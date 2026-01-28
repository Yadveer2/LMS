-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 07, 2026 at 09:03 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `xyz`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `actor_id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(255) DEFAULT NULL,
  `meta_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta_json`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `actor_id`, `action`, `entity_type`, `entity_id`, `meta_json`, `created_at`) VALUES
(368, 3, 'LOGIN', 'user', '3', '{\"username\":\"superadmin\",\"role\":\"superadmin\",\"scopeType\":\"global\",\"scopeName\":\"Institution\",\"ip_address\":\"::1\",\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36\",\"tabId\":\"tab_y0rmqphfmk3puv6w\"}', '2026-01-07 07:48:11'),
(369, 3, 'ADD_FACULTY', 'faculty', 'swdw', '{\"faculty_name\":\"swdw\",\"designation\":\"Clerk\",\"member_type\":\"faculty\",\"total_leaves\":7,\"scope\":\"Computer Science\"}', '2026-01-07 07:48:41'),
(370, 3, 'ADD_FACULTY', NULL, NULL, '{\"faculty_name\":\"swdw\",\"member_type\":\"faculty\",\"designation\":\"Clerk\"}', '2026-01-07 07:48:41');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `department_id` int(11) NOT NULL,
  `department_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`department_id`, `department_name`, `created_at`) VALUES
(1, 'Computer Science', '2025-12-02 23:48:04'),
(4, 'Electrical Engineering', '2025-12-04 23:48:04'),
(5, 'Electronics and Communication', '2025-12-04 23:48:04'),
(6, 'Civil Engineering', '2025-12-04 23:48:04');

-- --------------------------------------------------------

--
-- Table structure for table `faculty`
--

CREATE TABLE `faculty` (
  `id` int(11) NOT NULL,
  `faculty_name` varchar(255) NOT NULL,
  `designation` varchar(100) NOT NULL,
  `member_type` enum('faculty','staff') NOT NULL DEFAULT 'faculty',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `total_leaves` decimal(10,2) DEFAULT 0.00,
  `granted_leaves` decimal(10,2) DEFAULT 0.00,
  `remaining_leaves` decimal(10,2) DEFAULT 0.00,
  `department_id` int(11) DEFAULT NULL,
  `hostel_id` int(11) DEFAULT NULL,
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
  `year_of_joining` year(4) DEFAULT NULL,
  `employment_type` enum('regular','89_days','daily','contract') DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `is_teaching` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `faculty`
--

INSERT INTO `faculty` (`id`, `faculty_name`, `designation`, `member_type`, `created_at`, `total_leaves`, `granted_leaves`, `remaining_leaves`, `department_id`, `hostel_id`, `short_leaves_granted`, `short_leaves_remaining`, `half_day_leaves_granted`, `half_day_leaves_remaining`, `casual_leaves_granted`, `casual_leaves_remaining`, `medical_leaves_granted`, `medical_leaves_remaining`, `without_payment_leaves_granted`, `without_payment_leaves_remaining`, `compensatory_leaves_granted`, `compensatory_leaves_remaining`, `earned_leaves_granted`, `earned_leaves_remaining`, `academic_leaves_granted`, `academic_leaves_remaining`, `year_of_joining`, `employment_type`, `remark`, `is_teaching`) VALUES
(21, 'swdw', 'Clerk', 'faculty', '2026-01-07 07:48:41', 7.00, 7.00, 7.00, 1, NULL, 3.00, 3.00, 2.00, 2.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, '2013', '89_days', 'sds', 1);

-- --------------------------------------------------------

--
-- Table structure for table `hostels`
--

CREATE TABLE `hostels` (
  `hostel_id` int(11) NOT NULL,
  `hostel_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `hostels`
--

INSERT INTO `hostels` (`hostel_id`, `hostel_name`, `created_at`) VALUES
(1, 'Boys Hostel', '2025-12-04 23:48:04'),
(3, 'Hostel 3', '2025-12-04 23:48:04');

-- --------------------------------------------------------

--
-- Table structure for table `leaves`
--

CREATE TABLE `leaves` (
  `id` int(11) NOT NULL,
  `faculty_id` int(11) NOT NULL,
  `leave_date` date NOT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `leave_category` enum('short_leaves','half_day_leaves','casual_leaves','academic_leaves','medical_leaves','compensatory_leaves','earned_leaves','without_payment_leaves','other_leaves') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `department_id` int(11) DEFAULT NULL,
  `hostel_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leave_details`
--

CREATE TABLE `leave_details` (
  `id` int(11) NOT NULL,
  `leave_id` int(11) NOT NULL,
  `half_leave_type` enum('before_noon','after_noon') DEFAULT NULL,
  `short_leave_from` time DEFAULT NULL,
  `short_leave_to` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leave_types`
--

CREATE TABLE `leave_types` (
  `id` int(11) NOT NULL,
  `leave_category` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `conversion_rate` decimal(5,2) DEFAULT 1.00,
  `is_academic` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_types`
--

INSERT INTO `leave_types` (`id`, `leave_category`, `description`, `conversion_rate`, `is_academic`, `created_at`) VALUES
(1, 'short_leaves', 'Short Leaves (3 short leaves = 1 day)', 0.33, 0, '2026-01-07 08:00:39'),
(2, 'half_day_leaves', 'Half Day Leaves (2 half days = 1 day)', 0.50, 0, '2026-01-07 08:00:39'),
(3, 'full_day_leaves', 'Full Day Leaves', 1.00, 0, '2026-01-07 08:00:39'),
(4, 'medical_maternity_leaves', 'Medical/Maternity Leaves', 1.00, 0, '2026-01-07 08:00:39'),
(5, 'without_payment_leaves', 'Without Payment Leaves', 1.00, 0, '2026-01-07 08:00:39'),
(6, 'compensatory_leaves', 'Compensatory Leaves', 1.00, 0, '2026-01-07 08:00:39'),
(7, 'earned_leaves', 'Earned Leaves', 1.00, 0, '2026-01-07 08:00:39'),
(8, 'academic_leaves', 'Academic Leaves (Not counted in total)', 0.00, 1, '2026-01-07 08:00:39');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`session_id`, `expires`, `data`) VALUES
('R055ZMzxAbeFYe0k2jKQFsyLUzoNDKfg', 1767859426, '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2026-01-08T08:02:14.743Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"tabs\":{\"tab_y0rmqphfmk3puv6w\":{\"id\":3,\"username\":\"superadmin\",\"role\":\"superadmin\",\"departmentId\":null,\"departmentName\":null,\"hostelId\":null,\"hostelName\":null,\"scopeType\":\"global\",\"permissions\":{\"canViewDashboard\":true,\"canGenerateReports\":true,\"canDownloadIndividualReport\":true,\"canViewDetails\":true,\"canAddLeaves\":true,\"canManageFaculty\":true,\"canChangeLeaveBalance\":true,\"canManageUsers\":true,\"canManageDepartments\":true,\"canManageHostels\":true,\"canViewStats\":true,\"canManageAdmins\":true,\"canViewActivityLogs\":true},\"scope\":null},\"396856ff4cb9874f7f014c773394a620\":{\"id\":3,\"username\":\"superadmin\",\"role\":\"superadmin\",\"departmentId\":null,\"departmentName\":null,\"hostelId\":null,\"hostelName\":null,\"scopeType\":\"global\",\"permissions\":{\"canViewDashboard\":true,\"canGenerateReports\":true,\"canDownloadIndividualReport\":true,\"canViewDetails\":true,\"canAddLeaves\":true,\"canManageFaculty\":true,\"canChangeLeaveBalance\":true,\"canManageUsers\":true,\"canManageDepartments\":true,\"canManageHostels\":true,\"canViewStats\":true,\"canManageAdmins\":true,\"canViewActivityLogs\":true},\"scope\":null},\"9966fffee64410c95a66fe311cf3596f\":{\"id\":3,\"username\":\"superadmin\",\"role\":\"superadmin\",\"departmentId\":null,\"departmentName\":null,\"hostelId\":null,\"hostelName\":null,\"scopeType\":\"global\",\"permissions\":{\"canViewDashboard\":true,\"canGenerateReports\":true,\"canDownloadIndividualReport\":true,\"canViewDetails\":true,\"canAddLeaves\":true,\"canManageFaculty\":true,\"canChangeLeaveBalance\":true,\"canManageUsers\":true,\"canManageDepartments\":true,\"canManageHostels\":true,\"canViewStats\":true,\"canManageAdmins\":true,\"canViewActivityLogs\":true},\"scope\":null}},\"user\":{\"id\":3,\"username\":\"superadmin\",\"role\":\"superadmin\",\"departmentId\":null,\"departmentName\":null,\"hostelId\":null,\"hostelName\":null,\"scopeType\":\"global\",\"permissions\":{\"canViewDashboard\":true,\"canGenerateReports\":true,\"canDownloadIndividualReport\":true,\"canViewDetails\":true,\"canAddLeaves\":true,\"canManageFaculty\":true,\"canChangeLeaveBalance\":true,\"canManageUsers\":true,\"canManageDepartments\":true,\"canManageHostels\":true,\"canViewStats\":true,\"canManageAdmins\":true,\"canViewActivityLogs\":true},\"scope\":null}}');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(60) NOT NULL,
  `department_id` int(11) DEFAULT NULL,
  `hostel_id` int(11) DEFAULT NULL,
  `role` enum('department_admin','department_staff','hostel_admin','hostel_staff','establishment_admin','principal_admin','superadmin') DEFAULT 'department_staff',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `department_id`, `hostel_id`, `role`, `status`, `created_at`) VALUES
(1, 'admin', '0192023a7bbd73250516f069df18b500', 1, NULL, 'department_admin', 'active', '2025-11-27 09:53:22'),
(3, 'superadmin', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'superadmin', 'active', '2025-11-27 10:02:51'),
(5, 'estdept', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'establishment_admin', 'active', '2025-12-01 09:08:31'),
(7, 'ceadmin', '0192023a7bbd73250516f069df18b500', 6, NULL, 'department_admin', 'active', '2025-12-02 11:13:08'),
(8, 'hostel', '0192023a7bbd73250516f069df18b500', NULL, 1, 'hostel_admin', 'active', '2025-12-03 05:58:21'),
(9, 'principal', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'principal_admin', 'active', '2025-12-05 01:46:09');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `activity_logs_actor_id` (`actor_id`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`department_id`),
  ADD UNIQUE KEY `department_name` (`department_name`);

--
-- Indexes for table `faculty`
--
ALTER TABLE `faculty`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_faculty_name` (`faculty_name`),
  ADD KEY `department_id` (`department_id`),
  ADD KEY `hostel_id` (`hostel_id`);

--
-- Indexes for table `hostels`
--
ALTER TABLE `hostels`
  ADD PRIMARY KEY (`hostel_id`),
  ADD UNIQUE KEY `hostel_name` (`hostel_name`);

--
-- Indexes for table `leaves`
--
ALTER TABLE `leaves`
  ADD PRIMARY KEY (`id`),
  ADD KEY `faculty_id` (`faculty_id`),
  ADD KEY `leaves_department_id` (`department_id`),
  ADD KEY `leaves_hostel_id` (`hostel_id`);

--
-- Indexes for table `leave_details`
--
ALTER TABLE `leave_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `leave_id` (`leave_id`);

--
-- Indexes for table `leave_types`
--
ALTER TABLE `leave_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `leave_category` (`leave_category`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `department_id` (`department_id`),
  ADD KEY `hostel_id` (`hostel_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=371;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `department_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `faculty`
--
ALTER TABLE `faculty`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `hostels`
--
ALTER TABLE `hostels`
  MODIFY `hostel_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `leaves`
--
ALTER TABLE `leaves`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `leave_details`
--
ALTER TABLE `leave_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leave_types`
--
ALTER TABLE `leave_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `faculty`
--
ALTER TABLE `faculty`
  ADD CONSTRAINT `faculty_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  ADD CONSTRAINT `faculty_ibfk_2` FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`hostel_id`);

--
-- Constraints for table `leaves`
--
ALTER TABLE `leaves`
  ADD CONSTRAINT `leaves_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`id`),
  ADD CONSTRAINT `leaves_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  ADD CONSTRAINT `leaves_ibfk_3` FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`hostel_id`);

--
-- Constraints for table `leave_details`
--
ALTER TABLE `leave_details`
  ADD CONSTRAINT `leave_details_ibfk_1` FOREIGN KEY (`leave_id`) REFERENCES `leaves` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`hostel_id`) REFERENCES `hostels` (`hostel_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
