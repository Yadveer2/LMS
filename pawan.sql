CREATE TABLE activity_logs (
  id int(11) NOT NULL,
  actor_id int(11) NOT NULL,
  action varchar(255) NOT NULL,
  entity_type varchar(100) DEFAULT NULL,
  entity_id varchar(255) DEFAULT NULL,
  meta_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(meta_json)),
  created_at timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE departments (
  department_id int(11) NOT NULL,
  department_name varchar(255) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO departments (department_id, department_name, created_at) VALUES
(1, 'Computer Science', '2025-12-03 05:18:04'),
(4, 'Electrical Engineering', '2025-12-05 05:18:04'),
(5, 'Electronics and Communication', '2025-12-05 05:18:04'),
(6, 'Civil Engineering', '2025-12-05 05:18:04');
CREATE TABLE faculty (
  id int(11) NOT NULL,
  faculty_name varchar(255) NOT NULL,
  designation varchar(100) NOT NULL,
  member_type enum('faculty','staff') NOT NULL DEFAULT 'faculty',
  created_at timestamp NULL DEFAULT current_timestamp(),
  total_leaves decimal(10,2) DEFAULT 0.00,
  granted_leaves decimal(10,2) DEFAULT 0.00,
  remaining_leaves decimal(10,2) DEFAULT 0.00,
  department_id int(11) DEFAULT NULL,
  hostel_id int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE hostels (
  hostel_id int(11) NOT NULL,
  hostel_name varchar(255) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO hostels (hostel_id, hostel_name, created_at) VALUES
(1, 'Boys Hostel', '2025-12-05 05:18:04'),
(3, 'Hostel 3', '2025-12-05 05:18:04');
CREATE TABLE leaves (
  id int(11) NOT NULL,
  faculty_id int(11) NOT NULL,
  leave_date date NOT NULL,
  updated_at timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  leave_category enum('short_leaves','half_day_leaves','casual_leaves','academic_leaves','medical_leaves','compensatory_leaves','earned_leaves','without_payment_leaves','other_leaves') DEFAULT NULL,
  created_at timestamp NULL DEFAULT current_timestamp(),
  department_id int(11) DEFAULT NULL,
  hostel_id int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE leave_details (
  id int(11) NOT NULL,
  leave_id int(11) NOT NULL,
  half_leave_type enum('before_noon','after_noon') DEFAULT NULL,
  short_leave_from time DEFAULT NULL,
  short_leave_to time DEFAULT NULL,
  created_at timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE sessions (
  session_id varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  expires int(11) UNSIGNED NOT NULL,
  data mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE users (
  id int(11) NOT NULL,
  username varchar(50) NOT NULL,
  password varchar(60) NOT NULL,
  department_id int(11) DEFAULT NULL,
  hostel_id int(11) DEFAULT NULL,
  role enum('department_admin','department_staff','hostel_admin','hostel_staff','establishment_admin','principal_admin','superadmin') DEFAULT 'department_staff',
  status enum('active','inactive') DEFAULT 'active',
  created_at timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO users (id, username, password, department_id, hostel_id, role, status, created_at) VALUES
(1, 'admin', '0192023a7bbd73250516f069df18b500', 1, NULL, 'department_admin', 'active', '2025-11-27 15:23:22'),
(3, 'superadmin', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'superadmin', 'active', '2025-11-27 15:32:51'),
(5, 'estdept', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'establishment_admin', 'active', '2025-12-01 14:38:31'),
(7, 'ceadmin', '0192023a7bbd73250516f069df18b500', 6, NULL, 'department_admin', 'active', '2025-12-02 16:43:08'),
(8, 'hostel', '0192023a7bbd73250516f069df18b500', NULL, 1, 'hostel_admin', 'active', '2025-12-03 11:28:21'),
(9, 'principal', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'principal_admin', 'active', '2025-12-05 07:16:09');
ALTER TABLE activity_logs
  ADD PRIMARY KEY (id),
  ADD KEY activity_logs_actor_id (actor_id);
ALTER TABLE departments
  ADD PRIMARY KEY (department_id),
  ADD UNIQUE KEY department_name (department_name);
ALTER TABLE faculty
  ADD PRIMARY KEY (id),
  ADD KEY idx_faculty_name (faculty_name),
  ADD KEY department_id (department_id),
  ADD KEY hostel_id (hostel_id);
ALTER TABLE hostels
  ADD PRIMARY KEY (hostel_id),
  ADD UNIQUE KEY hostel_name (hostel_name);
ALTER TABLE leaves
  ADD PRIMARY KEY (id),
  ADD KEY faculty_id (faculty_id),
  ADD KEY leaves_department_id (department_id),
  ADD KEY leaves_hostel_id (hostel_id);
ALTER TABLE leave_details
  ADD PRIMARY KEY (id),
  ADD KEY leave_id (leave_id);

ALTER TABLE sessions
  ADD PRIMARY KEY (session_id);

ALTER TABLE users
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY username (username),
  ADD KEY department_id (department_id),
  ADD KEY hostel_id (hostel_id);

ALTER TABLE activity_logs
  MODIFY id int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=368;

--
-- AUTO_INCREMENT for table departments
--
ALTER TABLE departments
  MODIFY department_id int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table faculty
--
ALTER TABLE faculty
  MODIFY id int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table hostels
--
ALTER TABLE hostels
  MODIFY hostel_id int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table leaves
--
ALTER TABLE leaves
  MODIFY id int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table leave_details
--
ALTER TABLE leave_details
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table users
--
ALTER TABLE users
  MODIFY id int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- Constraints for dumped tables
--

--
-- Constraints for table activity_logs
--
ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id);

--
-- Constraints for table faculty
--
ALTER TABLE faculty
  ADD CONSTRAINT faculty_ibfk_1 FOREIGN KEY (department_id) REFERENCES departments (department_id),
  ADD CONSTRAINT faculty_ibfk_2 FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id);

--
-- Constraints for table leaves
--
ALTER TABLE leaves
  ADD CONSTRAINT leaves_ibfk_1 FOREIGN KEY (faculty_id) REFERENCES faculty (id),
  ADD CONSTRAINT leaves_ibfk_2 FOREIGN KEY (department_id) REFERENCES departments (department_id),
  ADD CONSTRAINT leaves_ibfk_3 FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id);

--
-- Constraints for table leave_details
--
ALTER TABLE leave_details
  ADD CONSTRAINT leave_details_ibfk_1 FOREIGN KEY (leave_id) REFERENCES leaves (id) ON DELETE CASCADE;

--
-- Constraints for table users
--
ALTER TABLE users
  ADD CONSTRAINT users_ibfk_1 FOREIGN KEY (department_id) REFERENCES departments (department_id),
  ADD CONSTRAINT users_ibfk_2 FOREIGN KEY (hostel_id) REFERENCES hostels (hostel_id);
-- Add per-leave-type granted and remaining columns and personnel metadata
ALTER TABLE faculty
  ADD COLUMN short_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN short_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN half_day_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN half_day_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN casual_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN casual_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN medical_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN medical_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN without_payment_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN without_payment_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN compensatory_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN compensatory_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN earned_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN earned_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN academic_leaves_granted decimal(10,2) DEFAULT 0.00,
  ADD COLUMN academic_leaves_remaining decimal(10,2) DEFAULT 0.00,
  ADD COLUMN year_of_joining YEAR DEFAULT NULL,
  ADD COLUMN employment_type enum('regular','89_days','daily','contract') DEFAULT NULL,
  ADD COLUMN remark TEXT DEFAULT NULL,
  ADD COLUMN is_teaching TINYINT(1) DEFAULT 0;
COMMIT;