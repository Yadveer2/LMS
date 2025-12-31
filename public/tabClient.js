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
    return originalFetch(resource, init);
  };

  // Expose tabId for debugging/other scripts
  window.LEAVE_MGMT_TAB_ID = tabId;
})();