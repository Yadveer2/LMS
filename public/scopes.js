// Helper functions for scope management
const ScopeManager = {
  // Get available scopes for the current user
  getAvailableScopes() {
    const user = window.state?.context;
    if (!user) return { departments: [], hostels: [] };
    
    if (user.scopeType === "department" && user.departmentId) {
      return {
        departments: [{ id: user.departmentId, name: user.departmentName }],
        hostels: []
      };
    }
    
    if (user.scopeType === "hostel" && user.hostelId) {
      return {
        departments: [],
        hostels: [{ id: user.hostelId, name: user.hostelName }]
      };
    }
    
    // For global users, return all scopes
    return window.state?.metadata || { departments: [], hostels: [] };
  },
  
  // Check if user can switch scopes
  canSwitchScope() {
    const user = window.state?.context;
    return user?.scopeType === "global";
  },
  
  // Format scope for display
  formatScope(scope) {
    if (!scope) return "Select Scope";
    if (scope.type === "department") return `${scope.name} Department`;
    if (scope.type === "hostel") return `Hostel ${scope.name}`;
    return "Institution";
  }
};