-- Consolidated updated schema generated from schema.sql
-- Final table definitions with added columns and constraints

DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `leave_details`;
DROP TABLE IF EXISTS `leaves`;
DROP TABLE IF EXISTS `faculty`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `hostels`;
DROP TABLE IF EXISTS `sessions`;

CREATE TABLE departments (
  department_id int(11) NOT NULL AUTO_INCREMENT,
  department_name varchar(255) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (department_id),
  UNIQUE KEY department_name (department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE hostels (
  hostel_id int(11) NOT NULL AUTO_INCREMENT,
  hostel_name varchar(255) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (hostel_id),
  UNIQUE KEY hostel_name (hostel_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE faculty (
  id int(11) NOT NULL AUTO_INCREMENT,
  faculty_name varchar(255) NOT NULL,
  designation varchar(100) NOT NULL,
  member_type enum('faculty','staff') NOT NULL DEFAULT 'faculty',
  created_at timestamp NULL DEFAULT current_timestamp(),
  total_leaves decimal(10,2) DEFAULT 0.00,
  granted_leaves decimal(10,2) DEFAULT 0.00,
  remaining_leaves decimal(10,2) DEFAULT 0.00,
  department_id int(11) DEFAULT NULL,
  hostel_id int(11) DEFAULT NULL,
  -- per-leave-type granted/remaining columns
  short_leaves_granted decimal(10,2) DEFAULT 0.00,
  short_leaves_remaining decimal(10,2) DEFAULT 0.00,
  half_day_leaves_granted decimal(10,2) DEFAULT 0.00,
  half_day_leaves_remaining decimal(10,2) DEFAULT 0.00,
  casual_leaves_granted decimal(10,2) DEFAULT 0.00,
  casual_leaves_remaining decimal(10,2) DEFAULT 0.00,
  medical_leaves_granted decimal(10,2) DEFAULT 0.00,
  medical_leaves_remaining decimal(10,2) DEFAULT 0.00,
  without_payment_leaves_granted decimal(10,2) DEFAULT 0.00,
  without_payment_leaves_remaining decimal(10,2) DEFAULT 0.00,
  compensatory_leaves_granted decimal(10,2) DEFAULT 0.00,
  compensatory_leaves_remaining decimal(10,2) DEFAULT 0.00,
  earned_leaves_granted decimal(10,2) DEFAULT 0.00,
  earned_leaves_remaining decimal(10,2) DEFAULT 0.00,
  academic_leaves_granted decimal(10,2) DEFAULT 0.00,
  academic_leaves_remaining decimal(10,2) DEFAULT 0.00,
  year_of_joining YEAR DEFAULT NULL,
  employment_type enum('regular','89_days','daily','contract') DEFAULT NULL,
  remark TEXT DEFAULT NULL,
  is_teaching TINYINT(1) DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_faculty_name (faculty_name),
  KEY department_id (department_id),
  KEY hostel_id (hostel_id),
  CONSTRAINT faculty_ibfk_1 FOREIGN KEY (department_id) REFERENCES departments (department_id),
  CONSTRAINT faculty_ibfk_2 FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE leaves (
  id int(11) NOT NULL AUTO_INCREMENT,
  faculty_id int(11) NOT NULL,
  leave_date date NOT NULL,
  updated_at timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  leave_category enum('short_leaves','half_day_leaves','casual_leaves','academic_leaves','medical_leaves','compensatory_leaves','earned_leaves','without_payment_leaves','other_leaves') DEFAULT NULL,
  created_at timestamp NULL DEFAULT current_timestamp(),
  department_id int(11) DEFAULT NULL,
  hostel_id int(11) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY faculty_id (faculty_id),
  KEY leaves_department_id (department_id),
  KEY leaves_hostel_id (hostel_id),
  CONSTRAINT leaves_ibfk_1 FOREIGN KEY (faculty_id) REFERENCES faculty (id),
  CONSTRAINT leaves_ibfk_2 FOREIGN KEY (department_id) REFERENCES departments (department_id),
  CONSTRAINT leaves_ibfk_3 FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE leave_details (
  id int(11) NOT NULL AUTO_INCREMENT,
  leave_id int(11) NOT NULL,
  half_leave_type enum('before_noon','after_noon') DEFAULT NULL,
  short_leave_from time DEFAULT NULL,
  short_leave_to time DEFAULT NULL,
  created_at timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY leave_id (leave_id),
  CONSTRAINT leave_details_ibfk_1 FOREIGN KEY (leave_id) REFERENCES leaves (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE sessions (
  session_id varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  expires int(11) UNSIGNED NOT NULL,
  data mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE users (
  id int(11) NOT NULL AUTO_INCREMENT,
  username varchar(50) NOT NULL,
  password varchar(60) NOT NULL,
  department_id int(11) DEFAULT NULL,
  hostel_id int(11) DEFAULT NULL,
  role enum('department_admin','department_staff','hostel_admin','hostel_staff','establishment_admin','principal_admin','superadmin') DEFAULT 'department_staff',
  status enum('active','inactive') DEFAULT 'active',
  created_at timestamp NULL DEFAULT current_timestamp(),
  current_session_id varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY username (username),
  KEY department_id (department_id),
  KEY hostel_id (hostel_id),
  CONSTRAINT users_ibfk_1 FOREIGN KEY (department_id) REFERENCES departments (department_id),
  CONSTRAINT users_ibfk_2 FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE activity_logs (
  id int(11) NOT NULL AUTO_INCREMENT,
  actor_id int(11) NOT NULL,
  action varchar(255) NOT NULL,
  entity_type varchar(100) DEFAULT NULL,
  entity_id varchar(255) DEFAULT NULL,
  meta_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(meta_json)),
  created_at timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY activity_logs_actor_id (actor_id),
  CONSTRAINT activity_logs_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed data from original dump
INSERT INTO departments (department_id, department_name, created_at) VALUES
(1, 'Computer Science', '2025-12-03 05:18:04'),
(4, 'Electrical Engineering', '2025-12-05 05:18:04'),
(5, 'Electronics and Communication', '2025-12-05 05:18:04'),
(6, 'Civil Engineering', '2025-12-05 05:18:04');

INSERT INTO hostels (hostel_id, hostel_name, created_at) VALUES
(1, 'Boys Hostel', '2025-12-05 05:18:04'),
(3, 'Hostel 3', '2025-12-05 05:18:04');

INSERT INTO users (id, username, password, department_id, hostel_id, role, status, created_at) VALUES
(1, 'admin', '0192023a7bbd73250516f069df18b500', 1, NULL, 'department_admin', 'active', '2025-11-27 15:23:22'),
(3, 'superadmin', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'superadmin', 'active', '2025-11-27 15:32:51'),
(5, 'estdept', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'establishment_admin', 'active', '2025-12-01 14:38:31'),
(7, 'ceadmin', '0192023a7bbd73250516f069df18b500', 6, NULL, 'department_admin', 'active', '2025-12-02 16:43:08'),
(8, 'hostel', '0192023a7bbd73250516f069df18b500', NULL, 1, 'hostel_admin', 'active', '2025-12-03 11:28:21'),
(9, 'principal', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'principal_admin', 'active', '2025-12-05 07:16:09');

-- Set AUTO_INCREMENT start values to match original dump
ALTER TABLE activity_logs AUTO_INCREMENT = 368;
ALTER TABLE departments AUTO_INCREMENT = 16;
ALTER TABLE faculty AUTO_INCREMENT = 21;
ALTER TABLE hostels AUTO_INCREMENT = 7;
ALTER TABLE leaves AUTO_INCREMENT = 12;
ALTER TABLE leave_details AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 10;

COMMIT;
