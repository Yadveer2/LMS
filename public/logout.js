// Logout functionality for all dashboards
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/leave_mgmt/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    // Clear local storage
                    localStorage.clear();
                    sessionStorage.clear();
                    // Notify other tabs and redirect to login
                    try { localStorage.setItem('leave_mgmt_session_event', JSON.stringify({ type: 'logout', ts: Date.now() })); } catch (e) {}
                    window.location.href = '/leave_mgmt';
                } else {
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('Logout failed. Please try again.');
            }
        });
    }
});