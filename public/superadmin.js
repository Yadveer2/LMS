// superadmin.js - Fixed version (no duplicates)

class SuperAdminDashboard {
    constructor() {
        this.isResettingPassword = false; // ADD THIS
        this.eventsBound = false; // ADD THIS
        this.init();
    }

    async init() {
        await this.loadUserInfo();
        await this.loadAllData();
        this.bindEvents();
        this.loadAllFacultyStaff();
        this.populateYearDropdowns();
    }

    loadUserInfo() {
        // Fetch current session user to avoid stale localStorage values
        return (async () => {
            try {
                const res = await fetch('/leave_mgmt/context', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const user = data.user || JSON.parse(localStorage.getItem('user') || '{}');
                    localStorage.setItem('user', JSON.stringify(user));
                    const usernameEl = document.getElementById('username');
                    if (usernameEl && user && user.username) usernameEl.textContent = user.username;
                    const initialsEl = document.getElementById('userInitials');
                    if (initialsEl && user && user.username) initialsEl.textContent =
                        user.username.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                    return;
                }
            } catch (err) {
                // fallback to localStorage below
            }

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && user.username) {
                const usernameEl = document.getElementById('username');
                if (usernameEl) usernameEl.textContent = user.username;
                const initialsEl = document.getElementById('userInitials');
                if (initialsEl) initialsEl.textContent = user.username.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            }
        })();
    }

    async loadAllData() {
        await Promise.all([
            this.loadStats(),
            this.loadAdminUsers(),
            this.loadDepartmentsHostels(),
            this.loadActivityLogs()

        ]);
    }

    showResetPasswordModal(userId, username) {
        document.getElementById('resetPasswordUserId').value = userId;
        document.getElementById('resetPasswordUsername').value = username;
        document.getElementById('resetPasswordModal').style.display = 'flex';
    }

    closeResetPasswordModal() {
        document.getElementById('resetPasswordModal').style.display = 'none';
        document.getElementById('resetPasswordForm').reset();
    }

    // async loadStats() {
    //     try {
    //         const [scopesRes, facultyRes] = await Promise.all([
    //             fetch('/leave_mgmt/metadata/scopes', { credentials: 'include' }),
    //             fetch('/leave_mgmt/all-faculty', { credentials: 'include' })
    //         ]);

    //         const scopesData = await scopesRes.json();
    //         const facultyData = await facultyRes.json();

    //         // Get counts
    //         const deptCount = scopesData.departments?.length || 0;
    //         const hostelCount = scopesData.hostels?.length || 0;

    //         // Count faculty vs staff
    //         let facultyCount = 0;
    //         let staffCount = 0;

    //         if (Array.isArray(facultyData)) {
    //             facultyData.forEach(member => {
    //                 if (member.member_type === 'faculty') {
    //                     facultyCount++;
    //                 } else if (member.member_type === 'staff') {
    //                     staffCount++;
    //                 }
    //             });
    //         }

    //         // Update stats
    //         document.getElementById('totalDepartments').textContent = deptCount;
    //         document.getElementById('totalHostels').textContent = hostelCount;
    //         document.getElementById('totalFaculty').textContent = facultyCount;
    //         document.getElementById('totalStaff').textContent = staffCount;

    //     } catch (error) {
    //         console.error('Failed to load stats:', error);
    //     }
    // }

    async loadStats() {
        try {
            const [scopesRes, facultyRes] = await Promise.all([
                fetch('/leave_mgmt/metadata/scopes', { credentials: 'include' }),
                fetch('/leave_mgmt/all-faculty', { credentials: 'include' })
            ]);

            if (!scopesRes.ok || !facultyRes.ok) {
                throw new Error('Failed to fetch stats data');
            }

            const scopesData = await scopesRes.json();
            const facultyData = await facultyRes.json();

            // Get counts - FIX FOR ISSUE #5
            const deptCount = Array.isArray(scopesData.departments) ? scopesData.departments.length : 0;
            const hostelCount = Array.isArray(scopesData.hostels) ? scopesData.hostels.length : 0;

            // Count faculty vs staff - FIX FOR ISSUE #5
            let facultyCount = 0;
            let staffCount = 0;

            if (Array.isArray(facultyData)) {
                facultyData.forEach(member => {
                    if (member.member_type === 'faculty' || member.department_id) {
                        facultyCount++;
                    } else if (member.member_type === 'staff' || member.hostel_id) {
                        staffCount++;
                    }
                });
            }

            console.log(`Stats: Departments=${deptCount}, Hostels=${hostelCount}, Faculty=${facultyCount}, Staff=${staffCount}`);

            // Update stats
            document.getElementById('totalDepartments').textContent = deptCount;
            document.getElementById('totalHostels').textContent = hostelCount;
            document.getElementById('totalFaculty').textContent = facultyCount;
            document.getElementById('totalStaff').textContent = staffCount;

        } catch (error) {
            console.error('Failed to load stats:', error);
            // Set to 0 if error
            document.getElementById('totalDepartments').textContent = '0';
            document.getElementById('totalHostels').textContent = '0';
            document.getElementById('totalFaculty').textContent = '0';
            document.getElementById('totalStaff').textContent = '0';
        }
    }

    async loadAdminUsers() {
        try {
            const response = await fetch('/leave_mgmt/admin/users', {
                credentials: 'include'
            });

            if (!response.ok) {
                // Try fallback endpoint
                const fallbackResponse = await fetch('/leave_mgmt/get-users', {
                    credentials: 'include'
                });

                if (!fallbackResponse.ok) {
                    throw new Error('Failed to fetch admin users');
                }

                const users = await fallbackResponse.json();
                return this.displayAdminUsers(users);
            }

            const users = await response.json();
            this.displayAdminUsers(users);

        } catch (error) {
            console.error('Failed to load admin users:', error);
            this.showErrorInTable('adminUsersBody', 'Failed to load admin users');
        }
    }

    displayAdminUsers(users) {
        const tbody = document.getElementById('adminUsersBody');
        tbody.innerHTML = '';

        if (!users || users.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #666;">
                    No admin users found
                </td>
            </tr>
        `;
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');

            // Format role badge - FIX FOR ROLE DISPLAY
            let roleClass = '';
            let roleText = user.role || 'unknown';

            // Map role to display text and class
            switch (user.role) {
                case 'superadmin':
                    roleClass = 'role-superadmin';
                    roleText = 'Super Admin';
                    break;
                case 'department_admin':
                    roleClass = 'role-department';
                    roleText = 'Department Admin';
                    break;
                case 'hostel_admin':
                    roleClass = 'role-hostel';
                    roleText = 'Hostel Admin';
                    break;
                case 'establishment_admin':
                    roleClass = 'role-establishment';
                    roleText = 'Establishment';
                    break;
                case 'principal_admin':
                    roleClass = 'role-principal';
                    roleText = 'Principal';
                    break;
                default:
                    roleClass = 'role-department';
                    roleText = user.role || 'Admin';
            }

            // Format scope - FIX FOR SCOPE DISPLAY
            let scopeText = 'Global';
            if (user.scope_type === 'department' && user.scope_name) {
                scopeText = `${user.scope_name} (Department)`;
            } else if (user.scope_type === 'hostel' && user.scope_name) {
                scopeText = `${user.scope_name} (Hostel)`;
            } else if (user.department_name) {
                scopeText = `${user.department_name} (Department)`;
            } else if (user.hostel_name) {
                scopeText = `${user.hostel_name} (Hostel)`;
            } else if (user.department_id) {
                scopeText = `Department ID: ${user.department_id}`;
            } else if (user.hostel_id) {
                scopeText = `Hostel ID: ${user.hostel_id}`;
            }

            // Format status
            const statusClass = (user.status === 'active' || user.active === 1) ? 'status-success' : 'status-pending';
            const statusText = (user.status === 'active' || user.active === 1) ? 'Active' : 'Inactive';

            // Format created_at
            let createdAtText = 'N/A';
            if (user.created_at) {
                const date = new Date(user.created_at);
                if (!isNaN(date.getTime())) {
                    createdAtText = date.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    });
                }
            }

            row.innerHTML = `
            <td><strong>${user.username || 'Unknown'}</strong></td>
            <td><span class="role-badge ${roleClass}">${roleText}</span></td>
            <td>${scopeText}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${createdAtText}</td>
            <td class="action-buttons">
                <button class="btn-sm btn-edit" onclick="superAdminDashboard.showResetPasswordModal(${user.id}, '${(user.username || '').replace(/'/g, "\\'")}')" 
                        title="Reset Password">
                    <i class="fas fa-key"></i> Reset
                </button>
                ${user.role !== 'superadmin' ? `
                <button class="btn-sm btn-delete" onclick="superAdminDashboard.deleteAdminUser(${user.id}, '${(user.username || '').replace(/'/g, "\\'")}')" 
                        title="Delete User">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ` : '<span style="color: #999; font-size: 12px;">Super Admin</span>'}
            </td>
        `;
            tbody.appendChild(row);
        });
    }

    // Add these methods to the SuperAdminDashboard class

    async resetPassword() {
        // Prevent multiple executions - ADD THIS CHECK

        if (this.isResettingPassword) {
            console.log('Reset password already in progress');
            return;
        }
        this.isResettingPassword = true;

        const userId = document.getElementById('resetPasswordUserId').value;
        const username = document.getElementById('resetPasswordUsername').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation - REMOVE ALL alert() calls
        if (!newPassword || !confirmPassword) {
            this.showSingleMessage('Please fill all password fields', 'error');
            this.isResettingPassword = false;
            return;
        }

        if (newPassword.length < 6) {
            this.showSingleMessage('Password must be at least 6 characters long', 'error');
            this.isResettingPassword = false;
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showSingleMessage('Passwords do not match', 'error');
            this.isResettingPassword = false;
            return;
        }

        // Use a single confirmation - REPLACE confirm() with this
        const confirmed = await this.showSingleConfirmation(`Reset password for "${username}"?`);
        if (!confirmed) {
            this.isResettingPassword = false;
            return;
        }

        try {
            // Try multiple endpoints
            const endpoints = [
                `/leave_mgmt/admin/users/${userId}/reset-password`,
                `/leave_mgmt/admins/${userId}/reset-password`,
                `/leave_mgmt/users/${userId}/reset-password`
            ];

            let success = false;
            let errorMessage = 'Failed to reset password';

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ password: newPassword })
                    });

                    if (response.ok) {
                        success = true;
                        break;
                    } else {
                        const error = await response.json();
                        errorMessage = error.error || errorMessage;
                    }
                } catch (err) {
                    console.log(`Failed with endpoint ${endpoint}:`, err);
                }
            }

            if (success) {
                // SINGLE SUCCESS MESSAGE - don't use alert()
                this.showSingleMessage(`Password for ${username} has been reset successfully!`, 'success');

                // Log the activity
                await this.logActivity('RESET_PASSWORD', {
                    username: username,
                    target_user: username
                });

                this.closeResetPasswordModal();
            } else {
                this.showSingleMessage(errorMessage || 'Failed to reset password', 'error');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            this.showSingleMessage('Failed to reset password', 'error');
        } finally {
            // Reset flag
            setTimeout(() => {
                this.isResettingPassword = false;
            }, 1000);
        }
    }

    // ADD THESE TWO HELPER METHODS TO YOUR CLASS:

    showSingleMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.single-message');
        existingMessages.forEach(msg => msg.remove());

        // Create message element
        const msgDiv = document.createElement('div');
        msgDiv.className = 'single-message';
        msgDiv.innerHTML = message;

        // Style based on type
        const bgColor = type === 'success' ? '#28a745' :
            type === 'error' ? '#dc3545' : '#17a2b8';

        msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

        document.body.appendChild(msgDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (msgDiv.parentNode) {
                msgDiv.remove();
            }
        }, 3000);
    }

    showSingleConfirmation(message) {
        return new Promise((resolve) => {
            // Create custom confirmation
            const confirmDiv = document.createElement('div');
            confirmDiv.id = 'custom-confirm';

            confirmDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 5px;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

            confirmDiv.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%;">
                <p style="margin-bottom: 25px;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="confirm-no" style="padding: 8px 20px;  border-radius: 5px;">Cancel</button>
                    <button id="confirm-yes" style="padding: 8px 20px; background: #007bff; color: white; border-radius: 5px;">OK</button>
                </div>
            </div>
        `;

            document.body.appendChild(confirmDiv);

            // Handle clicks
            document.getElementById('confirm-no').onclick = () => {
                confirmDiv.remove();
                resolve(false);
            };

            document.getElementById('confirm-yes').onclick = () => {
                confirmDiv.remove();
                resolve(true);
            };
        });
    }

    async deleteAdminUser(userId, username) {
        if (!confirm(`Are you sure you want to delete admin user "${username}"? This action cannot be undone.`)) {
            return;
        }

        try {
            console.log(`Deleting user ${userId}...`);

            // Try multiple endpoints
            const endpoints = [
                `/leave_mgmt/admin/users/${userId}`,
                `/leave_mgmt/admins/${userId}`,
                `/leave_mgmt/users/${userId}`
            ];

            let success = false;
            let errorMessage = 'Failed to delete user';

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    if (response.ok) {
                        success = true;
                        break;
                    } else {
                        const error = await response.json();
                        errorMessage = error.error || errorMessage;
                    }
                } catch (err) {
                    console.log(`Failed with endpoint ${endpoint}:`, err);
                }
            }

            if (success) {
                alert(`Admin user "${username}" deleted successfully!`);

                // Reload the admin users list
                await this.loadAdminUsers();

                // Log the activity
                await this.logActivity('DELETE_ADMIN', {
                    username: username,
                    target_user: username
                });
            } else {
                alert(errorMessage || 'Failed to delete admin user');
            }
        } catch (error) {
            console.error('Error deleting admin user:', error);
            alert('Failed to delete admin user. Please check console for details.');
        }
    }
    // async loadStats() {
    //     try {
    //         const [scopesRes, facultyRes] = await Promise.all([
    //             fetch('/leave_mgmt/metadata/scopes', { credentials: 'include' }),
    //             fetch('/leave_mgmt/all-faculty', { credentials: 'include' })  // Changed from get-leaves to all-faculty
    //         ]);

    //         const scopesData = await scopesRes.json();
    //         const facultyData = await facultyRes.json();

    //         // Get counts
    //         const deptCount = scopesData.departments?.length || 0;
    //         const hostelCount = scopesData.hostels?.length || 0;

    //         // Count faculty vs staff
    //         let facultyCount = 0;
    //         let staffCount = 0;

    //         if (Array.isArray(facultyData)) {
    //             facultyData.forEach(member => {
    //                 if (member.member_type === 'faculty') {
    //                     facultyCount++;
    //                 } else if (member.member_type === 'staff') {
    //                     staffCount++;
    //                 }
    //             });
    //         }

    //         // Update stats
    //         document.getElementById('totalDepartments').textContent = deptCount;
    //         document.getElementById('totalHostels').textContent = hostelCount;
    //         document.getElementById('totalFaculty').textContent = facultyCount;
    //         document.getElementById('totalStaff').textContent = staffCount;

    //     } catch (error) {
    //         console.error('Failed to load stats:', error);
    //     }
    // }

    async loadDepartmentsHostels() {
        try {
            console.log('Loading departments and hostels...');

            // Load departments
            let departments = [];
            try {
                const deptResponse = await fetch('/leave_mgmt/admin/departments-full', {
                    credentials: 'include'
                });

                console.log('Departments response status:', deptResponse.status);

                if (deptResponse.ok) {
                    departments = await deptResponse.json();
                    console.log('Departments data received:', departments);
                } else {
                    // Fallback to simple departments
                    const simpleDeptResponse = await fetch('/leave_mgmt/admin/departments', {
                        credentials: 'include'
                    });
                    const simpleDepts = await simpleDeptResponse.json();
                    console.log('Simple departments data:', simpleDepts);

                    departments = await Promise.all(
                        simpleDepts.map(async (dept) => {
                            try {
                                // Get member count
                                const memberRes = await fetch(`/leave_mgmt/departments/${dept.department_id || dept.id}/members`, {
                                    credentials: 'include'
                                });
                                let member_count = 0;
                                if (memberRes.ok) {
                                    const data = await memberRes.json();
                                    member_count = data.count || 0;
                                }

                                // Get admin count
                                const adminRes = await fetch(`/leave_mgmt/admin/scopes/department/${dept.department_id || dept.id}/admins`, {
                                    credentials: 'include'
                                });
                                let admin_count = 0;
                                if (adminRes.ok) {
                                    const data = await adminRes.json();
                                    admin_count = data.count || 0;
                                }

                                return {
                                    id: dept.department_id || dept.id,
                                    name: dept.department_name || dept.name,
                                    member_count: member_count,
                                    admin_count: admin_count,
                                    created_at: dept.created_at || dept.createdAt || dept.date_created || dept.creation_date || dept.createdDate || null
                                };
                            } catch (e) {
                                console.error(`Error fetching stats for department ${dept.id}:`, e);
                                return {
                                    id: dept.department_id || dept.id,
                                    name: dept.department_name || dept.name,
                                    member_count: 0,
                                    admin_count: 0,
                                    created_at: null
                                };
                            }
                        })
                    );
                }
            } catch (deptError) {
                console.error('Failed to load departments:', deptError);
                departments = [];
            }

            // Load hostels
            let hostels = [];
            try {
                const hostelResponse = await fetch('/leave_mgmt/admin/hostels-full', {
                    credentials: 'include'
                });

                console.log('Hostels response status:', hostelResponse.status);

                if (hostelResponse.ok) {
                    hostels = await hostelResponse.json();
                    console.log('Hostels data received:', hostels);
                } else {
                    // Fallback to simple hostels
                    const simpleHostelResponse = await fetch('/leave_mgmt/admin/hostels', {
                        credentials: 'include'
                    });
                    const simpleHostels = await simpleHostelResponse.json();
                    console.log('Simple hostels data:', simpleHostels);

                    hostels = await Promise.all(
                        simpleHostels.map(async (hostel) => {
                            try {
                                // Get member count
                                const memberRes = await fetch(`/leave_mgmt/hostels/${hostel.hostel_id || hostel.id}/members`, {
                                    credentials: 'include'
                                });
                                let member_count = 0;
                                if (memberRes.ok) {
                                    const data = await memberRes.json();
                                    member_count = data.count || 0;
                                }

                                // Get admin count
                                const adminRes = await fetch(`/leave_mgmt/admin/scopes/hostel/${hostel.hostel_id || hostel.id}/admins`, {
                                    credentials: 'include'
                                });
                                let admin_count = 0;
                                if (adminRes.ok) {
                                    const data = await adminRes.json();
                                    admin_count = data.count || 0;
                                }

                                return {
                                    id: hostel.hostel_id || hostel.id,
                                    name: hostel.hostel_name || hostel.name,
                                    member_count: member_count,
                                    admin_count: admin_count,
                                    created_at: hostel.created_at || hostel.createdAt || hostel.date_created || null
                                };
                            } catch (e) {
                                console.error(`Error fetching stats for hostel ${hostel.id}:`, e);
                                return {
                                    id: hostel.hostel_id || hostel.id,
                                    name: hostel.hostel_name || hostel.name,
                                    member_count: 0,
                                    admin_count: 0,
                                    created_at: null
                                };
                            }
                        })
                    );
                }
            } catch (hostelError) {
                console.error('Failed to load hostels:', hostelError);
                hostels = [];
            }

            // Display the data
            this.displayDepartmentsHostels(departments, hostels);

        } catch (error) {
            console.error('Failed to load departments/hostels:', error);
            this.showErrorInTable('deptHostelBody', 'Failed to load departments and hostels data.');
        }
    }
    async loadAllFacultyStaff() {
        try {
            const response = await fetch('/leave_mgmt/all-faculty', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch faculty/staff');
            }

            this.allFacultyStaff = await response.json();
            this.filterFacultyStaff();

        } catch (error) {
            console.error('Failed to load faculty/staff:', error);
            this.showErrorInTable('facultyStaffBody', 'Failed to load faculty/staff data');
        }
    }

    // Add this method to populate the scope filter dropdown
    populateScopeFilter() {
        const scopeFilter = document.getElementById('scopeFilter');
        if (!scopeFilter) {
            console.error('scopeFilter element not found!');
            return;
        }

        // Clear existing options
        scopeFilter.innerHTML = '<option value="">Select Department/Hostel</option>';

        console.log('Populating scope filter...');

        // Fetch departments and hostels
        fetch('/leave_mgmt/metadata/scopes', {
            credentials: 'include'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch scopes: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Check if data has duplicates by comparing IDs
                const uniqueDepartments = [];
                const uniqueHostels = [];
                const seenDeptIds = new Set();
                const seenHostelIds = new Set();

                // Filter duplicate departments
                if (data.departments && Array.isArray(data.departments)) {
                    data.departments.forEach(dept => {
                        if (dept && dept.id && dept.name && !seenDeptIds.has(dept.id)) {
                            uniqueDepartments.push(dept);
                            seenDeptIds.add(dept.id);
                        }
                    });
                }

                // Filter duplicate hostels
                if (data.hostels && Array.isArray(data.hostels)) {
                    data.hostels.forEach(hostel => {
                        if (hostel && hostel.id && hostel.name && !seenHostelIds.has(hostel.id)) {
                            uniqueHostels.push(hostel);
                            seenHostelIds.add(hostel.id);
                        }
                    });
                }

                console.log(`Unique: ${uniqueDepartments.length} departments, ${uniqueHostels.length} hostels`);

                // Add departments with optgroup
                if (uniqueDepartments.length > 0) {
                    const deptGroup = document.createElement('optgroup');
                    deptGroup.label = 'Departments';

                    uniqueDepartments.forEach(dept => {
                        const option = document.createElement('option');
                        option.value = `dept:${dept.id}`;
                        option.textContent = `${dept.name}`;
                        deptGroup.appendChild(option);
                    });

                    scopeFilter.appendChild(deptGroup);
                }

                // Add hostels with optgroup
                if (uniqueHostels.length > 0) {
                    const hostelGroup = document.createElement('optgroup');
                    hostelGroup.label = 'Hostels';

                    uniqueHostels.forEach(hostel => {
                        const option = document.createElement('option');
                        option.value = `hostel:${hostel.id}`;
                        option.textContent = `${hostel.name}`;
                        hostelGroup.appendChild(option);
                    });

                    scopeFilter.appendChild(hostelGroup);
                }

                // If no options were added, show message
                if (uniqueDepartments.length === 0 && uniqueHostels.length === 0) {
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "No departments/hostels available";
                    option.disabled = true;
                    scopeFilter.appendChild(option);
                }
            })
            .catch(error => {
                console.error('Failed to load scope options:', error);
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Failed to load options";
                option.disabled = true;
                scopeFilter.appendChild(option);
            });
    }

    // Add this method to load all faculty/staff
    async loadAllFacultyStaff() {
        try {
            console.log('Loading faculty/staff data...');

            const response = await fetch('/leave_mgmt/all-faculty', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch faculty/staff: ${response.status}`);
            }

            const data = await response.json();
            console.log('Faculty/staff data loaded:', data.length, 'records');

            // Store the data
            this.allFacultyStaff = Array.isArray(data) ? data : [];

            // Populate the scope filter
            this.populateScopeFilter();

            // Display all data initially
            this.displayFacultyStaff(this.allFacultyStaff);

        } catch (error) {
            console.error('Failed to load faculty/staff:', error);
            this.showFacultyStaffError('Failed to load faculty/staff data');
        }
    }

    // Update your displayFacultyStaff method to include proper edit buttons
    displayFacultyStaff(facultyStaff) {
        const tbody = document.getElementById('facultyStaffBody');
        if (!tbody) {
            console.error('facultyStaffBody element not found!');
            return;
        }

        if (!facultyStaff || facultyStaff.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #666; padding: 30px;">
                    <i class="fas fa-users" style="font-size: 24px; margin-bottom: 10px; display: block; color: #999;"></i>
                    No faculty/staff found
                    <br>
                    <small>Try changing your filter criteria</small>
                </td>
            </tr>
        `;
            return;
        }

        tbody.innerHTML = '';

        facultyStaff.forEach(person => {
            const row = document.createElement('tr');

            // Determine member type
            const memberType = person.member_type || (person.department_id ? 'faculty' : 'staff');

            // Determine scope info
            let scopeName = 'N/A';
            let scopeType = 'Unknown';

            if (person.department_name) {
                scopeName = person.department_name;
                scopeType = 'Department';
            } else if (person.hostel_name) {
                scopeName = person.hostel_name;
                scopeType = 'Hostel';
            } else if (person.department_id) {
                scopeName = `Dept ID: ${person.department_id}`;
                scopeType = 'Department';
            } else if (person.hostel_id) {
                scopeName = `Hostel ID: ${person.hostel_id}`;
                scopeType = 'Hostel';
            }

            // Calculate total leaves in real-time (excluding academic)
            const s_gr = parseFloat(person.short_leaves_granted || 0);
            const h_gr = parseFloat(person.half_day_leaves_granted || 0);
            const c_gr = parseFloat(person.casual_leaves_granted || 0);
            const m_gr = parseFloat(person.medical_leaves_granted || 0);
            const w_gr = parseFloat(person.without_payment_leaves_granted || 0);
            const comp_gr = parseFloat(person.compensatory_leaves_granted || 0);
            const e_gr = parseFloat(person.earned_leaves_granted || 0);
            const totalLeaves = (s_gr / 3 + h_gr * 0.5 + c_gr + m_gr + w_gr + comp_gr + e_gr).toFixed(2);

            row.innerHTML = `
            <td>${person.id}</td>
            <td><a href="#" onclick="superAdminDashboard.showViewPersonnelModal(${person.id}); return false;" style="color: inherit; text-decoration: none; font-weight: 700;">${person.faculty_name || 'Unknown'}</a></td>
            <td>
                <span class="role-badge ${memberType === 'faculty' ? 'role-department' : 'role-hostel'}">
                    ${memberType === 'faculty' ? 'Faculty' : 'Staff'}
                </span>
            </td>
            <td>${scopeName}<br><small style="color: #666;">${scopeType}</small></td>
            <td>${person.designation || 'Not specified'}</td>
            <td>
                <span style="font-weight: 600; color: #013a63;">${person.granted_leaves || 0}</span>
                <br>
                <small style="color: #666; font-size: 12px;">Remaining: ${person.remaining_leaves || 0}</small>
            </td>
            <td>${totalLeaves}</td>
            <td class="action-buttons">
                <button class="btn-sm btn-edit" onclick="superAdminDashboard.showUpdatePersonnelModal(${person.id}, '${memberType}')" title="Details">
                    <i class="fas fa-info-circle"></i> Details
                </button>
                <button class="btn-sm" onclick="superAdminDashboard.showEditLeavesModal(${person.id})" title="Leaves" style="background: #28a745; color: white;">
                    <i class="fas fa-calendar-alt"></i> Leaves
                </button>
                <button class="btn-sm btn-delete" onclick="superAdminDashboard.deleteFacultyStaff(${person.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
            tbody.appendChild(row);
        });

        console.log('Displayed', facultyStaff.length, 'faculty/staff records');
    }

    // Edit details method
    editFacultyStaffDetails(id) {
        this.showUpdatePersonnelModal(id);
    }

    // Edit leaves method
    editFacultyStaffLeaves(id) {
        this.showEditLeavesModal(id);
    }

    // Add the delete method
    async deleteFacultyStaff(id) {
        console.log('Deleting faculty/staff with ID:', id);

        // Find the person
        const person = this.allFacultyStaff.find(p => p.id === id);
        if (!person) {
            alert('Person not found!');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${person.faculty_name}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/leave_mgmt/delete-faculty/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                // Remove from local data
                this.allFacultyStaff = this.allFacultyStaff.filter(p => p.id !== id);

                // Refresh display
                this.filterFacultyStaff();
                alert('Record deleted successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting faculty/staff:', error);
            alert('Failed to delete. Please try again.');
        }
    }

    // Add error display method
    showFacultyStaffError(message) {
        const tbody = document.getElementById('facultyStaffBody');
        if (tbody) {
            tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #dc3545; padding: 30px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <br>
                    ${message}
                </td>
            </tr>
        `;
        }
    }

    filterFacultyStaff() {
        const filterType = document.getElementById('facultyStaffFilter').value;
        const scopeId = document.getElementById('scopeFilter').value;

        if (!this.allFacultyStaff) return;

        let filtered = this.allFacultyStaff;

        // Filter by type
        if (filterType === 'department') {
            filtered = filtered.filter(person => person.department_id);
        } else if (filterType === 'hostel') {
            filtered = filtered.filter(person => person.hostel_id);
        }

        // Filter by specific scope
        if (scopeId) {
            const [type, id] = scopeId.split(':');
            if (type === 'dept') {
                filtered = filtered.filter(person => person.department_id == id);
            } else if (type === 'hostel') {
                filtered = filtered.filter(person => person.hostel_id == id);
            }
        }

        this.displayFacultyStaff(filtered);
    }

    displayFacultyStaff(facultyStaff) {
        const tbody = document.getElementById('facultyStaffBody');
        tbody.innerHTML = '';

        if (!facultyStaff || facultyStaff.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #666;">
                    No faculty/staff found
                </td>
            </tr>
        `;
            return;
        }

        facultyStaff.forEach(person => {
            const row = document.createElement('tr');
            const scopeName = person.department_name || person.hostel_name || 'N/A';
            const scopeType = person.department_name ? 'Department' : 'Hostel';

            row.innerHTML = `
            <td>${person.id}</td>
            <td><a href="#" onclick="superAdminDashboard.showViewPersonnelModal(${person.id}); return false;" style="color: inherit; text-decoration: none; font-weight: 700;">${person.faculty_name || 'Unknown'}</a></td>
            <td>
                <span class="role-badge ${person.member_type === 'faculty' ? 'role-department' : 'role-hostel'}">
                    ${person.member_type === 'faculty' ? 'Faculty' : 'Staff'}
                </span>
            </td>
            <td>${scopeName} (${scopeType})</td>
            <td>${person.designation || 'Not specified'}</td>
            <td>${person.granted_leaves || 0}</td>
            <td class="action-buttons">
                <button class="btn-sm btn-edit" onclick="superAdminDashboard.showUpdatePersonnelModal(${person.id}, '${person.member_type || ''}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
                <button class="btn-sm" onclick="superAdminDashboard.showEditLeavesModal(${person.id})" style="background: #28a745; color: white;">
                    <i class="fas fa-calendar-alt"></i> Leaves
                </button>
                <button class="btn-sm btn-delete" onclick="superAdminDashboard.deleteFacultyStaff(${person.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
            tbody.appendChild(row);
        });
    }
    // Add these methods for CRUD operations
    async editFacultyStaff(id) {
        const person = this.allFacultyStaff.find(p => p.id === id);
        if (!person) return;

        // Show the update modal instead of prompt
        this.showUpdatePersonnelModal(id);
    }

    // Update the showUpdatePersonnelModal method to handle superadmin

    closeUpdatePersonnelModal() {
        document.getElementById('updatePersonnelModal').style.display = 'none';
        document.getElementById('updatePersonnelForm').reset();
    }

    updateScopeOptions() {
        const memberType = document.querySelector('input[name="updateMemberType"]:checked')?.value;
        const scopeSelect = document.getElementById('updateScope');
        const teachingGroup = document.getElementById('updateTeachingGroup');
        const scopeLabel = document.getElementById('updateScopeLabel');

        if (!memberType) return;

        scopeSelect.innerHTML = '<option value="">Loading...</option>';
        scopeLabel.textContent = memberType === 'faculty' ? 'Department' : 'Hostel';

        // Show/hide teaching option based on member type
        if (teachingGroup) {
            teachingGroup.style.display = memberType === 'faculty' ? 'block' : 'none';
        }

        // Load appropriate options
        this.loadScopeOptions(memberType === 'faculty' ? 'department' : 'hostel', scopeSelect);
        
        // Also update designation options
        this.updateDesignationOptions();
    }

    updateDesignationOptions() {
        const memberType = document.querySelector('input[name="updateMemberType"]:checked')?.value;
        const designationSelect = document.getElementById('updateDesignation');

        if (!memberType) return;

        if (memberType === 'faculty') {
            designationSelect.innerHTML = `
            <option value="" disabled selected>Select Designation</option>
            <option value="Professor">Professor</option>
            <option value="Associate Professor">Associate Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Clerk">Clerk</option>
            <option value="Lab Technician">Lab Technician</option>
            <option value="Lab Attendant">Lab Attendant</option>
            <option value="Attendant">Attendant</option>
        `;
        } else {
            designationSelect.innerHTML = `
            <option value="" disabled selected>Select Designation</option>
            <option value="Warden">Warden</option>
            <option value="Caretaker">Caretaker</option>
            <option value="Mess Manager">Mess Manager</option>
            <option value="Hostel Staff">Hostel Staff</option>
            <option value="Security">Security</option>
            <option value="Cleaner">Cleaner</option>
        `;
        }
    }

    async updatePersonnel() {
        const id = document.getElementById('updatePersonnelId').value;
        const name = document.getElementById('updateName').value.trim();
        const designation = document.getElementById('updateDesignation').value;
        const memberType = document.querySelector('input[name="updateMemberType"]:checked')?.value;
        const scopeId = document.getElementById('updateScope').value;

        if (!name || !designation || !memberType || !scopeId) {
            alert('Please fill all required fields');
            return;
        }

        const payload = {
            faculty_name: name,
            designation: designation,
            member_type: memberType
        };

        // Add scope based on member type
        if (memberType === 'faculty') {
            payload.department_id = parseInt(scopeId);
            payload.hostel_id = null;
        } else {
            payload.hostel_id = parseInt(scopeId);
            payload.department_id = null;
        }

        // Collect per-type granted values from modal if present
        const map = {
            'update-short-granted': 'short_leaves_granted',
            'update-half-granted': 'half_day_leaves_granted',
            'update-casual-granted': 'casual_leaves_granted',
            'update-medical-granted': 'medical_leaves_granted',
            'update-without-granted': 'without_payment_leaves_granted',
            'update-compensatory-granted': 'compensatory_leaves_granted',
            'update-earned-granted': 'earned_leaves_granted',
            'update-academic-granted': 'academic_leaves_granted'
        };

        Object.keys(map).forEach(k=>{
            const v = document.getElementById(k)?.value;
            if (v !== undefined && v !== null && v !== '') payload[map[k]] = Number(v);
        });

        try {
            // Send to details endpoint to update per-type granted balances
            const response = await fetch(`/leave_mgmt/faculty/${id}/details`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.closeUpdatePersonnelModal();
                await this.loadAllFacultyStaff();
                this.filterFacultyStaff();
                alert('Personnel updated successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to update personnel');
            }
        } catch (error) {
            console.error('Error updating personnel:', error);
            alert('Failed to update personnel');
        }
    }

    // Update the updatePersonnel method for superadmin
    async updatePersonnel() {
        const id = document.getElementById('updatePersonnelId').value;
        const name = document.getElementById('updateName').value.trim();
        const designation = document.getElementById('updateDesignation').value;
        const memberType = document.querySelector('input[name="updateMemberType"]:checked')?.value;
        const scopeId = document.getElementById('updateScope').value;

        if (!name || !designation || !memberType || !scopeId) {
            alert('Please fill all required fields');
            return;
        }

        const payload = {
            faculty_name: name,
            designation: designation,
            member_type: memberType
        };

        if (memberType === 'faculty') {
            payload.department_id = parseInt(scopeId);
            payload.hostel_id = null;
        } else {
            payload.hostel_id = parseInt(scopeId);
            payload.department_id = null;
        }

        const map = {
            'update-short-granted': 'short_leaves_granted',
            'update-half-granted': 'half_day_leaves_granted',
            'update-casual-granted': 'casual_leaves_granted',
            'update-medical-granted': 'medical_leaves_granted',
            'update-without-granted': 'without_payment_leaves_granted',
            'update-compensatory-granted': 'compensatory_leaves_granted',
            'update-earned-granted': 'earned_leaves_granted',
            'update-academic-granted': 'academic_leaves_granted'
        };

        Object.keys(map).forEach(k=>{
            const v = document.getElementById(k)?.value;
            if (v !== undefined && v !== null && v !== '') payload[map[k]] = Number(v);
        });

        try {
            const response = await fetch(`/leave_mgmt/faculty/${id}/details`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.closeUpdatePersonnelModal();
                await this.loadAllFacultyStaff();
                this.filterFacultyStaff();
                alert('Personnel updated successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to update personnel');
            }
        } catch (error) {
            console.error('Error updating personnel:', error);
            alert('Failed to update personnel');
        }
    }

    // Update the showUpdatePersonnelModal method to handle superadmin
    showUpdatePersonnelModal(personnelId) {
        const person = this.allFacultyStaff.find(p => p.id === personnelId);
        if (!person) return;

        document.getElementById('updatePersonnelId').value = person.id;
        document.getElementById('updateName').value = person.faculty_name;

        // Set member type
        const memberType = person.member_type || (person.department_id ? 'faculty' : 'staff');
        const memberTypeRadio = document.querySelector(`input[name="updateMemberType"][value="${memberType}"]`);
        if (memberTypeRadio) memberTypeRadio.checked = true;

        // Update designation options based on type
        this.updateDesignationOptions();

        // Set current designation
        const designationSelect = document.getElementById('updateDesignation');
        if (designationSelect) designationSelect.value = person.designation || '';

        // Load and set scope options
        const scopeSelect = document.getElementById('updateScope');
        if (scopeSelect) {
            scopeSelect.innerHTML = '<option value="">Loading...</option>';

            if (memberType === 'faculty') {
                // Load departments
                this.loadScopeOptions('department', scopeSelect).then(() => {
                    if (person.department_id) {
                        scopeSelect.value = person.department_id;
                    }
                });
            } else {
                // Load hostels
                this.loadScopeOptions('hostel', scopeSelect).then(() => {
                    if (person.hostel_id) {
                        scopeSelect.value = person.hostel_id;
                    }
                });
            }
        }

        // Set new fields
        const yearSelect = document.getElementById('updateYearOfJoining');
        if (yearSelect) yearSelect.value = person.year_of_joining || '';
        
        const empTypeSelect = document.getElementById('updateEmploymentType');
        if (empTypeSelect) empTypeSelect.value = person.employment_type || '';
        
        const remarkTextarea = document.getElementById('updateRemark');
        if (remarkTextarea) remarkTextarea.value = person.remark || '';
        
        // Show teaching option only for faculty
        const teachingGroup = document.getElementById('updateTeachingGroup');
        if (teachingGroup) {
            teachingGroup.style.display = memberType === 'faculty' ? 'block' : 'none';
            const isTeachingSelect = document.getElementById('updateTeachingSelect');
            if (isTeachingSelect) {
                if (person.is_teaching === 1 || person.is_teaching === true) isTeachingSelect.value = '1';
                else if (person.is_teaching === 0 || person.is_teaching === false) isTeachingSelect.value = '0';
                else isTeachingSelect.value = '';
            }
        }

        // Show the modal
        document.getElementById('updatePersonnelModal').style.display = 'flex';
    }

    // Read-only view modal for personnel details
    showViewPersonnelModal(personnelId) {
        const person = this.allFacultyStaff.find(p => p.id === personnelId);
        if (!person) return;

        // Create or reuse modal
        let modal = document.getElementById('viewPersonnelModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'viewPersonnelModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Personnel Details</h3>
                        <button class="close-modal" id="viewPersonnelClose">&times;</button>
                    </div>
                    <div class="modal-body" id="viewPersonnelBody" style="max-height:60vh; overflow:auto;"></div>
                </div>`;
            document.body.appendChild(modal);
            document.getElementById('viewPersonnelClose').addEventListener('click', () => modal.style.display = 'none');
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        }

        const body = modal.querySelector('#viewPersonnelBody');
        const scopeName = person.department_name || person.hostel_name || '';
        const memberType = person.member_type || (person.department_id ? 'faculty' : 'staff');

        const teachingText = (person.is_teaching == 1 || person.is_teaching === true) ? 'Teaching' : (person.is_teaching == 0 || person.is_teaching === false) ? 'Non-Teaching' : '-';

        const html = `
            <div style="padding:12px;">
                <h4 style="margin-bottom:8px;">${person.faculty_name || 'Unknown'}</h4>
                <div style="margin-bottom:6px;"><strong>Type:</strong> ${memberType}</div>
                <div style="margin-bottom:6px;"><strong>Scope:</strong> ${scopeName}</div>
                <div style="margin-bottom:6px;"><strong>Designation:</strong> ${person.designation || 'N/A'}</div>
            <div style="margin-bottom:6px;"><strong>Year of Joining:</strong> ${person.year_of_joining || person.year || '-'}</div>
            <div style="margin-bottom:6px;"><strong>Employment Type:</strong> ${person.employment_type || person.emp_type || '-'}</div>
            <div style="margin-bottom:6px;"><strong>Teaching Type:</strong> ${teachingText}</div>
                <!-- Email and Contact removed per request -->
                <div style="margin-bottom:6px;"><strong>Leaves Granted:</strong> ${person.granted_leaves || 0}</div>
                <div style="margin-bottom:6px;"><strong>Remaining Leaves:</strong> ${person.remaining_leaves || 0}</div>
                <div style="margin-top:10px;"><strong>Remarks:</strong><div style="margin-top:6px; color:#333;">${person.remark || '-'}</div></div>
            </div>
        `;

        body.innerHTML = html;
        modal.style.display = 'flex';
    }

    showEditLeavesModal(personnelId) {
        const person = this.allFacultyStaff.find(p => p.id === personnelId);
        if (!person) return;
        
        document.getElementById('editLeavesPersonnelId').value = person.id;
        const nameSpan = document.getElementById('editLeavesPersonName');
        if (nameSpan) nameSpan.textContent = person.faculty_name;
        
        // Populate per-type granted values
        const setIf = (id, val) => { const el = document.getElementById(id); if(el) el.value = (val !== undefined && val !== null) ? val : 0; };
        setIf('editShortLeaves', person.short_leaves_granted || 0);
        setIf('editHalfDayLeaves', person.half_day_leaves_granted || 0);
        setIf('editFullDayLeaves', person.casual_leaves_granted || 0);
        setIf('editMedicalLeaves', person.medical_leaves_granted || 0);
        setIf('editCompensatoryLeaves', person.compensatory_leaves_granted || 0);
        setIf('editEarnedLeaves', person.earned_leaves_granted || 0);
        setIf('editWithoutPaymentLeaves', person.without_payment_leaves_granted || 0);
        setIf('editAcademicLeaves', person.academic_leaves_granted || 0);
        
        // Calculate and display initial values
        this.updateEditLeavesDisplay(person);
        
        document.getElementById('editLeavesModal').style.display = 'flex';
    }

    updateEditLeavesDisplay(person) {
        if (!person) {
            const id = document.getElementById('editLeavesPersonnelId')?.value;
            if (id) {
                person = this.allFacultyStaff.find(p => p.id == id);
            }
            if (!person) return;
        }
        
        const s_gr = parseFloat(document.getElementById('editShortLeaves')?.value || 0) || 0;
        const h_gr = parseFloat(document.getElementById('editHalfDayLeaves')?.value || 0) || 0;
        const c_gr = parseFloat(document.getElementById('editFullDayLeaves')?.value || 0) || 0;
        const m_gr = parseFloat(document.getElementById('editMedicalLeaves')?.value || 0) || 0;
        const w_gr = parseFloat(document.getElementById('editWithoutPaymentLeaves')?.value || 0) || 0;
        const comp_gr = parseFloat(document.getElementById('editCompensatoryLeaves')?.value || 0) || 0;
        const e_gr = parseFloat(document.getElementById('editEarnedLeaves')?.value || 0) || 0;
        
        const grantedTotal = (s_gr / 3 + h_gr * 0.5 + c_gr + m_gr + w_gr + comp_gr + e_gr).toFixed(2);
        
        // Calculate remaining based on difference
        const s_rem = parseFloat(person.short_leaves_remaining || 0);
        const h_rem = parseFloat(person.half_day_leaves_remaining || 0);
        const c_rem = parseFloat(person.casual_leaves_remaining || 0);
        const m_rem = parseFloat(person.medical_leaves_remaining || 0);
        const w_rem = parseFloat(person.without_payment_leaves_remaining || 0);
        const comp_rem = parseFloat(person.compensatory_leaves_remaining || 0);
        const e_rem = parseFloat(person.earned_leaves_remaining || 0);
        
        const s_gr_old = parseFloat(person.short_leaves_granted || 0);
        const h_gr_old = parseFloat(person.half_day_leaves_granted || 0);
        const c_gr_old = parseFloat(person.casual_leaves_granted || 0);
        const m_gr_old = parseFloat(person.medical_leaves_granted || 0);
        const w_gr_old = parseFloat(person.without_payment_leaves_granted || 0);
        const comp_gr_old = parseFloat(person.compensatory_leaves_granted || 0);
        const e_gr_old = parseFloat(person.earned_leaves_granted || 0);
        
        const s_diff = s_gr - s_gr_old;
        const h_diff = h_gr - h_gr_old;
        const c_diff = c_gr - c_gr_old;
        const m_diff = m_gr - m_gr_old;
        const w_diff = w_gr - w_gr_old;
        const comp_diff = comp_gr - comp_gr_old;
        const e_diff = e_gr - e_gr_old;
        
        const new_s_rem = s_rem + s_diff;
        const new_h_rem = h_rem + h_diff;
        const new_c_rem = c_rem + c_diff;
        const new_m_rem = m_rem + m_diff;
        const new_w_rem = w_rem + w_diff;
        const new_comp_rem = comp_rem + comp_diff;
        const new_e_rem = e_rem + e_diff;
        
        const remainingTotal = (new_s_rem / 3 + new_h_rem * 0.5 + new_c_rem + new_m_rem + new_w_rem + new_comp_rem + new_e_rem).toFixed(2);
        
        const grantedDisplay = document.getElementById('editGrantedLeavesDisplay');
        const remainingDisplay = document.getElementById('editRemainingLeavesDisplay');
        if (grantedDisplay) grantedDisplay.textContent = grantedTotal;
        if (remainingDisplay) remainingDisplay.textContent = remainingTotal;
    }

    closeEditLeavesModal() {
        document.getElementById('editLeavesModal').style.display = 'none';
        document.getElementById('editLeavesForm')?.reset();
    }

    // Update the updatePersonnel method for superadmin (details only)
    async updatePersonnel() {
        const id = document.getElementById('updatePersonnelId').value;
        const name = document.getElementById('updateName').value.trim();
        const designation = document.getElementById('updateDesignation').value;
        const memberType = document.querySelector('input[name="updateMemberType"]:checked')?.value;
        const scopeId = document.getElementById('updateScope').value;
        const year_of_joining = document.getElementById('updateYearOfJoining')?.value || null;
        const employment_type = document.getElementById('updateEmploymentType')?.value || null;
        const remark = document.getElementById('updateRemark')?.value || null;
        const is_teaching = document.getElementById('updateTeachingSelect')?.value === '1';

        if (!name || !designation || !memberType || !scopeId) {
            alert('Please fill all required fields');
            return;
        }

        const payload = {
            faculty_name: name,
            designation: designation,
            member_type: memberType,
            year_of_joining,
            employment_type,
            remark,
            is_teaching
        };

        // Add scope based on member type
        if (memberType === 'faculty') {
            payload.department_id = parseInt(scopeId);
            payload.hostel_id = null;
        } else {
            payload.hostel_id = parseInt(scopeId);
            payload.department_id = null;
        }

        try {
            const response = await fetch(`/leave_mgmt/faculty/${id}/details`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.closeUpdatePersonnelModal();
                await this.loadAllFacultyStaff();
                this.filterFacultyStaff();
                alert('Personnel details updated successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to update personnel');
            }
        } catch (error) {
            console.error('Error updating personnel:', error);
            alert('Failed to update personnel');
        }
    }

    async updatePersonnelLeaves() {
        const id = document.getElementById('editLeavesPersonnelId').value;
        const s_gr = parseFloat(document.getElementById('editShortLeaves')?.value || 0) || 0;
        const h_gr = parseFloat(document.getElementById('editHalfDayLeaves')?.value || 0) || 0;
        const c_gr = parseFloat(document.getElementById('editFullDayLeaves')?.value || 0) || 0;
        const m_gr = parseFloat(document.getElementById('editMedicalLeaves')?.value || 0) || 0;
        const comp_gr = parseFloat(document.getElementById('editCompensatoryLeaves')?.value || 0) || 0;
        const e_gr = parseFloat(document.getElementById('editEarnedLeaves')?.value || 0) || 0;
        const w_gr = parseFloat(document.getElementById('editWithoutPaymentLeaves')?.value || 0) || 0;
        const a_gr = parseFloat(document.getElementById('editAcademicLeaves')?.value || 0) || 0;

        const payload = {
            short_leaves_granted: s_gr,
            half_day_leaves_granted: h_gr,
            casual_leaves_granted: c_gr,
            medical_leaves_granted: m_gr,
            compensatory_leaves_granted: comp_gr,
            earned_leaves_granted: e_gr,
            without_payment_leaves_granted: w_gr,
            academic_leaves_granted: a_gr
        };

        try {
            const response = await fetch(`/leave_mgmt/faculty/${id}/leaves`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.closeEditLeavesModal();
                await this.loadAllFacultyStaff();
                this.filterFacultyStaff();
                alert('Leaves updated successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to update leaves');
            }
        } catch (error) {
            console.error('Error updating leaves:', error);
            alert('Failed to update leaves');
        }
    }

    async deleteFacultyStaff(id) {
        if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/leave_mgmt/delete-faculty/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await this.loadAllFacultyStaff();
                alert('Record deleted successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting faculty/staff:', error);
            alert('Failed to delete record');
        }
    }

    displayDepartmentsHostels(departments, hostels) {
        const tbody = document.getElementById('deptHostelBody');
        tbody.innerHTML = '';

        // Process departments with better date handling
        const deptItems = Array.isArray(departments) ? departments.map(dept => {
            // Debug log for each department
            console.log('Department raw data:', dept);

            return {
                ...dept,
                type: 'department',
                name: dept.name || dept.department_name || dept.departmentName || 'Unknown',
                id: dept.id || dept.department_id || dept.departmentId,
                member_count: dept.member_count || dept.memberCount || 0,
                admin_count: dept.admin_count || dept.adminCount || 0,
                created_at: dept.created_at || dept.createdAt || dept.created_date || dept.date_created || dept.dateCreated || dept.creation_date || dept.createdDate || null
            };
        }) : [];

        // Process hostels with better date handling
        const hostelItems = Array.isArray(hostels) ? hostels.map(hostel => {
            // Debug log for each hostel
            console.log('Hostel raw data:', hostel);

            return {
                ...hostel,
                type: 'hostel',
                name: hostel.name || hostel.hostel_name || hostel.hostelName || 'Unknown',
                id: hostel.id || hostel.hostel_id || hostel.hostelId,
                member_count: hostel.member_count || hostel.memberCount || 0,
                admin_count: hostel.admin_count || hostel.adminCount || 0,
                created_at: hostel.created_at || hostel.createdAt || hostel.created_date || hostel.date_created || hostel.dateCreated
            };
        }) : [];

        const allItems = [...deptItems, ...hostelItems].sort((a, b) =>
            a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
        );

        if (allItems.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #666;">
                    No departments or hostels found
                </td>
            </tr>
        `;
            return;
        }

        allItems.forEach(item => {
            const row = document.createElement('tr');

            // Enhanced date parsing function
            const formatDate = (dateString) => {
                if (!dateString) return 'N/A';

                try {
                    // Try multiple date formats
                    let date;

                    if (typeof dateString === 'string') {
                        // Try ISO format first
                        date = new Date(dateString);

                        // If that fails, try other common formats
                        if (isNaN(date.getTime())) {
                            // Try MySQL datetime format: 2024-01-15 14:30:00
                            date = new Date(dateString.replace(' ', 'T'));
                        }

                        // Try removing timezone for UTC dates
                        if (isNaN(date.getTime())) {
                            date = new Date(dateString.split('T')[0]);
                        }
                    } else if (dateString instanceof Date) {
                        date = dateString;
                    } else {
                        return 'N/A';
                    }

                    if (isNaN(date.getTime())) {
                        return 'Invalid Date';
                    }

                    return date.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    })
                } catch (e) {
                    console.log('Error formatting date:', dateString, e);
                    return 'N/A';
                }
            };

            const createdAtText = formatDate(item.created_at);

            row.innerHTML = `
            <td>
                <span class="role-badge ${item.type === 'department' ? 'role-department' : 'role-hostel'}">
                    ${item.type === 'department' ? 'Department' : 'Hostel'}
                </span>
            </td>
            <td><strong>${item.name}</strong></td>
            <td>
                <span style="font-weight: 600; color: #013a63;">${item.member_count || 0}</span>
                ${item.type === 'department' ? ' faculty' : ' staff'}
            </td>
            <td>
                <span style="font-weight: 600; color: #28a745;">${item.admin_count || 0}</span>
                active admins
            </td>
            <td>${createdAtText}</td>
            <td class="action-buttons">
                <button class="btn-sm btn-edit" onclick="superAdminDashboard.editScope('${item.type}', ${item.id}, '${item.name.replace(/'/g, "\\'")}')" 
                        title="Edit Name">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-sm btn-delete" onclick="superAdminDashboard.deleteScope('${item.type}', ${item.id}, '${item.name.replace(/'/g, "\\'")}')" 
                        title="Delete">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
            tbody.appendChild(row);
        });
    }
    // Add these methods to the SuperAdminDashboard class

    async editScope(scopeType, scopeId, currentName) {
        const newName = prompt(`Edit ${scopeType} name:`, currentName);
        if (!newName || newName.trim() === '' || newName === currentName) return;

        try {
            // Try multiple endpoints
            const endpoints = scopeType === 'department' ? [
                `/leave_mgmt/admin/departments/${scopeId}`,
                `/leave_mgmt/departments/${scopeId}`,
                `/leave_mgmt/admin/department/${scopeId}`
            ] : [
                `/leave_mgmt/admin/hostels/${scopeId}`,
                `/leave_mgmt/hostels/${scopeId}`,
                `/leave_mgmt/admin/hostel/${scopeId}`
            ];

            const payload = scopeType === 'department' ?
                { department_name: newName.trim(), name: newName.trim() } :
                { hostel_name: newName.trim(), name: newName.trim() };

            let success = false;
            let errorMessage = `Failed to update ${scopeType}`;

            for (const endpoint of endpoints) {
                try {
                    console.log(`Trying endpoint: ${endpoint}`);
                    const response = await fetch(endpoint, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        success = true;
                        break;
                    } else {
                        const error = await response.text();
                        console.log(`Endpoint ${endpoint} failed:`, error);
                        errorMessage = error || errorMessage;
                    }
                } catch (err) {
                    console.log(`Failed with endpoint ${endpoint}:`, err);
                }
            }

            if (success) {
                alert(`${scopeType.charAt(0).toUpperCase() + scopeType.slice(1)} updated successfully!`);

                // Log activity
                await this.logActivity(`UPDATE_${scopeType.toUpperCase()}`, {
                    scope_id: scopeId,
                    old_name: currentName,
                    new_name: newName.trim()
                });

                // Reload data
                await this.loadDepartmentsHostels();
                await this.loadStats();
            } else {
                alert(errorMessage);
            }
        } catch (error) {
            console.error(`Error updating ${scopeType}:`, error);
            alert(`Failed to update ${scopeType}. Please try again.`);
        }
    }

    async deleteScope(scopeType, scopeId, scopeName) {
        if (!confirm(`Are you sure you want to delete ${scopeType} "${scopeName}"? This will also delete all associated users and data.`)) {
            return;
        }

        try {
            const endpoint = scopeType === 'department' ?
                `/leave_mgmt/admin/departments/${scopeId}` :
                `/leave_mgmt/admin/hostels/${scopeId}`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                alert(`${scopeType.charAt(0).toUpperCase() + scopeType.slice(1)} deleted successfully!`);

                // Log activity
                await this.logActivity(`DELETE_${scopeType.toUpperCase()}`, {
                    scope_id: scopeId,
                    scope_name: scopeName
                });

                // Reload data
                await this.loadDepartmentsHostels();
                await this.loadStats(); // Also update stats
            } else {
                const error = await response.json();
                alert(error.error || `Failed to delete ${scopeType}`);
            }
        } catch (error) {
            console.error(`Error deleting ${scopeType}:`, error);
            alert(`Failed to delete ${scopeType}`);
        }
    }

    showErrorInTable(tableBodyId, message) {
        const tbody = document.getElementById(tableBodyId);
        tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; color: #dc3545; padding: 20px;">
                ${message}
            </td>
        </tr>
    `;
    }
    showErrorInTable(tableBodyId, message) {
        const tbody = document.getElementById(tableBodyId);
        tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; color: #dc3545; padding: 20px;">
                ${message}
            </td>
        </tr>
    `;
    }


    showErrorInTable(tableBodyId, message) {
        const tbody = document.getElementById(tableBodyId);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #dc3545;">
                    ${message}
                </td>
            </tr>
        `;
    }

    async loadActivityLogs() {
        try {
            const response = await fetch('/leave_mgmt/activity-logs?limit=6', {
                credentials: 'include'
            });
            const payload = await response.json();
            const logs = Array.isArray(payload) ? payload : payload.logs || [];

            const tbody = document.getElementById('activityLogsBody') || document.getElementById('activityLogs');
            if (!tbody) {
                console.debug('Activity logs table body not found (expected #activityLogsBody or #activityLogs)');
                return;
            }
            tbody.innerHTML = '';

            logs.slice(0, 6).forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.actor_username || 'System'}</td>
                    <td>${this.formatActivityAction(log)}</td>
                    <td><span class="status-badge status-success">Success</span></td>
                `;
                tbody.appendChild(row);
            });

        } catch (error) {
            console.error('Failed to load activity logs:', error);
        }
    }

    formatActivityAction(log) {
        const actions = {
            'ADD_USER': 'Created user account',
            'ADD_FACULTY': 'Added faculty/staff',
            'ADD_DEPARTMENT': 'Created department',
            'ADD_HOSTEL': 'Created hostel',
            'ADD_ADMIN': 'Created admin account',
            'UPDATE_FACULTY': 'Updated faculty details',
            'DELETE_FACULTY': 'Deleted faculty record',
            'ADD_LEAVE': 'Added leave record',
            'DELETE_LEAVE': 'Deleted leave record',
            'ADD_SHORT_LEAVE': 'Added short leave',
            'ADD_HALF_DAY_LEAVE': 'Added half-day leave',
            'UPDATE_GRANTED_LEAVES': 'Updated granted leaves',
            'ADD_CASUAL_LEAVE': 'Added casual leaves',
            'GENERATE_REPORT': 'Generated report',
            'CHANGE_PASSWORD': 'Changed password',
            'FAILED_LOGIN': 'Failed login attempt',
            'LOGOUT': 'Logged out'
        };

        let actionText = actions[log.action] || log.action;

        if (log.meta_json) {
            try {
                const meta = JSON.parse(log.meta_json);
                if (meta.faculty_name) actionText += `: ${meta.faculty_name}`;
                else if (meta.department_name) actionText += `: ${meta.department_name}`;
                else if (meta.hostel_name) actionText += `: ${meta.hostel_name}`;
                else if (meta.username) actionText += `: ${meta.username}`;
            } catch (e) {
                // Ignore parsing errors
            }
        }

        return actionText;
    }

    bindEvents() {

        if (this.eventsBound) {
            console.warn('Events already bound, skipping...');
            return;
        }
        this.eventsBound = true;

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.location.href = '/leave_mgmt';
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.location.href = '/leave_mgmt';
        });

        // Admin Form - with double submission prevention
        const adminForm = document.getElementById('adminForm');
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = adminForm.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;

            try {
                await this.createAdmin();
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });

        // Department/Hostel Forms - with double submission prevention
        const deptForm = document.getElementById('deptForm');
        if (deptForm) {
            deptForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = deptForm.querySelector('button[type="submit"]');
                if (submitBtn && submitBtn.disabled) return;

                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                submitBtn.disabled = true;

                try {
                    await this.addDepartment();
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }

        const hostelForm = document.getElementById('hostelForm');
        if (hostelForm) {
            hostelForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = hostelForm.querySelector('button[type="submit"]');
                if (submitBtn && submitBtn.disabled) return;

                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                submitBtn.disabled = true;

                try {
                    await this.addHostel();
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }

        // Onboard Form - with double submission prevention
        const onboardForm = document.getElementById('onboardForm');
        if (onboardForm) {
            onboardForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = onboardForm.querySelector('button[type="submit"]');
                if (submitBtn && submitBtn.disabled) return;

                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                submitBtn.disabled = true;

                try {
                    await this.onboardMember();
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }

        // Report Form
        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.generateReport();
            });
        }

        const resetPasswordForm = document.getElementById('resetPasswordForm');
        if (resetPasswordForm) {
            // REMOVE any existing event listeners by cloning
            const newForm = resetPasswordForm.cloneNode(true);
            resetPasswordForm.parentNode.replaceChild(newForm, resetPasswordForm);

            // Add event listener to the new form
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopImmediatePropagation(); // ADD THIS: Prevent multiple handlers

                const submitBtn = newForm.querySelector('button[type="submit"]');
                if (submitBtn && submitBtn.disabled) return;

                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
                submitBtn.disabled = true;

                try {
                    await this.resetPassword();
                } catch (error) {
                    console.error('Reset password error:', error);
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    if (modal.style.display === 'flex') {
                        modal.style.display = 'none';
                    }
                });
            }
        });

        // Filter event listeners
        const facultyFilter = document.getElementById('facultyStaffFilter');
        const scopeFilter = document.getElementById('scopeFilter');

        if (facultyFilter) {
            facultyFilter.addEventListener('change', () => {
                this.filterFacultyStaff();
            });
        }

        if (scopeFilter) {
            scopeFilter.addEventListener('change', () => {
                this.filterFacultyStaff();
            });
        }

        // Refresh dashboard button
        const refreshBtn = document.querySelector('.footer-actions .btn-secondary');
        if (refreshBtn && refreshBtn.textContent.includes('Refresh')) {
            refreshBtn.addEventListener('click', () => {
                this.refreshDashboard();
            });
        }

        // View full activity logs button
        const activityBtn = document.querySelector('.footer-actions .btn-primary');
        if (activityBtn && activityBtn.textContent.includes('View Full Activity Logs')) {
            activityBtn.addEventListener('click', () => {
                this.openFullActivityLogs();
            });
        }

        // Setup form validation
        this.setupFormValidation();
    }

    // Add this helper method for form validation
    setupFormValidation() {
        // Password confirmation validation
        const newPassword = document.getElementById('newPassword');
        const confirmPassword = document.getElementById('confirmPassword');

        if (newPassword && confirmPassword) {
            const validatePasswords = () => {
                if (newPassword.value !== confirmPassword.value) {
                    confirmPassword.setCustomValidity('Passwords do not match');
                } else {
                    confirmPassword.setCustomValidity('');
                }
            };

            newPassword.addEventListener('input', validatePasswords);
            confirmPassword.addEventListener('input', validatePasswords);
        }

        // Department/Hostel name validation
        const deptName = document.getElementById('deptName');
        const hostelName = document.getElementById('hostelName');

        if (deptName) {
            deptName.addEventListener('input', (e) => {
                if (e.target.value.trim().length < 2) {
                    e.target.setCustomValidity('Department name must be at least 2 characters');
                } else {
                    e.target.setCustomValidity('');
                }
            });
        }

        if (hostelName) {
            hostelName.addEventListener('input', (e) => {
                if (e.target.value.trim().length < 2) {
                    e.target.setCustomValidity('Hostel name must be at least 2 characters');
                } else {
                    e.target.setCustomValidity('');
                }
            });
        }

        // Username validation
        const adminUsername = document.getElementById('adminUsername');
        if (adminUsername) {
            adminUsername.addEventListener('input', (e) => {
                const username = e.target.value.trim();
                if (username.length < 3) {
                    e.target.setCustomValidity('Username must be at least 3 characters');
                } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    e.target.setCustomValidity('Username can only contain letters, numbers, and underscores');
                } else {
                    e.target.setCustomValidity('');
                }
            });
        }
    }

    // Modal Functions
    showAddAdminModal() {
        document.getElementById('addAdminModal').style.display = 'flex';
    }

    closeAddAdminModal() {
        document.getElementById('addAdminModal').style.display = 'none';
        document.getElementById('adminForm').reset();
        document.getElementById('scopeField').style.display = 'none';
    }

    showAddDeptModal() {
        document.getElementById('addDeptModal').style.display = 'flex';
    }

    closeAddDeptModal() {
        document.getElementById('addDeptModal').style.display = 'none';
        document.getElementById('deptForm').style.display = 'none';
        document.getElementById('hostelForm').style.display = 'none';
        document.getElementById('deptForm').reset();
        document.getElementById('hostelForm').reset();
    }

    showAddDeptForm() {
        document.getElementById('deptForm').style.display = 'block';
        document.getElementById('hostelForm').style.display = 'none';
    }

    showAddHostelForm() {
        document.getElementById('hostelForm').style.display = 'block';
        document.getElementById('deptForm').style.display = 'none';
    }

    showOnboardModal() {
        document.getElementById('onboardModal').style.display = 'flex';
        this.setupOnboardForm();
    }

    closeOnboardModal() {
        document.getElementById('onboardModal').style.display = 'none';
        document.getElementById('onboardForm').reset();
    }

    showReportModal() {
        document.getElementById('reportModal').style.display = 'flex';
        this.setupReportForm();
    }

    closeReportModal() {
        document.getElementById('reportModal').style.display = 'none';
        document.getElementById('reportForm').reset();
        document.getElementById('dateRangeGroup').classList.remove('show');
        document.getElementById('reportScopeGroup').style.display = 'none';
    }

    toggleAdminScopeField() {
        const role = document.getElementById('adminRole').value;
        const scopeField = document.getElementById('scopeField');

        if (role === 'department_admin' || role === 'hostel_admin') {
            scopeField.style.display = 'block';
            this.loadScopeOptionsForAdmin(role);
        } else {
            scopeField.style.display = 'none';
        }
    }

    async loadScopeOptionsForAdmin(role) {
        const scopeSelect = document.getElementById('adminScope');
        scopeSelect.innerHTML = '<option value="">Select Scope</option>';

        try {
            const response = await fetch('/leave_mgmt/metadata/scopes', {
                credentials: 'include'
            });
            const data = await response.json();

            const items = role === 'department_admin' ? data.departments : data.hostels;

            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                scopeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load scope options:', error);
        }
    }

    async createAdmin() {
        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value.trim();
        const role = document.getElementById('adminRole').value;

        if (!username || !password || !role) {
            alert('Please fill all required fields');
            return;
        }

        const payload = { username, password, role };

        // Add scope if needed
        if (role === 'department_admin' || role === 'hostel_admin') {
            const scopeId = document.getElementById('adminScope').value;
            if (!scopeId) {
                alert('Please select a scope for this admin');
                return;
            }

            if (role === 'department_admin') {
                payload.departmentId = parseInt(scopeId); // Matches backend
            } else if (role === 'hostel_admin') {
                payload.hostelId = parseInt(scopeId); // Matches backend
            }
        }

        try {
            const response = await fetch('/leave_mgmt/admins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert('Admin created successfully!');
                this.closeAddAdminModal();
                await this.loadAdminUsers();
                await this.loadActivityLogs();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to create admin');
            }
        } catch (error) {
            console.error('Error creating admin:', error);
            alert('Failed to create admin');
        }
    }


    async logActivity(action, meta = {}) {
        try {
            const response = await fetch('/leave_mgmt/activity-logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: action,
                    meta_json: JSON.stringify(meta)
                })
            });

            // Refresh activity logs if on activity page
            if (document.getElementById('activity-section')?.classList.contains('active')) {
                await this.loadActivityLogs();
            }

            return response.ok;
        } catch (error) {
            console.error('Failed to log activity:', error);
            return false;
        }
    }

    async addDepartment() {
        const deptName = document.getElementById('deptName').value.trim();

        if (!deptName) {
            alert('Please enter department name');
            return;
        }

        try {
            const response = await fetch('/leave_mgmt/admin/departments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ department_name: deptName })
            });

            const result = await response.json(); // Get the response

            if (response.ok) {
                // Log activity
                await this.logActivity('ADD_DEPARTMENT', {
                    department_name: deptName
                });

                this.closeAddDeptModal();
                await this.loadAllData();

                // Show success message only once
                alert('Department added successfully!');
            } else {
                // Show error message
                alert(result.error || 'Failed to add department');
            }
        } catch (error) {
            console.error('Error adding department:', error);
            alert('Failed to add department');
        }
    }

    async addHostel() {
        const hostelName = document.getElementById('hostelName').value.trim();

        if (!hostelName) {
            alert('Please enter hostel name');
            return;
        }

        try {
            const response = await fetch('/leave_mgmt/admin/hostels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ hostel_name: hostelName })
            });

            const result = await response.json(); // Get the response

            if (response.ok) {
                // Log activity
                await this.logActivity('ADD_HOSTEL', {
                    hostel_name: hostelName
                });

                this.closeAddDeptModal();
                await this.loadAllData();

                // Show success message only once
                alert('Hostel added successfully!');
            } else {
                // Show error message
                alert(result.error || 'Failed to add hostel');
            }
        } catch (error) {
            console.error('Error adding hostel:', error);
            alert('Failed to add hostel');
        }
    }

    setupOnboardForm() {
        const designationSelect = document.getElementById('designation');
        designationSelect.innerHTML = `
            <option value="" disabled selected>Select Designation</option>
        `;

        // Set default to faculty
        document.getElementById('memberType').value = 'faculty';
        this.toggleScopeSelection();
    }

    toggleScopeSelection() {
        const memberType = document.getElementById('memberType').value;
        const scopeLabel = document.getElementById('scopeLabel');
        const scopeSelect = document.getElementById('scopeValue');
        const designationSelect = document.getElementById('designation');
        const teachingGroup = document.getElementById('onboardTeachingGroup');

        // Update scope label and options
        if (memberType === 'faculty') {
            scopeLabel.textContent = 'Select Department';
            this.loadScopeOptions('department', scopeSelect);

            // Set faculty designations
            designationSelect.innerHTML = `
                <option value="" disabled selected>Select Designation</option>
                <option value="Professor">Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Clerk">Clerk</option>
                <option value="Lab Technician">Lab Technician</option>
                <option value="Lab Attendant">Lab Attendant</option>
                <option value="Attendant">Attendant</option>
            `;

            // Show teaching option for faculty
            if (teachingGroup) teachingGroup.style.display = 'block';
        } else if (memberType === 'staff') {
            scopeLabel.textContent = 'Select Hostel';
            this.loadScopeOptions('hostel', scopeSelect);

            // Set staff designations
            designationSelect.innerHTML = `
                <option value="" disabled selected>Select Designation</option>
                <option value="Warden">Warden</option>
                <option value="Caretaker">Caretaker</option>
                <option value="Mess Manager">Mess Manager</option>
                <option value="Hostel Staff">Hostel Staff</option>
                <option value="Security">Security</option>
                <option value="Cleaner">Cleaner</option>
            `;

            // Hide teaching option for staff
            if (teachingGroup) teachingGroup.style.display = 'none';
        }
    }

    populateYearDropdowns() {
        const currentYear = new Date().getFullYear();
        const startYear = 1970;
        const endYear = currentYear + 1;
        
        const yearOptions = '<option value="">Select Year</option>';
        let yearSelectOptions = '';
        for (let year = endYear; year >= startYear; year--) {
            yearSelectOptions += `<option value="${year}">${year}</option>`;
        }
        
        // Populate onboard form dropdown
        const onboardYear = document.getElementById('onboardYearOfJoining');
        if (onboardYear) {
            onboardYear.innerHTML = yearOptions + yearSelectOptions;
        }
        
        // Populate update form dropdown
        const updateYear = document.getElementById('updateYearOfJoining');
        if (updateYear) {
            updateYear.innerHTML = yearOptions + yearSelectOptions;
        }
    }

    async loadScopeOptions(scopeType, selectElement) {
        selectElement.innerHTML = `<option value="">Select ${scopeType === 'department' ? 'Department' : 'Hostel'}</option>`;

        try {
            const response = await fetch('/leave_mgmt/metadata/scopes', {
                credentials: 'include'
            });
            const data = await response.json();

            const items = scopeType === 'department' ? data.departments : data.hostels;

            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                selectElement.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load scope options:', error);
        }
    }

    async onboardMember() {
        const memberType = document.getElementById('memberType').value;
        const scopeValue = document.getElementById('scopeValue').value;
        const memberName = document.getElementById('memberName').value.trim();
        const designation = document.getElementById('designation').value;
        // Collect per-type onboard values
        const getNum = id => Number(document.getElementById(id)?.value || 0);
        const s = getNum('onboard-short-granted');
        const h = getNum('onboard-half-granted');
        const c = getNum('onboard-casual-granted');
        const m = getNum('onboard-medical-granted');
        const w = getNum('onboard-without-granted');
        const comp = getNum('onboard-compensatory-granted');
        const e = getNum('onboard-earned-granted');
        const a = getNum('onboard-academic-granted');
        const year_of_joining = document.getElementById('onboardYearOfJoining')?.value || null;
        const employment_type = document.getElementById('onboardEmploymentType')?.value || null;
        const remark = document.getElementById('onboardRemark')?.value || null;
        const is_teaching = document.getElementById('onboardTeachingSelect')?.value === '1';

        if (!memberType || !scopeValue || !memberName || !designation) {
            alert('Please fill all required fields');
            return;
        }

        // Disable submit button to prevent double click
        const submitBtn = document.querySelector('#onboardForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitBtn.disabled = true;

        const payload = {
            faculty_name: memberName,
            designation: designation,
            member_type: memberType,
            short_leaves_granted: s,
            half_day_leaves_granted: h,
            casual_leaves_granted: c,
            medical_leaves_granted: m,
            without_payment_leaves_granted: w,
            compensatory_leaves_granted: comp,
            earned_leaves_granted: e,
            academic_leaves_granted: a,
            year_of_joining,
            employment_type,
            remark,
            is_teaching
        };

        // Add scope based on member type
        if (memberType === 'faculty') {
            payload.department_id = parseInt(scopeValue);
        } else {
            payload.hostel_id = parseInt(scopeValue);
        }

        console.log('Sending payload:', payload);

        try {
            const response = await fetch('/leave_mgmt/add-faculty', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const responseData = await response.json();
            console.log('Response:', responseData);

            if (response.ok) {
                // Clear form immediately
                document.getElementById('onboardForm').reset();

                // Show single success message
                setTimeout(() => {
                    alert(`${memberType === 'faculty' ? 'Faculty' : 'Staff'} onboarded successfully!`);
                }, 100);

                // Close modal after delay
                setTimeout(() => {
                    this.closeOnboardModal();
                }, 500);

                // Reload data
                await this.loadAllData();

                // Log activity
                await this.logActivity('ADD_FACULTY', {
                    faculty_name: memberName,
                    member_type: memberType,
                    designation: designation
                });
            } else {
                alert(responseData.error || `Failed to onboard ${memberType}`);
            }
        } catch (error) {
            console.error('Error onboarding member:', error);
            alert(`Failed to onboard ${memberType}`);
        } finally {
            // Re-enable button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // setupReportForm() {
    //     // Set today's date
    //     const today = new Date().toISOString().split('T')[0];
    //     document.getElementById('toDate').value = today;

    //     // Set 30 days ago as default from date
    //     const thirtyDaysAgo = new Date();
    //     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    //     document.getElementById('fromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    // }

    // Update the setupReportForm method:


    setupReportForm() {
        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('toDate').value = today;

        // Set 30 days ago as default from date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        document.getElementById('fromDate').value = thirtyDaysAgo.toISOString().split('T')[0];

        // Pre-load all scope options
        this.loadAllScopeOptions();
    }

    // NEW: Load all scope options (departments and hostels)
    async loadAllScopeOptions() {
        const scopeSelect = document.getElementById('reportScopeValue');
        if (!scopeSelect) return;

        scopeSelect.innerHTML = '<option value="">Loading...</option>';

        try {
            const response = await fetch('/leave_mgmt/metadata/scopes', {
                credentials: 'include'
            });
            const data = await response.json();

            scopeSelect.innerHTML = '<option value="">Select Department/Hostel</option>';

            // Add departments
            if (data.departments && data.departments.length > 0) {
                const deptGroup = document.createElement('optgroup');
                deptGroup.label = 'Departments';
                data.departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = `department:${dept.id}`;
                    option.textContent = dept.name;
                    deptGroup.appendChild(option);
                });
                scopeSelect.appendChild(deptGroup);
            }

            // Add hostels
            if (data.hostels && data.hostels.length > 0) {
                const hostelGroup = document.createElement('optgroup');
                hostelGroup.label = 'Hostels';
                data.hostels.forEach(hostel => {
                    const option = document.createElement('option');
                    option.value = `hostel:${hostel.id}`;
                    option.textContent = hostel.name;
                    hostelGroup.appendChild(option);
                });
                scopeSelect.appendChild(hostelGroup);
            }

        } catch (error) {
            console.error('Failed to load scope options:', error);
            scopeSelect.innerHTML = '<option value="">Failed to load options</option>';
        }
    }

    toggleDateRange() {
        const dateRangeGroup = document.getElementById('dateRangeGroup');
        const customReport = document.getElementById('customReport').checked;

        if (customReport) {
            dateRangeGroup.classList.add('show');
        } else {
            dateRangeGroup.classList.remove('show');
        }
    }

    // loadReportScopeOptions() {
    //     const scopeType = document.getElementById('reportScopeType').value;
    //     const scopeGroup = document.getElementById('reportScopeGroup');
    //     const scopeLabel = document.getElementById('reportScopeLabel');
    //     const scopeSelect = document.getElementById('reportScopeValue');

    //     if (!scopeType) {
    //         scopeGroup.style.display = 'none';
    //         return;
    //     }

    //     scopeGroup.style.display = 'block';
    //     scopeLabel.textContent = scopeType === 'department' ? 'Select Department' : 'Select Hostel';
    //     scopeSelect.innerHTML = `<option value="">Select</option>`;

    //     this.loadScopeOptions(scopeType, scopeSelect);
    // }
    loadReportScopeOptions() {
        const scopeType = document.getElementById('reportScopeType').value;
        const scopeGroup = document.getElementById('reportScopeGroup');
        const scopeLabel = document.getElementById('reportScopeLabel');
        const scopeSelect = document.getElementById('reportScopeValue');

        // Hide scope selection for "all" reports
        if (scopeType === 'all_departments' || scopeType === 'all_hostels') {
            scopeGroup.style.display = 'none';
            return;
        }

        // Show scope selection for single department/hostel
        scopeGroup.style.display = 'block';

        if (scopeType === 'single_department') {
            scopeLabel.textContent = 'Select Department';
            // Load and filter departments
            this.loadAndFilterScopeOptions('department', scopeSelect);
        } else if (scopeType === 'single_hostel') {
            scopeLabel.textContent = 'Select Hostel';
            // Load and filter hostels
            this.loadAndFilterScopeOptions('hostel', scopeSelect);
        } else {
            scopeGroup.style.display = 'none';
        }
    }

    // NEW: Load and filter scope options properly
    async loadAndFilterScopeOptions(type, scopeSelect) {
        if (!scopeSelect) return;

        scopeSelect.innerHTML = '<option value="">Loading...</option>';

        try {
            const response = await fetch('/leave_mgmt/metadata/scopes', {
                credentials: 'include'
            });
            const data = await response.json();

            scopeSelect.innerHTML = `<option value="">Select ${type === 'department' ? 'Department' : 'Hostel'}</option>`;

            let items = [];
            if (type === 'department') {
                items = data.departments || [];
            } else if (type === 'hostel') {
                items = data.hostels || [];
            }

            items.forEach(item => {
                const option = document.createElement('option');
                option.value = `${type === 'department' ? 'department' : 'hostel'}:${item.id}`;
                option.textContent = item.name;
                scopeSelect.appendChild(option);
            });

            // If no items found
            if (items.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = `No ${type === 'department' ? 'departments' : 'hostels'} available`;
                option.disabled = true;
                scopeSelect.appendChild(option);
            }

        } catch (error) {
            console.error('Failed to load scope options:', error);
            scopeSelect.innerHTML = '<option value="">Failed to load options</option>';
        }
    }

    // NEW: Filter scope options
    filterScopeOptions(type, scopeSelect) {
        const allOptions = scopeSelect.querySelectorAll('optgroup, option');

        allOptions.forEach(opt => {
            if (opt.tagName === 'OPTGROUP') {
                if (type === 'department' && opt.label === 'Departments') {
                    opt.style.display = '';
                } else if (type === 'hostel' && opt.label === 'Hostels') {
                    opt.style.display = '';
                } else {
                    opt.style.display = 'none';
                }
            } else if (opt.tagName === 'OPTION' && opt.value === '') {
                // Keep the "Select" option visible
                opt.style.display = '';
            } else if (opt.tagName === 'OPTION') {
                // Hide individual options not in optgroup
                opt.style.display = 'none';
            }
        });
    }

    // async generateReport() {
    //     const reportType = document.querySelector('input[name="reportType"]:checked').value;
    //     const scopeType = document.getElementById('reportScopeType').value;
    //     const scopeValue = document.getElementById('reportScopeValue').value;

    //     let fromDate, toDate;

    //     if (reportType === 'today') {
    //         const today = new Date();
    //         fromDate = today.toISOString().split('T')[0];
    //         toDate = fromDate;
    //     } else {
    //         fromDate = document.getElementById('fromDate').value;
    //         toDate = document.getElementById('toDate').value;

    //         if (!fromDate || !toDate) {
    //             alert('Please select date range for custom report');
    //             return;
    //         }
    //     }

    //     // Build URL
    //     let url = `/leave_mgmt/pdf/all?fromDate=${fromDate}&toDate=${toDate}`;

    //     if (scopeType && scopeValue) {
    //         url += `&scopeType=${scopeType}&scopeId=${scopeValue}`;
    //     } else {
    //         url += '&scopeType=global';
    //     }

    //     // Open in new tab
    //     window.open(url, '_blank');
    //     this.closeReportModal();
    // }

    async generateReport() {
        const reportType = document.querySelector('input[name="reportType"]:checked').value;
        const scopeType = document.getElementById('reportScopeType').value;
        const scopeValue = document.getElementById('reportScopeValue').value;

        let fromDate, toDate;

        if (reportType === 'today') {
            const today = new Date();
            fromDate = today.toISOString().split('T')[0];
            toDate = fromDate;
        } else {
            fromDate = document.getElementById('fromDate').value;
            toDate = document.getElementById('toDate').value;

            if (!fromDate || !toDate) {
                alert('Please select date range for custom report');
                return;
            }
        }

        // Validate scope selection
        if (!scopeType) {
            alert('Please select a report scope');
            return;
        }

        // Build URL based on scope type
        let url = `/leave_mgmt/pdf/all?fromDate=${fromDate}&toDate=${toDate}`;

        if (scopeType === 'all_departments') {
            url += '&scopeType=department&scopeId=all';
        } else if (scopeType === 'all_hostels') {
            url += '&scopeType=hostel&scopeId=all';
        } else if (scopeType === 'single_department' || scopeType === 'single_hostel') {
            if (!scopeValue) {
                alert(`Please select a ${scopeType === 'single_department' ? 'department' : 'hostel'} for the report`);
                return;
            }
            const [type, id] = scopeValue.split(':');
            url += `&scopeType=${type}&scopeId=${id}`;
        }

        console.log('Generating report URL:', url);

        // Show loading message
        const generateBtn = document.querySelector('#reportModal .btn-primary');
        const originalText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        generateBtn.disabled = true;

        // Open in new tab
        const newWindow = window.open('', '_blank');

        try {
            // Test if the URL is valid by making a HEAD request
            const testResponse = await fetch(url, { method: 'HEAD', credentials: 'include' });

            if (testResponse.ok) {
                // URL is valid, open it
                newWindow.location.href = url;
                setTimeout(() => {
                    this.closeReportModal();
                }, 1000);
            } else {
                throw new Error(`Server returned ${testResponse.status}`);
            }
        } catch (error) {
            console.error('Error generating report:', error);
            alert(`Failed to generate report: ${error.message}. Please check if the selected department/hostel has data.`);
            newWindow.close();
        } finally {
            // Restore button
            generateBtn.innerHTML = originalText;
            generateBtn.disabled = false;
        }
    }


    refreshDashboard() {
        this.loadAllData();
        alert('Dashboard refreshed!');
    }

    openFullActivityLogs() {
        window.open('/leave_mgmt/activity-logs/export', '_blank');
    }
}

// Initialize dashboard when DOM is loaded
// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // First, check if user is properly authenticated and is superadmin
        const response = await fetch('/leave_mgmt/context', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Failed to fetch user context, redirecting to login');
            window.location.href = '/leave_mgmt/';
            return;
        }
        
        const data = await response.json();
        const user = data?.user;
        
        if (!user) {
            console.error('No user data found, redirecting to login');
            window.location.href = '/leave_mgmt/';
            return;
        }
        
        console.log('User role detected:', user.role);
        
        // Check if user is superadmin
        if (user.role !== 'superadmin') {
            console.log(`User role ${user.role} should not be on superadmin dashboard, redirecting...`);
            
            // Redirect to appropriate dashboard based on role
            if (user.role === 'establishment_admin') {
                window.location.href = '/leave_mgmt/establishment.html';
            } else if (user.role === 'principal_admin') {
                window.location.href = '/leave_mgmt/principal.html';
            } else if (['department_admin', 'hostel_admin', 'department_staff', 'hostel_staff'].includes(user.role)) {
                window.location.href = '/leave_mgmt/main.html';
            } else {
                // Unknown role, go to login
                window.location.href = '/leave_mgmt/';
            }
            return;
        }
        
        // User is superadmin - initialize dashboard
        const dashboard = new SuperAdminDashboard();
        window.superAdminDashboard = dashboard;

        // Expose commonly used instance methods to the global scope for inline handlers
        window.showAddAdminModal = () => dashboard.showAddAdminModal();
        window.closeAddAdminModal = () => dashboard.closeAddAdminModal();
        window.showAddDeptModal = () => dashboard.showAddDeptModal();
        window.closeAddDeptModal = () => dashboard.closeAddDeptModal();
        window.showAddDeptForm = () => dashboard.showAddDeptForm();
        window.showAddHostelForm = () => dashboard.showAddHostelForm();
        window.showOnboardModal = () => dashboard.showOnboardModal();
        window.closeOnboardModal = () => dashboard.closeOnboardModal();
        window.showReportModal = () => dashboard.showReportModal();
        window.closeReportModal = () => dashboard.closeReportModal();
        window.toggleScopeSelection = () => dashboard.toggleScopeSelection();
        window.toggleDateRange = () => dashboard.toggleDateRange();
        window.loadReportScopeOptions = () => dashboard.loadReportScopeOptions();
        window.toggleAdminScopeField = () => dashboard.toggleAdminScopeField();
        window.downloadGlobalReport = () => dashboard.generateReport();
        window.refreshDashboard = () => dashboard.refreshDashboard();
        window.openFullActivityLogs = () => dashboard.openFullActivityLogs();
        window.showUpdatePersonnelModal = (id, type) => dashboard.showUpdatePersonnelModal(id, type);
        window.showEditLeavesModal = (id) => dashboard.showEditLeavesModal(id);
        window.closeUpdatePersonnelModal = () => dashboard.closeUpdatePersonnelModal();
        window.updateDesignationOptions = () => dashboard.updateDesignationOptions();
        window.editFacultyStaff = (id) => dashboard.editFacultyStaff(id);
        window.deleteFacultyStaff = (id) => dashboard.deleteFacultyStaff(id);
        window.updateScopeOptions = () => dashboard.updateScopeOptions();
        window.updatePersonnel = () => dashboard.updatePersonnel();
        window.resetPassword = () => dashboard.resetPassword();
        window.deleteAdminUser = (id, username) => dashboard.deleteAdminUser(id, username);
        window.editScope = (type, id, name) => dashboard.editScope(type, id, name);
        window.deleteScope = (type, id, name) => dashboard.deleteScope(type, id, name);
        window.showResetPasswordModal = (id, username) => dashboard.showResetPasswordModal(id, username);
        window.closeResetPasswordModal = () => dashboard.closeResetPasswordModal();

        // Store user info for later use
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('Superadmin dashboard initialized successfully');
        
    } catch (error) {
        console.error('Error during dashboard initialization:', error);
        window.location.href = '/leave_mgmt/';
    }
});

// Add visibility change listener to handle tab switches/refreshes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible again, re-check authentication
        fetch('/leave_mgmt/context', {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                window.location.href = '/leave_mgmt/';
                return;
            }
            return response.json();
        })
        .then(data => {
            const user = data?.user;
            if (!user || user.role !== 'superadmin') {
                console.log('User no longer has access, redirecting...');
                if (user?.role === 'establishment_admin') {
                    window.location.href = '/leave_mgmt/establishment.html';
                } else if (user?.role === 'principal_admin') {
                    window.location.href = '/leave_mgmt/principal.html';
                } else if (['department_admin', 'hostel_admin', 'department_staff', 'hostel_staff'].includes(user?.role)) {
                    window.location.href = '/leave_mgmt/main.html';
                } else {
                    window.location.href = '/leave_mgmt/';
                }
            }
        })
        .catch(() => {
            window.location.href = '/leave_mgmt/';
        });
    }
});

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Compute onboard/update totals for per-type inputs (superadmin UI)
function computeSuperadminTotals() {
    const getNum = id => Number(document.getElementById(id)?.value || 0);
    const onboardTotal = parseFloat((getNum('onboard-short-granted')/3 + getNum('onboard-half-granted')*0.5 + getNum('onboard-casual-granted') + getNum('onboard-medical-granted') + getNum('onboard-without-granted') + getNum('onboard-compensatory-granted') + getNum('onboard-earned-granted')).toFixed(2));
    const onboardEl = document.getElementById('onboard-total-leaves'); if (onboardEl) onboardEl.textContent = isNaN(onboardTotal)?'0.00':onboardTotal.toFixed(2);
    const updateTotal = parseFloat((getNum('update-short-granted')/3 + getNum('update-half-granted')*0.5 + getNum('update-casual-granted') + getNum('update-medical-granted') + getNum('update-without-granted') + getNum('update-compensatory-granted') + getNum('update-earned-granted')).toFixed(2));
    const updateEl = document.getElementById('update-total-leaves'); if (updateEl) updateEl.textContent = isNaN(updateTotal)?'0.00':updateTotal.toFixed(2);
}

['onboard-short-granted','onboard-half-granted','onboard-casual-granted','onboard-medical-granted','onboard-without-granted','onboard-compensatory-granted','onboard-earned-granted','update-short-granted','update-half-granted','update-casual-granted','update-medical-granted','update-without-granted','update-compensatory-granted','update-earned-granted'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.addEventListener) el.addEventListener('input', computeSuperadminTotals);
});

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }
});

