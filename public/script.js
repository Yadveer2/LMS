const SCOPE_TYPES = {
  DEPARTMENT: "department",
  HOSTEL: "hostel",
  GLOBAL: "global",
};

const designationPriority = {
  Professor: 1,
  "Associate Professor": 2,
  "Assistant Professor": 3,
  Warden: 4,
  Clerk: 5,
  "Lab Technician": 6,
  "Lab Attendant": 7,
  Attendant: 8,
};

const state = {
  context: null,
  metadata: { departments: [], hostels: [] },
  activeScope: null,
};

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  try {
    await loadContext();
    await maybeLoadMetadata();
    setInitialScope();
    configureHeader();
    setupScopeSwitcher();
    bindCoreEvents();
    configurePanels();
    if (state.activeScope) {
      await Promise.all([loadTableData(), refreshUserDropdown()]);
    } else {
      toggleScopeEmptyState(true);
    }
  } catch (err) {
    console.error(err);
    alert("Session expired. Please log in again.");
    window.location.href = "/leave_mgmt";
  }
}

async function loadContext() {
  const res = await fetch("/leave_mgmt/context");
  if (!res.ok) throw new Error("Failed to load session context.");
  const data = await res.json();
  if (!data?.user) throw new Error("Session missing.");
  state.context = data.user;
}

async function maybeLoadMetadata() {
  if (
    state.context.scopeType === SCOPE_TYPES.GLOBAL ||
    state.context.permissions?.canManageDepartments ||
    state.context.permissions?.canManageHostels ||
    state.context.role === "superadmin"
  ) {
    const res = await fetch("/leave_mgmt/metadata/scopes");
    if (!res.ok) throw new Error("Failed to load metadata.");
    state.metadata = await res.json();
  }
}

// Update the setInitialScope function:
function setInitialScope() {
  const user = state.context;
  
  // If user has a specific scope (department or hostel admin)
  if (user.scopeType === SCOPE_TYPES.DEPARTMENT && user.departmentId) {
    state.activeScope = {
      type: SCOPE_TYPES.DEPARTMENT,
      id: user.departmentId,
      name: user.departmentName,
    };
  } else if (user.scopeType === SCOPE_TYPES.HOSTEL && user.hostelId) {
    state.activeScope = {
      type: SCOPE_TYPES.HOSTEL,
      id: user.hostelId,
      name: user.hostelName,
    };
  } 
  // For global users (superadmin, establishment_admin, principal_admin)
  else if (user.scopeType === SCOPE_TYPES.GLOBAL) {
    state.activeScope = null; // No scope selected initially
  } else {
    state.activeScope = null;
  }
}


// Update the configureHeader function to handle global users:
// function configureHeader() {
//   const headingEl = document.querySelector(".heading--department-name");
//   const roleEl = document.querySelector(".heading--role-name");
  
//   headingEl.textContent = formatScopeLabel(state.activeScope);
//   roleEl.textContent = formatRoleLabel(state.context.role);
  
//   // Show/hide user management dropdown
//   const dropdown = document.querySelector(".dropdown");
//   const canManageUsers = state.context.role === "department_admin" || 
//                          state.context.role === "hostel_admin" ||
//                          state.context.permissions?.canManageUsers;
//   dropdown.style.display = canManageUsers ? "block" : "none";
  
//   // Show/hide faculty management section
//   const addSection = document.querySelector("#add_faculty");
//   const canManageFaculty = (state.context.role === "department_admin" && state.activeScope) ||
//                            (state.context.role === "hostel_admin" && state.activeScope) ||
//                            state.context.permissions?.canManageFaculty;
  
//   if (!canManageFaculty || state.context.scopeType === SCOPE_TYPES.GLOBAL) {
//     addSection?.classList.add("hidden");
//   } else {
//     addSection?.classList.remove("hidden");
//   }
  
//   // Show/hide report buttons
//   const generateBtn = document.querySelector(".generate-report");
//   const todayBtn = document.querySelector(".btn--todays-report");
//   const canGenerateReports = state.context.permissions?.canGenerateReports && state.activeScope;
  
//   if (!canGenerateReports) {
//     generateBtn?.classList.add("hidden");
//     todayBtn?.classList.add("hidden");
//   } else {
//     generateBtn?.classList.remove("hidden");
//     todayBtn?.classList.remove("hidden");
//   }
// }

function configureHeader() {
  const headingEl = document.querySelector(".heading--department-name");
  const roleEl = document.querySelector(".heading--role-name");
  
  headingEl.textContent = formatScopeLabel(state.activeScope);
  roleEl.textContent = formatRoleLabel(state.context.role);
  
  // Show/hide user management dropdown - based on canManageUsers permission
  const dropdown = document.querySelector(".dropdown");
  const canManageUsers = state.context.permissions?.canManageUsers;
  if (dropdown) {
    dropdown.style.display = canManageUsers ? "block" : "none";
  }
  
  // Show/hide faculty management section - based on canManageFaculty permission
  const addSection = document.querySelector("#add_faculty");
  const canManageFaculty = state.context.permissions?.canManageFaculty;
  
  if (addSection) {
    if (!canManageFaculty) {
      addSection.classList.add("hidden");
    } else {
      addSection.classList.remove("hidden");
    }
  }
  
  // Show/hide report buttons
  const generateBtn = document.querySelector(".generate-report");
  const todayBtn = document.querySelector(".btn--todays-report");
  const canGenerateReports = state.context.permissions?.canGenerateReports && state.activeScope;
  
  if (!canGenerateReports) {
    generateBtn?.classList.add("hidden");
    todayBtn?.classList.add("hidden");
  } else {
    generateBtn?.classList.remove("hidden");
    todayBtn?.classList.remove("hidden");
  }

  // Show/hide PI Chat button for department_admin, hostel_admin, principal_admin
  const piBtn = document.getElementById('pi-chat-btn');
  if (piBtn) {
    const role = state.context.role;
    if (role === 'department_admin' || role === 'hostel_admin' || role === 'principal_admin' || role === 'superadmin') {
      piBtn.style.display = 'inline-block';
    } else {
      piBtn.style.display = 'none';
    }
  }
}

// PI Chat modal controls
function openPiChatModal() {
  const modal = document.getElementById('piChatModal');
  if (!modal) return;
  // Populate scope selector (use metadata already loaded)
  const scopeTypeEl = document.getElementById('piScopeType');
  const scopeValueEl = document.getElementById('piScopeValue');
  scopeValueEl.innerHTML = '<option value="" disabled selected>Select</option>';
  const type = scopeTypeEl.value;
  const list = type === 'hostel' ? state.metadata.hostels : state.metadata.departments;
  list.forEach(entry => {
    scopeValueEl.insertAdjacentHTML('beforeend', `<option value="${entry.id}">${entry.name}</option>`);
  });

  // If user is non-principal admin with active scope, preselect and disable
  const role = state.context.role;
  if ((role === 'department_admin' || role === 'hostel_admin') && state.activeScope) {
    scopeTypeEl.value = state.activeScope.type;
    scopeTypeEl.disabled = true;
    // ensure values list corresponds
    scopeValueEl.value = state.activeScope.id;
    scopeValueEl.disabled = true;
  } else {
    scopeTypeEl.disabled = false;
    scopeValueEl.disabled = false;
  }

  modal.style.display = 'flex';
}

function closePiChatModal() {
  const modal = document.getElementById('piChatModal');
  if (modal) modal.style.display = 'none';
}

async function loadPiSummary(scopeType, scopeId) {
  try {
    const url = new URL('/leave_mgmt/pi-summary', window.location.origin);
    if (scopeType) url.searchParams.set('type', scopeType);
    if (scopeId) url.searchParams.set('id', scopeId);
    const res = await fetch(url.toString(), { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load PI summary');
    const data = await res.json();
    renderPiSummary(data, scopeType, scopeId);
  } catch (err) {
    showError(err.message || 'Error loading PI summary');
  }
}

function renderPiSummary(data, scopeType, scopeId) {
  const header = document.getElementById('piSummaryHeader');
  const stats = document.getElementById('piSummaryStats');
  const byCat = document.getElementById('piSummaryByCategory');
  header.textContent = scopeType && scopeId ? `Scope: ${scopeType} (${scopeId})` : 'Summary (All)';
  stats.innerHTML = `
    <div style="background:#f5f7fa;padding:12px;border-radius:6px;"><strong>Total Members</strong><div>${data.total_members || 0}</div></div>
    <div style="background:#f5f7fa;padding:12px;border-radius:6px;"><strong>Present</strong><div>${data.present || 0}</div></div>
    <div style="background:#f5f7fa;padding:12px;border-radius:6px;"><strong>On Leave</strong><div>${data.members_on_leave || 0}</div></div>
  `;
  const rows = Object.entries(data.by_category || {}).map(([cat, cnt]) => `<tr><td>${cat}</td><td>${cnt}</td></tr>`).join('');
  byCat.innerHTML = `
    <h4>By Leave Category</h4>
    <table class="table-sm" style="width:100%;border-collapse:collapse;">
      <thead><tr><th>Category</th><th>Count</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="2">No leaves today</td></tr>'}</tbody>
    </table>
  `;

  // Render detailed member list if provided
  const detailsElId = 'piMembersList';
  let detailsEl = document.getElementById(detailsElId);
  if (!detailsEl) {
    detailsEl = document.createElement('div');
    detailsEl.id = detailsElId;
    detailsEl.style.marginTop = '12px';
    document.getElementById('piSummaryArea').appendChild(detailsEl);
  }
  if (Array.isArray(data.members_on_leave_details) && data.members_on_leave_details.length) {
    const listRows = data.members_on_leave_details.map(m => {
      const cats = (m.categories || []).map(c => `<span style="background:#eef; padding:4px 6px; margin-right:6px; border-radius:4px; font-size:12px;">${c.replace(/_/g,' ')}</span>`).join('');
      const dates = (m.dates || []).join(', ');
      return `<div style="padding:8px;border-bottom:1px solid #eee;"><strong>${m.name}</strong> (${m.id})<div style="margin-top:6px;">${cats}</div><div style="margin-top:6px;color:#666;font-size:13px;">Dates: ${dates}</div></div>`;
    }).join('');
    detailsEl.innerHTML = `<h4>Members On Leave</h4><div>${listRows}</div>`;
  } else {
    detailsEl.innerHTML = '<h4>Members On Leave</h4><div>No members on leave today.</div>';
  }
}

// Wire up PI Chat button and load action
document.addEventListener('DOMContentLoaded', () => {
  const piBtn = document.getElementById('pi-chat-btn');
  if (piBtn) piBtn.addEventListener('click', openPiChatModal);
  const piLoad = document.getElementById('piLoadBtn');
  if (piLoad) piLoad.addEventListener('click', () => {
    const type = document.getElementById('piScopeType').value;
    const id = document.getElementById('piScopeValue').value;
    if (!type || !id) return showError('Select scope type and value');
    loadPiSummary(type, id);
  });
});

// Update login redirection based on role
async function redirectBasedOnRole() {
    try {
        const response = await fetch('/leave_mgmt/context', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const user = data.user;
            
            if (user) {
                // Store user info
                localStorage.setItem('user', JSON.stringify(user));
                
                // Redirect based on role
                if (user.role === 'superadmin') {
                    window.location.href = '/leave_mgmt/superadmin-dashboard';
                } else if (user.role === 'establishment_admin') {
                    window.location.href = '/leave_mgmt/establishment-dashboard';
                } else if (user.role === 'principal_admin') {
                    window.location.href = '/leave_mgmt/principal-dashboard';
                } else {
                    window.location.href = '/leave_mgmt/dashboard';
                }
            }
        }
    } catch (error) {
        console.error('Role redirection error:', error);
    }
}

// Call this after successful login
// Add this to your existing login function

function formatScopeLabel(scope) {
  if (!scope || !scope.id) return "Institution Dashboard";
  if (scope.type === SCOPE_TYPES.HOSTEL) {
    return `Hostel ${scope.name || ""}`.trim();
  }
  return `${scope.name || ""} Department`.trim();
}

function formatRoleLabel(role) {
  const labels = {
    department_admin: "Department Admin",
    department_staff: "Department Staff",
    hostel_admin: "Hostel Admin",
    hostel_staff: "Hostel Staff",
    establishment_admin: "Establishment Admin",
    principal_admin: "Principal Admin",
    superadmin: "Super Admin",
  };
  return labels[role] || "Faculty Leave Management";
}

function setupScopeSwitcher() {
  const switcher = document.getElementById("scope-switcher");
  if (!switcher) return;
  if (state.context.scopeType !== SCOPE_TYPES.GLOBAL) {
    switcher.classList.add("hidden");
    return;
  }
  switcher.classList.remove("hidden");
  populateScopeOptions(
    document.getElementById("scope-type-filter").value || "department"
  );
  document
    .getElementById("scope-type-filter")
    ?.addEventListener("change", (e) => {
      populateScopeOptions(e.target.value);
    });
  document
    .getElementById("scope-apply-btn")
    ?.addEventListener("click", () => {
      const type = document.getElementById("scope-type-filter").value;
      const value = Number(document.getElementById("scope-value-filter").value);
      if (!value) {
        return showError("Please select a scope before loading data.");
      }
      const list =
        type === SCOPE_TYPES.HOSTEL
          ? state.metadata.hostels
          : state.metadata.departments;
      const selected = list.find((entry) => entry.id === value);
      state.activeScope = {
        type,
        id: value,
        name: selected?.name || "",
      };
      configureHeader();
      toggleScopeEmptyState(false);
      loadTableData();
      refreshUserDropdown();
    });
}

function populateScopeOptions(type) {
  const select = document.getElementById("scope-value-filter");
  if (!select) return;
  const list =
    type === SCOPE_TYPES.HOSTEL
      ? state.metadata.hostels
      : state.metadata.departments;
  select.innerHTML = `<option value="" disabled selected>Select ${
    type === SCOPE_TYPES.HOSTEL ? "hostel" : "department"
  }</option>`;
  list.forEach((entry) => {
    select.insertAdjacentHTML(
      "beforeend",
      `<option value="${entry.id}">${entry.name}</option>`
    );
  });
}

function toggleScopeEmptyState(show) {
  const emptyState = document.getElementById("scope-empty-state");
  if (!emptyState) return;
  emptyState.classList.toggle("hidden", !show);
}

async function loadTableData() {
  if (!state.activeScope) {
    toggleScopeEmptyState(true);
    return;
  }
  toggleScopeEmptyState(false);
  const spinner = document.getElementById("loading-spinner");
  spinner.style.display = "block";
  try {
    const url = new URL("/leave_mgmt/get-leaves", window.location.origin);
    appendScopeParams(url);
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      throw new Error("Unable to fetch leave data.");
    }
    const data = await res.json();
    renderLeaveRows(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    showError(err.message);
  } finally {
    spinner.style.display = "none";
  }
}

function renderLeaveRows(rows) {
  const tbody = document.getElementById("leave-table");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="14">No faculty/staff records for this scope.</td></tr>';
    return;
  }
  rows.sort((a, b) => {
    const aRank = designationPriority[a.designation] || 99;
    const bRank = designationPriority[b.designation] || 99;
    if (aRank !== bRank) return aRank - bRank;
    return stripPrefixes(a.faculty_name).localeCompare(
      stripPrefixes(b.faculty_name)
    );
  });
  tbody.innerHTML = rows
    .map((row, index) => generateRowHTML(row, index + 1))
    .join("");
}

function stripPrefixes(name = "") {
  return name.replace(/^(Er\.|Dr\.|Mr\.|Ms\.|Prof\.|S\.|Er|Dr|Mr|Ms|Prof|S)\s*/i, "").trim();
}

function generateRowHTML(row, serialNumber) {
  return `
    <tr data-id="${row.id}">
      <td>${serialNumber}</td>
      <td>${row.faculty_name}</td>
      <td>${row.designation}</td>
      <td>${row.short_leaves || 0}</td>
      <td>${row.half_day_leaves || 0}</td>
      <td>${row.casual_leaves || 0}</td>
      <td>${row.academic_leaves || 0}</td>
      <td>${row.medical_leaves || 0}</td>
      <td>${row.compensatory_leaves || 0}</td>
      <td>${row.earned_leaves || 0}</td>
      <td>${row.without_payment_leaves || 0}</td>
      <td>${row.remaining_leaves || 0}</td>
      <td>${parseFloat(row.total_leaves || 0).toFixed(2)}</td>
      <td>
        <button class="add-leave-button">Add Leave</button>
        <button class="details-button" data-id="${row.id}">Details</button>
      </td>
    </tr>
    <tr class="leave-options-row" style="display:none;">
      <td colspan="14">
        <div class="addLeaveOptions">
          <div class="category nameofCategory">
            <label class="insidelabel">Category:</label>
            <select class="leave-category">
              <option value="" disabled selected>Select Leave Category</option>
              <option value="short_leaves">Short Leave</option>
              <option value="half_day_leaves">Half Day Leave</option>
              <option value="casual_leaves">Casual Leave</option>
              <option value="academic_leaves">Academic Leave</option>
              <option value="medical_leaves">Medical/Maternity Leave</option>
              <option value="compensatory_leaves">Compensatory Leave</option>
              <option value="earned_leaves">Earned Leave</option>
              <option value="without_payment_leaves">Without Payment Leave</option>
            </select>
            <div class="dynamic-option"></div>
          </div>
          <button class="update-leave-button updateBtn">Update</button>
        </div>
      </td>
    </tr>`;
}

// function bindCoreEvents() {
//   document
//     .getElementById("leave-table")
//     ?.addEventListener("click", handleTableClick);
//   document.getElementById("logout-button")?.addEventListener("click", logout);
//   setupAddFacultyForm();
//   setupSearch();
//   setupReportButtons();
//   document
//     .querySelector(".dropdown-toggle")
//     ?.addEventListener("click", () => {
//       document.querySelector(".dropdown-menu")?.classList.toggle("active");
//     });
// }

function bindCoreEvents() {
  document
    .getElementById("leave-table")
    ?.addEventListener("click", handleTableClick);
  document.getElementById("logout-button")?.addEventListener("click", logout);
  
  // Only setup faculty management if user has permission
  if (state.context.permissions?.canManageFaculty) {
    setupAddFacultyForm();
    setupSearch(); // This includes delete functionality
  } else {
    // Hide delete button if no permission
    const deleteBtn = document.getElementById("delete-faculty-btn");
    if (deleteBtn) deleteBtn.style.display = "none";
  }
  
  setupReportButtons();
  
  // Only setup dropdown if user has permission
  if (state.context.permissions?.canManageUsers) {
    document
      .querySelector(".dropdown-toggle")
      ?.addEventListener("click", () => {
        document.querySelector(".dropdown-menu")?.classList.toggle("active");
      });
  }
}

function handleTableClick(e) {
  const button = e.target;
  if (button.classList.contains("add-leave-button")) {
    const currentRow = button.closest("tr");
    const optionsRow = currentRow.nextElementSibling;
    optionsRow.style.display =
      optionsRow.style.display === "none" ? "table-row" : "none";
    const select = optionsRow.querySelector(".leave-category");
    const dynamicContainer = optionsRow.querySelector(".dynamic-option");
    select.addEventListener("change", (event) => {
      renderDynamicLeaveOptions(event.target.value, dynamicContainer);
    });
  }

  if (button.classList.contains("details-button")) {
    const facultyId = button.dataset.id;
    window.location.href = `/leave_mgmt/leave-details/${facultyId}`;
  }

  if (button.classList.contains("update-leave-button")) {
    const optionsRow = button.closest(".leave-options-row");
    const mainRow = optionsRow.previousElementSibling;
    const facultyId = mainRow.dataset.id;
    const categoryValue = optionsRow.querySelector(".leave-category").value;
    if (!categoryValue) {
      return showError("Please select a leave category.");
    }
    const dynamicOption = optionsRow.querySelector(".dynamic-option");
    const secondaryValue =
      dynamicOption.querySelector(".half-day-leave-select")?.value ||
      dynamicOption.querySelector(".input--granted-leaves")?.value || {
        fromTime: dynamicOption.querySelector(".input--from-time")?.value,
        toTime: dynamicOption.querySelector(".input--to-time")?.value,
      };
    const leave_categoryArr = [categoryValue, secondaryValue];
    const singleDate = dynamicOption.querySelector(".single-leave-date")?.value;
    const rangeDates = [
      dynamicOption.querySelector(".leave--from-date")?.value,
      dynamicOption.querySelector(".leave--to-date")?.value,
    ];
    const leave_date = singleDate || rangeDates;
    updateLeave(facultyId, leave_categoryArr, leave_date, optionsRow);
  }
}

function renderDynamicLeaveOptions(type, container) {
  if (!container) return;
  const today = new Date().toISOString().split("T")[0];
  if (type === "half_day_leaves") {
    container.innerHTML = `
      <span>Type: </span>
      <select class="half-day-leave-select">
        <option value="" selected disabled>Select</option>
        <option value="before_noon">Before Noon</option>
        <option value="after_noon">After Noon</option>
      </select>
      <div class="dynamic-date">
        <label class="dynamic-label">Date:</label>
        <input type="date" class="add-leave-date single-leave-date" value="${today}">
      </div>
    `;
  } else if (type === "short_leaves") {
    container.innerHTML = `
      <span class="shortleaveTime">Time: </span>
      <div class="inputs--time">
        <label>From: </label>
        <input class="time-picker input--from-time" type="time">
        <label>To: </label>
        <input class="time-picker input--to-time" type="time">
      </div>
      <div class="dynamic-date">
        <label class="dynamic-label">Date:</label>
        <input type="date" class="add-leave-date single-leave-date" value="${today}">
      </div>
    `;
  } else if (type === "granted_leaves") {
    container.innerHTML = `
      <span>Value:</span>
      <input type="number" class="input--granted-leaves" placeholder="Enter value">
    `;
  } else {
    container.innerHTML = `
      <div class="dynamic-date">
        <label class="dynamic-label">From:</label>
        <input type="date" class="add-leave-date leave--from-date" value="${today}">
      </div>
      <div class="dynamic-date">
        <label class="dynamic-label">To:</label>
        <input type="date" class="add-leave-date leave--to-date" value="${today}">
      </div>
    `;
  }
}

async function logout() {
  try {
    const res = await fetch("/leave_mgmt/logout", { method: "POST" });
    if (!res.ok) throw new Error();
    window.location.href = "/leave_mgmt";
  } catch (err) {
    showError("Logout failed. Please try again.");
  }
}

async function updateLeave(facultyId, leave_categoryArr, leave_date, row) {
  if (!confirm("Are you sure you want to add the leave?")) return;
  try {
    const res = await fetch("/leave_mgmt/add-leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faculty_id: facultyId,
        leave_categoryArr,
        leave_date,
      }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to add leave.");
    }
    showSuccess("Leave added successfully!");
    row.style.display = "none";
    loadTableData();
  } catch (err) {
    showError(err.message);
  }
}

function showError(message) {
  const errorDiv = document.getElementById("error-message");
  if (!errorDiv) return;
  errorDiv.innerText = message;
  errorDiv.style.display = "block";
  errorDiv.style.color = "red";
  setTimeout(() => {
    errorDiv.style.display = "none";
  }, 3500);
}

function showSuccess(message) {
  const successDiv = document.getElementById("success-message");
  if (!successDiv) return;
  successDiv.innerText = message;
  successDiv.style.display = "block";
  successDiv.style.color = "#155724";
  setTimeout(() => {
    successDiv.style.display = "none";
  }, 3000);
}

async function refreshUserDropdown() {
  if (!state.context.permissions?.canManageUsers || !state.activeScope) return;
  const dropdownMenu = document.querySelector(".dropdown-menu");
  if (!dropdownMenu) return;
  const url = new URL("/leave_mgmt/all-users", window.location.origin);
  appendScopeParams(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Unable to fetch users.");
    const users = await res.json();
    dropdownMenu.innerHTML = users
      .map(
        (user) => `<li>
      <span class="username">${user.username}</span>
      <span class="delete-btn" data-username="${user.username}">🗑️</span>
    </li>`
      )
      .join("");
    dropdownMenu.insertAdjacentHTML(
      "beforeend",
      `<li class="add-user-option">➕ Add User</li>`
    );
    dropdownMenu
      .querySelectorAll(".delete-btn")
      .forEach((btn) =>
        btn.addEventListener("click", (e) =>
          deleteUser(e.target.dataset.username)
        )
      );
    dropdownMenu
      .querySelector(".add-user-option")
      ?.addEventListener("click", showAddUserForm);
  } catch (err) {
    console.error(err);
    showError("Unable to load users for this scope.");
  }
}

function showAddUserForm() {
  const container = document.querySelector(".form-container");
  if (!container) return;
  container.innerHTML = `
    <div class="add-user-form">
      <input type="text" id="new-username" placeholder="Username" required />
      <input type="password" id="new-password" placeholder="Password" required />
      <div class="add-user-form-btns">
        <button id="submit-user">Add</button>
        <button id="cancel-user">Cancel</button>
      </div>
    </div>`;
  document.getElementById("submit-user").addEventListener("click", async () => {
    const username = document.getElementById("new-username").value.trim();
    const password = document.getElementById("new-password").value.trim();
    if (!username || !password) {
      alert("Please fill all fields!");
      return;
    }
    try {
      const res = await fetch("/leave_mgmt/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withScopePayload({ username, password })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add user.");
      alert("User added!");
      container.innerHTML = "";
      refreshUserDropdown();
    } catch (err) {
      alert(err.message);
    }
  });
  document
    .getElementById("cancel-user")
    ?.addEventListener("click", () => (container.innerHTML = ""));
}

async function deleteUser(username) {
  if (!confirm(`Delete ${username}?`)) return;
  const url = new URL(
    `/leave_mgmt/delete-user/${encodeURIComponent(username)}`,
    window.location.origin
  );
  appendScopeParams(url);
  try {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error deleting user.");
    }
    alert("User deleted!");
    refreshUserDropdown();
  } catch (err) {
    alert(err.message);
  }
}

function setupAddFacultyForm() {
  const addBtn = document.getElementById("add-faculty-button");
  if (!addBtn) return;
  addBtn.addEventListener("click", async () => {
    if (!state.activeScope) {
      return showError("Select a scope before adding faculty/staff.");
    }
    const faculty_name = document
      .getElementById("new-faculty-name")
      .value.trim();
    const designation = document.getElementById("new-faculty-designation")
      .value;
    // Prefer per-type inputs if present
    const getNum = (id) => Number(document.getElementById(id)?.value || 0);
    const s = getNum('new-short-granted');
    const h = getNum('new-half-granted');
    const c = getNum('new-casual-granted');
    const m = getNum('new-medical-granted');
    const w = getNum('new-without-granted');
    const comp = getNum('new-compensatory-granted');
    const e = getNum('new-earned-granted');
    const a = getNum('new-academic-granted');
    const granted_leaves = null; // keep legacy variable name
    const totalLeaves = parseFloat(((s/3) + h*0.5 + c + m + w + comp + e).toFixed(2));
    if (!faculty_name || !designation) {
      return showError("Please enter a name and designation.");
    }
    // Validate per-type totals
    if ((s+h+c+m+w+comp+e+a) === 0) {
      return showError("Please enter at least one leave allotment.");
    }
    if (!confirm("Are you sure you want to add this record?")) return;
    try {
      const payload = withScopePayload({ faculty_name, designation });
      // Include per-type granted fields
      payload.short_leaves_granted = s;
      payload.half_day_leaves_granted = h;
      payload.casual_leaves_granted = c;
      payload.medical_leaves_granted = m;
      payload.without_payment_leaves_granted = w;
      payload.compensatory_leaves_granted = comp;
      payload.earned_leaves_granted = e;
      payload.academic_leaves_granted = a;
      payload.total_leaves = totalLeaves;

      const res = await fetch("/leave_mgmt/add-faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add faculty/staff.");
      showSuccess("Record added successfully!");
      document.getElementById("new-faculty-name").value = "";
      document.getElementById("new-faculty-designation").selectedIndex = 0;
      ['new-short-granted','new-half-granted','new-casual-granted','new-medical-granted','new-without-granted','new-compensatory-granted','new-earned-granted','new-academic-granted'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      loadTableData();
    } catch (err) {
      showError(err.message);
    }
  });
}

// Compute and update totals in main page add/global forms
function computeMainTotals() {
  const getNum = (id) => Number(document.getElementById(id)?.value || 0);
  const ids = ['new-short-granted','new-half-granted','new-casual-granted','new-medical-granted','new-without-granted','new-compensatory-granted','new-earned-granted'];
  const s = getNum('new-short-granted');
  const h = getNum('new-half-granted');
  const total = parseFloat((s/3 + h*0.5 + ids.slice(2).reduce((acc,id)=>acc+getNum(id),0)).toFixed(2));
  const el = document.getElementById('new-total-leaves'); if(el) el.textContent = total.toFixed(2);

  const gs = getNum('global-short-granted');
  const gh = getNum('global-half-granted');
  const gtotal = parseFloat((gs/3 + gh*0.5 + ['global-casual-granted','global-medical-granted','global-without-granted','global-compensatory-granted','global-earned-granted'].reduce((acc,id)=>acc+getNum(id),0)).toFixed(2));
  const gel = document.getElementById('global-total-leaves'); if(gel) gel.textContent = gtotal.toFixed(2);
}

// attach listeners for main totals
['new-short-granted','new-half-granted','new-casual-granted','new-medical-granted','new-without-granted','new-compensatory-granted','new-earned-granted','global-short-granted','global-half-granted','global-casual-granted','global-medical-granted','global-without-granted','global-compensatory-granted','global-earned-granted'].forEach(id=>{
  const el = document.getElementById(id); if(el) el.addEventListener && el.addEventListener('input', computeMainTotals);
});

// function setupSearch() {
//   const searchInput = document.getElementById("searchInput");
//   const deleteBtn = document.getElementById("delete-faculty-btn");
//   const suggestionsList = document.getElementById("suggestionsBox");
//   if (!searchInput) return;
//   let selectedFacultyId = null;
//   let activeIndex = -1;
//   let suggestions = [];

//   searchInput.addEventListener("input", async () => {
//     const query = searchInput.value.trim();
//     if (!query || !state.activeScope) {
//       suggestionsList.style.display = "none";
//       deleteBtn.disabled = true;
//       selectedFacultyId = null;
//       return;
//     }
//     const url = new URL("/leave_mgmt/faculty-suggestions", window.location.origin);
//     appendScopeParams(url);
//     url.searchParams.set("search", query);
//     try {
//       const res = await fetch(url);
//       if (!res.ok) throw new Error();
//       suggestions = await res.json();
//       if (!suggestions.length) {
//         suggestionsList.style.display = "none";
//         deleteBtn.disabled = true;
//         return;
//       }
//       suggestionsList.innerHTML = suggestions
//         .map(
//           (item, index) => `<li data-id="${item.id}" class="suggestion-item ${
//             index === 0 ? "active" : ""
//           }">${item.display}</li>`
//         )
//         .join("");
//       suggestionsList.style.display = "block";
//       activeIndex = 0;
//       Array.from(suggestionsList.children).forEach((item, index) => {
//         item.addEventListener("click", () => selectSuggestion(index));
//       });
//     } catch (err) {
//       console.error(err);
//     }
//   });

//   searchInput.addEventListener("keydown", (e) => {
//     const items = suggestionsList.querySelectorAll(".suggestion-item");
//     if (!items.length) return;
//     if (e.key === "ArrowDown") {
//       activeIndex = (activeIndex + 1) % items.length;
//     } else if (e.key === "ArrowUp") {
//       activeIndex = (activeIndex - 1 + items.length) % items.length;
//     } else if (e.key === "Enter") {
//       e.preventDefault();
//       selectSuggestion(activeIndex);
//       return;
//     }
//     items.forEach((item, index) => {
//       item.classList.toggle("active", index === activeIndex);
//     });
//   });

//   function selectSuggestion(index) {
//     if (!suggestions[index]) return;
//     searchInput.value = suggestions[index].display;
//     selectedFacultyId = suggestions[index].id;
//     deleteBtn.disabled = false;
//     suggestionsList.style.display = "none";
//   }

//   deleteBtn?.addEventListener("click", async () => {
//     if (!selectedFacultyId) return;
//     if (
//       !confirm("This action will permanently delete the faculty/staff record.")
//     )
//       return;
//     try {
//       const res = await fetch(
//         `/leave_mgmt/delete-faculty/${selectedFacultyId}`,
//         {
//           method: "DELETE",
//         }
//       );
//       const result = await res.json();
//       if (!res.ok || !result.success) {
//         throw new Error(result.error || "Failed to delete record.");
//       }
//       showSuccess("Record deleted successfully.");
//       searchInput.value = "";
//       deleteBtn.disabled = true;
//       selectedFacultyId = null;
//       loadTableData();
//     } catch (err) {
//       showError(err.message);
//     }
//   });
// }

function setupSearch() {
  // Check if user has permission to delete
  if (!state.context.permissions?.canManageFaculty) {
    const deleteBtn = document.getElementById("delete-faculty-btn");
    if (deleteBtn) {
      deleteBtn.style.display = "none";
      deleteBtn.disabled = true;
    }
    // Also hide the suggestions delete functionality
    const suggestionsList = document.getElementById("suggestionsBox");
    if (suggestionsList) {
      suggestionsList.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent any delete actions
      });
    }
    return; // Exit early if no permission
  }
  
  // Rest of the existing setupSearch() code...
  const searchInput = document.getElementById("searchInput");
  const deleteBtn = document.getElementById("delete-faculty-btn");
  const suggestionsList = document.getElementById("suggestionsBox");
  // ... existing code continues
}

function setupReportButtons() {
  const fromDateInput = document.querySelector(".from-date");
  const toDateInput = document.querySelector(".to-date");
  if (fromDateInput && toDateInput) {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 35);
    fromDateInput.value = defaultFrom.toISOString().split("T")[0];
    toDateInput.value = new Date().toISOString().split("T")[0];
  }
  document
    .querySelector(".generate-report")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!state.activeScope) {
        return showError("Please select a scope before generating reports.");
      }
      const fromDate = document.querySelector(".from-date").value;
      const toDate = document.querySelector(".to-date").value;
      const url = new URL("/leave_mgmt/pdf/all", window.location.origin);
      appendScopeParams(url);
      url.searchParams.set("fromDate", fromDate);
      url.searchParams.set("toDate", toDate);
      await openPdf(url);
    });
  document
    .querySelector(".btn--todays-report")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!state.activeScope) {
        return showError("Please select a scope before generating reports.");
      }
      const url = new URL("/leave_mgmt/pdf/todays-report", window.location.origin);
      appendScopeParams(url);
      await openPdf(url);
    });
}

async function openPdf(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to generate PDF.");
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  } catch (err) {
    showError(err.message);
  }
}

function appendScopeParams(url) {
  if (!state.activeScope) return;
  url.searchParams.set("scopeType", state.activeScope.type);
  url.searchParams.set("scopeId", state.activeScope.id);
}

function withScopePayload(payload) {
  if (!state.activeScope) return payload;
  if (
    payload.scopeType ||
    payload.scopeId ||
    payload.departmentId ||
    payload.hostelId
  ) {
    return payload;
  }
  return {
    ...payload,
    scopeType: state.activeScope.type,
    scopeId: state.activeScope.id,
  };
}

// Replace the entire configurePanels function (line ~680):
function configurePanels() {
  // Hide all panels first
  document.getElementById("establishment-panel")?.classList.add("hidden");
  document.getElementById("stats-panel")?.classList.add("hidden");
  document.getElementById("superadmin-panel")?.classList.add("hidden");

  // Show establishment panel for establishment_admin and superadmin
  if (state.context.role === "establishment_admin" || state.context.role === "superadmin") {
    document.getElementById("establishment-panel")?.classList.remove("hidden");
  }

  // Show stats panel for principal_admin, superadmin, and establishment_admin
  if (
    state.context.role === "principal_admin" ||
    state.context.role === "superadmin" ||
    state.context.role === "establishment_admin"
  ) {
    document.getElementById("stats-panel")?.classList.remove("hidden");
  }

  // Show superadmin panel only for superadmin
  if (state.context.role === "superadmin") {
    document.getElementById("superadmin-panel")?.classList.remove("hidden");
  }

  // Initialize panels if they're visible
  if (!document.getElementById("establishment-panel")?.classList.contains("hidden")) {
    initEstablishmentPanel();
  }
  
  if (!document.getElementById("stats-panel")?.classList.contains("hidden")) {
    initStatsPanel();
  }
  
  if (!document.getElementById("superadmin-panel")?.classList.contains("hidden")) {
    initSuperAdminPanel();
  }
}

function initEstablishmentPanel() {
  const panel = document.getElementById("establishment-panel");
  if (
    !panel ||
    (!state.context.permissions?.canManageDepartments &&
      !state.context.permissions?.canManageHostels &&
      state.context.scopeType !== SCOPE_TYPES.GLOBAL)
  ) {
    panel?.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  setupDepartmentForm();
  setupHostelForm();
  setupGlobalFacultyForm();
  setupFacultyUpdateForm();
}

function setupDepartmentForm() {
  const form = document.getElementById("department-form");
  const listEl = document.getElementById("department-list");
  if (!form || !listEl) return;
  const render = () => {
    listEl.innerHTML = state.metadata.departments
      .map(
        (dept) => `<li data-id="${dept.id}">
        <span>${dept.name}</span>
        <div>
          <button data-action="rename">Rename</button>
          <button data-action="delete">Delete</button>
        </div>
      </li>`
      )
      .join("");
    listEl.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const id = e.target.closest("li").dataset.id;
        if (e.target.dataset.action === "rename") {
          const name = prompt("Enter new department name:");
          if (!name) return;
          updateDepartment(id, name.trim());
        } else {
          if (!confirm("Delete this department?")) return;
          deleteDepartment(id);
        }
      })
    );
  };
  render();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("dept-name-input").value.trim();
    if (!name) return;
    try {
      const res = await fetch("/leave_mgmt/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_name: name }),
      });
      if (!res.ok) throw new Error("Unable to add department.");
      const result = await res.json();
      state.metadata.departments.push({ id: result.id, name });
      document.getElementById("dept-name-input").value = "";
      render();
      populateScopeOptions(
        document.getElementById("scope-type-filter")?.value || "department"
      );
    } catch (err) {
      showError(err.message);
    }
  });
  async function updateDepartment(id, name) {
    try {
      const res = await fetch(`/leave_mgmt/admin/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_name: name }),
      });
      if (!res.ok) throw new Error("Failed to rename department.");
      const dept = state.metadata.departments.find((d) => d.id === Number(id));
      if (dept) dept.name = name;
      render();
      populateScopeOptions(
        document.getElementById("scope-type-filter")?.value || "department"
      );
    } catch (err) {
      showError(err.message);
    }
  }
  async function deleteDepartment(id) {
    try {
      const res = await fetch(`/leave_mgmt/admin/departments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete department.");
      state.metadata.departments = state.metadata.departments.filter(
        (d) => d.id !== Number(id)
      );
      render();
      populateScopeOptions(
        document.getElementById("scope-type-filter")?.value || "department"
      );
    } catch (err) {
      showError(
        "Failed to delete department. Make sure no faculty or admins depend on it."
      );
    }
  }
}

function setupHostelForm() {
  const form = document.getElementById("hostel-form");
  const listEl = document.getElementById("hostel-list");
  if (!form || !listEl) return;
  const render = () => {
    listEl.innerHTML = state.metadata.hostels
      .map(
        (hostel) => `<li data-id="${hostel.id}">
        <span>${hostel.name}</span>
        <div>
          <button data-action="rename">Rename</button>
          <button data-action="delete">Delete</button>
        </div>
      </li>`
      )
      .join("");
    listEl.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const id = e.target.closest("li").dataset.id;
        if (e.target.dataset.action === "rename") {
          const name = prompt("Enter new hostel name:");
          if (!name) return;
          updateHostel(id, name.trim());
        } else {
          if (!confirm("Delete this hostel?")) return;
          deleteHostel(id);
        }
      })
    );
  };
  render();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("hostel-name-input").value.trim();
    if (!name) return;
    try {
      const res = await fetch("/leave_mgmt/admin/hostels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostel_name: name }),
      });
      if (!res.ok) throw new Error("Unable to add hostel.");
      const result = await res.json();
      state.metadata.hostels.push({ id: result.id, name });
      document.getElementById("hostel-name-input").value = "";
      render();
      populateScopeOptions(
        document.getElementById("scope-type-filter")?.value || "department"
      );
    } catch (err) {
      showError(err.message);
    }
  });
  async function updateHostel(id, name) {
    try {
      const res = await fetch(`/leave_mgmt/admin/hostels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostel_name: name }),
      });
      if (!res.ok) throw new Error("Failed to rename hostel.");
      const hostel = state.metadata.hostels.find((h) => h.id === Number(id));
      if (hostel) hostel.name = name;
      render();
      populateScopeOptions(
        document.getElementById("scope-type-filter")?.value || "department"
      );
    } catch (err) {
      showError(err.message);
    }
  }
  async function deleteHostel(id) {
    try {
      const res = await fetch(`/leave_mgmt/admin/hostels/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete hostel.");
      state.metadata.hostels = state.metadata.hostels.filter(
        (h) => h.id !== Number(id)
      );
      render();
      populateScopeOptions(
        document.getElementById("scope-type-filter")?.value || "department"
      );
    } catch (err) {
      showError(
        "Failed to delete hostel. Make sure no staff or admins depend on it."
      );
    }
  }
}

function setupGlobalFacultyForm() {
  const form = document.getElementById("global-faculty-form");
  if (!form) return;
  const scopeSelect = document.getElementById("global-scope-type");
  const valueSelect = document.getElementById("global-scope-value");
  const populate = () => {
    const type = scopeSelect.value;
    const list =
      type === SCOPE_TYPES.HOSTEL
        ? state.metadata.hostels
        : state.metadata.departments;
    valueSelect.innerHTML = list
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join("");
  };
  populate();
  scopeSelect.addEventListener("change", populate);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      faculty_name: document.getElementById("global-faculty-name").value.trim(),
      designation: document.getElementById("global-faculty-designation").value,
      member_type: document.getElementById("global-member-type").value,
      scopeType: scopeSelect.value,
      scopeId: Number(valueSelect.value),
    };
    // per-type fields
    const getNum = (id) => Number(document.getElementById(id)?.value || 0);
    payload.short_leaves_granted = getNum('global-short-granted');
    payload.half_day_leaves_granted = getNum('global-half-granted');
    payload.casual_leaves_granted = getNum('global-casual-granted');
    payload.medical_leaves_granted = getNum('global-medical-granted');
    payload.without_payment_leaves_granted = getNum('global-without-granted');
    payload.compensatory_leaves_granted = getNum('global-compensatory-granted');
    payload.earned_leaves_granted = getNum('global-earned-granted');
    payload.academic_leaves_granted = getNum('global-academic-granted');
    if (!payload.faculty_name || !payload.designation || !payload.scopeId) {
      return showError("Please fill all required fields.");
    }
    try {
      const res = await fetch("/leave_mgmt/add-faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add faculty/staff.");
      showSuccess("Record added.");
      form.reset();
      populate();
    } catch (err) {
      showError(err.message);
    }
  });
}

function setupFacultyUpdateForm() {
  const form = document.getElementById("faculty-update-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("update-faculty-id").value.trim();
    if (!id) return showError("Enter a faculty/staff ID.");
    const payload = {};
    ["update-designation", "update-granted", "update-remaining"].forEach(
      (field) => {
        const value = document.getElementById(field).value.trim();
        if (value) {
          if (field === "update-designation") payload.designation = value;
          if (field === "update-granted") payload.granted_leaves = value;
          if (field === "update-remaining") payload.remaining_leaves = value;
        }
      }
    );
    try {
      // If per-type update fields exist, send to details endpoint to update per-type granted values
      const perTypeExists = document.getElementById('update-short-granted');
      if (perTypeExists) {
        // collect per-type granted fields
        ['short','half','casual','medical','without','compensatory','earned','academic'].forEach(k=>{
          const gid = `update-${k}-granted`;
          const v = document.getElementById(gid)?.value;
          if (v !== undefined && v !== null && v !== "") {
            const keyMap = {
              short: 'short_leaves_granted',
              half: 'half_day_leaves_granted',
              casual: 'casual_leaves_granted',
              medical: 'medical_leaves_granted',
              without: 'without_payment_leaves_granted',
              compensatory: 'compensatory_leaves_granted',
              earned: 'earned_leaves_granted',
              academic: 'academic_leaves_granted'
            };
            payload[keyMap[k]] = Number(v);
          }
        });

        const res = await fetch(`/leave_mgmt/faculty/${id}/details`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update record.");
        showSuccess("Faculty/staff updated.");
        form.reset();
      } else {
        const res = await fetch(`/leave_mgmt/faculty/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update record.");
        showSuccess("Faculty/staff updated.");
        form.reset();
      }
      if (
        state.activeScope &&
        ((state.activeScope.type === SCOPE_TYPES.DEPARTMENT &&
          payload.department_id == state.activeScope.id) ||
          (state.activeScope.type === SCOPE_TYPES.HOSTEL &&
            payload.hostel_id == state.activeScope.id) ||
          (!payload.department_id && !payload.hostel_id))
      ) {
        loadTableData();
      }
    } catch (err) {
      showError(err.message);
    }
  });
}

function initStatsPanel() {
  const panel = document.getElementById("stats-panel");
  if (!panel) return;
  
  // Check if user has permission to view stats
  const canViewStats = state.context.role === "principal_admin" ||
                       state.context.role === "superadmin" ||
                       state.context.role === "establishment_admin" ||
                       state.context.permissions?.canViewStats;
  
  if (!canViewStats) {
    panel.classList.add("hidden");
    return;
  }
  
  panel.classList.remove("hidden");
  document.getElementById("stats-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("refresh-stats").addEventListener("click", refreshStats);
  refreshStats();
}

// Fix the initSuperAdminPanel function:
function initSuperAdminPanel() {
  const panel = document.getElementById("superadmin-panel");
  if (!panel) return;
  
  if (state.context.role !== "superadmin") {
    panel.classList.add("hidden");
    return;
  }
  
  panel.classList.remove("hidden");
  setupAdminCreateForm();
  loadAdmins();
  loadActivityLogs();
  document
    .getElementById("export-logs")
    ?.addEventListener("click", () => window.open("/leave_mgmt/activity-logs/export"));
}

async function refreshStats() {
  try {
    const date = document.getElementById("stats-date").value;
    const url = new URL("/leave_mgmt/stats/presence", window.location.origin);
    url.searchParams.set("date", date);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load stats.");
    const data = await res.json();
    const deptBody = document.querySelector("#dept-stats-table tbody");
    const hostelBody = document.querySelector("#hostel-stats-table tbody");
    deptBody.innerHTML = data.departments
      .map(
        (row) =>
          `<tr><td>${row.name}</td><td>${row.present}</td><td>${row.absent}</td></tr>`
      )
      .join("");
    hostelBody.innerHTML = data.hostels
      .map(
        (row) =>
          `<tr><td>${row.name}</td><td>${row.present}</td><td>${row.absent}</td></tr>`
      )
      .join("");
  } catch (err) {
    showError(err.message);
  }
}

function initSuperAdminPanel() {
  const panel = document.getElementById("superadmin-panel");
  if (!panel || state.context.role !== "superadmin") {
    panel?.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  setupAdminCreateForm();
  loadAdmins();
  loadActivityLogs();
  document
    .getElementById("export-logs")
    ?.addEventListener("click", () => window.open("/leave_mgmt/activity-logs/export"));
}

function setupAdminCreateForm() {
  const form = document.getElementById("admin-create-form");
  const roleSelect = document.getElementById("admin-role");
  const scopeSelect = document.getElementById("admin-scope-select");
  if (!form) return;
  const toggleScopeSelect = () => {
    const role = roleSelect.value;
    if (role === "department_admin") {
      scopeSelect.classList.remove("hidden");
      scopeSelect.innerHTML = state.metadata.departments
        .map((dept) => `<option value="department:${dept.id}">${dept.name}</option>`)
        .join("");
    } else if (role === "hostel_admin") {
      scopeSelect.classList.remove("hidden");
      scopeSelect.innerHTML = state.metadata.hostels
        .map((hostel) => `<option value="hostel:${hostel.id}">${hostel.name}</option>`)
        .join("");
    } else {
      scopeSelect.classList.add("hidden");
      scopeSelect.innerHTML = "";
    }
  };
  toggleScopeSelect();
  roleSelect.addEventListener("change", toggleScopeSelect);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value.trim();
    const role = roleSelect.value;
    if (!username || !password) {
      return showError("Username and password are required.");
    }
    const payload = { username, password, role };
    if (!scopeSelect.classList.contains("hidden")) {
      const [type, id] = scopeSelect.value.split(":");
      if (type === "department") payload.departmentId = Number(id);
      if (type === "hostel") payload.hostelId = Number(id);
    }
    try {
      const res = await fetch("/leave_mgmt/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add admin.");
      showSuccess("Admin created.");
      form.reset();
      toggleScopeSelect();
      loadAdmins();
    } catch (err) {
      showError(err.message);
    }
  });
}

async function loadAdmins() {
  const tbody = document.querySelector("#admin-table tbody");
  if (!tbody) return;
  try {
    const res = await fetch("/leave_mgmt/admins");
    if (!res.ok) throw new Error("Failed to fetch admins.");
    const admins = await res.json();
    tbody.innerHTML = admins
      .map(
        (admin) => `<tr data-id="${admin.id}">
        <td>${admin.username}</td>
        <td>${formatRoleLabel(admin.role)}</td>
        <td>${admin.department_id || admin.hostel_id || "-"}</td>
        <td><code>${admin.password}</code></td>
        <td><button data-action="reset">Reset Password</button></td>
      </tr>`
      )
      .join("");
    tbody.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.closest("tr").dataset.id;
        const newPassword = prompt("Enter new password:");
        if (!newPassword) return;
        resetAdminPassword(id, newPassword);
      })
    );
  } catch (err) {
    showError(err.message);
  }
}

async function resetAdminPassword(id, password) {
  try {
    const res = await fetch(`/leave_mgmt/admins/${id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("Password reset failed.");
    showSuccess("Password updated.");
    loadAdmins();
  } catch (err) {
    showError(err.message);
  }
}

async function loadActivityLogs() {
  const tbody = document.querySelector("#activity-table tbody");
  if (!tbody) return;
  try {
    const res = await fetch("/leave_mgmt/activity-logs?limit=100");
    if (!res.ok) throw new Error("Failed to fetch activity logs.");
    const payload = await res.json();
    const logs = Array.isArray(payload) ? payload : payload.logs || [];
    tbody.innerHTML = logs
      .map(
        (log) => `<tr>
        <td>${new Date(log.created_at).toLocaleString()}</td>
        <td>${log.actor_username || "-"}</td>
        <td>${log.action}</td>
        <td>${log.entity_type || "-"} ${log.entity_id || ""}</td>
      </tr>`
      )
      .join("");
  } catch (err) {
    showError(err.message);
  }
}
