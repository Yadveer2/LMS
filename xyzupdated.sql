-- Enhanced Leave Management System Database Schema
-- Version: 2.0 - Improved Structure and Compatibility
-- Generated: January 2026
-- 
-- This schema addresses the following improvements:
-- 1. Added missing leave_types table for better leave category management
-- 2. Enhanced indexing for better performance
-- 3. Added proper constraints and data validation
-- 4. Improved session management
-- 5. Better normalization and data integrity
-- 6. Added audit trail enhancements

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Drop existing tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `leave_details`;
DROP TABLE IF EXISTS `leaves`;
DROP TABLE IF EXISTS `faculty`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `leave_types`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `hostels`;

-- --------------------------------------------------------
-- Table structure for table `departments`
-- --------------------------------------------------------

CREATE TABLE `departments` (
  `department_id` int(11) NOT NULL AUTO_INCREMENT,
  `department_name` varchar(255) NOT NULL,
  `department_code` varchar(10) DEFAULT NULL,
  `head_of_department` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`department_id`),
  UNIQUE KEY `department_name` (`department_name`),
  UNIQUE KEY `department_code` (`department_code`),
  KEY `idx_department_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `hostels`
-- --------------------------------------------------------

CREATE TABLE `hostels` (
  `hostel_id` int(11) NOT NULL AUTO_INCREMENT,
  `hostel_name` varchar(255) NOT NULL,
  `hostel_code` varchar(10) DEFAULT NULL,
  `warden_name` varchar(255) DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`hostel_id`),
  UNIQUE KEY `hostel_name` (`hostel_name`),
  UNIQUE KEY `hostel_code` (`hostel_code`),
  KEY `idx_hostel_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `leave_types`
-- --------------------------------------------------------

CREATE TABLE `leave_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `leave_category` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `conversion_rate` decimal(5,2) DEFAULT 1.00,
  `is_academic` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `max_consecutive_days` int(11) DEFAULT NULL,
  `requires_approval` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `leave_category` (`leave_category`),
  KEY `idx_leave_type_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `faculty`
-- --------------------------------------------------------

CREATE TABLE `faculty` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `faculty_name` varchar(255) NOT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `designation` varchar(100) NOT NULL,
  `member_type` enum('faculty','staff') NOT NULL DEFAULT 'faculty',
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  
  -- Leave balance tracking
  `total_leaves` decimal(10,2) DEFAULT 0.00,
  `granted_leaves` decimal(10,2) DEFAULT 0.00,
  `remaining_leaves` decimal(10,2) DEFAULT 0.00,
  
  -- Detailed leave type balances
  `short_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `short_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `half_day_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `half_day_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `casual_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `casual_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `medical_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `medical_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `without_payment_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `without_payment_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `compensatory_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `compensatory_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `earned_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `earned_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  `academic_leaves_granted` decimal(10,2) DEFAULT 0.00,
  `academic_leaves_remaining` decimal(10,2) DEFAULT 0.00,
  
  -- Employment details
  `year_of_joining` year(4) DEFAULT NULL,
  `employment_type` enum('regular','89_days','daily','contract') DEFAULT NULL,
  `salary_grade` varchar(20) DEFAULT NULL,
  `is_teaching` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `remark` text DEFAULT NULL,
  
  -- Associations
  `department_id` int(11) DEFAULT NULL,
  `hostel_id` int(11) DEFAULT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  KEY `idx_faculty_name` (`faculty_name`),
  KEY `idx_faculty_active` (`is_active`),
  KEY `idx_faculty_member_type` (`member_type`),
  KEY `department_id` (`department_id`),
  KEY `hostel_id` (`hostel_id`),
  CONSTRAINT `faculty_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`) ON UPDATE CASCADE,
  CONSTRAINT `faculty_ibfk_2` FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`hostel_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(60) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `hostel_id` int(11) DEFAULT NULL,
  `role` enum('department_admin','department_staff','hostel_admin','hostel_staff','establishment_admin','principal_admin','superadmin') DEFAULT 'department_staff',
  `status` enum('active','inactive','suspended') DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL,
  `login_attempts` int(11) DEFAULT 0,
  `locked_until` timestamp NULL DEFAULT NULL,
  `password_changed_at` timestamp NULL DEFAULT NULL,
  `current_session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_user_status` (`status`),
  KEY `idx_user_role` (`role`),
  KEY `department_id` (`department_id`),
  KEY `hostel_id` (`hostel_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`) ON UPDATE CASCADE,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`hostel_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `leaves`
-- --------------------------------------------------------

CREATE TABLE `leaves` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `faculty_id` int(11) NOT NULL,
  `leave_date` date NOT NULL,
  `leave_category` enum('short_leaves','half_day_leaves','casual_leaves','academic_leaves','medical_leaves','compensatory_leaves','earned_leaves','without_payment_leaves','other_leaves') DEFAULT NULL,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'approved',
  `applied_by` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `hostel_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_faculty_date_category` (`faculty_id`, `leave_date`, `leave_category`),
  KEY `idx_leave_date` (`leave_date`),
  KEY `idx_leave_status` (`status`),
  KEY `idx_leave_category` (`leave_category`),
  KEY `faculty_id` (`faculty_id`),
  KEY `applied_by` (`applied_by`),
  KEY `approved_by` (`approved_by`),
  KEY `leaves_department_id` (`department_id`),
  KEY `leaves_hostel_id` (`hostel_id`),
  CONSTRAINT `leaves_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leaves_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`) ON UPDATE CASCADE,
  CONSTRAINT `leaves_ibfk_3` FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`hostel_id`) ON UPDATE CASCADE,
  CONSTRAINT `leaves_ibfk_4` FOREIGN KEY (`applied_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `leaves_ibfk_5` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `leave_details`
-- --------------------------------------------------------

CREATE TABLE `leave_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `leave_id` int(11) NOT NULL,
  `half_leave_type` enum('before_noon','after_noon') DEFAULT NULL,
  `short_leave_from` time DEFAULT NULL,
  `short_leave_to` time DEFAULT NULL,
  `duration_hours` decimal(4,2) DEFAULT NULL,
  `substitute_arranged` tinyint(1) DEFAULT 0,
  `substitute_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `leave_id` (`leave_id`),
  CONSTRAINT `leave_details_ibfk_1` FOREIGN KEY (`leave_id`) REFERENCES `leaves` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `activity_logs`
-- --------------------------------------------------------

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actor_id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(255) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `meta_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta_json`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity_actor` (`actor_id`),
  KEY `idx_activity_action` (`action`),
  KEY `idx_activity_entity` (`entity_type`, `entity_id`),
  KEY `idx_activity_created` (`created_at`),
  CONSTRAINT `activity_logs_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table structure for table `sessions`
-- --------------------------------------------------------

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`session_id`),
  KEY `idx_session_expires` (`expires`),
  KEY `idx_session_user` (`user_id`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Insert seed data
-- --------------------------------------------------------

-- Insert departments
INSERT INTO `departments` (`department_id`, `department_name`, `department_code`, `head_of_department`, `is_active`, `created_at`) VALUES
(1, 'Computer Science', 'CS', NULL, 1, '2025-12-02 23:48:04'),
(4, 'Electrical Engineering', 'EE', NULL, 1, '2025-12-04 23:48:04'),
(5, 'Electronics and Communication', 'ECE', NULL, 1, '2025-12-04 23:48:04'),
(6, 'Civil Engineering', 'CE', NULL, 1, '2025-12-04 23:48:04');

-- Insert hostels
INSERT INTO `hostels` (`hostel_id`, `hostel_name`, `hostel_code`, `warden_name`, `capacity`, `is_active`, `created_at`) VALUES
(1, 'Boys Hostel', 'BH1', NULL, 200, 1, '2025-12-04 23:48:04'),
(3, 'Hostel 3', 'H3', NULL, 150, 1, '2025-12-04 23:48:04');

-- Insert leave types with proper conversion rates
INSERT INTO `leave_types` (`id`, `leave_category`, `display_name`, `description`, `conversion_rate`, `is_academic`, `is_active`, `max_consecutive_days`, `requires_approval`) VALUES
(1, 'short_leaves', 'Short Leaves', 'Short Leaves (3 short leaves = 1 day)', 0.33, 0, 1, 1, 1),
(2, 'half_day_leaves', 'Half Day Leaves', 'Half Day Leaves (2 half days = 1 day)', 0.50, 0, 1, 1, 1),
(3, 'casual_leaves', 'Casual Leaves', 'Full Day Casual Leaves', 1.00, 0, 1, 7, 1),
(4, 'medical_leaves', 'Medical Leaves', 'Medical/Maternity Leaves', 1.00, 0, 1, 30, 1),
(5, 'without_payment_leaves', 'Without Payment Leaves', 'Leave Without Pay', 1.00, 0, 1, NULL, 1),
(6, 'compensatory_leaves', 'Compensatory Leaves', 'Compensatory Off', 1.00, 0, 1, 5, 1),
(7, 'earned_leaves', 'Earned Leaves', 'Earned Leave', 1.00, 0, 1, 15, 1),
(8, 'academic_leaves', 'Academic Leaves', 'Academic Leaves (Not counted in total)', 0.00, 1, 1, NULL, 1);

-- Insert users with enhanced security
INSERT INTO `users` (`id`, `username`, `password`, `email`, `full_name`, `department_id`, `hostel_id`, `role`, `status`, `created_at`) VALUES
(1, 'admin', '0192023a7bbd73250516f069df18b500', 'admin@institution.edu', 'Department Administrator', 1, NULL, 'department_admin', 'active', '2025-11-27 09:53:22'),
(3, 'superadmin', '0192023a7bbd73250516f069df18b500', 'superadmin@institution.edu', 'Super Administrator', NULL, NULL, 'superadmin', 'active', '2025-11-27 10:02:51'),
(5, 'estdept', '0192023a7bbd73250516f069df18b500', 'establishment@institution.edu', 'Establishment Administrator', NULL, NULL, 'establishment_admin', 'active', '2025-12-01 09:08:31'),
(7, 'ceadmin', '0192023a7bbd73250516f069df18b500', 'ce.admin@institution.edu', 'Civil Engineering Admin', 6, NULL, 'department_admin', 'active', '2025-12-02 11:13:08'),
(8, 'hostel', '0192023a7bbd73250516f069df18b500', 'hostel@institution.edu', 'Hostel Administrator', NULL, 1, 'hostel_admin', 'active', '2025-12-03 05:58:21'),
(9, 'principal', '0192023a7bbd73250516f069df18b500', 'principal@institution.edu', 'Principal', NULL, NULL, 'principal_admin', 'active', '2025-12-05 01:46:09');

-- Insert sample faculty data from xyz.sql
INSERT INTO `faculty` (`id`, `faculty_name`, `designation`, `member_type`, `created_at`, `total_leaves`, `granted_leaves`, `remaining_leaves`, `department_id`, `hostel_id`, `short_leaves_granted`, `short_leaves_remaining`, `half_day_leaves_granted`, `half_day_leaves_remaining`, `casual_leaves_granted`, `casual_leaves_remaining`, `medical_leaves_granted`, `medical_leaves_remaining`, `without_payment_leaves_granted`, `without_payment_leaves_remaining`, `compensatory_leaves_granted`, `compensatory_leaves_remaining`, `earned_leaves_granted`, `earned_leaves_remaining`, `academic_leaves_granted`, `academic_leaves_remaining`, `year_of_joining`, `employment_type`, `remark`, `is_teaching`) VALUES
(21, 'swdw', 'Clerk', 'faculty', '2026-01-07 07:48:41', 7.00, 7.00, 7.00, 1, NULL, 3.00, 3.00, 2.00, 2.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, '2013', '89_days', 'sds', 1);

-- Set AUTO_INCREMENT values to match original data
ALTER TABLE `activity_logs` AUTO_INCREMENT = 371;
ALTER TABLE `departments` AUTO_INCREMENT = 16;
ALTER TABLE `faculty` AUTO_INCREMENT = 22;
ALTER TABLE `hostels` AUTO_INCREMENT = 7;
ALTER TABLE `leaves` AUTO_INCREMENT = 12;
ALTER TABLE `leave_details` AUTO_INCREMENT = 1;
ALTER TABLE `leave_types` AUTO_INCREMENT = 9;
ALTER TABLE `users` AUTO_INCREMENT = 10;

-- --------------------------------------------------------
-- Create indexes for better performance
-- --------------------------------------------------------

-- Additional performance indexes
CREATE INDEX `idx_faculty_employment` ON `faculty` (`employment_type`, `is_active`);
CREATE INDEX `idx_leaves_date_range` ON `leaves` (`leave_date`, `faculty_id`);
CREATE INDEX `idx_activity_logs_date` ON `activity_logs` (`created_at` DESC);

-- --------------------------------------------------------
-- Create views for common queries
-- --------------------------------------------------------

-- View for faculty leave summary
CREATE VIEW `faculty_leave_summary` AS
SELECT 
    f.id,
    f.faculty_name,
    f.designation,
    f.member_type,
    f.department_id,
    d.department_name,
    f.hostel_id,
    h.hostel_name,
    f.total_leaves,
    f.granted_leaves,
    f.remaining_leaves,
    f.is_active,
    COUNT(l.id) as total_leave_records,
    SUM(CASE WHEN l.leave_category = 'short_leaves' THEN 1 ELSE 0 END) AS short_leaves_taken,
    SUM(CASE WHEN l.leave_category = 'half_day_leaves' THEN 1 ELSE 0 END) AS half_day_leaves_taken,
    SUM(CASE WHEN l.leave_category = 'casual_leaves' THEN 1 ELSE 0 END) AS casual_leaves_taken
FROM faculty f
LEFT JOIN departments d ON f.department_id = d.department_id
LEFT JOIN hostels h ON f.hostel_id = h.hostel_id
LEFT JOIN leaves l ON f.id = l.faculty_id AND l.status = 'approved'
WHERE f.is_active = 1
GROUP BY f.id;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;