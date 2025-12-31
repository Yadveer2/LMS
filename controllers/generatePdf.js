const PdfPrinter = require("pdfmake");
const path = require("path");
const fs = require("fs");
const { format } = require("date-fns");
const { buffer } = require("stream/consumers");
const { text } = require("body-parser");

// Define font styles
const fonts = {
  Roboto: {
    normal: path.join(__dirname, "fonts/Roboto-Regular.ttf"),
    bold: path.join(__dirname, "fonts/Roboto-Medium.ttf"),
    italics: path.join(__dirname, "fonts/Roboto-Italic.ttf"),
    bolditalics: path.join(__dirname, "fonts/Roboto-MediumItalic.ttf"),
  },
  bigHeadingFont: {
    normal: path.join(__dirname, "fonts/DMSerifText-Regular.ttf"),
    bold: path.join(__dirname, "fonts/DMSerifText-Regular.ttf"),
  },
};

const printer = new PdfPrinter(fonts);

// header definition
const header = {
  margin: [40, 20, 40, 15],
  stack: [
    {
      columns: [
        {
          // College logo
          image: path.join(
            __dirname,
            "..",
            "public",
            "assets",
            "Img",
            "collegeLogo.png"
          ),
          width: 80,
          //   height: 60,
        },
        {
          // College name with subheading
          stack: [
            // {
            //   text: "ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਇੰਜੀਨੀਅਰਿੰਗ ਕਾਲਜ਼",
            //   alignment: "center",
            //   fontSize: 25,
            //   color: "#cf1e18",
            //   bold: true,
            // },
            {
              text: "Guru Nanak Dev Engineering College",
              alignment: "center",
              fontSize: 25,
              color: "#0d0046",
              bold: true,
            },
            {
              text: "An Autonomous College Under UGC Act 1956",
              alignment: "center",
              fontSize: 14,
              color: "#cf1e18",
              bold: true,
            },
          ],
          margin: [10, 10, 0, 0],
        },
      ],
    },
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 515, // Full width of A4 minus margins
          y2: 0,
          lineWidth: 1.5,
          color: "#000000", // Black line
        },
      ],
      margin: [0, 10, 0, 0], // Top and bottom spacing
    },
  ],
};

// Footer definition
const footer = {
  margin: [40, 10, 40, 0],
  stack: [
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 515, // Full width of A4 minus margins
          y2: 0,
          lineWidth: 1.5,
          color: "#000000", // Black line
        },
      ],
    },
    {
      text: "Gill Park, Gill Road, Ludhiana-141006 Punjab",
      alignment: "center",
      fontSize: 10,
      color: "grey",
      margin: [0, 10, 0, 0],
    },
  ],
};

/**
 * Function to generate a single PDF
 * @param {Object} faculty - Faculty Object
 * @param {Array} leaveData - All the existing leave records
 * @param {String} fromDate - Start date in PDF heading
 * @param {String} toDate - End date in PDF heading
 * @param {String} scopeLabel - Scope display label (e.g., Department or Hostel)
 * @returns {Buffer}
 */
async function generatePDF(
  faculty,
  leaveData,
  fromDate,
  toDate,
  scopeLabel
) {
  fromDate = fromDate && format(new Date(fromDate), "dd/MM/yyyy");
  toDate = toDate && format(new Date(toDate), "dd/MM/yyyy");
  let sn = 1;

  // Count occurrences of each leave category in the provided leaveData
  const countCategories = leaveData.reduce((acc, curr) => {
    acc[curr.leave_category] = (acc[curr.leave_category] || 0) + 1;
    return acc;
  }, {});

  // Compute total day-equivalents excluding academic_leaves
  const shortCount = countCategories.short_leaves || 0;
  const halfCount = countCategories.half_day_leaves || 0;
  const casualCount = countCategories.casual_leaves || 0;
  const medicalCount = countCategories.medical_leaves || 0;
  const compensatoryCount = countCategories.compensatory_leaves || 0;
  const earnedCount = countCategories.earned_leaves || 0;
  const withoutPaymentCount = countCategories.without_payment_leaves || 0;

  const totalDayEquivalents = parseFloat(
    (
      shortCount * 0.33 +
      halfCount * 0.5 +
      casualCount +
      medicalCount +
      compensatoryCount +
      earnedCount +
      withoutPaymentCount
    ).toFixed(2)
  );

  countCategories.total_leaves = totalDayEquivalents;
  countCategories.remaining_leaves = faculty.remaining_leaves;

  // Attach per-type granted/remaining balances from faculty record if available
  countCategories.balances = {
    short_granted: faculty.short_leaves_granted || 0,
    short_remaining: faculty.short_leaves_remaining || 0,
    half_granted: faculty.half_day_leaves_granted || 0,
    half_remaining: faculty.half_day_leaves_remaining || 0,
    casual_granted: faculty.casual_leaves_granted || 0,
    casual_remaining: faculty.casual_leaves_remaining || 0,
    medical_granted: faculty.medical_leaves_granted || 0,
    medical_remaining: faculty.medical_leaves_remaining || 0,
    without_payment_granted: faculty.without_payment_leaves_granted || 0,
    without_payment_remaining: faculty.without_payment_leaves_remaining || 0,
    compensatory_granted: faculty.compensatory_leaves_granted || 0,
    compensatory_remaining: faculty.compensatory_leaves_remaining || 0,
    earned_granted: faculty.earned_leaves_granted || 0,
    earned_remaining: faculty.earned_leaves_remaining || 0,
    academic_granted: faculty.academic_leaves_granted || 0,
    academic_remaining: faculty.academic_leaves_remaining || 0,
  };

  const docDefinition = {
    // Page settings
    pageSize: "A4",
    pageMargins: [40, 120, 40, 70], // left, top, right, bottom
    header: header,
    footer: footer,

    content: [
      {
        text: scopeLabel,
        style: "heading",
        alignment: "center",
        fontSize: 17,
        bold: true,
      },
      // Leave Details Heading
      {
        text: `Leave Details - ${faculty.faculty_name} (${faculty.designation})`,
        style: "heading",
        margin: [0, 20, 0, 10],
      },

      // Date Range
      {
        text: `Date Range: ${fromDate} to ${toDate}`,
        margin: [0, 0, 0, 20],
      },

      // Leave Details Table
      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "*"], // SN will auto-size, others will share remaining space
          body: [
            // Header row
            [
              { text: "SN", style: "tableHeader" },
              { text: "Leave Category", style: "tableHeader" },
              { text: "Leave Date", style: "tableHeader" },
            ],
            // Data rows will be added dynamically
            ...leaveData.map((leaveObj) => {
              const leaveType = `${leaveObj.leave_category
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase())
                .replace(/\bLeaves\b/i, "Leave")
                .replace(/\bFull Day Leave\b/i, "Casual Leave")
                .replace(/\bMedical Leaves\b/i, "Medical/Maternity Leave")} ${
                ((leaveObj.short_leave_from || leaveObj.half_leave_type) &&
                  `(${
                    leaveObj.half_leave_type
                      ?.replace(/_/g, " ")
                      .replace(/\b\w/g, (char) => char.toUpperCase()) ||
                    leaveObj.short_leave_from + " to " + leaveObj.short_leave_to
                  })`) ||
                ""
              }`;
              const leaveDate = format(
                new Date(leaveObj.leave_date),
                "dd/MM/yyyy"
              );
              return [sn++, leaveType, leaveDate];
            }),
          ],
        },
      },
    ],

    // Styles definition
    styles: {
      heading: {
        fontSize: 14,
        bold: true,
      },
      tableHeader: {
        bold: true,
        fillColor: "#f3f3f3",
        margin: [5, 5, 5, 5],
      },
    },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return await generatePdfBuffer(pdfDoc);
}

// Function to generate front page
/**
 *
 * @param {String} fromDate - Start date in title
 * @param {String} toDate - End date in title
 * @param {String} scopeLabel - Scope label text
 * @returns {Buffer}
 */
async function generateFrontPage(fromDate, toDate, scopeLabel) {
  fromDate = fromDate && format(new Date(fromDate), "dd/MM/yyyy");
  toDate = toDate && format(new Date(toDate), "dd/MM/yyyy");
  let sn = 1;
  const docDefinition = {
    // Page settings
    pageSize: "A4",
    pageMargins: [40, 120, 40, 70], // left, top, right, bottom
    header: header,
    footer: footer,

    content: [
      {
        text: `FACULTY\nLEAVE REPORT\n\n${fromDate}\nto\n${toDate}`,
        style: "bigHeading", // Apply custom style
        alignment: "center", // Horizontally center
        margin: [0, 70, 0, 50], // Adjust margins for vertical centering
        width: "auto", // Allow the text to wrap automatically
      },
      {
        text: scopeLabel,
        style: "heading",
        alignment: "center",
        margin: [0, 70, 0, 0],
        width: "autO",
      },
    ],
    styles: {
      bigHeading: {
        fontSize: 46,
        font: "bigHeadingFont",
        bold: true,
        color: "#000",
      },

      heading: {
        fontSize: 24,
        bold: true,
        color: "#000",
      },
    },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return await generatePdfBuffer(pdfDoc);
}

/**
 *
 * @param {Array<Array<Object>>} oneDayLeaveData - Each nested array contains two Objects, First Object contains faculty details and the second object contains the leave details.
 * @param {String} date - Date in the heading of the PDF
 * @param {String} scopeLabel - Scope label for heading (department/hostel)
 * @returns {Buffer}
 */
async function generateOneDayReport(oneDayLeaveData, date, scopeLabel) {
  console.log(oneDayLeaveData);

  let sn = 0;
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 120, 40, 70],
    header: header,
    footer: footer,

    content: [
      {
        text: scopeLabel,
        style: "heading",
        alignment: "center",
        fontSize: 17,
        bold: true,
      },
      {
        table: {
          widths: ["auto", "*"],
          body: [
            [
              { text: `To`, margin: [0, 20, 0, 10] },
              {
                text: `${format(date, "dd/MM/yyyy")}`,
                bold: true,
                alignment: "right",
                margin: [0, 20, 0, 10],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 20, 0, 0],
      },
      { text: `The Principal`, margin: [0, 0, 0, 20] },

      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "*", "*"],
          body: [
            [
              { text: "SN", style: "tableHeader" },
              { text: "Faculty Name", style: "tableHeader" },
              { text: "Designation", style: "tableHeader" },
              { text: "Leave Category", style: "tableHeader" },
            ],
            ...oneDayLeaveData.flatMap(([faculty, leaveData]) => {
              if (!Array.isArray(leaveData)) return [];
              return leaveData.map((leaveObj) => {
                const leaveType = `${leaveObj.leave_category
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (char) => char.toUpperCase())
                  .replace(/\bLeaves\b/i, "Leave")
                  .replace(/\bFull Day Leave\b/i, "Casual Leave")
                  .replace(/\bMedical Leaves\b/i, "Medical/Maternity Leave")} ${
                  leaveObj.short_leave_from || leaveObj.half_leave_type
                    ? `(${
                        leaveObj.half_leave_type
                          ?.replace(/_/g, " ")
                          .replace(/\b\w/g, (char) => char.toUpperCase()) ||
                        leaveObj.short_leave_from +
                          " to " +
                          leaveObj.short_leave_to
                      })`
                    : ""
                }`;

                return [
                  ++sn,
                  faculty.faculty_name,
                  faculty.designation,
                  leaveType,
                ];
              });
            }),
          ],
        },
      },
    ],

    styles: {
      heading: { fontSize: 14, bold: true },
      tableHeader: { bold: true, fillColor: "#f3f3f3", margin: [5, 5, 5, 5] },
    },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return await generatePdfBuffer(pdfDoc);
}

/**
 * Helper function for generating PDF Buffer
 * @param {*} pdfDoc 
 * @returns 
 */
function generatePdfBuffer(pdfDoc) {
  const pdfBuffers = [];

  // Pipe the PDF document to the buffer
  pdfDoc.on("data", (chunk) => pdfBuffers.push(chunk));
  pdfDoc.end();

  return new Promise((resolve, reject) => {
    try {
      pdfDoc.on("end", () => {
        const pdfBuffer = Buffer.concat(pdfBuffers);
        resolve(pdfBuffer);
      });
    } catch (err) {
      return console.log(err);
    }
  });
}

module.exports = { generatePDF, generateFrontPage, generateOneDayReport };