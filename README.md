# Leave Management System

## Overview
This repository implements a Faculty Leave Management web application built with Node.js and Express, backed by MySQL. The project provides a browser-based UI (files under `public/`) for managing faculties and leave records, server routes for API and PDF generation, and helper services for authentication and validation.

## Project layout
- `server.js` — application entry point
- `routes/` — Express routes (e.g., `routes/pdf.js`)
- `controllers/` — controller utilities (includes `generatePdf.js`)
- `public/` — client-side pages and assets (HTML, JS, CSS)
- `services/` — auth/validation helpers (`authz.js`, `leaveValidation.js`, `helpers.js`)
- `schema.sql` — database schema and sample tables
- `package.json` — project metadata and scripts

Files you will likely edit during development:
- `public/*.html`, `public/*.js`, `public/*.css` — UI pages and client scripts
- `routes/*.js` — add or change API endpoints
- `controllers/*.js` — server-side business logic (PDF generation, data aggregation)
- `services/*.js` — authorization and validation utilities

## Key features
- Session-based authentication and authorization hooks
- Add and track different leave types per faculty
- Detailed per-day leave records and summary balances
- PDF generation endpoint (uses `controllers/generatePdf.js`)

Behavioral notes:
- Short leaves are tracked separately and converted to casual leave according to business rules implemented in the server logic (see `services/` and controller code).

## Prerequisites
- Node.js (14+ recommended)
- MySQL server

## Quickstart
1. Install dependencies:

```bash
npm install
```

2. Create a MySQL database and import the schema:

```sql
CREATE DATABASE leave_management;
USE leave_management;
-- from project root
SOURCE schema.sql;
```

3. Create a `.env` file in the project root with database and session settings (example):

```env
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=leave_management
SESSION_SECRET=your_session_secret
PORT=3300
```

4. Start the server:

```bash
node server.js
```

5. Open the UI in your browser at `http://localhost:3300/` (or `http://localhost:<PORT>/` if changed).

If your `package.json` defines a start script you can run `npm start` instead of `node server.js`.

## PDF generation
The project exposes a PDF route handled by `routes/pdf.js` and `controllers/generatePdf.js`. Use the corresponding UI or request the route directly to generate PDF reports of leave records.

## Development notes
- Client pages live in `public/` (examples: `leaveDetails.html`, `main.html`, `principal.html`).
- Server routes are defined under `routes/` and use services from `services/` for auth and validation.
- To add new pages, place them in `public/` and wire any new API endpoints in `routes/`.

Common files to inspect when troubleshooting:
- `server.js` — server startup, middleware, and route registration
- `routes/pdf.js` — PDF route handlers
- `controllers/generatePdf.js` — PDF generation logic and templates
- `services/authz.js` — authentication/authorization middleware
- `schema.sql` — create tables and initial data

## Deployment
- In production, run behind a reverse proxy (Nginx) and use a process manager like `pm2`:

```bash
npm install -g pm2
pm2 start server.js --name leave_mgmt
pm2 save
pm2 startup
```

## Security
- Use strong credentials for the DB and `SESSION_SECRET`.
- Run the app over HTTPS in production.
- Limit DB access to trusted hosts.

Additional recommendations:
- Rotate the `SESSION_SECRET` and store secrets outside the repository (e.g. environment variables, secret manager).
- Sanitize and validate user input on both client and server. The project includes `services/leaveValidation.js` for server-side validation.

## Where to look next
- API routes: `routes/`
- PDF logic: `controllers/generatePdf.js`
- Client UI: `public/`

## Database schema (example)
Below are minimal table samples that fit the app's structure. Confirm and adapt to `schema.sql` in the repo:

```sql
CREATE TABLE faculty (
	id INT AUTO_INCREMENT PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	designation VARCHAR(100) NOT NULL,
	total_leaves INT DEFAULT 0
);

CREATE TABLE leaves (
	id INT AUTO_INCREMENT PRIMARY KEY,
	faculty_id INT NOT NULL,
	leave_category VARCHAR(50) NOT NULL,
	leave_date DATE NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (faculty_id) REFERENCES faculty(id)
);
```

If the real `schema.sql` contains additional tables (users, roles, sessions), import that file instead.

---

Maintainers:
- Project Owner: YADVEER
- Project Owner: PRABNOOR SINGH




---

If you want, I can:
- run the server locally and confirm it serves the `public/` pages,
- open `routes/` to extract exact endpoints to list in the README,
- or create a brief `CONTRIBUTING.md` with dev setup steps.

