const ROLE = {
  DEPARTMENT_ADMIN: "department_admin",
  // DEPARTMENT_STAFF: "department_staff",
  HOSTEL_ADMIN: "hostel_admin",
  // HOSTEL_STAFF: "hostel_staff",
  ESTABLISHMENT_ADMIN: "establishment_admin",
  PRINCIPAL_ADMIN: "principal_admin",
  SUPERADMIN: "superadmin",
};

const SCOPE_TYPES = {
  DEPARTMENT: "department",
  HOSTEL: "hostel",
  GLOBAL: "global",
};

const ROLE_SCOPE = {
  [ROLE.DEPARTMENT_ADMIN]: SCOPE_TYPES.DEPARTMENT,
  // [ROLE.DEPARTMENT_STAFF]: SCOPE_TYPES.DEPARTMENT,
  [ROLE.HOSTEL_ADMIN]: SCOPE_TYPES.HOSTEL,
  // [ROLE.HOSTEL_STAFF]: SCOPE_TYPES.HOSTEL,
  [ROLE.ESTABLISHMENT_ADMIN]: SCOPE_TYPES.GLOBAL,
  [ROLE.PRINCIPAL_ADMIN]: SCOPE_TYPES.GLOBAL,
  [ROLE.SUPERADMIN]: SCOPE_TYPES.GLOBAL,
};

// Update the buildPermissionSet function:

const buildPermissionSet = (role) => {
  const base = {
    canViewDashboard: true,
    // Reports
    canGenerateReports: false,
    canDownloadIndividualReport: false,
    canViewDetails: false,
    // Leaves
    canAddLeaves: false,
    // Faculty
    canManageFaculty: false,
    canChangeLeaveBalance: false,
    // Users
    canManageUsers: false,
    // Departments / Hostels
    canManageDepartments: false,
    canManageHostels: false,
    // Stats
    canViewStats: false,
    // Admins & Logs
    canManageAdmins: false,
    canViewActivityLogs: false,
  };

  switch (role) {
    case ROLE.DEPARTMENT_ADMIN:
      return {
        ...base,
        canAddLeaves: true,
        canGenerateReports: true,
        canViewDetails: true,
        canDownloadIndividualReport: true,
        canChangeLeaveBalance: true,
      };
      
    // case ROLE.DEPARTMENT_STAFF:
    //   return {
    //     ...base,
    //     canAddLeaves: true,
    //     canGenerateReports: true,
    //     canViewDetails: true,
    //   };
      
    case ROLE.HOSTEL_ADMIN:
      return {
        ...base,
        canAddLeaves: true,
        canGenerateReports: true,
        canViewDetails: true,
        canDownloadIndividualReport: true,
        canChangeLeaveBalance: true,
      };
      
    // case ROLE.HOSTEL_STAFF:
    //   return {
    //     ...base,
    //     canAddLeaves: true,
    //     canGenerateReports: true,
    //     canViewDetails: true,
    //   };
      
    case ROLE.ESTABLISHMENT_ADMIN:
      return {
        ...base,
        canManageDepartments: true,
        canManageHostels: true,
        canManageFaculty: true,
        canViewStats: true,
        canViewDetails: true,
      };
      
    case ROLE.PRINCIPAL_ADMIN:
      return {
        ...base,
        canGenerateReports: true,
        canViewStats: true,
        canViewDetails: true,
      };
      
    case ROLE.SUPERADMIN:
      const all = {};
      Object.keys(base).forEach((k) => (all[k] = true));
      return all;
      
    default:
      return base;
  }
};

const getScopeTypeFromRole = (role) => ROLE_SCOPE[role] || null;

const isGlobalRole = (role) => ROLE_SCOPE[role] === SCOPE_TYPES.GLOBAL;

const canAccessRecord = (user, record) => {
  if (!user || !record) return false;
  if (user.scopeType === SCOPE_TYPES.GLOBAL) return true;
  if (user.scopeType === SCOPE_TYPES.DEPARTMENT) {
    return (
      Number(record.department_id || record.departmentId) ===
      Number(user.departmentId)
    );
  }
  if (user.scopeType === SCOPE_TYPES.HOSTEL) {
    return (
      Number(record.hostel_id || record.hostelId) === Number(user.hostelId)
    );
  }
  return false;
};

const resolveScopeFromRequest = (req, options = {}) => {
  const { allowNullForGlobal = false } = options;
  const user = req.session?.user;
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
      name: scopeName,
    };
  }

  const payload = {
    ...req.query,
    ...((req.body && typeof req.body === "object" && req.body) || {}),
  };
  const rawScopeType =
    (payload.scopeType || payload.scope || payload.targetScope || "")
      .toString()
      .toLowerCase() || null;
  const explicitScopeId = payload.scopeId || payload.targetScopeId;
  const departmentId = payload.departmentId || payload.targetDepartmentId;
  const hostelId = payload.hostelId || payload.targetHostelId;

  if (rawScopeType === "department" || departmentId) {
    return {
      type: SCOPE_TYPES.DEPARTMENT,
      id: Number(departmentId || explicitScopeId),
    };
  }
  if (rawScopeType === "hostel" || hostelId) {
    return { type: SCOPE_TYPES.HOSTEL, id: Number(hostelId || explicitScopeId) };
  }

  if (allowNullForGlobal) return null;
  throw new Error("Scope selection required for this action.");
};

const formatScopeLabel = (scope = {}) => {
  if (!scope || !scope.type || !scope.name) {
    return "Institution Dashboard";
  }
  if (scope.type === SCOPE_TYPES.HOSTEL) {
    return `Hostel ${scope.name}`;
  }
  if (scope.type === SCOPE_TYPES.DEPARTMENT) {
    return `${scope.name} Department`;
  }
  return "Institution Dashboard";
};

const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    const currentRole = req.session?.user?.role;
    if (!currentRole || !allowedRoles.includes(currentRole)) {
      return res
        .status(403)
        .json({ error: "You are not allowed to perform this action." });
    }
    return next();
  };

module.exports = {
  ROLE,
  SCOPE_TYPES,
  buildPermissionSet,
  getScopeTypeFromRole,
  isGlobalRole,
  canAccessRecord,
  resolveScopeFromRequest,
  authorizeRoles,
  formatScopeLabel,
};

