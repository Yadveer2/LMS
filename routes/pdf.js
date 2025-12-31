const { PDFDocument } = require("pdf-lib");
const Stream = require("stream");
const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

const {
  generateFrontPage,
  generatePDF,
  generateOneDayReport,
} = require("../controllers/generatePdf");
const {
  SCOPE_TYPES,
  resolveScopeFromRequest,
  canAccessRecord,
  formatScopeLabel,
} = require("../services/authz");

const pool = mysql
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise();

const fetchScopeName = async (scope) => {
  if (!scope) return null;
  if (scope.type === SCOPE_TYPES.DEPARTMENT) {
    const [[dept]] = await pool.query(
      "SELECT department_name FROM departments WHERE department_id = ?",
      [scope.id]
    );
    return dept?.department_name || null;
  }
  if (scope.type === SCOPE_TYPES.HOSTEL) {
    const [[hostel]] = await pool.query(
      "SELECT hostel_name FROM hostels WHERE hostel_id = ?",
      [scope.id]
    );
    return hostel?.hostel_name || null;
  }
  return null;
};

router.get("/", async (req, res) => {
  try {
    const defaultFromDate = new Date();
    const today = new Date();
    defaultFromDate.setDate(today.getDate() - 35);
    const { facultyId, fromDate, toDate } = req.query;

    const sanitizedFromDate =
      fromDate || defaultFromDate.toISOString().split("T")[0];
    const sanitizedToDate = toDate || today.toISOString().split("T")[0];

    if (!facultyId) {
      return res
        .status(400)
        .json({ message: "Bad request. Employee ID not specified." });
    }

    const [[faculty]] = await pool.query(
      `
        SELECT 
            f.*,
            d.department_name,
            h.hostel_name
        FROM faculty f
        LEFT JOIN departments d ON f.department_id = d.department_id
        LEFT JOIN hostels h ON f.hostel_id = h.hostel_id
        WHERE f.id = ?
    `,
      [facultyId]
    );

    if (!faculty) {
      return res.status(404).json({ error: "Faculty not found." });
    }

    if (!canAccessRecord(req.session.user, faculty)) {
      return res
        .status(403)
        .json({ error: "You cannot download this faculty report." });
    }

    const [leaveData] = await pool.query(
      `SELECT * FROM leaves l
       LEFT JOIN leave_details ld ON l.id = ld.leave_id
       WHERE l.faculty_id = ? 
       AND l.leave_date BETWEEN ? AND ?`,
      [facultyId, sanitizedFromDate, sanitizedToDate]
    );

    if (leaveData.length === 0) {
      return res.status(404).json({ error: "No leave data found." });
    }

    const scope = faculty.department_id
      ? {
          type: SCOPE_TYPES.DEPARTMENT,
          id: faculty.department_id,
          name: faculty.department_name,
        }
      : {
          type: SCOPE_TYPES.HOSTEL,
          id: faculty.hostel_id,
          name: faculty.hostel_name,
        };
    const scopeLabel = formatScopeLabel(scope);

    const pdfBuffer = await generatePDF(
      faculty,
      leaveData,
      sanitizedFromDate,
      sanitizedToDate,
      scopeLabel
    );
    const pdf = Stream.Readable.from(pdfBuffer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");

    pdf.pipe(res);
    pdf.on("end", () => res.end());
  } catch (error) {
    console.error("Error processing PDF request:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Route to get combined PDF
// Route to get combined PDF
router.get("/all", async (req, res) => {
  try {
    const defaultFromDate = new Date();
    const today = new Date();
    defaultFromDate.setDate(today.getDate() - 35);
    
    const { fromDate, toDate, scopeType, scopeId } = req.query;

    const sanitizedFromDate = fromDate || defaultFromDate.toISOString().split("T")[0];
    const sanitizedToDate = toDate || today.toISOString().split("T")[0];

    let rows = [];
    let scopeLabel = "All Departments";
    let scope = null;

    // Handle different scope types
    if (scopeType === 'department' && scopeId === 'all') {
      // ALL DEPARTMENTS - Fetch data from all departments
      console.log('Generating report for ALL departments');
      
      [rows] = await pool.query(
        `
        SELECT 
            faculty.id, 
            faculty.faculty_name, 
            faculty.designation, 
            faculty.member_type,
            faculty.department_id,
            d.department_name,
            SUM(CASE WHEN leave_category = 'short_leaves' THEN 1 ELSE 0 END) AS short_leaves,
            SUM(CASE WHEN leave_category = 'half_day_leaves' THEN 1 ELSE 0 END) AS half_day_leaves,
            SUM(CASE WHEN leave_category = 'casual_leaves' THEN 1 ELSE 0 END) AS casual_leaves,
            SUM(CASE WHEN leave_category = 'academic_leaves' THEN 1 ELSE 0 END) AS academic_leaves,
            SUM(CASE WHEN leave_category = 'medical_leaves' THEN 1 ELSE 0 END) AS medical_leaves,
            SUM(CASE WHEN leave_category = 'compensatory_leaves' THEN 1 ELSE 0 END) AS compensatory_leaves,
            SUM(CASE WHEN leave_category = 'other_leaves' THEN 1 ELSE 0 END) AS other_leaves,
            faculty.remaining_leaves,
            faculty.total_leaves
        FROM faculty
        LEFT JOIN leaves ON faculty.id = leaves.faculty_id
        LEFT JOIN departments d ON faculty.department_id = d.department_id
        WHERE faculty.department_id IS NOT NULL
        GROUP BY faculty.id, faculty.department_id, d.department_name
        ORDER BY 
            d.department_name,
            faculty.designation DESC,
            REGEXP_REPLACE(faculty.faculty_name, '^(Er\\.|Dr\\.|Mr\\.|Ms\\.|Prof\\.|S\\.|Er|Dr|Mr|Ms|Prof|S)\\s*', '') ASC;
        `
      );
      
      scopeLabel = "All Departments";
      
    } else if (scopeType === 'hostel' && scopeId === 'all') {
      // ALL HOSTELS - Fetch data from all hostels
      console.log('Generating report for ALL hostels');
      
      [rows] = await pool.query(
        `
        SELECT 
            faculty.id, 
            faculty.faculty_name, 
            faculty.designation, 
            faculty.member_type,
            faculty.hostel_id,
            h.hostel_name,
            SUM(CASE WHEN leave_category = 'short_leaves' THEN 1 ELSE 0 END) AS short_leaves,
            SUM(CASE WHEN leave_category = 'half_day_leaves' THEN 1 ELSE 0 END) AS half_day_leaves,
            SUM(CASE WHEN leave_category = 'casual_leaves' THEN 1 ELSE 0 END) AS casual_leaves,
            SUM(CASE WHEN leave_category = 'academic_leaves' THEN 1 ELSE 0 END) AS academic_leaves,
            SUM(CASE WHEN leave_category = 'medical_leaves' THEN 1 ELSE 0 END) AS medical_leaves,
            SUM(CASE WHEN leave_category = 'compensatory_leaves' THEN 1 ELSE 0 END) AS compensatory_leaves,
            SUM(CASE WHEN leave_category = 'other_leaves' THEN 1 ELSE 0 END) AS other_leaves,
            faculty.remaining_leaves,
            faculty.total_leaves
        FROM faculty
        LEFT JOIN leaves ON faculty.id = leaves.faculty_id
        LEFT JOIN hostels h ON faculty.hostel_id = h.hostel_id
        WHERE faculty.hostel_id IS NOT NULL
        GROUP BY faculty.id, faculty.hostel_id, h.hostel_name
        ORDER BY 
            h.hostel_name,
            faculty.designation DESC,
            REGEXP_REPLACE(faculty.faculty_name, '^(Er\\.|Dr\\.|Mr\\.|Ms\\.|Prof\\.|S\\.|Er|Dr|Mr|Ms|Prof|S)\\s*', '') ASC;
        `
      );
      
      scopeLabel = "All Hostels";
      
    } else {
      // SINGLE DEPARTMENT/HOSTEL (existing logic)
      scope = resolveScopeFromRequest(req, { allowNullForGlobal: false });
      if (!scope) {
        return res.status(400).json({ error: "Scope (department/hostel) is required." });
      }

      const column = scope.type === SCOPE_TYPES.DEPARTMENT ? "faculty.department_id" : "faculty.hostel_id";

      [rows] = await pool.query(
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
            SUM(CASE WHEN leave_category = 'other_leaves' THEN 1 ELSE 0 END) AS other_leaves,
            faculty.remaining_leaves,
            faculty.total_leaves
        FROM faculty
        LEFT JOIN leaves ON faculty.id = leaves.faculty_id
        WHERE ${column} = ?
        GROUP BY faculty.id
        ORDER BY 
            faculty.designation DESC,
            REGEXP_REPLACE(faculty.faculty_name, '^(Er\\.|Dr\\.|Mr\\.|Ms\\.|Prof\\.|S\\.|Er|Dr|Mr|Ms|Prof|S)\\s*', '') ASC;
        `,
        [scope.id]
      );

      const scopeName = await fetchScopeName(scope);
      scopeLabel = formatScopeLabel({ ...scope, name: scopeName });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: "No faculty data found." });
    }

    // Sort by designation priority
    const designationPriority = {
      Professor: 1,
      "Associate Professor": 2,
      "Assistant Professor": 3,
      Clerk: 4,
      "Lab Technician": 5,
      "Lab Attendant": 6,
      Attendant: 7,
    };

    rows.sort((a, b) => {
      const designationComparison = designationPriority[a.designation] - designationPriority[b.designation];
      return designationComparison;
    });

    // Generate PDFs
    const frontPage = await generateFrontPage(sanitizedFromDate, sanitizedToDate, scopeLabel);
    const pdfBuffers = [frontPage];

    // Group rows by department/hostel for "all" reports
    let groupedRows = rows;
    
    if (scopeType === 'department' && scopeId === 'all') {
      // Group by department for all departments report
      const departmentsMap = new Map();
      rows.forEach(row => {
        const deptId = row.department_id;
        if (!departmentsMap.has(deptId)) {
          departmentsMap.set(deptId, {
            name: row.department_name,
            faculty: []
          });
        }
        departmentsMap.get(deptId).faculty.push(row);
      });
      groupedRows = Array.from(departmentsMap.values());
    } else if (scopeType === 'hostel' && scopeId === 'all') {
      // Group by hostel for all hostels report
      const hostelsMap = new Map();
      rows.forEach(row => {
        const hostelId = row.hostel_id;
        if (!hostelsMap.has(hostelId)) {
          hostelsMap.set(hostelId, {
            name: row.hostel_name,
            faculty: []
          });
        }
        hostelsMap.get(hostelId).faculty.push(row);
      });
      groupedRows = Array.from(hostelsMap.values());
    }

    // Generate PDF for each faculty/group
    for (const item of groupedRows) {
      try {
        let facultyList = [];
        let groupName = "";
        
        if (scopeType && scopeId === 'all') {
          // For "all" reports, process group of faculty
          facultyList = item.faculty;
          groupName = item.name;
        } else {
          // For single scope, process individual faculty
          facultyList = [item];
        }
        
        for (const faculty of facultyList) {
          const [leaveData] = await pool.query(
            `SELECT * FROM leaves l
             LEFT JOIN leave_details ld ON l.id = ld.leave_id
             WHERE l.faculty_id = ?
             AND l.leave_date BETWEEN ? AND ?`,
            [faculty.id, sanitizedFromDate, sanitizedToDate]
          );

          if (leaveData.length === 0) continue;

          // For "all" reports, include department/hostel name in scope label
          let facultyScopeLabel = scopeLabel;
          if ((scopeType === 'department' && scopeId === 'all') && faculty.department_name) {
            facultyScopeLabel = `${scopeLabel} - ${faculty.department_name}`;
          } else if ((scopeType === 'hostel' && scopeId === 'all') && faculty.hostel_name) {
            facultyScopeLabel = `${scopeLabel} - ${faculty.hostel_name}`;
          }

          const pdfBuffer = await generatePDF(
            faculty,
            leaveData,
            sanitizedFromDate,
            sanitizedToDate,
            facultyScopeLabel
          );
          pdfBuffers.push(pdfBuffer);
        }
      } catch (err) {
        console.error(`Error fetching leave data:`, err);
      }
    }

    // Merge PDFs
    const mergedPdf = await PDFDocument.create();

    for (const pdfBfr of pdfBuffers) {
      try {
        const pdfDoc = await PDFDocument.load(pdfBfr);
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error("Error merging PDFs:", err);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    const readableStream = Stream.Readable.from([mergedPdfBytes]);

    // Set filename based on report type
    let filename = "leave_data.pdf";
    if (scopeType === 'department' && scopeId === 'all') {
      filename = `all_departments_${sanitizedFromDate}_to_${sanitizedToDate}.pdf`;
    } else if (scopeType === 'hostel' && scopeId === 'all') {
      filename = `all_hostels_${sanitizedFromDate}_to_${sanitizedToDate}.pdf`;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    readableStream.pipe(res);
    readableStream.on("end", () => res.end());
  } catch (error) {
    console.error("Error processing combined PDF request:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Route to get Todays (one day) report
router.get("/todays-report", async (req, res) => {
  console.log("req for todays report came");

  try {
    const today = new Date();
    const date = today.toISOString().split("T")[0];

    const scope = resolveScopeFromRequest(req, { allowNullForGlobal: false });
    if (!scope) {
      return res
        .status(400)
        .json({ error: "Scope (department/hostel) is required." });
    }

    const column =
      scope.type === SCOPE_TYPES.DEPARTMENT
        ? "faculty.department_id"
        : "faculty.hostel_id";

    const [rows] = await pool.query(
      `
      SELECT 
          faculty.id, 
          faculty.faculty_name, 
          faculty.designation,
          faculty.remaining_leaves,
          faculty.total_leaves
      FROM faculty
      LEFT JOIN leaves ON faculty.id = leaves.faculty_id
      WHERE ${column} = ?
      GROUP BY faculty.id
      ORDER BY 
          faculty.designation DESC,
          REGEXP_REPLACE(faculty.faculty_name, '^(Er\.|Dr\.|Mr\.|Ms\.|Prof\.|S\.|Er|Dr|Mr|Ms|Prof|S)\s*', '') ASC;
    `,
      [scope.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No faculty data found." });
    }

    const scopeName = await fetchScopeName(scope);
    const scopeLabel = formatScopeLabel({ ...scope, name: scopeName });

    // Generate PDFs
    const oneDayLeaveData = [];

    for (const faculty of rows) {
      try {
        const [leaveData] = await pool.query(
          `SELECT * FROM leaves l
           LEFT JOIN leave_details ld ON l.id = ld.leave_id
           WHERE l.faculty_id = ?
           AND l.leave_date = ?`,
          [faculty.id, date]
        );
        if (leaveData.length === 0) continue;

        oneDayLeaveData.push([faculty, leaveData]);
      } catch (err) {
        console.error(`Error fetching leaveData for ${faculty.id} `, err);
      }
    }
    console.log(oneDayLeaveData, "asagohan leavedata");

    if (oneDayLeaveData.length === 0) {
      return res
        .status(404)
        .json({ error: `No leave records found for today i.e. ${date}` });
    }
    const pdfBuffer = await generateOneDayReport(
      oneDayLeaveData,
      date,
      scopeLabel
    );

    const pdf = Stream.Readable.from(pdfBuffer);
    pdf.pipe(res);
    pdf.on("end", () => res.end());

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="leave_data.pdf"`);
  } catch (error) {
    console.error("Error processing combined PDF request:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
