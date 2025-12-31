class EstablishmentDashboard {
    constructor() {
        this.currentTab = 'structure';
        this.departments = [];
        this.hostels = [];
        this.personnel = [];
        this.filteredPersonnel = [];
        this.init();
    }

    async init() {
        await this.loadUserInfo();
        await this.loadData();
        this.bindEvents();
        this.setupNavigation();
        this.renderDepartments();
        this.renderHostels();
        this.renderPersonnel();
    }

    async loadUserInfo() {
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
            // ignore and fallback to localStorage
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.username) {
            const usernameEl = document.getElementById('username');
            if (usernameEl) usernameEl.textContent = user.username;
            const initialsEl = document.getElementById('userInitials');
            if (initialsEl) initialsEl.textContent = user.username.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
    }

    async loadData() {
        try {
            // Load metadata
            const metadataResponse = await fetch('/leave_mgmt/metadata/scopes', {
                credentials: 'include'
            });
            const metadata = await metadataResponse.json();
            
            this.departments = metadata.departments || [];
            this.hostels = metadata.hostels || [];
            
            // Update stats
            document.getElementById('totalDeptCount').textContent = this.departments.length;
            document.getElementById('totalHostelCount').textContent = this.hostels.length;
            
            // Load all faculty/staff
            await this.loadAllPersonnel();
            
            // Update faculty and staff counts
            const facultyCount = this.personnel.filter(p => p.member_type === 'faculty').length;
            const staffCount = this.personnel.filter(p => p.member_type === 'staff').length;
            
            document.getElementById('totalFacultyCount').textContent = facultyCount;
            document.getElementById('totalStaffCount').textContent = staffCount;
            
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }

    async loadAllPersonnel() {
        try {
            // Load all personnel using the all-faculty endpoint
            const response = await fetch('/leave_mgmt/all-faculty', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    this.personnel = data.map(item => ({
                        ...item,
                        scope_type: item.department_id ? 'department' : 'hostel',
                        department_name: item.department_name || null,
                        hostel_name: item.hostel_name || null
                    }));
                }
            } else {
                // Fallback: Load from each department and hostel separately
                this.personnel = [];
                
                // Load from each department
                for (const dept of this.departments) {
                    try {
                        const response = await fetch(`/leave_mgmt/get-leaves?scopeType=department&scopeId=${dept.id}`, {
                            credentials: 'include'
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (Array.isArray(data)) {
                                data.forEach(item => {
                                    this.personnel.push({
                                        ...item,
                                        department_id: dept.id,
                                        department_name: dept.name,
                                        scope_type: 'department'
                                    });
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Error loading department ${dept.id}:`, err);
                    }
                }
                
                // Load from each hostel (staff)
                for (const hostel of this.hostels) {
                    try {
                        const response = await fetch(`/leave_mgmt/get-leaves?scopeType=hostel&scopeId=${hostel.id}`, {
                            credentials: 'include'
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (Array.isArray(data)) {
                                data.forEach(item => {
                                    this.personnel.push({
                                        ...item,
                                        hostel_id: hostel.id,
                                        hostel_name: hostel.name,
                                        scope_type: 'hostel'
                                    });
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Error loading hostel ${hostel.id}:`, err);
                    }
                }
            }
            
            this.filteredPersonnel = [...this.personnel];
            
        } catch (error) {
            console.error('Failed to load personnel:', error);
        }
    }

    bindEvents() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.location.href = '/leave_mgmt';
        });

        // Department form
        document.getElementById('addDeptForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addDepartment();
        });

        // Hostel form
        document.getElementById('addHostelForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addHostel();
        });

        // Personnel form
        document.getElementById('addPersonnelForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addPersonnel();
        });

        // Update personnel form
        document.getElementById('updatePersonnelForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updatePersonnel();
        });

        // Edit leaves form
        document.getElementById('editLeavesForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updatePersonnelLeaves();
        });

        // Search departments
        document.getElementById('deptSearch').addEventListener('input', (e) => {
            this.searchDepartments(e.target.value);
        });

        // Search hostels
        document.getElementById('hostelSearch').addEventListener('input', (e) => {
            this.searchHostels(e.target.value);
        });

        // Close modals on outside click
        document.addEventListener('click', (e) => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Initialize scope filter for personnel
        this.populateScopeFilter();
        
        // Populate year dropdowns
        this.populateYearDropdowns();

        // Keep designation dropdown in sync when personnelType changes
        const personnelTypeEl = document.getElementById('personnelType');
        if (personnelTypeEl) {
            personnelTypeEl.addEventListener('change', () => this.updateDesignationDropdown && this.updateDesignationDropdown());
        }
    }

    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });
        
        // Show selected tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const selectedTab = document.getElementById(`${tabId}Tab`);
        if (selectedTab) {
            selectedTab.style.display = 'block';
            
            // Refresh data for the tab
            if (tabId === 'structure') {
                this.renderDepartments();
                this.renderHostels();
            } else if (tabId === 'personnel') {
                this.renderPersonnel();
            }
        }
    }

    renderDepartments(searchTerm = '') {
        const tbody = document.getElementById('departmentsTable');
        if (!tbody) return;
        
        let filteredDepts = this.departments;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredDepts = this.departments.filter(dept => 
                dept.name.toLowerCase().includes(term) || 
                dept.id.toString().includes(term)
            );
        }
        
        if (filteredDepts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No departments found</td></tr>';
            return;
        }
        
       tbody.innerHTML = filteredDepts.map(dept => {
    return `
        <tr data-id="${dept.id}">
            <td>${dept.id}</td>  <!-- SHOW ACTUAL DATABASE ID -->
            <td>${dept.name}</td>
            <td class="action-buttons">
                <button class="btn-sm btn-edit" onclick="establishmentDashboard.editDepartment(${dept.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-sm btn-delete" onclick="establishmentDashboard.deleteDepartment(${dept.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `;
}).join('');
    }

    renderHostels(searchTerm = '') {
        const tbody = document.getElementById('hostelsTable');
        if (!tbody) return;
        
        let filteredHostels = this.hostels;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredHostels = this.hostels.filter(hostel => 
                hostel.name.toLowerCase().includes(term) || 
                hostel.id.toString().includes(term)
            );
        }
        
        if (filteredHostels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hostels found</td></tr>';
            return;
        }
        
tbody.innerHTML = filteredHostels.map(hostel => {
    return `
        <tr data-id="${hostel.id}">
            <td>${hostel.id}</td>  <!-- SHOW ACTUAL DATABASE ID -->
            <td>${hostel.name}</td>
            <td class="action-buttons">
                <button class="btn-sm btn-edit" onclick="establishmentDashboard.editHostel(${hostel.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-sm btn-delete" onclick="establishmentDashboard.deleteHostel(${hostel.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `;
}).join('');
    }

    renderPersonnel() {
        const tbody = document.getElementById('personnelTable');
        if (!tbody) return;
        
        if (this.filteredPersonnel.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No personnel found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.filteredPersonnel.map((person, index) => {
            const scopeName = person.scope_type === 'department' 
                ? person.department_name 
                : person.hostel_name;
            
            const scopeType = person.scope_type === 'department' ? 'Department' : 'Hostel';
            
            // Calculate total leaves in real-time (excluding academic)
            const s_gr = parseFloat(person.short_leaves_granted || 0);
            const h_gr = parseFloat(person.half_day_leaves_granted || 0);
            const c_gr = parseFloat(person.casual_leaves_granted || 0);
            const m_gr = parseFloat(person.medical_leaves_granted || 0);
            const w_gr = parseFloat(person.without_payment_leaves_granted || 0);
            const comp_gr = parseFloat(person.compensatory_leaves_granted || 0);
            const e_gr = parseFloat(person.earned_leaves_granted || 0);
            const totalLeaves = (s_gr / 3 + h_gr * 0.5 + c_gr + m_gr + w_gr + comp_gr + e_gr).toFixed(2);
            
            return `
                <tr data-id="${person.id}">
                    <td>${person.id}</td> 
                    <td><a href="#" onclick="establishmentDashboard.showViewPersonnelModal(${person.id}); return false;" style="color: inherit; text-decoration: none;">${person.faculty_name}</a></td>
                    <td>${person.member_type === 'faculty' ? 'Faculty' : 'Staff'}</td>
                    <td>${scopeName} (${scopeType})</td>
                    <td>${person.designation || 'Not specified'}</td>
                    <td>${person.granted_leaves || 0}</td>
                    <td>${totalLeaves}</td>
                    <td class="action-buttons">
                        <button class="btn-sm btn-edit" onclick="establishmentDashboard.editPersonnelDetails(${person.id})" title="Edit Details">
                            <i class="fas fa-user-edit"></i> Details
                        </button>
                        <button class="btn-sm btn-edit" onclick="establishmentDashboard.editPersonnelLeaves(${person.id})" title="Edit Leaves" style="background: #28a745;">
                            <i class="fas fa-calendar-alt"></i> Leaves
                        </button>
                        <button class="btn-sm btn-delete" onclick="establishmentDashboard.deletePersonnel(${person.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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
        
        // Populate add form dropdown
        const yearOfJoining = document.getElementById('yearOfJoining');
        if (yearOfJoining) {
            yearOfJoining.innerHTML = yearOptions + yearSelectOptions;
        }
        
        // Populate update form dropdown
        const updateYearOfJoining = document.getElementById('updateYearOfJoining');
        if (updateYearOfJoining) {
            updateYearOfJoining.innerHTML = yearOptions + yearSelectOptions;
        }
    }

    populateScopeFilter() {
        const scopeFilter = document.getElementById('personnelScopeFilter');
        const personnelScope = document.getElementById('personnelScope');
        const updateDepartment = document.getElementById('updateDepartment');
        
        if (!scopeFilter || !personnelScope || !updateDepartment) return;
        
        let options = '<option value="all">All Departments/Hostels</option>';
        
        // Add departments
        this.departments.forEach(dept => {
            options += `<option value="dept:${dept.id}">${dept.name} (Department)</option>`;
        });
        
        // Add hostels
        this.hostels.forEach(hostel => {
            options += `<option value="hostel:${hostel.id}">${hostel.name} (Hostel)</option>`;
        });
        
        scopeFilter.innerHTML = options;
        
        // For personnel form and update form
        let personnelOptions = '<option value="">Select Department/Hostel</option>';
        this.departments.forEach(dept => {
            personnelOptions += `<option value="dept:${dept.id}">${dept.name} (Department)</option>`;
        });
        this.hostels.forEach(hostel => {
            personnelOptions += `<option value="hostel:${hostel.id}">${hostel.name} (Hostel)</option>`;
        });
        
        personnelScope.innerHTML = personnelOptions;
        updateDepartment.innerHTML = '<option value="">Select Department</option>' + 
            this.departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
    }

    filterPersonnel() {
        const typeFilter = document.getElementById('personnelTypeFilter').value;
        const scopeFilter = document.getElementById('personnelScopeFilter').value;
        
        this.filteredPersonnel = this.personnel.filter(person => {
            // Filter by type
            if (typeFilter !== 'all') {
                if (typeFilter === 'faculty' && person.member_type !== 'faculty') return false;
                if (typeFilter === 'staff' && person.member_type !== 'staff') return false;
            }
            
            // Filter by scope
            if (scopeFilter !== 'all') {
                const [type, id] = scopeFilter.split(':');
                if (type === 'dept') {
                    if (person.department_id !== parseInt(id)) return false;
                } else if (type === 'hostel') {
                    if (person.hostel_id !== parseInt(id)) return false;
                }
            }
            
            return true;
        });
        
        this.renderPersonnel();
    }

    searchPersonnel() {
        const searchTerm = document.getElementById('personnelSearch').value.toLowerCase();
        
        this.filteredPersonnel = this.personnel.filter(person => {
            return person.faculty_name.toLowerCase().includes(searchTerm) ||
                   person.designation.toLowerCase().includes(searchTerm) ||
                   (person.department_name && person.department_name.toLowerCase().includes(searchTerm)) ||
                   (person.hostel_name && person.hostel_name.toLowerCase().includes(searchTerm));
        });
        
        this.renderPersonnel();
    }

    searchDepartments(term) {
        this.renderDepartments(term);
    }

    searchHostels(term) {
        this.renderHostels(term);
    }

    // Modal Functions
    showAddDeptModal() {
        document.getElementById('addDeptModal').style.display = 'flex';
    }

    closeAddDeptModal() {
        document.getElementById('addDeptModal').style.display = 'none';
        document.getElementById('addDeptForm').reset();
    }

    showAddHostelModal() {
        document.getElementById('addHostelModal').style.display = 'flex';
    }

    closeAddHostelModal() {
        document.getElementById('addHostelModal').style.display = 'none';
        document.getElementById('addHostelForm').reset();
    }

    showAddFacultyModal() {
        document.getElementById('personnelModalTitle').textContent = 'Add Faculty';
        document.getElementById('personnelType').value = 'faculty';
        this.updatePersonnelForm();
        document.getElementById('addPersonnelModal').style.display = 'flex';
    }

    showAddStaffModal() {
        document.getElementById('personnelModalTitle').textContent = 'Add Staff';
        document.getElementById('personnelType').value = 'staff';
        this.updatePersonnelForm();
        document.getElementById('addPersonnelModal').style.display = 'flex';
    }

    // New: show combined onboard modal for Faculty/Staff
    showOnboardModal() {
        document.getElementById('personnelModalTitle').textContent = 'Onboard Faculty/Staff';
        // Reset form and allow user to choose type
        const form = document.getElementById('addPersonnelForm');
        if (form) form.reset();
        const typeEl = document.getElementById('personnelType');
        if (typeEl) typeEl.value = '';
        this.updatePersonnelForm();
        document.getElementById('addPersonnelModal').style.display = 'flex';
    }

    closeAddPersonnelModal() {
        document.getElementById('addPersonnelModal').style.display = 'none';
        document.getElementById('addPersonnelForm').reset();
    }

    showUpdatePersonnelModal(personnelId) {
        const person = this.personnel.find(p => p.id === personnelId);
        if (!person) return;
        
        document.getElementById('updatePersonnelId').value = person.id;
        document.getElementById('updateName').value = person.faculty_name;
        document.getElementById('updateDesignation').value = person.designation || '';

        if (person.department_id) {
            document.getElementById('updateDepartment').value = person.department_id;
        }
        document.getElementById('updateYearOfJoining').value = person.year_of_joining || '';
        document.getElementById('updateEmploymentType').value = person.employment_type || '';
        document.getElementById('updateRemark').value = person.remark || '';
        
        // Show teaching option only for faculty
        const teachingGroup = document.getElementById('updateTeachingGroup');
        if (teachingGroup) {
            teachingGroup.style.display = person.member_type === 'faculty' ? 'block' : 'none';
            const sel = document.getElementById('updateTeachingSelect');
            if (sel) {
                const raw = person.is_teaching ?? person.teaching ?? person.isTeaching ?? person.teaching_type ?? '';
                const val = String(raw).trim().toLowerCase();
                if (val === '1' || val === 'true' || val === 'yes') sel.value = '1';
                else if (val === '0' || val === 'false' || val === 'no') sel.value = '0';
                else sel.value = '';
            }
        }
        
        document.getElementById('updatePersonnelModal').style.display = 'flex';
    }

    // Read-only view modal for personnel details (establishment)
    showViewPersonnelModal(personnelId) {
        const person = this.personnel.find(p => p.id === personnelId);
        if (!person) return;

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

        const rawT = person.is_teaching ?? person.teaching ?? person.isTeaching ?? person.teaching_type ?? '';
        const tVal = String(rawT).trim().toLowerCase();
        let teachingText = '-';
        if (tVal === '1' || tVal === 'true' || tVal === 'yes') teachingText = 'Teaching';
        else if (tVal === '0' || tVal === 'false' || tVal === 'no') teachingText = 'Non-Teaching';

        const html = `
            <div style="padding:12px;">
                <h4 style="margin-bottom:8px;">${person.faculty_name || 'Unknown'}</h4>
                <div style="margin-bottom:6px;"><strong>Type:</strong> ${memberType}</div>
                <div style="margin-bottom:6px;"><strong>Scope:</strong> ${scopeName}</div>
                <div style="margin-bottom:6px;"><strong>Designation:</strong> ${person.designation || 'N/A'}</div>
            <div style="margin-bottom:6px;"><strong>Year of Joining:</strong> ${person.year_of_joining || person.year || '-'}</div>
            <div style="margin-bottom:6px;"><strong>Employment Type:</strong> ${person.employment_type || person.emp_type || '-'}</div>
            <div style="margin-bottom:6px;"><strong>Teaching Type:</strong> ${teachingText}</div>
            <div style="margin-bottom:6px;"><strong>Leaves Granted:</strong> ${person.granted_leaves || 0}</div>
                <div style="margin-bottom:6px;"><strong>Remaining Leaves:</strong> ${person.remaining_leaves || 0}</div>
                <div style="margin-top:10px;"><strong>Remarks:</strong><div style="margin-top:6px; color:#333;">${person.remark || '-'}</div></div>
            </div>
        `;

        body.innerHTML = html;
        modal.style.display = 'flex';
    }

    showEditLeavesModal(personnelId) {
        const person = this.personnel.find(p => p.id === personnelId);
        if (!person) return;
        
        document.getElementById('editLeavesPersonnelId').value = person.id;
        document.getElementById('editLeavesPersonName').textContent = person.faculty_name;
        
        // Populate per-type granted values
        document.getElementById('editShortLeaves').value = person.short_leaves_granted || 0;
        document.getElementById('editHalfDayLeaves').value = person.half_day_leaves_granted || 0;
        document.getElementById('editFullDayLeaves').value = person.casual_leaves_granted || 0;
        document.getElementById('editMedicalLeaves').value = person.medical_leaves_granted || 0;
        document.getElementById('editCompensatoryLeaves').value = person.compensatory_leaves_granted || 0;
        document.getElementById('editEarnedLeaves').value = person.earned_leaves_granted || 0;
        document.getElementById('editWithoutPaymentLeaves').value = person.without_payment_leaves_granted || 0;
        document.getElementById('editAcademicLeaves').value = person.academic_leaves_granted || 0;
        
        // Calculate and display initial values
        this.updateEditLeavesDisplay(person);
        
        document.getElementById('editLeavesModal').style.display = 'flex';
    }

    updateEditLeavesDisplay(person) {
        if (!person) {
            // Get person from current modal if not provided
            const id = document.getElementById('editLeavesPersonnelId')?.value;
            if (id) {
                person = this.personnel.find(p => p.id == id);
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
        document.getElementById('editLeavesForm').reset();
    }

    closeUpdatePersonnelModal() {
        document.getElementById('updatePersonnelModal').style.display = 'none';
        document.getElementById('updatePersonnelForm').reset();
    }

updatePersonnelForm() {
    const type = document.getElementById('personnelType').value;
    const scopeSelect = document.getElementById('personnelScope');
    const designationSelect = document.getElementById('personnelDesignation');
    
    // Clear existing options
    scopeSelect.innerHTML = '<option value="">Select Department/Hostel</option>';

    if (type === 'faculty') {
        // Show only departments for faculty
        this.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = `dept:${dept.id}`;  // Note: 'dept:' prefix
            option.textContent = `${dept.name} (Department)`;
            scopeSelect.appendChild(option);
        });
        
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
        const teachingGroup = document.getElementById('teachingGroup');
        if (teachingGroup) teachingGroup.style.display = 'block';
    } else if (type === 'staff') {
        // Show only hostels for staff
        this.hostels.forEach(hostel => {
            const option = document.createElement('option');
            option.value = `hostel:${hostel.id}`;  // Note: 'hostel:' prefix
            option.textContent = `${hostel.name} (Hostel)`;
            scopeSelect.appendChild(option);
        });
        
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
        const teachingGroup2 = document.getElementById('teachingGroup');
        if (teachingGroup2) teachingGroup2.style.display = 'none';
    }
    else {
        // No type selected — leave default placeholders
        scopeSelect.innerHTML = '<option value="">Select Department/Hostel</option>';
        designationSelect.innerHTML = `
            <option value="" disabled selected>Select Designation</option>
        `;
    }
}
    updateDesignationDropdown() {
        const type = document.getElementById('personnelType').value;
        const designationSelect = document.getElementById('personnelDesignation');
        if (!designationSelect) return;

        if (type === 'faculty') {
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
        } else if (type === 'staff') {
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

    // CRUD Operations
    async addDepartment() {
        const name = document.getElementById('deptNameInput').value.trim();
        
        if (!name) {
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
                body: JSON.stringify({ department_name: name })
            });

            if (response.ok) {
                const result = await response.json();
                this.departments.push({ id: result.id, name });
                this.closeAddDeptModal();
                await this.loadData();
                this.renderDepartments();
                this.populateScopeFilter();
                alert('Department added successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to add department');
            }
        } catch (error) {
            console.error('Error adding department:', error);
            alert('Failed to add department');
        }
    }

    async editDepartment(deptId) {
        const dept = this.departments.find(d => d.id === deptId);
        if (!dept) return;
        
        const newName = prompt('Enter new department name:', dept.name);
        if (!newName || newName.trim() === '') return;
        
        try {
            const response = await fetch(`/leave_mgmt/admin/departments/${deptId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ department_name: newName.trim() })
            });

            if (response.ok) {
                dept.name = newName.trim();
                this.renderDepartments();
                this.populateScopeFilter();
                alert('Department updated successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to update department');
            }
        } catch (error) {
            console.error('Error updating department:', error);
            alert('Failed to update department');
        }
    }

    async deleteDepartment(deptId) {
        if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/leave_mgmt/admin/departments/${deptId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                this.departments = this.departments.filter(d => d.id !== deptId);
                this.renderDepartments();
                this.populateScopeFilter();
                await this.loadData();
                alert('Department deleted successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete department');
            }
        } catch (error) {
            console.error('Error deleting department:', error);
            alert('Failed to delete department. Make sure no faculty or admins depend on it.');
        }
    }

    async addHostel() {
        const name = document.getElementById('hostelNameInput').value.trim();
        
        if (!name) {
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
                body: JSON.stringify({ hostel_name: name })
            });

            if (response.ok) {
                const result = await response.json();
                this.hostels.push({ id: result.id, name });
                this.closeAddHostelModal();
                await this.loadData();
                this.renderHostels();
                this.populateScopeFilter();
                alert('Hostel added successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to add hostel');
            }
        } catch (error) {
            console.error('Error adding hostel:', error);
            alert('Failed to add hostel');
        }
    }

    async editHostel(hostelId) {
        const hostel = this.hostels.find(h => h.id === hostelId);
        if (!hostel) return;
        
        const newName = prompt('Enter new hostel name:', hostel.name);
        if (!newName || newName.trim() === '') return;
        
        try {
            const response = await fetch(`/leave_mgmt/admin/hostels/${hostelId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ hostel_name: newName.trim() })
            });

            if (response.ok) {
                hostel.name = newName.trim();
                this.renderHostels();
                this.populateScopeFilter();
                alert('Hostel updated successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to update hostel');
            }
        } catch (error) {
            console.error('Error updating hostel:', error);
            alert('Failed to update hostel');
        }
    }

    async deleteHostel(hostelId) {
        if (!confirm('Are you sure you want to delete this hostel? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/leave_mgmt/admin/hostels/${hostelId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                this.hostels = this.hostels.filter(h => h.id !== hostelId);
                this.renderHostels();
                this.populateScopeFilter();
                await this.loadData();
                alert('Hostel deleted successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete hostel');
            }
        } catch (error) {
            console.error('Error deleting hostel:', error);
            alert('Failed to delete hostel. Make sure no staff or admins depend on it.');
        }
    }
async addPersonnel() {
    const type = document.getElementById('personnelType').value;
    const scope = document.getElementById('personnelScope').value;
    const name = document.getElementById('personnelName').value.trim();
    const designation = document.getElementById('personnelDesignation').value.trim();
    const s_gr = parseFloat(document.getElementById('shortLeavesInput').value) || 0;
    const h_gr = parseFloat(document.getElementById('halfDayLeavesInput').value) || 0;
    const c_gr = parseFloat(document.getElementById('fullDayLeavesInput').value) || 0;
    const m_gr = parseFloat(document.getElementById('medicalLeavesInput').value) || 0;
    const comp_gr = parseFloat(document.getElementById('compensatoryLeavesInput').value) || 0;
    const e_gr = parseFloat(document.getElementById('earnedLeavesInput').value) || 0;
    const w_gr = parseFloat(document.getElementById('withoutPaymentLeavesInput').value) || 0;
    const a_gr = parseFloat(document.getElementById('academicLeavesInput').value) || 0;
    const year_of_joining = document.getElementById('yearOfJoining').value || null;
    const employment_type = document.getElementById('employmentType').value || null;
    const remark = document.getElementById('remark').value || null;
    const is_teaching = document.getElementById('addTeachingSelect')?.value === '1';

    if (!type || !scope || !name || !designation) {
        alert('Please fill all required fields');
        return;
    }

    const [scopeType, scopeId] = scope.split(':');
    
    const payload = {
        faculty_name: name,
        designation: designation,
        member_type: type,
        short_leaves_granted: s_gr,
        half_day_leaves_granted: h_gr,
        casual_leaves_granted: c_gr,
        medical_leaves_granted: m_gr,
        compensatory_leaves_granted: comp_gr,
        earned_leaves_granted: e_gr,
        without_payment_leaves_granted: w_gr,
        academic_leaves_granted: a_gr,
        year_of_joining,
        employment_type,
        remark,
        is_teaching
    };

    // CRITICAL: Add the correct scope field based on type
    if (scopeType === 'dept') {
        payload.department_id = parseInt(scopeId);
    } else if (scopeType === 'hostel') {
        payload.hostel_id = parseInt(scopeId);
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

        // Check if response is ok
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || 'Failed to add personnel');
            } catch {
                throw new Error(errorText || 'Failed to add personnel');
            }
        }

        const responseData = await response.json();
        console.log('Response:', responseData);

        if (response.ok) {
            this.closeAddPersonnelModal();
            await this.loadData();
            this.filterPersonnel();
            this.renderPersonnel();
            alert(`${type === 'faculty' ? 'Faculty' : 'Staff'} added successfully!`);
        }
    } catch (error) {
        console.error('Error adding personnel:', error);
        alert(`Error: ${error.message}`);
    }
}
    editPersonnelDetails(personnelId) {
        this.showUpdatePersonnelModal(personnelId);
    }

    editPersonnelLeaves(personnelId) {
        this.showEditLeavesModal(personnelId);
    }

    async updatePersonnelLeaves() {
        const id = document.getElementById('editLeavesPersonnelId').value;
        const s_gr = parseFloat(document.getElementById('editShortLeaves').value) || 0;
        const h_gr = parseFloat(document.getElementById('editHalfDayLeaves').value) || 0;
        const c_gr = parseFloat(document.getElementById('editFullDayLeaves').value) || 0;
        const m_gr = parseFloat(document.getElementById('editMedicalLeaves').value) || 0;
        const comp_gr = parseFloat(document.getElementById('editCompensatoryLeaves').value) || 0;
        const e_gr = parseFloat(document.getElementById('editEarnedLeaves').value) || 0;
        const w_gr = parseFloat(document.getElementById('editWithoutPaymentLeaves').value) || 0;
        const a_gr = parseFloat(document.getElementById('editAcademicLeaves').value) || 0;

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

            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || 'Failed to update leaves');
                } catch {
                    throw new Error(errorText || 'Failed to update leaves');
                }
            }

            const responseData = await response.json();
            if (responseData.success) {
                this.closeEditLeavesModal();
                await this.loadData();
                this.filterPersonnel();
                this.renderPersonnel();
                alert('Leaves updated successfully!');
            }
        } catch (error) {
            console.error('Error updating leaves:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async updatePersonnel() {
    const id = document.getElementById('updatePersonnelId').value;
    const name = document.getElementById('updateName').value.trim();
    const designation = document.getElementById('updateDesignation').value.trim();
    const department = document.getElementById('updateDepartment').value;
    const year_of_joining = document.getElementById('updateYearOfJoining').value || null;
    const employment_type = document.getElementById('updateEmploymentType').value || null;
    const remark = document.getElementById('updateRemark').value || null;
    const is_teaching = document.getElementById('updateTeachingSelect')?.value === '1';

    if (!name || !designation) {
        alert('Please fill all required fields');
        return;
    }

    const payload = {
        faculty_name: name,
        designation: designation,
        year_of_joining,
        employment_type,
        remark,
        is_teaching
    };

    if (department) {
        payload.department_id = parseInt(department);
    }

    console.log('Update payload:', payload);

    try {
        const response = await fetch(`/leave_mgmt/faculty/${id}/details`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || 'Failed to update personnel');
            } catch {
                throw new Error(errorText || 'Failed to update personnel');
            }
        }

        const responseData = await response.json();
        console.log('Update response:', responseData);

        if (response.ok) {
            this.closeUpdatePersonnelModal();
            await this.loadData();
            this.filterPersonnel();
            this.renderPersonnel();
            alert('Personnel updated successfully!');
        }
    } catch (error) {
        console.error('Error updating personnel:', error);
        alert(`Error: ${error.message}`);
    }
}

    async deletePersonnel(personnelId) {
        if (!confirm('Are you sure you want to delete this personnel record? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/leave_mgmt/delete-faculty/${personnelId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                this.personnel = this.personnel.filter(p => p.id !== personnelId);
                this.filteredPersonnel = this.filteredPersonnel.filter(p => p.id !== personnelId);
                this.renderPersonnel();
                await this.loadData();
                alert('Personnel deleted successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete personnel');
            }
        } catch (error) {
            console.error('Error deleting personnel:', error);
            alert('Failed to delete personnel');
        }
    }

//     // Report Functions
//     generateDepartmentReport() {
//         const today = new Date().toISOString().split('T')[0];
//         const url = `/leave_mgmt/pdf/all?fromDate=${today}&toDate=${today}&scopeType=department&scopeId=all`;
//         window.open(url, '_blank');
//     }

//     generateHostelReport() {
//         const today = new Date().toISOString().split('T')[0];
//         const url = `/leave_mgmt/pdf/all?fromDate=${today}&toDate=${today}&scopeType=hostel&scopeId=all`;
//         window.open(url, '_blank');
//     }

//     generateInstitutionReport() {
//         const today = new Date().toISOString().split('T')[0];
//         const url = `/leave_mgmt/pdf/all?fromDate=${today}&toDate=${today}&scopeType=global`;
//         window.open(url, '_blank');
//     }

//     exportAllData() {
//         window.open('/leave_mgmt/activity-logs/export', '_blank');
//     }

//     // Settings Functions
//     saveLeaveSettings() {
//         const facultyLeaves = document.getElementById('defaultFacultyLeaves').value;
//         const staffLeaves = document.getElementById('defaultStaffLeaves').value;
        
//         // In a real app, this would save to the server
//         localStorage.setItem('defaultFacultyLeaves', facultyLeaves);
//         localStorage.setItem('defaultStaffLeaves', staffLeaves);
        
//         alert('Leave settings saved!');
//     }

    changePassword() {
//         const newPassword = document.getElementById('newPassword').value;
//         const confirmPassword = document.getElementById('confirmPassword').value;
        
//         if (!newPassword || !confirmPassword) {
//             alert('Please fill both password fields');
//             return;
//         }
        
//         if (newPassword !== confirmPassword) {
//             alert('Passwords do not match');
//             return;
//         }
        
//         // In a real app, this would call a password change API
//         alert('Password change functionality would be implemented here');
        
//         document.getElementById('newPassword').value = '';
//         document.getElementById('confirmPassword').value = '';
    }
}

// Global instance for inline onclick handlers
let establishmentDashboard;

// Add this function to check user role on refresh
async function checkUserRole() {
    try {
        const response = await fetch('/leave_mgmt/context', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = '/leave_mgmt';
            return;
        }
        
        const data = await response.json();
        const user = data?.user;
        
        if (!user) {
            window.location.href = '/leave_mgmt';
            return;
        }
        
        console.log('Current user role:', user.role);
        
        // If user is NOT establishment_admin, redirect to proper dashboard
        if (user.role !== 'establishment_admin') {
            console.log(`User role ${user.role} should not be on establishment dashboard, redirecting...`);
            
            if (user.role === 'superadmin') {
                window.location.href = '/leave_mgmt/superadmin.html';
            } else if (user.role === 'principal_admin') {
                window.location.href = '/leave_mgmt/principal.html';
            } else if (['department_admin', 'hostel_admin', 'department_staff', 'hostel_staff'].includes(user.role)) {
                window.location.href = '/leave_mgmt/main.html';
            } else {
                // Unknown role, go to login
                window.location.href = '/leave_mgmt/';
            }
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error checking user role:', error);
        window.location.href = '/leave_mgmt/';
        return false;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // First, check if user is properly authenticated and is establishment_admin
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
        
        // Check if user is establishment_admin
        if (user.role !== 'establishment_admin') {
            console.log(`User role ${user.role} should not be on establishment dashboard, redirecting...`);
            
            // Redirect to appropriate dashboard based on role
            if (user.role === 'superadmin') {
                window.location.href = '/leave_mgmt/superadmin.html';
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
        
        // User is establishment_admin - initialize dashboard
        establishmentDashboard = new EstablishmentDashboard();

        // Expose instance and commonly used methods to global scope for inline handlers
        window.establishmentDashboard = establishmentDashboard;
        window.showAddDeptModal = () => establishmentDashboard.showAddDeptModal();
        window.closeAddDeptModal = () => establishmentDashboard.closeAddDeptModal();
        window.showAddHostelModal = () => establishmentDashboard.showAddHostelModal();
        window.closeAddHostelModal = () => establishmentDashboard.closeAddHostelModal();
        window.searchDepartments = (value) => establishmentDashboard.searchDepartments(value);
        window.searchHostels = (value) => establishmentDashboard.searchHostels(value);
        window.showAddFacultyModal = () => establishmentDashboard.showAddFacultyModal();
        window.showAddStaffModal = () => establishmentDashboard.showAddStaffModal();
        window.showOnboardModal = () => establishmentDashboard.showOnboardModal();
        window.closeAddPersonnelModal = () => establishmentDashboard.closeAddPersonnelModal();
        window.closeUpdatePersonnelModal = () => establishmentDashboard.closeUpdatePersonnelModal();
        window.closeEditLeavesModal = () => establishmentDashboard.closeEditLeavesModal();
        window.updatePersonnelForm = () => establishmentDashboard.updatePersonnelForm();
        window.updateDesignationDropdown = () => establishmentDashboard.updateDesignationDropdown();
        window.filterPersonnel = () => establishmentDashboard.filterPersonnel();
        window.searchPersonnel = () => establishmentDashboard.searchPersonnel();

        // Store user info for later use
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('Establishment dashboard initialized successfully');
        
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
            if (!user || user.role !== 'establishment_admin') {
                console.log('User no longer has access, redirecting...');
                if (user?.role === 'superadmin') {
                    window.location.href = '/leave_mgmt/superadmin.html';
                } else if (user?.role === 'principal_admin') {
                    window.location.href = '/leave_mgmt/principal.html';
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

function computeAddTotal() {
    const s = parseFloat(document.getElementById('shortLeavesInput').value) || 0;
    const h = parseFloat(document.getElementById('halfDayLeavesInput').value) || 0;
    const f = parseFloat(document.getElementById('fullDayLeavesInput').value) || 0;
    const m = parseFloat(document.getElementById('medicalLeavesInput').value) || 0;
    const comp = parseFloat(document.getElementById('compensatoryLeavesInput').value) || 0;
    const e = parseFloat(document.getElementById('earnedLeavesInput').value) || 0;
    const w = parseFloat(document.getElementById('withoutPaymentLeavesInput').value) || 0;
    const total = (s / 3 + h * 0.5 + f + m + comp + e + w) || 0;
    document.getElementById('totalLeavesDisplay').textContent = total.toFixed(2);
}

function computeEditLeavesTotal() {
    if (!window.establishmentDashboard) return;
    const personId = document.getElementById('editLeavesPersonnelId')?.value;
    if (!personId) return;
    
    const person = window.establishmentDashboard.personnel.find(p => p.id == personId);
    if (person) {
        window.establishmentDashboard.updateEditLeavesDisplay(person);
    }
}

// Attach listeners if elements exist
['shortLeavesInput','halfDayLeavesInput','fullDayLeavesInput','medicalLeavesInput','compensatoryLeavesInput','earnedLeavesInput','withoutPaymentLeavesInput','academicLeavesInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', computeAddTotal);
});

// Add event listeners for edit leaves inputs
['editShortLeaves','editHalfDayLeaves','editFullDayLeaves','editMedicalLeaves','editCompensatoryLeaves','editEarnedLeaves','editWithoutPaymentLeaves'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', computeEditLeavesTotal);
});

const personnelTypeSelect = document.getElementById('personnelType');
if (personnelTypeSelect) {
    personnelTypeSelect.addEventListener('change', () => {
        const teachingGroup = document.getElementById('teachingGroup');
        if (!teachingGroup) return;
        teachingGroup.style.display = personnelTypeSelect.value === 'faculty' ? 'block' : 'none';
    });
    // Trigger initial visibility
    personnelTypeSelect.dispatchEvent(new Event('change'));
}
