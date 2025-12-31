const crypto = require('crypto');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const md5 = require('md5');
const path = require('path');
const cookieParser = require('cookie-parser');
const { inSeconds, getDateRange } = require('./services/helpers');
const checkLeaveOverlap = require('./services/leaveValidation');
const {
  ROLE,
  SCOPE_TYPES,
  buildPermissionSet,
  getScopeTypeFromRole,
  authorizeRoles,
  resolveScopeFromRequest,
  canAccessRecord
} = require('./services/authz');
require('dotenv').config();

const port = process.env.PORT || 3300;
app.use(bodyParser.json());
app.use(cookieParser());

const pool = mysql
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
  .promise();

// Use a dedicated pool for session storage to reduce contention with
// application transactions. Keeping session queries isolated helps
// prevent session write/read activity from being blocked by long
// running app transactions and reduces lock-wait occurrences.
const sessionPool = mysql
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    // smaller pool for session traffic
    connectionLimit: 5,
    queueLimit: 0
  })
  .promise();

const sessionStore = new MySQLStore(
  {
    // Recommended production options (tune as needed)
    expiration: 24 * 60 * 60 * 1000,
    createDatabaseTable: true,
    // how often to check and clear expired sessions (ms)
    checkExpirationInterval: 15 * 60 * 1000
  },
  sessionPool
);

// Helper function for leave calculations with new conversion rates
const calculateLeaveEquivalents = (short = 0, half = 0, casual = 0, medical = 0, without = 0, compensatory = 0, earned = 0) => {
  // Calculate total leave days based on new conversion rates:
  // Short leaves: 3 = 1 day (1 short = 0.333333 days)
  // Half day leaves: 2 = 1 day (1 half = 0.5 days)
  // Full day leaves: 1 = 1 day
  // Academic leaves are NOT included in total calculations
  
  const total = (short * 0.333333) + 
                (half * 0.5) + 
                (casual * 1) + 
                (medical * 1) + 
                (without * 1) + 
                (compensatory * 1) + 
                (earned * 1);
  
  return parseFloat(total.toFixed(2));
};

// Add this middleware to create tab-specific sessions
app.use((req, res, next) => {
  // Respect client-provided per-tab identifier sent via header `X-Tab-Id`.
  // This allows the browser to keep a stable per-tab id (stored in sessionStorage)
  // and the server can map tab-specific user state under `req.session.tabs[tabId]`.
  const incomingTabId = req.get('X-Tab-Id') || req.get('x-tab-id');
  if (incomingTabId) {
    req.tabId = incomingTabId;
  } else {
    // Fallback: generate a temporary tab id (will be replaced when client provides one)
    const tabIdSeed = (req.headers['user-agent'] || '') + (req.ip || '') + Date.now();
    req.tabId = crypto.createHash('md5').update(tabIdSeed).digest('hex');
  }

  // If session exists and doesn't have tab data, initialize it (guard against missing session)
  if (req.session && !req.session.tabs) {
    req.session.tabs = {};
  }

  next();
});

app.use((req, res, next) => {
  // Force cookie path for all responses
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});


// SESSION MIDDLEWARE FIRST
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 86400000,
      sameSite: 'lax'
    },
    name: 'leave_mgmt_sid'
  })
);

// Add this after session middleware (around line 140)
app.use((req, res, next) => {
  // Prevent caching for HTML files and dashboard
  if (req.path.includes('.html') || req.path === '/leave_mgmt/dashboard') {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Vary': 'Cookie'
    });
  }
  next();
});

// TAB MIDDLEWARE SECOND (AFTER session)
app.use((req, res, next) => {
  // If client sent a stable per-tab id, prefer it. Otherwise keep existing req.tabId
  const incomingTabId = req.get('X-Tab-Id') || req.get('x-tab-id');
  if (incomingTabId) req.tabId = incomingTabId;

  if (req.session && !req.session.tabs) {
    req.session.tabs = {};
  }

  next();
});

// Serve static files but exclude HTML files from direct access
app.use("/leave_mgmt", express.static(path.join(__dirname, "public"), { 
  maxAge: 0,
  // Don't serve HTML files directly - they'll be handled by the route above
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

const authenticateSession = (req, res, next) => {
  // First check if session exists
  if (!req.session) {
    return res.status(401).json({ error: 'No session found. Please log in.' });
  }

  // Initialize tabs if not present
  if (!req.session.tabs) {
    req.session.tabs = {};
  }

  // Try to get tab-specific user first (preferred)
  if (req.session.tabs[req.tabId]) {
    req.session.user = req.session.tabs[req.tabId];
    return next();
  }

  // Fallback: If no tab-specific user exists, try to use session.user
  // This allows initial requests before tabClient.js injects the header
  if (req.session.user) {
    // Store it in tabs so future requests use it
    req.session.tabs[req.tabId] = req.session.user;
    return next();
  }

  // No user found at all
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

exports.authenticateSession = authenticateSession;

const verifyPermission = (permissionKey) => (req, res, next) => {
  const hasPermission = req.session.user?.permissions?.[permissionKey];
  if (!hasPermission) {
    return res
      .status(403)
      .json({ error: 'You are not allowed to perform this action.' });
  }
  return next();
};

const logActivity = async (user, action, entityType, entityId, meta = {}) => {
  if (!user) return;
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, meta_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.id,
        action,
        entityType || null,
        entityId ? String(entityId) : null,
        JSON.stringify(meta || {})
      ]
    );
  } catch (err) {
    console.error('Failed to log activity', err);
  }
};

const handleScopeResolution = (req, res, options = {}) => {
  try {
    return resolveScopeFromRequest(req, options);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return null;
  }
};

const resolveUserScope = (user) => {
  if (!user) return null;

  if (user.scopeType && user.scopeType !== SCOPE_TYPES.GLOBAL) {
    const scopeId =
      user.scopeType === SCOPE_TYPES.DEPARTMENT
        ? user.departmentId
        : user.hostelId;
    const scopeName =
      user.scopeType === SCOPE_TYPES.DEPARTMENT
        ? user.departmentName
        : user.hostelName;
    return {
      type: user.scopeType,
      id: scopeId,
      name: scopeName
    };
  }

  // For global users, return null to indicate they need to select a scope
  return null;
};

const getScopeCondition = (scope, alias = 'faculty') => {
  if (!scope) return { clause: '1=1', value: null };
  if (scope.type === SCOPE_TYPES.DEPARTMENT) {
    return { clause: `${alias}.department_id = ?`, value: scope.id };
  }
  if (scope.type === SCOPE_TYPES.HOSTEL) {
    return { clause: `${alias}.hostel_id = ?`, value: scope.id };
  }
  return { clause: '1=1', value: null };
};

const fetchFacultyRecord = async (facultyId) => {
  const [[facultyRecord]] = await pool.query(
    `SELECT id, faculty_name, designation, department_id, hostel_id, member_type,
            granted_leaves, remaining_leaves, total_leaves,
            short_leaves_granted, short_leaves_remaining,
            half_day_leaves_granted, half_day_leaves_remaining,
            casual_leaves_granted, casual_leaves_remaining,
            medical_leaves_granted, medical_leaves_remaining,
            without_payment_leaves_granted, without_payment_leaves_remaining,
            compensatory_leaves_granted, compensatory_leaves_remaining,
            earned_leaves_granted, earned_leaves_remaining,
            academic_leaves_granted, academic_leaves_remaining,
            year_of_joining, employment_type, remark, is_teaching
     FROM faculty WHERE id = ?`,
    [facultyId]
  );
  return facultyRecord;
};

const enforceFacultyScope = async (req, res, facultyId) => {
  const faculty = await fetchFacultyRecord(facultyId);
  if (!faculty) {
    res.status(404).json({ error: 'Faculty not found' });
    return null;
  }
  if (!canAccessRecord(req.session.user, faculty)) {
    res.status(403).json({ error: 'You cannot access this record.' });
    return null;
  }
  return faculty;
};

app.get("/leave_mgmt/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post('/leave_mgmt/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const hashedPassword = md5(password);
    const [users] = await pool.query(
      `SELECT u.*, d.department_name, h.hostel_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.department_id
       LEFT JOIN hostels h ON u.hostel_id = h.hostel_id
       WHERE u.username = ? AND u.password = ? AND u.status = 'active'`,
      [username, hashedPassword]
    );

    if (users.length === 0) {
      pool
        .query(
          `INSERT INTO activity_logs (actor_id, action, entity_type, meta_json)
         VALUES (NULL, 'FAILED_LOGIN', 'user', ?)`,
          [
            JSON.stringify({
              attempted_username: username,
              ip_address: req.ip,
              user_agent: req.headers['user-agent']
            })
          ]
        )
        .catch((err) => console.error('Failed to log failed login', err));

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Preserve existing tabs mapping (if any) so other tabs remain logged-in after session regeneration
    const existingTabs =
      req.session && req.session.tabs ? { ...req.session.tabs } : {};

    // Generate unique session for this tab (preserving other tabs mapping)
    req.session.regenerate(async function (err) {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      const scopeType = getScopeTypeFromRole(user.role) || SCOPE_TYPES.GLOBAL;
      const scopeName =
        scopeType === SCOPE_TYPES.DEPARTMENT
          ? user.department_name
          : scopeType === SCOPE_TYPES.HOSTEL
            ? user.hostel_name
            : 'Institution';

      const sessionPayload = {
        id: user.id,
        username: user.username,
        role: user.role,
        departmentId: user.department_id,
        departmentName: user.department_name,
        hostelId: user.hostel_id,
        hostelName: user.hostel_name,
        scopeType,
        permissions: buildPermissionSet(user.role),
        scope: resolveUserScope({
          scopeType,
          departmentId: user.department_id,
          departmentName: user.department_name,
          hostelId: user.hostel_id,
          hostelName: user.hostel_name
        })
      };

      // Restore any previously stored tabs (so other tabs keep their identity)
      req.session.tabs = existingTabs;
      // Store tab-specific user data for this tab
      req.session.tabs[req.tabId] = sessionPayload;

      // Also store current user for compatibility (fallback for code expecting req.session.user)
      req.session.user = sessionPayload;

      req.session.save(function (err) {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ error: 'Session error' });
        }

        // Log successful login
        pool
          .query(
            `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, meta_json)
           VALUES (?, ?, ?, ?, ?)`,
            [
              user.id,
              'LOGIN',
              'user',
              user.id,
              JSON.stringify({
                username: user.username,
                role: user.role,
                scopeType,
                scopeName,
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
                tabId: req.tabId
              })
            ]
          )
          .catch((err) => console.error('Failed to log login', err));

        res.json({
          message: 'Login successful',
          role: user.role,
          scopeType,
          scopeName,
          departmentName: user.department_name,
          hostelName: user.hostel_name,
          permissions: sessionPayload.permissions,
          tabId: req.tabId // Send tab ID to frontend
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/leave_mgmt/logout', (req, res) => {
  const user = req.session?.user;
  const tabId = req.tabId;

  if (user) {
    pool
      .query(
        `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, meta_json)
       VALUES (?, ?, ?, ?, ?)`,
        [
          user.id,
          'LOGOUT',
          'user',
          user.id,
          JSON.stringify({
            username: user.username,
            role: user.role,
            tabId
          })
        ]
      )
      .catch((err) => console.error('Failed to log logout activity', err));
  }

  // Remove this tab's data
  if (req.session.tabs && req.session.tabs[tabId]) {
    delete req.session.tabs[tabId];
  }

  // If no tabs left, destroy session
  if (!req.session.tabs || Object.keys(req.session.tabs).length === 0) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.clearCookie('leave_mgmt_sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
      res.json({ message: 'Logout successful' });
    });
  } else {
    // Keep session for other tabs
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Tab logged out successfully' });
    });
  }
});

app.get('/leave_mgmt/context', authenticateSession, (req, res) => {
  res.json({ user: req.session.user });
});

// Redirect direct HTML access to proper dashboard based on role
app.get('/leave_mgmt/*.html', authenticateSession, (req, res) => {
  const requestedFile = req.path.split('/').pop();
  const user = req.session.user;
  
  // Allow direct access only if role matches the dashboard
  const roleFileMap = {
    'superadmin.html': ROLE.SUPERADMIN,
    'establishment.html': ROLE.ESTABLISHMENT_ADMIN,
    'principal.html': ROLE.PRINCIPAL_ADMIN,
    'main.html': [ROLE.DEPARTMENT_ADMIN, ROLE.HOSTEL_ADMIN, ROLE.DEPARTMENT_STAFF, ROLE.HOSTEL_STAFF]
  };
  
  // Check if user can access the requested file
  let canAccess = false;
  
  if (roleFileMap[requestedFile]) {
    if (Array.isArray(roleFileMap[requestedFile])) {
      canAccess = roleFileMap[requestedFile].includes(user.role);
    } else {
      canAccess = user.role === roleFileMap[requestedFile];
    }
  }
  
  if (canAccess) {
    // Serve the requested file directly
    return res.sendFile(path.join(__dirname, 'public', requestedFile));
  } else {
    // Redirect to proper dashboard based on role
    console.log(`Redirecting ${user.role} from ${requestedFile} to proper dashboard`);
    
    if (user.role === ROLE.SUPERADMIN) {
      return res.redirect('/leave_mgmt/superadmin.html');
    } else if (user.role === ROLE.ESTABLISHMENT_ADMIN) {
      return res.redirect('/leave_mgmt/establishment.html');
    } else if (user.role === ROLE.PRINCIPAL_ADMIN) {
      return res.redirect('/leave_mgmt/principal.html');
    } else {
      return res.redirect('/leave_mgmt/main.html');
    }
  }
});

// Unified dashboard routing - serve correct dashboard based on role
app.get('/leave_mgmt/dashboard', authenticateSession, (req, res) => {
  const user = req.session.user;

  // Set aggressive cache-busting headers to prevent stale content
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Vary': 'Cookie',
    'ETag': 'W/"' + Date.now() + '"',
    'Last-Modified': new Date().toUTCString()
  });

  try {
    console.log('Dashboard access - User role:', user.role); // Debug log
    
    if (user.role === ROLE.SUPERADMIN) {
      console.log('Redirecting to superadmin.html');
      return res.sendFile(path.join(__dirname, 'public', 'superadmin.html'));
    }

    if (user.role === ROLE.ESTABLISHMENT_ADMIN) {
      console.log('Redirecting to establishment.html');
      return res.sendFile(
        path.join(__dirname, 'public', 'establishment.html')
      );
    }

    if (user.role === ROLE.PRINCIPAL_ADMIN) {
      console.log('Redirecting to principal.html');
      return res.sendFile(path.join(__dirname, 'public', 'principal.html'));
    }

    // For other roles (department_admin, hostel_admin, etc.), serve the main dashboard
    console.log('Redirecting to main.html for role:', user.role);
    return res.sendFile(path.join(__dirname, 'public', 'main.html'));
  } catch (err) {
    console.error('Dashboard serving error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

app.get(
  '/leave_mgmt/metadata/scopes',
  authenticateSession,
  async (req, res) => {
    try {
      const [departments] = await pool.query(
        'SELECT department_id AS id, department_name AS name FROM departments ORDER BY department_name'
      );
      const [hostels] = await pool.query(
        'SELECT hostel_id AS id, hostel_name AS name FROM hostels ORDER BY hostel_name'
      );
      res.json({ departments, hostels });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch scopes.' });
    }
  }
);

app.get(
  '/leave_mgmt/all-users',
  authenticateSession,
  authorizeRoles(ROLE.DEPARTMENT_ADMIN, ROLE.HOSTEL_ADMIN),
  async (req, res) => {
    const scope = handleScopeResolution(req, res);
    if (!scope) return;
    const targetRole =
      scope.type === SCOPE_TYPES.DEPARTMENT
        ? ROLE.DEPARTMENT_STAFF
        : ROLE.HOSTEL_STAFF;
    const column =
      scope.type === SCOPE_TYPES.DEPARTMENT ? 'department_id' : 'hostel_id';

    try {
      const [rows] = await pool.query(
        `SELECT username, id FROM users WHERE ${column} = ? AND role = ? ORDER BY username`,
        [scope.id, targetRole]
      );
      res.json(rows);
    } catch (error) {
      console.error('An Error occurred: ', error);
      res.status(500).json({ error: 'Unable to fetch users.' });
    }
  }
);

app.post(
  '/leave_mgmt/add-user',
  authenticateSession,
  authorizeRoles(ROLE.DEPARTMENT_ADMIN, ROLE.HOSTEL_ADMIN),
  async (req, res) => {
    const { username, password } = req.body;
    const scope = handleScopeResolution(req, res);
    if (!scope) return;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
      const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [
        username
      ]);

      if (rows.length !== 0) {
        return res
          .status(400)
          .json({ error: 'Duplicate Entry, User already exists.' });
      }

      const targetRole =
        scope.type === SCOPE_TYPES.DEPARTMENT
          ? ROLE.DEPARTMENT_STAFF
          : ROLE.HOSTEL_STAFF;

      await pool.query(
        'INSERT INTO users(username, password, department_id, hostel_id, role) VALUES (?, md5(?), ?, ?, ?)',
        [
          username,
          password,
          scope.type === SCOPE_TYPES.DEPARTMENT ? scope.id : null,
          scope.type === SCOPE_TYPES.HOSTEL ? scope.id : null,
          targetRole
        ]
      );

      await logActivity(req.session.user, 'ADD_USER', 'user', username, scope);

      res
        .status(200)
        .json({ success: true, message: 'New user added successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to add new user' });
    }
  }
);

app.delete(
  '/leave_mgmt/delete-user/:username',
  authenticateSession,
  authorizeRoles(ROLE.DEPARTMENT_ADMIN, ROLE.HOSTEL_ADMIN),
  async (req, res) => {
    const { username } = req.params;
    const scope = handleScopeResolution(req, res);
    if (!scope) return;

    const column =
      scope.type === SCOPE_TYPES.DEPARTMENT ? 'department_id' : 'hostel_id';
    const targetRole =
      scope.type === SCOPE_TYPES.DEPARTMENT
        ? ROLE.DEPARTMENT_STAFF
        : ROLE.HOSTEL_STAFF;

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [result] = await connection.query(
        `DELETE FROM users WHERE username = ? AND ${column} = ? AND role = ?`,
        [username, scope.id, targetRole]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ error: 'User not found for this scope.' });
      }

      await connection.commit();
      await logActivity(
        req.session.user,
        'DELETE_USER',
        'user',
        username,
        scope
      );
      res.json({
        success: true,
        message: 'User deleted successfully.'
      });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error(err);
      res.status(500).json({ error: 'Failed to delete user.' });
    } finally {
      if (connection) connection.release();
    }
  }
);

app.get('/leave_mgmt/get-leaves', authenticateSession, async (req, res) => {
  const scope = handleScopeResolution(req, res, { allowNullForGlobal: false });
  if (!scope) return;

  const { clause, value } = getScopeCondition(scope);
  const params = value ? [value] : [];
  try {
    const [rows] = await pool.query(
      `
      SELECT
        faculty.id,
        faculty.faculty_name,
        faculty.designation,
        faculty.member_type,
        SUM(CASE WHEN leave_category = 'short_leaves' THEN 1 ELSE 0 END) AS short_leaves,
        SUM(CASE WHEN leave_category = 'half_day_leaves' THEN 1 ELSE 0 END) AS half_day_leaves,
        SUM(CASE WHEN leave_category = 'casual_leaves' THEN 1 ELSE 0 END) AS casual_leaves,
        SUM(CASE WHEN leave_category = 'academic_leaves' THEN 1 ELSE 0 END) AS academic_leaves,
        SUM(CASE WHEN leave_category = 'medical_leaves' THEN 1 ELSE 0 END) AS medical_leaves,
        SUM(CASE WHEN leave_category = 'compensatory_leaves' THEN 1 ELSE 0 END) AS compensatory_leaves,
        SUM(CASE WHEN leave_category = 'earned_leaves' THEN 1 ELSE 0 END) AS earned_leaves,
        SUM(CASE WHEN leave_category = 'without_payment_leaves' THEN 1 ELSE 0 END) AS without_payment_leaves,
        faculty.remaining_leaves,
        faculty.granted_leaves,
        faculty.total_leaves,
        faculty.short_leaves_granted, faculty.short_leaves_remaining,
        faculty.half_day_leaves_granted, faculty.half_day_leaves_remaining,
        faculty.casual_leaves_granted, faculty.casual_leaves_remaining,
        faculty.medical_leaves_granted, faculty.medical_leaves_remaining,
        faculty.without_payment_leaves_granted, faculty.without_payment_leaves_remaining,
        faculty.compensatory_leaves_granted, faculty.compensatory_leaves_remaining,
        faculty.earned_leaves_granted, faculty.earned_leaves_remaining,
        faculty.academic_leaves_granted, faculty.academic_leaves_remaining,
        faculty.year_of_joining, faculty.employment_type, faculty.remark, faculty.is_teaching,
        faculty.department_id, faculty.hostel_id
      FROM faculty
      LEFT JOIN leaves ON faculty.id = leaves.faculty_id
      WHERE ${clause}
      GROUP BY faculty.id
      ORDER BY faculty.id;
    `,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leave data' });
  }
});

// Route: Add leave
app.post("/leave_mgmt/add-leave", authenticateSession, async (req, res) => {
  const { faculty_id, leave_categoryArr, leave_date } = req.body;
  const [leave_category, secLeaveOption] = leave_categoryArr;

  const validLeaveCategories = [
    "short_leaves",
    "half_day_leaves",
    "casual_leaves",
    "academic_leaves",
    "medical_leaves",
    "compensatory_leaves",
    "remaining_leaves",
    "granted_leaves",
    "earned_leaves",
    "without_payment_leaves",
  ];

  if (!validLeaveCategories.includes(leave_category)) {
    return res.status(400).json({ error: "Invalid leave category" });
  }
  if (!faculty_id || !leave_category || !leave_date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let connection;

  let startDate, endDate;
  if (Array.isArray(leave_date) && leave_date.length === 2) {
    [startDate, endDate] = leave_date;
  } else {
    startDate = endDate = leave_date;
  }

  const leaveDates = getDateRange(startDate, endDate);
  if (leaveDates.length === 0)
    return res.status(400).json({ error: "Bad Request. Invalid date range!" });

  let facultyRecord;
  try {
    facultyRecord = await enforceFacultyScope(req, res, faculty_id);
    if (!facultyRecord) return;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch all leaves for the given dates
    const [allExistingLeaves] = await connection.query(
      `SELECT id, leave_category, faculty_id, DATE_FORMAT(leave_date, '%d-%m-%Y') AS formatted_date 
   FROM leaves 
   WHERE faculty_id = ? AND leave_date IN (?)`,
      [faculty_id, leaveDates]
    );

    const overlap = await checkLeaveOverlap(
      leaveDates,
      allExistingLeaves,
      connection,
      { leave_category, secLeaveOption }
    );

    if (overlap) {
      return res.status(overlap.status).json({ error: overlap.error });
    }

    // Helper to recompute global remaining_leaves (exclude academic) from per-type remaining columns
    const recomputeRemainingSql = `ROUND(
      (short_leaves_remaining) * 0.333333 + 
      (half_day_leaves_remaining) * 0.5 + 
      (casual_leaves_remaining) * 1 + 
      (medical_leaves_remaining) * 1 + 
      (without_payment_leaves_remaining) * 1 + 
      (compensatory_leaves_remaining) * 1 + 
      (earned_leaves_remaining) * 1, 
      2)`;

    // Add Leave
    // Fetch current per-type remaining counts to validate availability
    const [facultyRemainRows] = await connection.query(
      `SELECT short_leaves_remaining, half_day_leaves_remaining, casual_leaves_remaining, medical_leaves_remaining, without_payment_leaves_remaining, compensatory_leaves_remaining, earned_leaves_remaining, academic_leaves_remaining FROM faculty WHERE id = ?`,
      [faculty_id]
    );
    const currentRemain = facultyRemainRows[0] || {};

    if (leave_category === "short_leaves") {
      if (!secLeaveOption.fromTime || !secLeaveOption.toTime) {
        return res.status(400).json({ error: "Bad Request: Invalid Time" });
      }

      const fromTimeInSeconds = inSeconds(secLeaveOption.fromTime);
      const toTimeInSeconds = inSeconds(secLeaveOption.toTime);

      if (fromTimeInSeconds >= toTimeInSeconds) {
        return res.status(400).json({ error: "Bad Request, Invalid time." });
      }

      // Validate availability: need 1 short leave (counts as 1 short leave)
      if ((currentRemain.short_leaves_remaining || 0) < 1) {
        return res.status(400).json({ error: "Insufficient short leave balance" });
      }

      // Insert the leave record
      const [leaveResult] = await connection.query(
        `INSERT INTO leaves (faculty_id, leave_category, leave_date, department_id, hostel_id) VALUES (?, ?, ?, ?, ?);`,
        [faculty_id, leave_category, leave_date, facultyRecord.department_id, facultyRecord.hostel_id]
      );

      // Update Leave Details
      await connection.query(
        `INSERT INTO leave_details (leave_id, short_leave_from, short_leave_to) VALUES (?, ?, ?)`,
        [leaveResult.insertId, secLeaveOption.fromTime, secLeaveOption.toTime]
      );

      // Decrement per-type remaining (short) by 1 and recompute global remaining (exclude academic)
      await connection.query(
        `UPDATE faculty SET short_leaves_remaining = short_leaves_remaining - 1, remaining_leaves = ${recomputeRemainingSql} WHERE id = ?;`,
        [faculty_id]
      );

      await connection.commit();

      await logActivity(
        req.session.user,
        "ADD_SHORT_LEAVE",
        "leave",
        leaveResult.insertId,
        {
          faculty_id,
          faculty_name: facultyRecord.faculty_name,
          leave_category,
          leave_date,
          from_time: secLeaveOption.fromTime,
          to_time: secLeaveOption.toTime,
        }
      );

      // Return success with the inserted id
      return res.json({ status: "success", leaveId: leaveResult.insertId });
    } else if (leave_category === "half_day_leaves") {
      if (
        !(secLeaveOption === "before_noon") &&
        !(secLeaveOption === "after_noon")
      ) {
        return res
          .status(400)
          .json({ error: "Bad Request: Invalid Leave Option" });
      }
      // Validate availability: need 1 half-day leave (counts as 0.5 day)
      if ((currentRemain.half_day_leaves_remaining || 0) < 1) {
        return res.status(400).json({ error: "Insufficient half-day leave balance" });
      }

      const [leaveResult] = await connection.query(`INSERT INTO leaves (faculty_id, leave_category, leave_date, department_id, hostel_id) VALUES (?, ?, ?, ?, ?);`, [faculty_id, leave_category, leave_date, facultyRecord.department_id, facultyRecord.hostel_id]);

      // Insert leave Details
      await connection.query(`INSERT INTO leave_details (leave_id, half_leave_type) VALUES (?, ?)`, [leaveResult.insertId, secLeaveOption]);

      // Decrement per-type remaining (half_day) by 1 and recompute global remaining
      await connection.query(
        `UPDATE faculty SET half_day_leaves_remaining = half_day_leaves_remaining - 1, remaining_leaves = ${recomputeRemainingSql} WHERE id = ?;`,
        [faculty_id]
      );

      await connection.commit();

      await logActivity(req.session.user, "ADD_HALF_DAY_LEAVE", "leave", leaveResult.insertId, {
        faculty_id,
        faculty_name: facultyRecord.faculty_name,
        leave_category,
        leave_date,
        half_type: secLeaveOption,
      });

      return res.json({ status: "success", leaveId: leaveResult.insertId });
    } else if (leave_category === "granted_leaves") {
      if (!Number(secLeaveOption)) {
        return res.status(400).json({ error: "Bad Request: Invalid Value." });
      }
      await connection.query(
        `UPDATE faculty
        SET
          remaining_leaves = remaining_leaves + ?,
          granted_leaves = granted_leaves + ?
        WHERE id = ?
        `,
        [Number(secLeaveOption), Number(secLeaveOption), faculty_id]
      );

      await connection.commit();

      // Detailed logging for granted leaves update
      await logActivity(
        req.session.user,
        "UPDATE_GRANTED_LEAVES",
        "faculty",
        faculty_id,
        {
          faculty_name: facultyRecord.faculty_name,
          added_leaves: Number(secLeaveOption),
          new_remaining: facultyRecord.remaining_leaves + Number(secLeaveOption),
        }
      );

      return res.json({ status: "success" });
    } else if (leave_category === "casual_leaves") {
      const fromDate = new Date(leave_date[0]);
      const toDate = new Date(leave_date[1]);
      const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

      if (fromDate > toDate) {
        return res.status(400).json({ error: "Bad Request, Invalid Date range." });
      }

      // Validate availability
      if ((currentRemain.casual_leaves_remaining || 0) < days) {
        return res.status(400).json({ error: "Insufficient full day leave balance" });
      }

      const leaveInserts = [];
      for (let i = 0; i < days; i++) {
        const newLeaveDate = new Date(fromDate);
        newLeaveDate.setDate(fromDate.getDate() + i);

        leaveInserts.push(connection.query(`INSERT INTO leaves (faculty_id, leave_category, leave_date, department_id, hostel_id) VALUES (?, ?, ?, ?, ?);`, [faculty_id, leave_category, newLeaveDate, facultyRecord.department_id, facultyRecord.hostel_id]));
      }

      await Promise.all(leaveInserts);

      // Decrement casual remaining by days and recompute global remaining (exclude academic)
      await connection.query(
        `UPDATE faculty SET casual_leaves_remaining = casual_leaves_remaining - ?, remaining_leaves = ${recomputeRemainingSql} WHERE id = ?;`,
        [days, faculty_id]
      );

      await connection.commit();

      // Detailed logging for casual leaves (multiple inserted)
      await logActivity(req.session.user, "ADD_CASUAL_LEAVE", "leave", null, {
        faculty_id,
        faculty_name: facultyRecord.faculty_name,
        leave_category,
        from_date: leave_date[0],
        to_date: leave_date[1],
        days,
      });

      return res.json({ status: "success" });
    } else {
      // Handle other leave categories (medical, compensatory, earned, without_payment, academic)
      const fromDate = new Date(leave_date[0]);
      const toDate = new Date(leave_date[1]);
      const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

      if (fromDate > toDate) {
        return res.status(400).json({ error: "Bad Request, Invalid Date range." });
      }

      // Map category to remaining column
      const categoryToCol = {
        medical_leaves: 'medical_leaves_remaining',
        compensatory_leaves: 'compensatory_leaves_remaining',
        earned_leaves: 'earned_leaves_remaining',
        without_payment_leaves: 'without_payment_leaves_remaining',
        academic_leaves: 'academic_leaves_remaining'
      };

      const col = categoryToCol[leave_category];
      if (!col) {
        return res.status(400).json({ error: 'Unsupported leave category' });
      }

      // Validate availability for non-academic categories
      if (leave_category !== 'academic_leaves' && (currentRemain[col] || currentRemain[col] === 0) && (currentRemain[col] < days)) {
        return res.status(400).json({ error: `Insufficient ${leave_category} balance` });
      }

      const leaveInserts = [];
      for (let i = 0; i < days; i++) {
        const newLeaveDate = new Date(fromDate);
        newLeaveDate.setDate(fromDate.getDate() + i);
        leaveInserts.push(connection.query(`INSERT INTO leaves (faculty_id, leave_category, leave_date, department_id, hostel_id) VALUES (?, ?, ?, ?, ?);`, [faculty_id, leave_category, newLeaveDate, facultyRecord.department_id, facultyRecord.hostel_id]));
      }

      await Promise.all(leaveInserts);

      if (leave_category === 'academic_leaves') {
        // Decrement only the academic remaining counter, do not touch global remaining
        await connection.query(`UPDATE faculty SET academic_leaves_remaining = academic_leaves_remaining - ? WHERE id = ?;`, [days, faculty_id]);
      } else {
        // Decrement the specific remaining column by days and recompute global remaining
        // Build parameters with 'days' at the correct position for recomputeRemainingSql
        // Order: short, half, casual, medical, without, compensatory, earned
        const params = [0, 0, 0, 0, 0, 0, 0];
        if (col === 'medical_leaves_remaining') params[3] = days;
        else if (col === 'without_payment_leaves_remaining') params[4] = days;
        else if (col === 'compensatory_leaves_remaining') params[5] = days;
        else if (col === 'earned_leaves_remaining') params[6] = days;
        else if (col === 'casual_leaves_remaining') params[2] = days;
        else if (col === 'short_leaves_remaining') params[0] = days;
        else if (col === 'half_day_leaves_remaining') params[1] = days;

        // Prepend the decrement value for the specific column (used in SET ... = ... - ?).
        // For the generic query we pass the decrement as the first param and then the seven recompute params, followed by id.
        await connection.query(
          `UPDATE faculty SET ${col} = ${col} - ?, remaining_leaves = ${recomputeRemainingSql} WHERE id = ?;`,
          [days, faculty_id]
        );
      }

      await connection.commit();

      await logActivity(req.session.user, `ADD_${leave_category.toUpperCase()}`, "leave", null, {
        faculty_id,
        faculty_name: facultyRecord.faculty_name,
        leave_category,
        from_date: leave_date[0],
        to_date: leave_date[1],
        days,
      });

      return res.json({ status: "success" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to add leave" });
  } finally {
    if (connection) connection.release();
  }
});

// Find the /leave_mgmt/add-faculty endpoint in server.js
app.post(
  "/leave_mgmt/add-faculty",
  authenticateSession,
  verifyPermission("canManageFaculty"),
  async (req, res) => {
    const {
      faculty_name,
      designation,
      granted_leaves = 0,
      member_type = "faculty",
      department_id,    // From request body
      hostel_id        // From request body
    } = req.body;
    
    if (!faculty_name || !designation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = req.session.user;
    let departmentId = null;
    let hostelId = null;
    let scopeName = "Unknown";

    // Handle scope based on user role
    if (user.role === ROLE.ESTABLISHMENT_ADMIN || user.role === ROLE.SUPERADMIN) {
      // For establishment admin and superadmin, use scope from request body
      if (department_id) {
        departmentId = parseInt(department_id);
        hostelId = null;
        
        // Get department name for logging
        const [dept] = await pool.query(
          "SELECT department_name FROM departments WHERE department_id = ?",
          [departmentId]
        );
        scopeName = dept[0]?.department_name || `Department ${departmentId}`;
      } else if (hostel_id) {
        hostelId = parseInt(hostel_id);
        departmentId = null;
        
        // Get hostel name for logging
        const [hostel] = await pool.query(
          "SELECT hostel_name FROM hostels WHERE hostel_id = ?",
          [hostelId]
        );
        scopeName = hostel[0]?.hostel_name || `Hostel ${hostelId}`;
      } else {
        return res.status(400).json({ 
          error: "Scope selection required for this action. Please select a department or hostel." 
        });
      }
    } else {
      // For other roles (department/hostel admins), use scope from session
      const scope = handleScopeResolution(req, res, {
        allowNullForGlobal: false,
      });
      if (!scope) return;
      
      if (scope.type === SCOPE_TYPES.DEPARTMENT) {
        departmentId = scope.id;
        hostelId = null;
        scopeName = scope.name || `Department ${departmentId}`;
      } else if (scope.type === SCOPE_TYPES.HOSTEL) {
        hostelId = scope.id;
        departmentId = null;
        scopeName = scope.name || `Hostel ${hostelId}`;
      }
    }

    try {
      // Parse per-type granted values from request (defaults to 0)
      const s_gr = parseFloat(req.body.short_leaves_granted) || 0;
      const h_gr = parseFloat(req.body.half_day_leaves_granted) || 0;
      const c_gr = parseFloat(req.body.casual_leaves_granted) || 0;
      const m_gr = parseFloat(req.body.medical_leaves_granted) || 0;
      const w_gr = parseFloat(req.body.without_payment_leaves_granted) || 0;
      const comp_gr = parseFloat(req.body.compensatory_leaves_granted) || 0;
      const e_gr = parseFloat(req.body.earned_leaves_granted) || 0;
      const a_gr = parseFloat(req.body.academic_leaves_granted) || 0;

      // Calculate total leaves using new conversion rates (exclude academic)
      const totalLeaves = calculateLeaveEquivalents(
        s_gr,    // short leaves granted
        h_gr,    // half day leaves granted
        c_gr,    // casual leaves granted
        m_gr,    // medical leaves granted
        w_gr,    // without payment leaves granted
        comp_gr, // compensatory leaves granted
        e_gr     // earned leaves granted
      );

      // Insert record with per-type columns and metadata
      await pool.query(
        `
        INSERT INTO faculty (
          faculty_name,
          designation,
          member_type,
          granted_leaves,
          remaining_leaves,
          total_leaves,
          short_leaves_granted, short_leaves_remaining,
          half_day_leaves_granted, half_day_leaves_remaining,
          casual_leaves_granted, casual_leaves_remaining,
          medical_leaves_granted, medical_leaves_remaining,
          without_payment_leaves_granted, without_payment_leaves_remaining,
          compensatory_leaves_granted, compensatory_leaves_remaining,
          earned_leaves_granted, earned_leaves_remaining,
          academic_leaves_granted, academic_leaves_remaining,
          year_of_joining, employment_type, remark, is_teaching,
          department_id, hostel_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
        [
          faculty_name,
          designation,
          member_type,
          totalLeaves,
          totalLeaves,
          totalLeaves,
          s_gr, s_gr,
          h_gr, h_gr,
          c_gr, c_gr,
          m_gr, m_gr,
          w_gr, w_gr,
          comp_gr, comp_gr,
          e_gr, e_gr,
          a_gr, a_gr,
          req.body.year_of_joining || null,
          req.body.employment_type || null,
          req.body.remark || null,
          req.body.is_teaching ? 1 : 0,
          departmentId,
          hostelId,
        ]
      );
      
      await logActivity(
        req.session.user,
        "ADD_FACULTY",
        "faculty",
        faculty_name,
        {
          faculty_name,
          designation,
          member_type,
          total_leaves: totalLeaves,
          scope: scopeName
        }
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add faculty" });
    }
  }
);

// Get all faculty across all departments (for establishment admin)
app.get(
  "/leave_mgmt/all-faculty",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [faculty] = await pool.query(
        `SELECT 
          f.id,
          f.faculty_name,
          f.designation,
          f.member_type,
          f.granted_leaves,
          f.remaining_leaves,
          f.total_leaves,
          f.short_leaves_granted, f.short_leaves_remaining,
          f.half_day_leaves_granted, f.half_day_leaves_remaining,
          f.casual_leaves_granted, f.casual_leaves_remaining,
          f.medical_leaves_granted, f.medical_leaves_remaining,
          f.compensatory_leaves_granted, f.compensatory_leaves_remaining,
          f.earned_leaves_granted, f.earned_leaves_remaining,
          f.without_payment_leaves_granted, f.without_payment_leaves_remaining,
          f.academic_leaves_granted, f.academic_leaves_remaining,
          f.year_of_joining, f.employment_type, f.remark, f.is_teaching,
          d.department_name,
          h.hostel_name,
          f.department_id,
          f.hostel_id
        FROM faculty f
        LEFT JOIN departments d ON f.department_id = d.department_id
        LEFT JOIN hostels h ON f.hostel_id = h.hostel_id
        ORDER BY f.member_type, f.faculty_name`
      );
      res.json(faculty);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch all faculty" });
    }
  }
);

// Get detailed attendance stats for principal admin
app.get(
  "/leave_mgmt/detailed-stats",
  authenticateSession,
  authorizeRoles(ROLE.PRINCIPAL_ADMIN, ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    
    try {
      // Department stats with HoD information
      const [deptStats] = await pool.query(
        `
        SELECT 
          d.department_id,
          d.department_name,
          COUNT(DISTINCT f.id) AS total_faculty,
          SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS absent_today,
          (SELECT faculty_name FROM faculty 
           WHERE department_id = d.department_id 
           ORDER BY designation LIKE '%Professor%' DESC, id ASC 
           LIMIT 1) AS hod_name
        FROM departments d
        LEFT JOIN faculty f ON f.department_id = d.department_id AND f.member_type = 'faculty'
        LEFT JOIN leaves l ON l.faculty_id = f.id AND l.leave_date = ?
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
        `,
        [date]
      );

      // Hostel stats
      const [hostelStats] = await pool.query(
        `
        SELECT 
          h.hostel_id,
          h.hostel_name,
          COUNT(DISTINCT f.id) AS total_staff,
          SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS absent_today
        FROM hostels h
        LEFT JOIN faculty f ON f.hostel_id = h.hostel_id AND f.member_type = 'staff'
        LEFT JOIN leaves l ON l.faculty_id = f.id AND l.leave_date = ?
        GROUP BY h.hostel_id, h.hostel_name
        ORDER BY h.hostel_name
        `,
        [date]
      );

      // Monthly absenteeism average
      const [monthlyStats] = await pool.query(
        `
        SELECT 
          d.department_id,
          d.department_name,
          COUNT(DISTINCT f.id) AS total_faculty,
          COUNT(DISTINCT l.faculty_id) AS total_absent,
          ROUND((COUNT(DISTINCT l.faculty_id) / COUNT(DISTINCT f.id) * 100), 1) AS absenteeism_rate
        FROM departments d
        LEFT JOIN faculty f ON f.department_id = d.department_id AND f.member_type = 'faculty'
        LEFT JOIN leaves l ON l.faculty_id = f.id 
          AND l.leave_date >= DATE_SUB(?, INTERVAL 30 DAY)
          AND l.leave_date <= ?
        GROUP BY d.department_id, d.department_name
        `,
        [date, date]
      );

      res.json({
        date,
        departments: deptStats.map(dept => ({
          id: dept.department_id,
          name: dept.department_name,
          total: dept.total_faculty,
          absent: dept.absent_today,
          present: (dept.total_faculty || 0) - (dept.absent_today || 0),
          hod: dept.hod_name || "Not assigned",
          absenteeism: monthlyStats.find(m => m.department_id === dept.department_id)?.absenteeism_rate || 0
        })),
        hostels: hostelStats.map(hostel => ({
          id: hostel.hostel_id,
          name: hostel.hostel_name,
          total: hostel.total_staff,
          absent: hostel.absent_today,
          present: (hostel.total_staff || 0) - (hostel.absent_today || 0)
        }))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch detailed stats" });
    }
  }
);

// Update faculty details (for establishment admin)
// New endpoint for editing leaves only
app.patch(
  "/leave_mgmt/faculty/:id/leaves",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { id } = req.params;
    const {
      short_leaves_granted,
      half_day_leaves_granted,
      casual_leaves_granted,
      medical_leaves_granted,
      without_payment_leaves_granted,
      compensatory_leaves_granted,
      earned_leaves_granted,
      academic_leaves_granted
    } = req.body;

    try {
      // Check if faculty exists
      const [faculty] = await pool.query("SELECT * FROM faculty WHERE id = ?", [id]);
      if (faculty.length === 0) {
        return res.status(404).json({ error: "Faculty not found" });
      }

      const s_gr = parseFloat(short_leaves_granted) || 0;
      const h_gr = parseFloat(half_day_leaves_granted) || 0;
      const c_gr = parseFloat(casual_leaves_granted) || 0;
      const m_gr = parseFloat(medical_leaves_granted) || 0;
      const w_gr = parseFloat(without_payment_leaves_granted) || 0;
      const comp_gr = parseFloat(compensatory_leaves_granted) || 0;
      const e_gr = parseFloat(earned_leaves_granted) || 0;
      const a_gr = parseFloat(academic_leaves_granted) || 0;

      // Get current remaining values
      const currentFac = faculty[0];
      const short_rem = parseFloat(currentFac.short_leaves_remaining || 0);
      const half_rem = parseFloat(currentFac.half_day_leaves_remaining || 0);
      const casual_rem = parseFloat(currentFac.casual_leaves_remaining || 0);
      const medical_rem = parseFloat(currentFac.medical_leaves_remaining || 0);
      const w_rem = parseFloat(currentFac.without_payment_leaves_remaining || 0);
      const comp_rem = parseFloat(currentFac.compensatory_leaves_remaining || 0);
      const e_rem = parseFloat(currentFac.earned_leaves_remaining || 0);
      const a_rem = parseFloat(currentFac.academic_leaves_remaining || 0);

      // Calculate difference and adjust remaining
      const short_diff = s_gr - parseFloat(currentFac.short_leaves_granted || 0);
      const half_diff = h_gr - parseFloat(currentFac.half_day_leaves_granted || 0);
      const casual_diff = c_gr - parseFloat(currentFac.casual_leaves_granted || 0);
      const medical_diff = m_gr - parseFloat(currentFac.medical_leaves_granted || 0);
      const w_diff = w_gr - parseFloat(currentFac.without_payment_leaves_granted || 0);
      const comp_diff = comp_gr - parseFloat(currentFac.compensatory_leaves_granted || 0);
      const e_diff = e_gr - parseFloat(currentFac.earned_leaves_granted || 0);
      const a_diff = a_gr - parseFloat(currentFac.academic_leaves_granted || 0);

      // Update remaining by the difference (only granted changes, remaining adjusts accordingly)
      const new_short_rem = short_rem + short_diff;
      const new_half_rem = half_rem + half_diff;
      const new_casual_rem = casual_rem + casual_diff;
      const new_medical_rem = medical_rem + medical_diff;
      const new_w_rem = w_rem + w_diff;
      const new_comp_rem = comp_rem + comp_diff;
      const new_e_rem = e_rem + e_diff;
      const new_a_rem = a_rem + a_diff;

      // Recompute aggregate totals using new conversion rates (exclude academic)
      const totalLeaves = calculateLeaveEquivalents(
        s_gr,    // short leaves granted
        h_gr,    // half day leaves granted
        c_gr,    // casual leaves granted
        m_gr,    // medical leaves granted
        w_gr,    // without payment leaves granted
        comp_gr, // compensatory leaves granted
        e_gr     // earned leaves granted
      );
      
      const new_remaining_leaves = calculateLeaveEquivalents(
        new_short_rem,  // short leaves remaining
        new_half_rem,   // half day leaves remaining
        new_casual_rem, // casual leaves remaining
        new_medical_rem, // medical leaves remaining
        new_w_rem,      // without payment leaves remaining
        new_comp_rem,   // compensatory leaves remaining
        new_e_rem       // earned leaves remaining
      );

      await pool.query(
        `UPDATE faculty SET 
          short_leaves_granted = ?, short_leaves_remaining = ?,
          half_day_leaves_granted = ?, half_day_leaves_remaining = ?,
          casual_leaves_granted = ?, casual_leaves_remaining = ?,
          medical_leaves_granted = ?, medical_leaves_remaining = ?,
          without_payment_leaves_granted = ?, without_payment_leaves_remaining = ?,
          compensatory_leaves_granted = ?, compensatory_leaves_remaining = ?,
          earned_leaves_granted = ?, earned_leaves_remaining = ?,
          academic_leaves_granted = ?, academic_leaves_remaining = ?,
          granted_leaves = ?, remaining_leaves = ?, total_leaves = ?
        WHERE id = ?`,
        [
          s_gr, new_short_rem,
          h_gr, new_half_rem,
          c_gr, new_casual_rem,
          m_gr, new_medical_rem,
          w_gr, new_w_rem,
          comp_gr, new_comp_rem,
          e_gr, new_e_rem,
          a_gr, new_a_rem,
          totalLeaves, new_remaining_leaves, totalLeaves,
          id
        ]
      );

      await logActivity(
        req.session.user,
        "UPDATE_FACULTY_LEAVES",
        "faculty",
        id,
        {
          ...req.body,
          total_leaves: totalLeaves,
          new_remaining: new_remaining_leaves
        }
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update faculty leaves" });
    }
  }
);

app.patch(
  "/leave_mgmt/faculty/:id/details",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
      const { id } = req.params;
      // Accept legacy and per-type fields plus metadata
      const {
        faculty_name,
        designation,
        department_id,
        hostel_id,
        granted_leaves,
        short_leaves_granted,
        half_day_leaves_granted,
        casual_leaves_granted,
        medical_leaves_granted,
        without_payment_leaves_granted,
        compensatory_leaves_granted,
        earned_leaves_granted,
        academic_leaves_granted,
        year_of_joining,
        employment_type,
        remark,
        is_teaching,
        member_type
      } = req.body;

      try {
        // Check if faculty exists
        const [faculty] = await pool.query("SELECT * FROM faculty WHERE id = ?", [id]);
        if (faculty.length === 0) {
          return res.status(404).json({ error: "Faculty not found" });
        }

        const updates = [];
        const values = [];

        if (faculty_name !== undefined) {
          updates.push("faculty_name = ?");
          values.push(faculty_name);
        }
        if (designation !== undefined) {
          updates.push("designation = ?");
          values.push(designation);
        }
        if (department_id !== undefined) {
          updates.push("department_id = ?");
          values.push(department_id || null);
        }
        if (hostel_id !== undefined) {
          updates.push("hostel_id = ?");
          values.push(hostel_id || null);
        }
        if (member_type !== undefined) {
          updates.push("member_type = ?");
          values.push(member_type);
        }

        // If per-type granted values provided, update those and recompute totals
        const providedAnyPerType = [short_leaves_granted, half_day_leaves_granted, casual_leaves_granted,
          medical_leaves_granted, without_payment_leaves_granted, compensatory_leaves_granted, earned_leaves_granted, academic_leaves_granted]
          .some(v => v !== undefined);

        if (providedAnyPerType) {
          const s_gr = parseFloat(short_leaves_granted) || 0;
          const h_gr = parseFloat(half_day_leaves_granted) || 0;
          const c_gr = parseFloat(casual_leaves_granted) || 0;
          const m_gr = parseFloat(medical_leaves_granted) || 0;
          const w_gr = parseFloat(without_payment_leaves_granted) || 0;
          const comp_gr = parseFloat(compensatory_leaves_granted) || 0;
          const e_gr = parseFloat(earned_leaves_granted) || 0;
          const a_gr = parseFloat(academic_leaves_granted) || 0;

          // Update per-type granted and remaining (do not change remaining automatically later if you want separate flow)
          updates.push("short_leaves_granted = ?", "short_leaves_remaining = ?");
          values.push(s_gr, s_gr);
          updates.push("half_day_leaves_granted = ?", "half_day_leaves_remaining = ?");
          values.push(h_gr, h_gr);
          updates.push("casual_leaves_granted = ?", "casual_leaves_remaining = ?");
          values.push(c_gr, c_gr);
          updates.push("medical_leaves_granted = ?", "medical_leaves_remaining = ?");
          values.push(m_gr, m_gr);
          updates.push("without_payment_leaves_granted = ?", "without_payment_leaves_remaining = ?");
          values.push(w_gr, w_gr);
          updates.push("compensatory_leaves_granted = ?", "compensatory_leaves_remaining = ?");
          values.push(comp_gr, comp_gr);
          updates.push("earned_leaves_granted = ?", "earned_leaves_remaining = ?");
          values.push(e_gr, e_gr);
          updates.push("academic_leaves_granted = ?", "academic_leaves_remaining = ?");
          values.push(a_gr, a_gr);

          // Recompute aggregate totals using new conversion rates (exclude academic)
          const totalLeaves = calculateLeaveEquivalents(
            s_gr,    // short leaves granted
            h_gr,    // half day leaves granted
            c_gr,    // casual leaves granted
            m_gr,    // medical leaves granted
            w_gr,    // without payment leaves granted
            comp_gr, // compensatory leaves granted
            e_gr     // earned leaves granted
          );
          
          updates.push("granted_leaves = ?", "remaining_leaves = ?", "total_leaves = ?");
          values.push(totalLeaves, totalLeaves, totalLeaves);
        } else if (granted_leaves !== undefined) {
          // Legacy single granted_leaves field
          const g = parseFloat(granted_leaves) || 0;
          updates.push("granted_leaves = ?", "remaining_leaves = ?", "total_leaves = ?");
          values.push(g, g, g);
        }

        if (year_of_joining !== undefined) {
          updates.push("year_of_joining = ?");
          values.push(year_of_joining || null);
        }
        if (employment_type !== undefined) {
          updates.push("employment_type = ?");
          values.push(employment_type || null);
        }
        if (remark !== undefined) {
          updates.push("remark = ?");
          values.push(remark || null);
        }
        if (is_teaching !== undefined) {
          updates.push("is_teaching = ?");
          values.push(is_teaching ? 1 : 0);
        }

        if (updates.length === 0) {
          return res.status(400).json({ error: "No updates provided" });
        }

        values.push(id);

        await pool.query(
          `UPDATE faculty SET ${updates.join(", ")} WHERE id = ?`,
          values
        );

        await logActivity(
          req.session.user,
          "UPDATE_FACULTY_DETAILS",
          "faculty",
          id,
          req.body
        );

        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update faculty" });
      }
  }
);

app.get(
  "/leave_mgmt/faculty-suggestions",
  authenticateSession,
  async (req, res) => {
    const { search = "" } = req.query;
    const scope = handleScopeResolution(req, res, { allowNullForGlobal: false });
    if (!scope) return;

    const column =
      scope.type === SCOPE_TYPES.DEPARTMENT ? "department_id" : "hostel_id";

    try {
      const [rows] = await pool.query(
        `
        SELECT id, faculty_name, designation 
        FROM faculty
        WHERE ${column} = ?
          AND CONCAT(faculty_name, ' (', designation, ')') LIKE ?
        ORDER BY designation, faculty_name;
      `,
        [scope.id, `%${search}%`]
      );

      const suggestions = rows.map((faculty) => ({
        id: faculty.id,
        display: `${faculty.faculty_name} (${faculty.designation})`,
      }));

      res.json(suggestions);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch faculty suggestions" });
    }
  }
);

// Route: Delete faculty and related records
app.delete(
  "/leave_mgmt/delete-faculty/:id",
  authenticateSession,
  verifyPermission("canManageFaculty"),
  async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
      const faculty = await enforceFacultyScope(req, res, id);
      if (!faculty) return;

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Delete from `leaves` table
      await connection.query("DELETE FROM leaves WHERE faculty_id = ?", [id]);

      // Delete from `faculty` table
      await connection.query("DELETE FROM faculty WHERE id = ?", [id]);

      await connection.commit();
      await logActivity(req.session.user, "DELETE_FACULTY", "faculty", id, {
        faculty_name: faculty.faculty_name,
      });
      res.json({
        success: true,
        message: "Faculty and related records deleted successfully.",
      });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error(err);
      res.status(500).json({ error: "Failed to delete faculty." });
    } finally {
      if (connection) connection.release();
    }
  }
);

// Serve leave details page
app.get(
  "/leave_mgmt/leave-details/:id",
  authenticateSession,
  async (req, res) => {
    const { id } = req.params;
    try {
      const faculty = await enforceFacultyScope(req, res, id);
      if (!faculty) return;
      res.sendFile(path.join(__dirname, "public", "leaveDetails.html"));
    } catch (err) {
      console.error(err);
      res.status(500).send("Error retrieving leave details");
    }
  }
);

app.get(
  "/leave_mgmt/leave-details-data/:id",
  authenticateSession,
  async (req, res) => {
    const { id } = req.params;
    try {
      const faculty = await enforceFacultyScope(req, res, id);
      if (!faculty) return;

      const [leaveRows] = await pool.query(
        `
        SELECT 
          l.id, 
          l.leave_category, 
          DATE_FORMAT(l.leave_date, '%d-%m-%Y') AS formatted_date,
          ld.half_leave_type, 
          ld.short_leave_from, 
          ld.short_leave_to
        FROM leaves l
        LEFT JOIN leave_details ld ON l.id = ld.leave_id
        WHERE l.faculty_id = ?
        ORDER BY l.leave_date DESC;
        `,
        [id]
      );

      res.json({ faculty, leaves: leaveRows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error retrieving leave details" });
    }
  }
);

// Delete leave
app.post(
  "/leave_mgmt/delete-leave/:leaveId",
  authenticateSession,
  async (req, res) => {
    const { leaveId } = req.params;

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Retrieve leave details for adjustment
      const [leaveDetails] = await connection.query(
        "SELECT leave_category, faculty_id FROM leaves WHERE id = ?",
        [leaveId]
      );

      if (leaveDetails.length === 0) {
        await connection.rollback();
        res.status(404).json({ error: "Leave record not found." });
        return;
      }

      const { leave_category, faculty_id } = leaveDetails[0];
      const faculty = await enforceFacultyScope(req, res, faculty_id);
      if (!faculty) {
        await connection.rollback();
        return;
      }

      // Remove any leave_details associated with this leave, then delete the leave row
      await connection.query("DELETE FROM leave_details WHERE leave_id = ?", [leaveId]);
      const [result] = await connection.query(
        "DELETE FROM leaves WHERE id = ?",
        [leaveId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        res.status(404).json({ error: "Failed to delete leave record." });
        return;
      }

      // Recompute remaining counters deterministically from granted - used counts
      // This avoids incremental drift and ensures full-day categories count as 1
      const [facGrantRows] = await connection.query(
        `SELECT short_leaves_granted, half_day_leaves_granted, casual_leaves_granted, medical_leaves_granted, without_payment_leaves_granted, compensatory_leaves_granted, earned_leaves_granted, academic_leaves_granted FROM faculty WHERE id = ?`,
        [faculty_id]
      );
      const grants = facGrantRows[0] || {};

      const [usedRows] = await connection.query(
        `SELECT leave_category, COUNT(*) AS cnt FROM leaves WHERE faculty_id = ? GROUP BY leave_category`,
        [faculty_id]
      );
      const usedMap = {};
      for (const r of usedRows) usedMap[r.leave_category] = Number(r.cnt) || 0;

      const new_short_rem = Math.max(0, (Number(grants.short_leaves_granted) || 0) - (usedMap['short_leaves'] || 0));
      const new_half_rem = Math.max(0, (Number(grants.half_day_leaves_granted) || 0) - (usedMap['half_day_leaves'] || 0));
      const new_casual_rem = Math.max(0, (Number(grants.casual_leaves_granted) || 0) - (usedMap['casual_leaves'] || 0));
      const new_medical_rem = Math.max(0, (Number(grants.medical_leaves_granted) || 0) - (usedMap['medical_leaves'] || 0));
      const new_w_rem = Math.max(0, (Number(grants.without_payment_leaves_granted) || 0) - (usedMap['without_payment_leaves'] || 0));
      const new_comp_rem = Math.max(0, (Number(grants.compensatory_leaves_granted) || 0) - (usedMap['compensatory_leaves'] || 0));
      const new_e_rem = Math.max(0, (Number(grants.earned_leaves_granted) || 0) - (usedMap['earned_leaves'] || 0));
      const new_a_rem = Math.max(0, (Number(grants.academic_leaves_granted) || 0) - (usedMap['academic_leaves'] || 0));

      // Recompute remaining leaves using new conversion rates
      const recomputedRemaining = calculateLeaveEquivalents(
        new_short_rem,    // short leaves remaining
        new_half_rem,     // half day leaves remaining
        new_casual_rem,   // casual leaves remaining
        new_medical_rem,  // medical leaves remaining
        new_w_rem,        // without payment leaves remaining
        new_comp_rem,     // compensatory leaves remaining
        new_e_rem         // earned leaves remaining
      );

      // Persist updated per-type counters and remaining_leaves (academic counted separately)
      await connection.query(
        `UPDATE faculty SET short_leaves_remaining = ?, half_day_leaves_remaining = ?, casual_leaves_remaining = ?, medical_leaves_remaining = ?, without_payment_leaves_remaining = ?, compensatory_leaves_remaining = ?, earned_leaves_remaining = ?, academic_leaves_remaining = ?, remaining_leaves = ? WHERE id = ?`,
        [
          new_short_rem,
          new_half_rem,
          new_casual_rem,
          new_medical_rem,
          new_w_rem,
          new_comp_rem,
          new_e_rem,
          new_a_rem,
          recomputedRemaining,
          faculty_id,
        ]
      );

      await connection.commit();
      await logActivity(req.session.user, 'DELETE_LEAVE', 'leave', leaveId, { faculty_id });
      // Return JSON success (client expects JSON when called via fetch)
      return res.json({ success: true });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error(err);
      res.status(500).json({ error: "Failed to delete leave record." });
    } finally {
      if (connection) connection.release();
    }
  }
);

// Establishment Admin: Department Management
// Update this existing endpoint to include created_at
app.get(
  "/leave_mgmt/admin/departments",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [departments] = await pool.query(
        "SELECT department_id AS id, department_name AS name, created_at FROM departments ORDER BY department_name"
      );
      res.json(departments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch departments." });
    }
  }
);

app.post(
  "/leave_mgmt/admin/departments",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { department_name } = req.body;
    if (!department_name) {
      return res.status(400).json({ error: "Department name is required." });
    }
    try {
      const [result] = await pool.query(
        "INSERT INTO departments (department_name) VALUES (?)",
        [department_name]
      );
      await logActivity(
        req.session.user,
        "ADD_DEPARTMENT",
        "department",
        result.insertId,
        { department_name }
      );
      res.json({ success: true, id: result.insertId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add department." });
    }
  }
);

app.patch(
  "/leave_mgmt/admin/departments/:id",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { id } = req.params;
    const { department_name } = req.body;
    if (!department_name) {
      return res.status(400).json({ error: "Department name is required." });
    }
    try {
      await pool.query(
        "UPDATE departments SET department_name = ? WHERE department_id = ?",
        [department_name, id]
      );
      await logActivity(
        req.session.user,
        "UPDATE_DEPARTMENT",
        "department",
        id,
        { department_name }
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update department." });
    }
  }
);

// Add PUT endpoints for updating department/hostel names
app.put(
  "/leave_mgmt/admin/departments/:id",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    try {
      const deptId = req.params.id;
      const { department_name, name } = req.body;
      const newName = department_name || name;
      
      if (!newName || newName.trim().length < 2) {
        return res.status(400).json({ error: 'Department name is required (min 2 chars)' });
      }
      
      // Check if department exists
      const [existing] = await pool.query('SELECT * FROM departments WHERE department_id = ?', [deptId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      
      // Check for duplicate name
      const [duplicate] = await pool.query('SELECT * FROM departments WHERE department_name = ? AND department_id != ?', [newName.trim(), deptId]);
      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Department name already exists' });
      }
      
      await pool.query(
        'UPDATE departments SET department_name = ? WHERE department_id = ?', 
        [newName.trim(), deptId]
      );
      
      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)`,
        [
          req.session.user.id,
          'UPDATE_DEPARTMENT',
          JSON.stringify({
            department_id: deptId,
            old_name: existing[0].department_name,
            new_name: newName.trim(),
            actor_username: req.session.user.username
          })
        ]
      );
      
      res.json({ success: true, message: 'Department updated successfully' });
    } catch (error) {
      console.error('Error updating department:', error);
      res.status(500).json({ error: 'Failed to update department' });
    }
  }
);

app.put(
  "/leave_mgmt/admin/hostels/:id",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    try {
      const hostelId = req.params.id;
      const { hostel_name, name } = req.body;
      const newName = hostel_name || name;
      
      if (!newName || newName.trim().length < 2) {
        return res.status(400).json({ error: 'Hostel name is required (min 2 chars)' });
      }
      
      // Check if hostel exists
      const [existing] = await pool.query('SELECT * FROM hostels WHERE hostel_id = ?', [hostelId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Hostel not found' });
      }
      
      // Check for duplicate name
      const [duplicate] = await pool.query('SELECT * FROM hostels WHERE hostel_name = ? AND hostel_id != ?', [newName.trim(), hostelId]);
      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Hostel name already exists' });
      }
      
      await pool.query(
        'UPDATE hostels SET hostel_name = ? WHERE hostel_id = ?', 
        [newName.trim(), hostelId]
      );
      
      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)`,
        [
          req.session.user.id,
          'UPDATE_HOSTEL',
          JSON.stringify({
            hostel_id: hostelId,
            old_name: existing[0].hostel_name,
            new_name: newName.trim(),
            actor_username: req.session.user.username
          })
        ]
      );
      
      res.json({ success: true, message: 'Hostel updated successfully' });
    } catch (error) {
      console.error('Error updating hostel:', error);
      res.status(500).json({ error: 'Failed to update hostel' });
    }
  }
);

app.delete(
  "/leave_mgmt/admin/departments/:id",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM departments WHERE department_id = ?", [id]);
      await logActivity(
        req.session.user,
        "DELETE_DEPARTMENT",
        "department",
        id
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error:
          "Failed to delete department. Ensure no faculty/users are linked to it.",
      });
    }
  }
);

// Establishment Admin: Hostel Management
// Update this existing endpoint to include created_at
app.get(
  "/leave_mgmt/admin/hostels",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [hostels] = await pool.query(
        "SELECT hostel_id AS id, hostel_name AS name, created_at FROM hostels ORDER BY hostel_name"
      );
      res.json(hostels);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch hostels." });
    }
  }
);

app.post(
  "/leave_mgmt/admin/hostels",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { hostel_name } = req.body;
    if (!hostel_name) {
      return res.status(400).json({ error: "Hostel name is required." });
    }
    try {
      const [result] = await pool.query(
        "INSERT INTO hostels (hostel_name) VALUES (?)",
        [hostel_name]
      );
      await logActivity(
        req.session.user,
        "ADD_HOSTEL",
        "hostel",
        result.insertId,
        { hostel_name }
      );
      res.json({ success: true, id: result.insertId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add hostel." });
    }
  }
);

app.patch(
  "/leave_mgmt/admin/hostels/:id",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { id } = req.params;
    const { hostel_name } = req.body;
    if (!hostel_name) {
      return res.status(400).json({ error: "Hostel name is required." });
    }
    try {
      await pool.query(
        "UPDATE hostels SET hostel_name = ? WHERE hostel_id = ?",
        [hostel_name, id]
      );
      await logActivity(
        req.session.user,
        "UPDATE_HOSTEL",
        "hostel",
        id,
        { hostel_name }
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update hostel." });
    }
  }
);

app.delete(
  "/leave_mgmt/admin/hostels/:id",
  authenticateSession,
  authorizeRoles(ROLE.ESTABLISHMENT_ADMIN, ROLE.SUPERADMIN),
  async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM hostels WHERE hostel_id = ?", [id]);
      await logActivity(req.session.user, "DELETE_HOSTEL", "hostel", id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error:
          "Failed to delete hostel. Ensure no staff/users are linked to it.",
      });
    }
  }
);

// Faculty update endpoint (designation/leaves/scope) - UPDATED FOR SUPERADMIN
app.patch(
  "/leave_mgmt/faculty/:id",
  authenticateSession,
  async (req, res) => {
    const { id } = req.params;
    const updates = {};
    const allowedFields = [
      "designation",
      "granted_leaves",
      "remaining_leaves",
      "total_leaves",
      "department_id",
      "hostel_id",
      "member_type",
      "faculty_name"  // Added this
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided." });
    }

    try {
      // For superadmin, allow updates without scope checking
      if (req.session.user.role === ROLE.SUPERADMIN) {
        const setClause = Object.keys(updates)
          .map((field) => `${field} = ?`)
          .join(", ");
        const values = Object.values(updates);

        await pool.query(
          `UPDATE faculty SET ${setClause} WHERE id = ?`,
          [...values, id]
        );
        await pool.query(
          `INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)`,
          [
            req.session.user.id,
            "UPDATE_FACULTY",
            JSON.stringify({
              faculty_id: id,
              updates: updates,
              actor_username: req.session.user.username
            })
          ]
        );
        return res.json({ success: true });
      }
      
      // For non-superadmin, use existing scope checking
      const faculty = await enforceFacultyScope(req, res, id);
      if (!faculty) return;

      const setClause = Object.keys(updates)
        .map((field) => `${field} = ?`)
        .join(", ");
      const values = Object.values(updates);

      await pool.query(
        `UPDATE faculty SET ${setClause} WHERE id = ?`,
        [...values, id]
      );
      await pool.query(
        `INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)`,
        [
          req.session.user.id,
          "UPDATE_FACULTY",
          JSON.stringify({
            faculty_id: id,
            updates: updates,
            actor_username: req.session.user.username
          })
        ]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update faculty." });
    }
  }
);

// Principal Admin - Presence stats
app.get(
  "/leave_mgmt/stats/presence",
  authenticateSession,
  authorizeRoles(
    ROLE.PRINCIPAL_ADMIN,
    ROLE.SUPERADMIN,
    ROLE.ESTABLISHMENT_ADMIN
  ),
  async (req, res) => {
    const date =
      req.query.date || new Date().toISOString().split("T")[0];
    try {
      const [departmentStats] = await pool.query(
        `
        SELECT 
          d.department_id,
          d.department_name,
          SUM(CASE WHEN f.id IS NOT NULL AND f.member_type = 'faculty' THEN 1 ELSE 0 END) AS total_faculty,
          SUM(
            CASE
              WHEN f.id IS NOT NULL
                   AND f.member_type = 'faculty'
                   AND EXISTS (
                     SELECT 1 FROM leaves l
                     WHERE l.faculty_id = f.id AND l.leave_date = ?
                   )
              THEN 1 ELSE 0
            END
          ) AS absent_faculty
        FROM departments d
        LEFT JOIN faculty f ON f.department_id = d.department_id
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
      `,
        [date]
      );

      const [hostelStats] = await pool.query(
        `
        SELECT 
          h.hostel_id,
          h.hostel_name,
          SUM(CASE WHEN f.id IS NOT NULL AND f.member_type = 'staff' THEN 1 ELSE 0 END) AS total_staff,
          SUM(
            CASE
              WHEN f.id IS NOT NULL
                   AND f.member_type = 'staff'
                   AND EXISTS (
                     SELECT 1 FROM leaves l
                     WHERE l.faculty_id = f.id AND l.leave_date = ?
                   )
              THEN 1 ELSE 0
            END
          ) AS absent_staff
        FROM hostels h
        LEFT JOIN faculty f ON f.hostel_id = h.hostel_id
        GROUP BY h.hostel_id, h.hostel_name
        ORDER BY h.hostel_name
      `,
        [date]
      );

      res.json({
        date,
        departments: departmentStats.map((dept) => ({
          id: dept.department_id,
          name: dept.department_name,
          total: dept.total_faculty,
          absent: dept.absent_faculty,
          present: (dept.total_faculty || 0) - (dept.absent_faculty || 0),
        })),
        hostels: hostelStats.map((hostel) => ({
          id: hostel.hostel_id,
          name: hostel.hostel_name,
          total: hostel.total_staff,
          absent: hostel.absent_staff,
          present: (hostel.total_staff || 0) - (hostel.absent_staff || 0),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats." });
    }
  }
);

// PI summary endpoint: returns totals and today's leave breakdown for a scope
app.get('/leave_mgmt/pi-summary', authenticateSession, async (req, res) => {
  try {
    const type = req.query.type; // 'department' or 'hostel'
    const id = req.query.id ? Number(req.query.id) : null;
    const user = req.session.user || {};

    // Authorization: department/hostel admins may only request their own scope
    if (user.role === ROLE.DEPARTMENT_ADMIN) {
      if (type !== 'department' || id !== user.departmentId) return res.status(403).json({ error: 'Forbidden' });
    }
    if (user.role === ROLE.HOSTEL_ADMIN) {
      if (type !== 'hostel' || id !== user.hostelId) return res.status(403).json({ error: 'Forbidden' });
    }

    // Build where clause and params
    let where = '';
    const params = [];
    if (type === 'department') {
      if (id) { where = 'WHERE department_id = ?'; params.push(id); }
    } else if (type === 'hostel') {
      if (id) { where = 'WHERE hostel_id = ?'; params.push(id); }
    } else {
      // If no type provided and user is principal or superadmin, provide overall totals
      if (!(user.role === ROLE.PRINCIPAL_ADMIN || user.role === ROLE.SUPERADMIN)) {
        return res.status(400).json({ error: 'Invalid scope' });
      }
    }

    // Total members in scope (faculty table holds both faculty/staff in this app)
    const totalQuery = `SELECT COUNT(*) AS total_members FROM faculty ${where}`;
    const [totalRows] = await pool.query(totalQuery, params);
    const total_members = (totalRows && totalRows[0] && totalRows[0].total_members) || 0;

    // Leaves for today grouped by category
    const leavesSql = `SELECT leave_category, COUNT(DISTINCT faculty_id) AS cnt FROM leaves ${where ? where + ' AND ' : 'WHERE '} DATE(leave_date) = CURDATE() GROUP BY leave_category`;
    const [leaveRows] = await pool.query(leavesSql, params);

    const by_category = {};
    let members_on_leave = 0;
    for (const r of leaveRows) {
      by_category[r.leave_category] = r.cnt;
      members_on_leave += r.cnt;
    }

    // Fetch detailed members currently on leave (name, categories, dates)
    const membersSql = `
      SELECT f.id AS faculty_id, f.faculty_name, l.leave_category, DATE_FORMAT(l.leave_date, '%Y-%m-%d') AS leave_date
      FROM leaves l
      JOIN faculty f ON f.id = l.faculty_id
      ${where ? where : ''}
      AND DATE(l.leave_date) = CURDATE()
    `;
    const [memberRows] = await pool.query(membersSql, params);

    // Aggregate by faculty
    const membersMap = new Map();
    for (const r of memberRows) {
      if (!membersMap.has(r.faculty_id)) {
        membersMap.set(r.faculty_id, { id: r.faculty_id, name: r.faculty_name, categories: new Set(), dates: new Set() });
      }
      const m = membersMap.get(r.faculty_id);
      if (r.leave_category) m.categories.add(r.leave_category);
      if (r.leave_date) m.dates.add(r.leave_date);
    }

    const members_on_leave_details = Array.from(membersMap.values()).map(m => ({
      id: m.id,
      name: m.name,
      categories: Array.from(m.categories),
      dates: Array.from(m.dates)
    }));

    const present = Math.max(0, total_members - members_on_leave);

    res.json({ total_members, present, members_on_leave, by_category, members_on_leave_details });
  } catch (err) {
    console.error('PI summary error:', err);
    res.status(500).json({ error: 'Failed to fetch PI summary' });
  }
});

// Super Admin - Admin management
app.get(
  "/leave_mgmt/admins",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [admins] = await pool.query(
        `
        SELECT 
          id,
          username,
          role,
          department_id,
          hostel_id,
          password,
          status
        FROM users
        WHERE role IN (?, ?, ?, ?, ?)
        ORDER BY role, username
      `,
        [
          ROLE.DEPARTMENT_ADMIN,
          ROLE.HOSTEL_ADMIN,
          ROLE.ESTABLISHMENT_ADMIN,
          ROLE.PRINCIPAL_ADMIN,
          ROLE.SUPERADMIN,
        ]
      );
      res.json(admins);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch admins." });
    }
  }
);

app.post(
  "/leave_mgmt/admins",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    const { username, password, role, departmentId, hostelId } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const scopeType = getScopeTypeFromRole(role);
    if (
      scopeType === SCOPE_TYPES.DEPARTMENT &&
      !departmentId
    ) {
      return res
        .status(400)
        .json({ error: "Department ID is required for this role." });
    }
    if (scopeType === SCOPE_TYPES.HOSTEL && !hostelId) {
      return res
        .status(400)
        .json({ error: "Hostel ID is required for this role." });
    }

    try {
      const [existing] = await pool.query(
        `SELECT id FROM users WHERE username = ?`,
        [username]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: "Username already exists." });
      }

      const [result] = await pool.query(
        `
        INSERT INTO users (username, password, role, department_id, hostel_id)
        VALUES (?, md5(?), ?, ?, ?)
      `,
        [
          username,
          password,
          role,
          scopeType === SCOPE_TYPES.DEPARTMENT ? departmentId : null,
          scopeType === SCOPE_TYPES.HOSTEL ? hostelId : null,
        ]
      );

      await logActivity(req.session.user, "ADD_ADMIN", "user", result.insertId, {
        username,
        role,
      });

      res.json({ success: true, id: result.insertId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add admin." });
    }
  }
);

// ==================== NEW ROUTES FOR SUPERADMIN DASHBOARD ====================

// Get all admin users with details (for superadmin dashboard)
app.get(
  "/leave_mgmt/admin/users",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [admins] = await pool.query(
        `
        SELECT 
          u.id,
          u.username,
          u.role,
          u.status,
          u.created_at,
          d.department_name,
          h.hostel_name,
          u.department_id,
          u.hostel_id
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.department_id
        LEFT JOIN hostels h ON u.hostel_id = h.hostel_id
        WHERE u.role IN (?, ?, ?, ?, ?, ?)
        ORDER BY 
          CASE u.role
            WHEN 'superadmin' THEN 1
            WHEN 'principal_admin' THEN 2
            WHEN 'establishment_admin' THEN 3
            WHEN 'department_admin' THEN 4
            WHEN 'hostel_admin' THEN 5
            ELSE 6
          END,
          u.username
      `,
        [
          ROLE.SUPERADMIN,
          ROLE.PRINCIPAL_ADMIN,
          ROLE.ESTABLISHMENT_ADMIN,
          ROLE.DEPARTMENT_ADMIN,
          ROLE.HOSTEL_ADMIN,
          ROLE.DEPARTMENT_STAFF,
          ROLE.HOSTEL_STAFF,
        ]
      );
      res.json(admins);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch admin users." });
    }
  }
);

// Enhanced admin users endpoint with scope info
app.get(
  "/leave_mgmt/admin/users-full",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [admins] = await pool.query(
        `
        SELECT 
          u.id,
          u.username,
          u.role,
          u.status,
          u.active,
          u.created_at,
          u.department_id,
          u.hostel_id,
          d.department_name,
          h.hostel_name,
          CASE 
            WHEN u.department_id IS NOT NULL THEN 'department'
            WHEN u.hostel_id IS NOT NULL THEN 'hostel'
            ELSE 'global'
          END as scope_type,
          CASE 
            WHEN u.department_id IS NOT NULL THEN d.department_name
            WHEN u.hostel_id IS NOT NULL THEN h.hostel_name
            ELSE 'Global'
          END as scope_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.department_id
        LEFT JOIN hostels h ON u.hostel_id = h.hostel_id
        WHERE u.role IN (?, ?, ?, ?, ?, ?)
        ORDER BY 
          CASE u.role 
            WHEN 'superadmin' THEN 1
            WHEN 'principal_admin' THEN 2
            WHEN 'establishment_admin' THEN 3
            WHEN 'department_admin' THEN 4
            WHEN 'hostel_admin' THEN 5
            ELSE 6
          END,
          u.username
      `,
        [
          ROLE.SUPERADMIN,
          ROLE.PRINCIPAL_ADMIN,
          ROLE.ESTABLISHMENT_ADMIN,
          ROLE.DEPARTMENT_ADMIN,
          ROLE.HOSTEL_ADMIN,
          ROLE.DEPARTMENT_STAFF,
          ROLE.HOSTEL_STAFF,
        ]
      );
      res.json(admins);
    } catch (err) {
      console.error('Error fetching admin users:', err);
      res.status(500).json({ error: 'Failed to fetch admin users' });
    }
  }
);

// Enhanced departments endpoint with stats
app.get(
  "/leave_mgmt/admin/departments-full",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    try {
      const [departments] = await pool.query(
        `
        SELECT 
          d.department_id AS id,
          d.department_name AS name,
          d.created_at,
          DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') as formatted_created_at,
          COUNT(DISTINCT f.id) AS member_count,
          COUNT(DISTINCT u.id) AS admin_count
        FROM departments d
        LEFT JOIN faculty f ON d.department_id = f.department_id
        LEFT JOIN users u ON d.department_id = u.department_id AND u.role IN ('department_admin', 'department_staff')
        GROUP BY d.department_id, d.department_name, d.created_at
        ORDER BY d.department_name
      `
      );
      res.json(departments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch departments with stats." });
    }
  }
);

// Enhanced hostels endpoint with stats
app.get(
  "/leave_mgmt/admin/hostels-full",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    try {
      const [hostels] = await pool.query(
        `
        SELECT 
          h.hostel_id AS id,
          h.hostel_name AS name,
          h.created_at,
          DATE_FORMAT(h.created_at, '%Y-%m-%d %H:%i:%s') as formatted_created_at,
          COUNT(DISTINCT f.id) AS member_count,
          COUNT(DISTINCT u.id) AS admin_count
        FROM hostels h
        LEFT JOIN faculty f ON h.hostel_id = f.hostel_id
        LEFT JOIN users u ON h.hostel_id = u.hostel_id AND u.role IN ('hostel_admin', 'hostel_staff')
        GROUP BY h.hostel_id, h.hostel_name, h.created_at
        ORDER BY h.hostel_name
      `
      );
      res.json(hostels);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch hostels with stats." });
    }
  }
);

// Get member count for a specific department
app.get(
  "/leave_mgmt/departments/:id/members",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [[result]] = await pool.query(
        `
        SELECT COUNT(*) as count 
        FROM faculty 
        WHERE department_id = ? AND member_type = 'faculty'
      `,
        [id]
      );
      res.json({ count: result.count || 0 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch department members." });
    }
  }
);

// Get member count for a specific hostel
app.get(
  "/leave_mgmt/hostels/:id/members",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [[result]] = await pool.query(
        `
        SELECT COUNT(*) as count 
        FROM faculty 
        WHERE hostel_id = ? AND member_type = 'staff'
      `,
        [id]
      );
      res.json({ count: result.count || 0 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch hostel members." });
    }
  }
);

// Get admin count for a specific department/hostel
app.get(
  "/leave_mgmt/admin/scopes/:type/:id/admins",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    const { type, id } = req.params;
    try {
      let query, params;
      
      if (type === 'department') {
        query = `
          SELECT COUNT(*) as count 
          FROM users 
          WHERE department_id = ? AND role IN ('department_admin', 'department_staff') AND status = 'active'
        `;
        params = [id];
      } else if (type === 'hostel') {
        query = `
          SELECT COUNT(*) as count 
          FROM users 
          WHERE hostel_id = ? AND role IN ('hostel_admin', 'hostel_staff') AND status = 'active'
        `;
        params = [id];
      } else {
        return res.status(400).json({ error: "Invalid scope type." });
      }
      
      const [[result]] = await pool.query(query, params);
      res.json({ count: result.count || 0 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch admin count." });
    }
  }
);

// Get all users (for superadmin dashboard - fallback)
app.get(
  "/leave_mgmt/get-users",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [users] = await pool.query(
        `
        SELECT 
          id,
          username,
          role,
          status,
          created_at,
          department_id,
          hostel_id
        FROM users
        ORDER BY role, username
      `
      );
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch users." });
    }
  }
);

// Get all faculty with department/hostel info (for stats)
app.get(
  "/leave_mgmt/get-faculty",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN, ROLE.ESTABLISHMENT_ADMIN),
  async (req, res) => {
    const { department_id, hostel_id } = req.query;
    
    try {
      let whereClause = "1=1";
      const params = [];
      
      if (department_id) {
        whereClause += " AND f.department_id = ?";
        params.push(department_id);
      }
      
      if (hostel_id) {
        whereClause += " AND f.hostel_id = ?";
        params.push(hostel_id);
      }
      
      const [faculty] = await pool.query(
        `
        SELECT 
          f.id,
          f.faculty_name,
          f.designation,
          f.member_type,
          f.granted_leaves,
          f.remaining_leaves,
          f.total_leaves,
          d.department_name,
          h.hostel_name
        FROM faculty f
        LEFT JOIN departments d ON f.department_id = d.department_id
        LEFT JOIN hostels h ON f.hostel_id = h.hostel_id
        WHERE ${whereClause}
        ORDER BY f.member_type, f.faculty_name
      `,
        params
      );
      res.json(faculty);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch faculty." });
    }
  }
);

// Get departments (simple list - already exists but adding fallback)
app.get(
  "/leave_mgmt/get-departments",
  authenticateSession,
  async (req, res) => {
    try {
      const [departments] = await pool.query(
        "SELECT department_id AS id, department_name AS name, created_at FROM departments ORDER BY department_name"
      );
      res.json(departments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch departments." });
    }
  }
);

// Get hostels (simple list - already exists but adding fallback)
app.get(
  "/leave_mgmt/get-hostels",
  authenticateSession,
  async (req, res) => {
    try {
      const [hostels] = await pool.query(
        "SELECT hostel_id AS id, hostel_name AS name, created_at FROM hostels ORDER BY hostel_name"
      );
      res.json(hostels);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch hostels." });
    }
  }
);

app.patch(
  "/leave_mgmt/admins/:id/password",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }
    try {
      await pool.query(
        "UPDATE users SET password = md5(?) WHERE id = ?",
        [password, id]
      );
      await logActivity(req.session.user, "RESET_ADMIN_PASSWORD", "user", id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to reset password." });
    }
  }
);

// Add DELETE admin user endpoint - INSERT AFTER THE PASSWORD RESET ENDPOINT
app.delete(
  "/leave_mgmt/admin/users/:id",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    let connection; // Declare connection here
    try {
      const userId = req.params.id;
      
      // Don't allow deleting superadmin
      const [user] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
      if (user[0] && user[0].role === ROLE.SUPERADMIN) {
        return res.status(403).json({ error: 'Cannot delete superadmin user' });
      }
      
      connection = await pool.getConnection(); // Get connection from the pool
      await connection.beginTransaction(); // Start a transaction

      // Delete logs for the user
      await connection.query('DELETE FROM activity_logs WHERE actor_id = ?', [userId]);

      // Now, delete the user
      await connection.query('DELETE FROM users WHERE id = ?', [userId]);

      await connection.commit(); // Commit the transaction
      
      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)`,
        [
          req.session.user.id,
          'DELETE_ADMIN',
          JSON.stringify({
            target_user_id: userId,
            actor_username: req.session.user.username
          })
        ]
      );
      
      res.json({ success: true, message: 'Admin user deleted successfully' });
    } catch (error) {
      if (connection) await connection.rollback(); // Rollback on error
      console.error('Error deleting admin user:', error);
      res.status(500).json({ error: 'Failed to delete admin user' });
    } finally {
      if (connection) connection.release(); // Release the connection
    }
  }
);

// Add custom reset password endpoint
app.post(
  "/leave_mgmt/admin/users/:id/reset-password",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { password } = req.body;
      
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      
      const hashedPassword = md5(password);
      
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
      
      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)`,
        [
          req.session.user.id,
          'RESET_PASSWORD',
          JSON.stringify({
            target_user_id: userId,
            actor_username: req.session.user.username
          })
        ]
      );
      
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// POST endpoint for logging activities
app.post(
  "/leave_mgmt/activity-logs",
  authenticateSession,
  async (req, res) => {
    try {
      const { action, meta_json } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }
      
      await pool.query(
        'INSERT INTO activity_logs (actor_id, action, meta_json) VALUES (?, ?, ?)',
        [req.session.user.id, action, meta_json || null]
      );
      
      res.json({ success: true, message: 'Activity logged' });
    } catch (error) {
      console.error('Error logging activity:', error);
      res.status(500).json({ error: 'Failed to log activity' });
    }
  }
);

// Activity Logs
app.get(
  "/leave_mgmt/activity-logs",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const page = Number(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const actorId = req.query.actor_id;
    const action = req.query.action;
    const entityType = req.query.entity_type;

    try {
      const whereClauses = [];
      const queryParams = [];

      if (actorId) {
        whereClauses.push("al.actor_id = ?");
        queryParams.push(actorId);
      }

      if (action) {
        whereClauses.push("al.action LIKE ?");
        queryParams.push(`%${action}%`);
      }

      if (entityType) {
        whereClauses.push("al.entity_type = ?");
        queryParams.push(entityType);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count for pagination
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`,
        queryParams
      );

      // Get logs with user info
      const dataParams = [...queryParams, limit, offset];
      const [logs] = await pool.query(
        `
        SELECT 
          al.id,
          al.actor_id,
          u.username AS actor_username,
          u.role AS actor_role,
          al.action,
          al.entity_type,
          al.entity_id,
          al.meta_json,
          al.created_at
        FROM activity_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `,
        dataParams
      );

      res.json({
        logs,
        pagination: {
          total: countResult[0].total,
          page,
          limit,
          pages: Math.ceil(countResult[0].total / limit),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch activity logs." });
    }
  }
);

// Report generation logging endpoint (helps record report generation even when PDFs are generated elsewhere)
app.get(
  "/leave_mgmt/generate-report",
  authenticateSession,
  async (req, res) => {
    const { type, scopeType, scopeId, fromDate, toDate } = req.query;

    try {
      // NOTE: This endpoint only logs the generation event — actual report generation
      // often happens in /leave_mgmt/pdf routes. You can adapt this to proxy or generate
      // content and return a file.

      await logActivity(
        req.session.user,
        "GENERATE_REPORT",
        "report",
        null,
        {
          report_type: type,
          scope_type: scopeType,
          scope_id: scopeId,
          from_date: fromDate,
          to_date: toDate,
        }
      );

      res.json({ success: true, message: "Report generation logged" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to log report generation" });
    }
  }
);

// User password change endpoint (for authenticated users)
app.patch(
  "/leave_mgmt/user/password",
  authenticateSession,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user?.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both passwords are required." });
    }

    try {
      // Verify current password
      const [users] = await pool.query(
        "SELECT id FROM users WHERE id = ? AND password = md5(?)",
        [userId, currentPassword]
      );

      if (users.length === 0) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }

      // Update password
      await pool.query("UPDATE users SET password = md5(?) WHERE id = ?", [newPassword, userId]);

      // Log password change
      await logActivity(req.session.user, "CHANGE_PASSWORD", "user", userId, { username: req.session.user.username });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to change password." });
    }
  }
);

app.get(
  "/leave_mgmt/activity-logs/export",
  authenticateSession,
  authorizeRoles(ROLE.SUPERADMIN),
  async (req, res) => {
    try {
      const [logs] = await pool.query(
        `
        SELECT 
          al.id,
          u.username AS actor_username,
          al.action,
          al.entity_type,
          al.entity_id,
          al.meta_json,
          al.created_at
        FROM activity_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        ORDER BY al.created_at DESC
      `
      );

      const header =
        "id,actor_username,action,entity_type,entity_id,meta_json,created_at\n";
      const rows = logs
        .map((log) =>
          [
            log.id,
            log.actor_username,
            log.action,
            log.entity_type,
            log.entity_id,
            JSON.stringify(log.meta_json || {}),
            log.created_at.toISOString(),
          ]
            .map((value) => `"${value ?? ""}"`)
            .join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="activity_logs.csv"`
      );
      res.send(header + rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to export logs." });
    }
  }
);

app.use("/leave_mgmt/pdf", authenticateSession, require("./routes/pdf"));

// Migration function for updating existing data
const migrateLeaveCalculations = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    console.log('Starting migration of leave calculations...');
    
    // 1. Update total_leaves for all faculty records
    await connection.query(`
      UPDATE faculty 
      SET total_leaves = ROUND(
        short_leaves_granted * 0.333333 + 
        half_day_leaves_granted * 0.5 + 
        casual_leaves_granted * 1 + 
        medical_leaves_granted * 1 + 
        without_payment_leaves_granted * 1 + 
        compensatory_leaves_granted * 1 + 
        earned_leaves_granted * 1, 
        2
      )
    `);
    
    console.log('Step 1: Updated total_leaves for all faculty');
    
    // 2. Update granted_leaves to match total_leaves
    await connection.query(`
      UPDATE faculty 
      SET granted_leaves = total_leaves
    `);
    
    console.log('Step 2: Updated granted_leaves to match total_leaves');
    
    // 3. Update remaining_leaves based on current usage
    await connection.query(`
      UPDATE faculty f
      LEFT JOIN (
        SELECT 
          faculty_id,
          COUNT(CASE WHEN leave_category = 'short_leaves' THEN 1 END) as used_short,
          COUNT(CASE WHEN leave_category = 'half_day_leaves' THEN 1 END) as used_half,
          COUNT(CASE WHEN leave_category = 'casual_leaves' THEN 1 END) as used_casual,
          COUNT(CASE WHEN leave_category = 'medical_leaves' THEN 1 END) as used_medical,
          COUNT(CASE WHEN leave_category = 'without_payment_leaves' THEN 1 END) as used_without,
          COUNT(CASE WHEN leave_category = 'compensatory_leaves' THEN 1 END) as used_compensatory,
          COUNT(CASE WHEN leave_category = 'earned_leaves' THEN 1 END) as used_earned
        FROM leaves
        GROUP BY faculty_id
      ) l ON f.id = l.faculty_id
      SET f.remaining_leaves = ROUND(
        (f.short_leaves_granted - COALESCE(l.used_short, 0)) * 0.333333 + 
        (f.half_day_leaves_granted - COALESCE(l.used_half, 0)) * 0.5 + 
        (f.casual_leaves_granted - COALESCE(l.used_casual, 0)) * 1 + 
        (f.medical_leaves_granted - COALESCE(l.used_medical, 0)) * 1 + 
        (f.without_payment_leaves_granted - COALESCE(l.used_without, 0)) * 1 + 
        (f.compensatory_leaves_granted - COALESCE(l.used_compensatory, 0)) * 1 + 
        (f.earned_leaves_granted - COALESCE(l.used_earned, 0)) * 1, 
        2
      )
    `);
    
    console.log('Step 3: Updated remaining_leaves based on current usage');
    
    // 4. Also update per-type remaining columns
    await connection.query(`
      UPDATE faculty f
      LEFT JOIN (
        SELECT 
          faculty_id,
          COUNT(CASE WHEN leave_category = 'short_leaves' THEN 1 END) as used_short,
          COUNT(CASE WHEN leave_category = 'half_day_leaves' THEN 1 END) as used_half,
          COUNT(CASE WHEN leave_category = 'casual_leaves' THEN 1 END) as used_casual,
          COUNT(CASE WHEN leave_category = 'medical_leaves' THEN 1 END) as used_medical,
          COUNT(CASE WHEN leave_category = 'without_payment_leaves' THEN 1 END) as used_without,
          COUNT(CASE WHEN leave_category = 'compensatory_leaves' THEN 1 END) as used_compensatory,
          COUNT(CASE WHEN leave_category = 'earned_leaves' THEN 1 END) as used_earned,
          COUNT(CASE WHEN leave_category = 'academic_leaves' THEN 1 END) as used_academic
        FROM leaves
        GROUP BY faculty_id
      ) l ON f.id = l.faculty_id
      SET 
        f.short_leaves_remaining = f.short_leaves_granted - COALESCE(l.used_short, 0),
        f.half_day_leaves_remaining = f.half_day_leaves_granted - COALESCE(l.used_half, 0),
        f.casual_leaves_remaining = f.casual_leaves_granted - COALESCE(l.used_casual, 0),
        f.medical_leaves_remaining = f.medical_leaves_granted - COALESCE(l.used_medical, 0),
        f.without_payment_leaves_remaining = f.without_payment_leaves_granted - COALESCE(l.used_without, 0),
        f.compensatory_leaves_remaining = f.compensatory_leaves_granted - COALESCE(l.used_compensatory, 0),
        f.earned_leaves_remaining = f.earned_leaves_granted - COALESCE(l.used_earned, 0),
        f.academic_leaves_remaining = f.academic_leaves_granted - COALESCE(l.used_academic, 0)
    `);
    
    console.log('Step 4: Updated per-type remaining columns');
    
    await connection.commit();
    console.log('Migration completed successfully!');
    
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Migration failed:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
};

// Uncomment and run this function once after deploying the code changes
// migrateLeaveCalculations().then(() => {
//   console.log('Migration script completed');
//   process.exit(0);
// }).catch(err => {
//   console.error('Migration script failed:', err);
//   process.exit(1);
// });

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}/leave_mgmt`);
});