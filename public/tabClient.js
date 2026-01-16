(function(){
  // Per-tab identifier stored in sessionStorage (isolated per tab)
  const KEY = 'leave_mgmt_tab_id';
  let tabId = sessionStorage.getItem(KEY);
  if (!tabId) {
    // simple random id
    tabId = 'tab_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem(KEY, tabId);
  }

  // Monkeypatch fetch to include X-Tab-Id header for all requests
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(resource, init = {}) {
    init.headers = init.headers || {};
    // If Headers instance, set directly
    if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
      init.headers.set('X-Tab-Id', tabId);
    } else if (Array.isArray(init.headers)) {
      init.headers.push(['X-Tab-Id', tabId]);
    } else {
      init.headers['X-Tab-Id'] = tabId;
    }

    if (!init.credentials) init.credentials = 'include';

    return originalFetch(resource, init).then((response) => {
      if (response && response.status === 401) {
        // Load login page inline so user sees login without manual refresh
        fetch('/leave_mgmt/', { credentials: 'include' })
          .then((r) => r.text())
          .then((html) => {
            try {
              document.open();
              document.write(html);
              document.close();
            } catch (e) {
              window.location.href = '/leave_mgmt/';
            }
          })
          .catch(() => {
            window.location.href = '/leave_mgmt/';
          });
      }
      return response;
    });
  };

  // Listen for cross-tab session events via localStorage
  window.addEventListener('storage', (ev) => {
    if (!ev.key) return;
    if (ev.key === 'leave_mgmt_session_event') {
      try {
        const payload = JSON.parse(ev.newValue || '{}');
        if (payload && (payload.type === 'login' || payload.type === 'logout')) {
          // Another tab logged in — current tab should show login UI
          if (document.querySelector('input#username')) return; // already login page
          fetch('/leave_mgmt/', { credentials: 'include' })
            .then((r) => r.text())
            .then((html) => {
              try {
                document.open();
                document.write(html);
                document.close();
              } catch (e) {
                window.location.href = '/leave_mgmt/';
              }
            })
            .catch(() => window.location.href = '/leave_mgmt/');
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  });

  // Polling fallback for tabs that missed storage events / cross-browser cases
  const POLL_INTERVAL = 15000;
  setInterval(() => {
    fetch('/leave_mgmt/context', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) {
          fetch('/leave_mgmt/', { credentials: 'include' })
            .then((h) => h.text())
            .then((html) => {
              try { document.open(); document.write(html); document.close(); } catch (e) { window.location.href = '/leave_mgmt/'; }
            })
            .catch(() => window.location.href = '/leave_mgmt/');
        }
      })
      .catch(() => {});
  }, POLL_INTERVAL);

  // Expose tabId for debugging/other scripts
  window.LEAVE_MGMT_TAB_ID = tabId;
})();