-- Insert 10 faculty/staff entries for each existing department (1, 4, 5, 6)
-- Computer Science Department (ID: 1)
INSERT INTO faculty (id, faculty_name, designation, member_type, department_id, hostel_id, total_leaves, granted_leaves, remaining_leaves, year_of_joining, employment_type, is_teaching, remark) VALUES
(1, 'Dr. Rajesh Kumar', 'Professor & HOD', 'faculty', 1, NULL, 30.00, 20.00, 10.00, 2010, 'regular', 1, 'Head of Department - AI/ML Specialist'),
(2, 'Prof. Anjali Sharma', 'Associate Professor', 'faculty', 1, 1, 30.00, 15.00, 15.00, 2015, 'regular', 1, 'Ph.D in Computer Science - Database Systems'),
(3, 'Dr. Vikram Singh', 'Assistant Professor', 'faculty', 1, NULL, 30.00, 10.00, 20.00, 2018, 'regular', 1, 'Specialization: Machine Learning'),
(4, 'Ms. Priya Patel', 'Lecturer', 'faculty', 1, NULL, 30.00, 8.00, 22.00, 2020, 'contract', 1, 'M.Tech, Gold Medalist - Web Technologies'),
(5, 'Mr. Sanjay Verma', 'Senior Lab Assistant', 'staff', 1, 1, 20.00, 5.00, 15.00, 2019, 'regular', 0, 'Computer Lab In-charge'),
(6, 'Dr. Meera Nair', 'Professor', 'faculty', 1, NULL, 30.00, 22.00, 8.00, 2012, 'regular', 1, 'Cybersecurity Expert'),
(7, 'Mr. Rahul Desai', 'Assistant Professor', 'faculty', 1, 3, 30.00, 12.00, 18.00, 2019, 'regular', 1, 'Cloud Computing'),
(8, 'Ms. Kavita Rao', 'Office Superintendent', 'staff', 1, NULL, 20.00, 8.00, 12.00, 2016, 'regular', 0, 'Department Office Head'),
(9, 'Mr. Amit Joshi', 'System Administrator', 'staff', 1, 1, 20.00, 4.00, 16.00, 2020, 'contract', 0, 'Network and Systems'),
(10, 'Dr. S. Menon', 'Associate Professor', 'faculty', 1, NULL, 30.00, 18.00, 12.00, 2014, 'regular', 1, 'Software Engineering');

-- Electrical Engineering Department (ID: 4)
INSERT INTO faculty (id, faculty_name, designation, member_type, department_id, hostel_id, total_leaves, granted_leaves, remaining_leaves, year_of_joining, employment_type, is_teaching, remark) VALUES
(11, 'Dr. Amitabh Chakraborty', 'Professor & HOD', 'faculty', 4, NULL, 30.00, 22.00, 8.00, 2008, 'regular', 1, 'Head of Department - Power Systems'),
(12, 'Prof. Meena Nair', 'Associate Professor', 'faculty', 4, 3, 30.00, 18.00, 12.00, 2012, 'regular', 1, 'Power Electronics Expert'),
(13, 'Mr. Rakesh Menon', 'Assistant Professor', 'faculty', 4, 1, 30.00, 12.00, 18.00, 2017, 'regular', 1, 'Control Systems - PhD Scholar'),
(14, 'Ms. Sunita Reddy', 'Senior Office Assistant', 'staff', 4, NULL, 20.00, 6.00, 14.00, 2018, '89_days', 0, 'Department Office Coordinator'),
(15, 'Mr. Krishna Iyer', 'Chief Technician', 'staff', 4, 1, 20.00, 4.00, 16.00, 2021, 'daily', 0, 'Electrical Lab Head'),
(16, 'Dr. P. Srinivasan', 'Professor', 'faculty', 4, NULL, 30.00, 25.00, 5.00, 2010, 'regular', 1, 'Renewable Energy Systems'),
(17, 'Ms. Ananya Das', 'Assistant Professor', 'faculty', 4, 3, 30.00, 10.00, 20.00, 2020, 'regular', 1, 'Instrumentation Engineering'),
(18, 'Mr. Vikas Gupta', 'Lab Supervisor', 'staff', 4, NULL, 20.00, 7.00, 13.00, 2019, 'regular', 0, 'Power Systems Lab'),
(19, 'Mrs. Shobha Nair', 'Store Keeper', 'staff', 4, 1, 20.00, 3.00, 17.00, 2017, 'regular', 0, 'Electrical Stores'),
(20, 'Dr. K. Rajan', 'Associate Professor', 'faculty', 4, NULL, 30.00, 16.00, 14.00, 2015, 'regular', 1, 'Microelectronics');

-- Electronics and Communication Department (ID: 5)
INSERT INTO faculty (id, faculty_name, designation, member_type, department_id, hostel_id, total_leaves, granted_leaves, remaining_leaves, year_of_joining, employment_type, is_teaching, remark) VALUES
(21, 'Dr. N. Srinivasan', 'Professor & HOD', 'faculty', 5, NULL, 30.00, 25.00, 5.00, 2009, 'regular', 1, 'Head of Department - Microwave Engineering'),
(22, 'Prof. Deepa Krishnan', 'Associate Professor', 'faculty', 5, 3, 30.00, 16.00, 14.00, 2014, 'regular', 1, 'VLSI Design Expert'),
(23, 'Dr. Arjun Mehta', 'Assistant Professor', 'faculty', 5, 1, 30.00, 11.00, 19.00, 2019, 'regular', 1, 'Communication Systems - 5G Specialist'),
(24, 'Mr. Venkatesh Prasad', 'Senior Lab Instructor', 'staff', 5, NULL, 20.00, 7.00, 13.00, 2016, 'regular', 0, 'ECE Lab In-charge'),
(25, 'Ms. Lakshmi Rai', 'Head Clerk', 'staff', 5, 3, 20.00, 3.00, 17.00, 2020, 'contract', 0, 'Department Office Administration'),
(26, 'Dr. R. Gupta', 'Professor', 'faculty', 5, NULL, 30.00, 22.00, 8.00, 2011, 'regular', 1, 'Signal Processing'),
(27, 'Ms. Neha Sharma', 'Assistant Professor', 'faculty', 5, 1, 30.00, 9.00, 21.00, 2021, 'regular', 1, 'Embedded Systems'),
(28, 'Mr. Suresh Kumar', 'Technician', 'staff', 5, NULL, 20.00, 5.00, 15.00, 2018, 'daily', 0, 'Digital Electronics Lab'),
(29, 'Mrs. Geeta Nair', 'Office Assistant', 'staff', 5, 3, 20.00, 4.00, 16.00, 2019, '89_days', 0, 'Department Office Support'),
(30, 'Dr. S. Chatterjee', 'Associate Professor', 'faculty', 5, NULL, 30.00, 17.00, 13.00, 2016, 'regular', 1, 'RF and Antenna Design');

-- Civil Engineering Department (ID: 6)
INSERT INTO faculty (id, faculty_name, designation, member_type, department_id, hostel_id, total_leaves, granted_leaves, remaining_leaves, year_of_joining, employment_type, is_teaching, remark) VALUES
(31, 'Dr. S. Gupta', 'Professor & HOD', 'faculty', 6, NULL, 30.00, 28.00, 2.00, 2007, 'regular', 1, 'Head of Department - Structural Engineering'),
(32, 'Prof. Manoj Tiwari', 'Associate Professor', 'faculty', 6, 1, 30.00, 19.00, 11.00, 2013, 'regular', 1, 'Environmental Engineering Expert'),
(33, 'Ms. Reena Khanna', 'Assistant Professor', 'faculty', 6, NULL, 30.00, 13.00, 17.00, 2020, 'regular', 1, 'Transportation Engineering'),
(34, 'Mr. Prakash Joshi', 'Store In-charge', 'staff', 6, 1, 20.00, 8.00, 12.00, 2015, 'regular', 0, 'Civil Stores Management'),
(35, 'Mrs. Asha Nair', 'Senior Attender', 'staff', 6, 3, 20.00, 2.00, 18.00, 2021, 'daily', 0, 'Department Attender'),
(36, 'Dr. R. Kumar', 'Professor', 'faculty', 6, NULL, 30.00, 24.00, 6.00, 2009, 'regular', 1, 'Geotechnical Engineering'),
(37, 'Mr. Ajay Verma', 'Assistant Professor', 'faculty', 6, 1, 30.00, 14.00, 16.00, 2018, 'regular', 1, 'Construction Management'),
(38, 'Ms. Preeti Sharma', 'Lab Technician', 'staff', 6, NULL, 20.00, 6.00, 14.00, 2019, 'regular', 0, 'Surveying Lab'),
(39, 'Mr. Rajesh Nair', 'Workshop Supervisor', 'staff', 6, 3, 20.00, 5.00, 15.00, 2017, 'contract', 0, 'Civil Workshop'),
(40, 'Dr. A. Mishra', 'Associate Professor', 'faculty', 6, NULL, 30.00, 20.00, 10.00, 2014, 'regular', 1, 'Water Resources Engineering');

-- Now update per-leave-type columns for all faculty
-- This query sets realistic leave balances based on employment type, teaching status, and year of joining
UPDATE faculty SET
  short_leaves_granted = CASE 
    WHEN employment_type = 'regular' THEN 12.00
    WHEN employment_type = 'contract' THEN 10.00
    ELSE 8.00
  END,
  short_leaves_remaining = CASE 
    WHEN employment_type = 'regular' THEN FLOOR(RAND() * 8) + 4
    WHEN employment_type = 'contract' THEN FLOOR(RAND() * 6) + 4
    ELSE FLOOR(RAND() * 5) + 3
  END,
  half_day_leaves_granted = CASE 
    WHEN is_teaching = 1 THEN 6.00
    ELSE 4.00
  END,
  half_day_leaves_remaining = CASE 
    WHEN is_teaching = 1 THEN FLOOR(RAND() * 4) + 2
    ELSE FLOOR(RAND() * 3) + 1
  END,
  casual_leaves_granted = CASE 
    WHEN employment_type = 'regular' THEN 8.00
    ELSE 6.00
  END,
  casual_leaves_remaining = CASE 
    WHEN employment_type = 'regular' THEN FLOOR(RAND() * 5) + 3
    ELSE FLOOR(RAND() * 4) + 2
  END,
  medical_leaves_granted = 15.00,
  medical_leaves_remaining = FLOOR(RAND() * 10) + 5,
  without_payment_leaves_granted = 30.00,
  without_payment_leaves_remaining = 30.00,
  compensatory_leaves_granted = CASE 
    WHEN is_teaching = 1 THEN 5.00
    ELSE 3.00
  END,
  compensatory_leaves_remaining = CASE 
    WHEN is_teaching = 1 THEN FLOOR(RAND() * 3) + 2
    ELSE FLOOR(RAND() * 2) + 1
  END,
  earned_leaves_granted = CASE 
    WHEN employment_type = 'regular' THEN 30.00
    WHEN employment_type = 'contract' THEN 15.00
    ELSE 10.00
  END,
  earned_leaves_remaining = CASE 
    WHEN employment_type = 'regular' THEN FLOOR(RAND() * 15) + 10
    WHEN employment_type = 'contract' THEN FLOOR(RAND() * 8) + 5
    ELSE FLOOR(RAND() * 6) + 4
  END,
  academic_leaves_granted = CASE 
    WHEN is_teaching = 1 THEN 10.00
    ELSE 0.00
  END,
  academic_leaves_remaining = CASE 
    WHEN is_teaching = 1 THEN FLOOR(RAND() * 7) + 3
    ELSE 0.00
  END;

-- Insert sample leaves records (40 leaves spanning different dates and types)
INSERT INTO leaves (id, faculty_id, leave_date, leave_category, created_at, department_id, hostel_id) VALUES
-- December 2025 leaves
(1, 1, '2025-12-10', 'casual_leaves', '2025-12-08 09:00:00', 1, NULL),
(2, 2, '2025-12-11', 'medical_leaves', '2025-12-09 10:30:00', 1, 1),
(3, 3, '2025-12-12', 'half_day_leaves', '2025-12-10 08:15:00', 1, NULL),
(4, 5, '2025-12-13', 'short_leaves', '2025-12-11 14:20:00', 1, 1),
(5, 6, '2025-12-16', 'academic_leaves', '2025-12-12 11:45:00', 1, NULL),
(6, 7, '2025-12-17', 'casual_leaves', '2025-12-13 09:30:00', 1, 3),
(7, 8, '2025-12-18', 'medical_leaves', '2025-12-14 10:00:00', 1, NULL),
(8, 10, '2025-12-19', 'compensatory_leaves', '2025-12-15 13:15:00', 1, NULL),
(9, 11, '2025-12-20', 'earned_leaves', '2025-12-16 08:45:00', 4, NULL),
(10, 12, '2025-12-23', 'without_payment_leaves', '2025-12-17 16:20:00', 4, 3),
(11, 13, '2025-12-24', 'other_leaves', '2025-12-18 11:10:00', 4, 1),
(12, 14, '2025-12-25', 'casual_leaves', '2025-12-19 09:45:00', 4, NULL),
(13, 15, '2025-12-26', 'medical_leaves', '2025-12-20 10:30:00', 4, 1),
(14, 16, '2025-12-27', 'half_day_leaves', '2025-12-21 08:00:00', 4, NULL),
(15, 17, '2025-12-30', 'short_leaves', '2025-12-22 14:15:00', 4, 3),
(16, 18, '2025-12-31', 'academic_leaves', '2025-12-23 11:00:00', 4, NULL),
(17, 21, '2026-01-02', 'casual_leaves', '2025-12-24 09:30:00', 5, NULL),
(18, 22, '2026-01-03', 'medical_leaves', '2025-12-26 10:45:00', 5, 3),
(19, 23, '2026-01-04', 'half_day_leaves', '2025-12-27 08:20:00', 5, 1),
(20, 24, '2026-01-05', 'short_leaves', '2025-12-28 13:30:00', 5, NULL),
(21, 25, '2026-01-06', 'compensatory_leaves', '2025-12-29 09:15:00', 5, 3),
(22, 26, '2026-01-09', 'earned_leaves', '2025-12-30 11:45:00', 5, NULL),
(23, 27, '2026-01-10', 'without_payment_leaves', '2025-12-31 16:00:00', 5, 1),
(24, 28, '2026-01-11', 'other_leaves', '2026-01-02 10:30:00', 5, NULL),
(25, 29, '2026-01-12', 'casual_leaves', '2026-01-03 09:00:00', 5, 3),
(26, 30, '2026-01-13', 'medical_leaves', '2026-01-04 14:20:00', 5, NULL),
(27, 31, '2026-01-16', 'half_day_leaves', '2026-01-05 08:45:00', 6, NULL),
(28, 32, '2026-01-17', 'short_leaves', '2026-01-06 13:00:00', 6, 1),
(29, 33, '2026-01-18', 'academic_leaves', '2026-01-07 10:15:00', 6, NULL),
(30, 34, '2026-01-19', 'casual_leaves', '2026-01-08 09:30:00', 6, 1),
(31, 35, '2026-01-20', 'medical_leaves', '2026-01-09 11:45:00', 6, 3),
(32, 36, '2026-01-23', 'compensatory_leaves', '2026-01-10 08:00:00', 6, NULL),
(33, 37, '2026-01-24', 'earned_leaves', '2026-01-11 14:30:00', 6, 1),
(34, 38, '2026-01-25', 'without_payment_leaves', '2026-01-12 16:15:00', 6, NULL),
(35, 39, '2026-01-26', 'other_leaves', '2026-01-13 10:45:00', 6, 3),
(36, 40, '2026-01-27', 'casual_leaves', '2026-01-14 09:20:00', 6, NULL),
(37, 4, '2026-01-30', 'medical_leaves', '2026-01-15 11:00:00', 1, NULL),
(38, 9, '2026-01-31', 'half_day_leaves', '2026-01-16 08:30:00', 1, 1),
(39, 19, '2026-02-01', 'short_leaves', '2026-01-17 13:45:00', 4, 1),
(40, 20, '2026-02-02', 'academic_leaves', '2026-01-18 10:10:00', 4, NULL);

-- Insert leave details for half day and short leaves
INSERT INTO leave_details (id, leave_id, half_leave_type, short_leave_from, short_leave_to, created_at) VALUES
(1, 3, 'after_noon', NULL, NULL, '2025-12-10 08:15:00'),
(2, 4, NULL, '14:00:00', '16:00:00', '2025-12-11 14:20:00'),
(3, 14, 'before_noon', NULL, NULL, '2025-12-21 08:00:00'),
(4, 15, NULL, '10:30:00', '12:30:00', '2025-12-22 14:15:00'),
(5, 19, 'after_noon', NULL, NULL, '2025-12-27 08:20:00'),
(6, 20, NULL, '15:00:00', '17:00:00', '2025-12-28 13:30:00'),
(7, 27, 'before_noon', NULL, NULL, '2026-01-05 08:45:00'),
(8, 28, NULL, '09:00:00', '11:00:00', '2026-01-06 13:00:00'),
(9, 38, 'after_noon', NULL, NULL, '2026-01-16 08:30:00'),
(10, 39, NULL, '16:00:00', '18:00:00', '2026-01-17 13:45:00');

-- Insert sample activity logs (20 records)
INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, meta_json, created_at) VALUES
(1, 1, 'CREATE', 'faculty', '4', '{"faculty_name": "Ms. Priya Patel", "designation": "Lecturer"}', '2025-12-01 10:00:00'),
(2, 3, 'UPDATE', 'faculty', '1', '{"leaves_granted": "20.00", "leaves_remaining": "10.00"}', '2025-12-02 11:30:00'),
(3, 7, 'CREATE', 'leaves', '6', '{"faculty_id": "7", "leave_date": "2025-12-17", "category": "casual_leaves"}', '2025-12-13 09:30:00'),
(4, 1, 'APPROVE', 'leaves', '1', '{"status": "approved", "approved_by": "1"}', '2025-12-08 10:15:00'),
(5, 5, 'REJECT', 'leaves', '10', '{"status": "rejected", "reason": "Insufficient documentation"}', '2025-12-17 17:00:00'),
(6, 8, 'CREATE', 'faculty', '35', '{"faculty_name": "Mrs. Asha Nair", "member_type": "staff"}', '2025-12-15 14:20:00'),
(7, 9, 'SYSTEM_UPDATE', 'settings', NULL, '{"action": "yearly_leave_reset", "year": "2025"}', '2025-12-01 00:01:00'),
(8, 3, 'BACKUP', 'database', NULL, '{"backup_file": "backup_20251215.sql", "size": "45MB"}', '2025-12-15 23:00:00'),
(9, 1, 'APPROVE', 'leaves', '2', '{"status": "approved", "approved_by": "1"}', '2025-12-09 11:30:00'),
(10, 7, 'UPDATE', 'faculty', '32', '{"designation": "Associate Professor"}', '2025-12-10 14:45:00'),
(11, 8, 'CREATE', 'leaves', '11', '{"faculty_id": "13", "leave_date": "2025-12-24"}', '2025-12-18 11:10:00'),
(12, 5, 'APPROVE', 'leaves', '15', '{"status": "approved", "approved_by": "5"}', '2025-12-22 15:30:00'),
(13, 9, 'UPDATE', 'faculty', '21', '{"total_leaves": "30.00", "granted_leaves": "25.00"}', '2025-12-25 10:00:00'),
(14, 3, 'SYSTEM_UPDATE', 'settings', NULL, '{"action": "update_leave_policy", "changes": "medical_leaves increased"}', '2025-12-28 16:20:00'),
(15, 1, 'CREATE', 'faculty', '40', '{"faculty_name": "Dr. A. Mishra", "department_id": "6"}', '2025-12-30 09:15:00'),
(16, 7, 'REJECT', 'leaves', '23', '{"status": "rejected", "reason": "Advance notice required"}', '2025-12-31 17:45:00'),
(17, 8, 'APPROVE', 'leaves', '27', '{"status": "approved", "approved_by": "8"}', '2026-01-05 09:30:00'),
(18, 5, 'UPDATE', 'faculty', '15', '{"hostel_id": "1"}', '2026-01-10 11:20:00'),
(19, 9, 'CREATE', 'leaves', '36', '{"faculty_id": "40", "leave_date": "2026-01-27"}', '2026-01-14 09:20:00'),
(20, 3, 'BACKUP', 'database', NULL, '{"backup_file": "backup_20260120.sql", "size": "52MB"}', '2026-01-20 23:00:00');

-- Add additional users for hostel management
INSERT INTO users (id, username, password, department_id, hostel_id, role, status, created_at) VALUES
(16, 'boyshostel_staff1', '0192023a7bbd73250516f069df18b500', NULL, 1, 'hostel_staff', 'active', '2025-12-06 09:00:00'),
(17, 'boyshostel_staff2', '0192023a7bbd73250516f069df18b500', NULL, 1, 'hostel_staff', 'active', '2025-12-06 09:00:00'),
(18, 'hostel3_staff1', '0192023a7bbd73250516f069df18b500', NULL, 3, 'hostel_staff', 'active', '2025-12-06 09:00:00'),
(19, 'hostel3_staff2', '0192023a7bbd73250516f069df18b500', NULL, 3, 'hostel_staff', 'active', '2025-12-06 09:00:00'),
(20, 'est_staff1', '0192023a7bbd73250516f069df18b500', NULL, NULL, 'establishment_admin', 'active', '2025-12-06 09:00:00');

COMMIT;