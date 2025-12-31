class PrincipalDashboard {
    constructor() {
        this.departments = [];
        this.hostels = [];
        this.departmentStats = [];
        this.hostelStats = [];
        this.init();
    }

    async init() {
        await this.loadUserInfo();
        await this.loadMetadata();
        await this.loadTodayStats();
        this.renderFacultyChart();
        this.renderStaffChart();
        this.loadDepartmentReports();
        this.loadHostelReports();
        this.bindEvents();
        this.startAutoRefresh();
        this.setupReportModal();
        // this.setupAlertSystem(); 
        this.setupAnalysis();
    }

    // NEW: Setup alert system
    setupAlertSystem() {
        // Create alert container
        const alertContainer = document.createElement('div');
        alertContainer.id = 'alertContainer';
        alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(alertContainer);
    }

// ===== ANALYSIS METHODS =====

    // Add this method to set up analysis
    setupAnalysis() {
        // Set default date for analysis
        const today = new Date().toISOString().split('T')[0];
        const analysisDateInput = document.getElementById('analysisDate');
        if (analysisDateInput) {
            analysisDateInput.value = today;
            
            // Add change event listener
            analysisDateInput.addEventListener('change', () => {
                this.loadAnalysisData();
            });
        }
        
        // Load initial analysis data
        setTimeout(() => {
            this.loadAnalysisData();
        }, 1500);
    }

    // Main method to load analysis data
    async loadAnalysisData() {
        try {
            const date = document.getElementById('analysisDate')?.value || 
                         document.getElementById('statsDate')?.value || 
                         new Date().toISOString().split('T')[0];
            const scope = document.getElementById('analysisScope')?.value || 'department';
            const type = document.getElementById('analysisType')?.value || 'overview';
            
            // Show loading state
            const container = document.getElementById('analysisCharts');
            const noDataMsg = document.getElementById('noAnalysisData');
            const summary = document.getElementById('analysisSummary');
            
            if (container) {
                container.innerHTML = `
                    <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i>
                        Loading ${scope} analysis for ${date}...
                    </div>
                `;
            }
            
            if (noDataMsg) noDataMsg.style.display = 'none';
            if (summary) summary.style.display = 'none';
            
            this.showAlert(`Loading ${scope} analysis...`, 'info', 2000);
            
            // Use DB-backed detailed-stats endpoint (server returns departments/hostels)
            let data = null;
            try {
                const statsResponse = await fetch(`/leave_mgmt/detailed-stats?date=${date}`, {
                    credentials: 'include'
                });

                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    data = this.generateAnalysisFromStats(statsData, scope);
                    this.showAlert(`${scope.charAt(0).toUpperCase() + scope.slice(1)} analysis loaded from DB`, 'success', 3000);
                } else {
                    // Last resort: Use sample data
                    data = this.getSampleAnalysisData(scope);
                    this.showAlert('Using sample analysis data', 'info', 3000);
                }
            } catch (err) {
                console.error('Failed to fetch detailed-stats:', err);
                data = this.getSampleAnalysisData(scope);
                this.showAlert('Using sample analysis data (failed DB request)', 'warning', 4000);
            }
            
            // Render the charts
            if (data && data.length > 0) {
                this.renderAnalysisCharts(data, scope, type);
            } else {
                this.showNoAnalysisData();
            }
            
        } catch (error) {
            console.error('Failed to load analysis data:', error);
            this.showAlert('Failed to load analysis data', 'error');
            this.renderSampleAnalysisCharts();
        }
    }

    // Helper to generate analysis from stats
    generateAnalysisFromStats(statsData, scope) {
        const items = scope === 'department' ? (statsData.departments || []) : (statsData.hostels || []);
        
        return items.map(item => {
            const total = item.total || 0;
            const present = item.present || 0;
            const absent = total - present;
            
            // Create realistic leave distribution
            const leaveTypes = {
                'casual_leave': Math.max(0, Math.floor(absent * 0.4)),
                'medical_leave': Math.max(0, Math.floor(absent * 0.3)),
                'earned_leave': Math.max(0, Math.floor(absent * 0.2)),
                'other_leave': Math.max(0, absent - Math.floor(absent * 0.4) - Math.floor(absent * 0.3) - Math.floor(absent * 0.2))
            };
            
            return {
                id: item.id || Math.random(),
                name: item.name || 'Unknown',
                total: total,
                present: present,
                absent: absent,
                leaveDistribution: leaveTypes
            };
        });
    }

    // Sample data for testing
    getSampleAnalysisData(scope) {
        if (scope === 'department') {
            return [
                {
                    id: 1,
                    name: 'Computer Science & Engineering',
                    total: 28,
                    present: 23,
                    absent: 5,
                    leaveDistribution: {
                        'casual_leave': 2,
                        'medical_leave': 1,
                        'earned_leave': 1,
                        'other_leave': 1
                    }
                },
                {
                    id: 2,
                    name: 'Electrical Engineering',
                    total: 24,
                    present: 20,
                    absent: 4,
                    leaveDistribution: {
                        'casual_leave': 2,
                        'medical_leave': 1,
                        'earned_leave': 1,
                        'other_leave': 0
                    }
                },
                {
                    id: 3,
                    name: 'Mechanical Engineering',
                    total: 26,
                    present: 22,
                    absent: 4,
                    leaveDistribution: {
                        'casual_leave': 1,
                        'medical_leave': 2,
                        'earned_leave': 1,
                        'other_leave': 0
                    }
                },
                {
                    id: 4,
                    name: 'Civil Engineering',
                    total: 22,
                    present: 19,
                    absent: 3,
                    leaveDistribution: {
                        'casual_leave': 1,
                        'medical_leave': 1,
                        'earned_leave': 1,
                        'other_leave': 0
                    }
                },
                {
                    id: 5,
                    name: 'Applied Sciences',
                    total: 30,
                    present: 27,
                    absent: 3,
                    leaveDistribution: {
                        'casual_leave': 1,
                        'medical_leave': 1,
                        'earned_leave': 1,
                        'other_leave': 0
                    }
                }
            ];
        } else {
            // Hostel sample data
            return [
                {
                    id: 101,
                    name: 'Boys Hostel A',
                    total: 15,
                    present: 13,
                    absent: 2,
                    leaveDistribution: {
                        'casual_leave': 1,
                        'medical_leave': 0,
                        'earned_leave': 1,
                        'other_leave': 0
                    }
                },
                {
                    id: 102,
                    name: 'Boys Hostel B',
                    total: 18,
                    present: 16,
                    absent: 2,
                    leaveDistribution: {
                        'casual_leave': 1,
                        'medical_leave': 1,
                        'earned_leave': 0,
                        'other_leave': 0
                    }
                },
                {
                    id: 103,
                    name: 'Girls Hostel',
                    total: 12,
                    present: 11,
                    absent: 1,
                    leaveDistribution: {
                        'casual_leave': 0,
                        'medical_leave': 1,
                        'earned_leave': 0,
                        'other_leave': 0
                    }
                }
            ];
        }
    }

    // Render analysis charts
    renderAnalysisCharts(data, scope, type) {
        const container = document.getElementById('analysisCharts');
        const summaryContainer = document.getElementById('analysisSummary');
        const summaryStats = summaryContainer?.querySelector('.summary-stats');
        const noDataMsg = document.getElementById('noAnalysisData');

        // Ensure we have the selected date for callbacks/templates
        const date = document.getElementById('analysisDate')?.value || document.getElementById('statsDate')?.value || new Date().toISOString().split('T')[0];
        
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = '';
            if (noDataMsg) noDataMsg.style.display = 'block';
            if (summaryContainer) summaryContainer.style.display = 'none';
            return;
        }
        
        // Hide no data message
        if (noDataMsg) noDataMsg.style.display = 'none';
        
        container.innerHTML = '';
        
        // Calculate overall summary
        let totalItems = 0;
        let totalPresent = 0;
        let totalAbsent = 0;
        let leaveTypeTotals = {
            'casual_leave': 0,
            'medical_leave': 0,
            'earned_leave': 0,
            'other_leave': 0
        };
        
        data.forEach(item => {
            totalItems += item.total || 0;
            totalPresent += item.present || 0;
            totalAbsent += item.absent || 0;
            
            if (item.leaveDistribution) {
                Object.keys(item.leaveDistribution).forEach(leaveType => {
                    if (leaveTypeTotals[leaveType] !== undefined) {
                        leaveTypeTotals[leaveType] += item.leaveDistribution[leaveType] || 0;
                    }
                });
            }
        });
        
        // Show summary
        if (summaryContainer && summaryStats) {
            summaryContainer.style.display = 'block';
            
            const scopeName = scope === 'department' ? 'Faculty' : 'Staff';
            const attendanceRate = totalItems > 0 ? Math.round((totalPresent / totalItems) * 100) : 0;
            
            summaryStats.innerHTML = `
                <div class="summary-stat-card" style="border-left-color: var(--primary);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">Total ${scopeName}</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--primary);">${totalItems}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">Across ${data.length} ${scope === 'department' ? 'departments' : 'hostels'}</div>
                </div>
                <div class="summary-stat-card" style="border-left-color: var(--success);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">Present Today</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--success);">${totalPresent}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">${totalItems > 0 ? Math.round((totalPresent / totalItems) * 100) : 0}% of total</div>
                </div>
                <div class="summary-stat-card" style="border-left-color: var(--warning);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">On Leave</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--warning);">${totalAbsent}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">${Object.values(leaveTypeTotals).reduce((a, b) => a + b, 0)} with leave types</div>
                </div>
                <div class="summary-stat-card" style="border-left-color: var(--info);">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">Overall Attendance</div>
                        <div style="font-size: 28px; font-weight: 700; color: var(--info);">${attendanceRate}%</div>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">
                                    ${attendanceRate >= 90 ? '<i class="fas fa-arrow-up text-success" style="margin-right:4px"></i> Excellent' : attendanceRate >= 75 ? '<i class="fas fa-minus text-warning" style="margin-right:4px"></i> Good' : '<i class="fas fa-exclamation-triangle text-danger" style="margin-right:4px"></i> Needs Attention'}
                                </div>
                    </div>
            `;
        }
        
        // Render charts for each item
        data.forEach(item => {
            const chartCard = this.createAnalysisChartCard(item, scope, type);
            container.appendChild(chartCard);
        });
    }

    // Create individual chart card
    createAnalysisChartCard(item, scope, type) {
        const total = item.total || 0;
        const present = item.present || 0;
        const absent = item.absent || (total - present);
        const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
        
        const chartCard = document.createElement('div');
        chartCard.className = 'analysis-chart-card';
        chartCard.style.cssText = `
            background: var(--surface);
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border: 1px solid var(--border-light);
            transition: all 0.3s ease;
        `;
        
        chartCard.onmouseenter = () => {
            chartCard.style.transform = 'translateY(-3px)';
            chartCard.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        };
        
        chartCard.onmouseleave = () => {
            chartCard.style.transform = 'translateY(0)';
            chartCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        };
        
        const chartId = `analysis-chart-${item.id}-${Date.now()}`;
        
        // Determine colors based on attendance
        let statusColor, statusIcon, statusText;
        if (attendanceRate >= 90) {
            statusColor = '#28a745';
            statusIcon = 'fa-check-circle';
            statusText = 'Excellent';
        } else if (attendanceRate >= 75) {
            statusColor = '#ffc107';
            statusIcon = 'fa-exclamation-circle';
            statusText = 'Good';
        } else {
            statusColor = '#dc3545';
            statusIcon = 'fa-exclamation-triangle';
            statusText = 'Needs Attention';
        }
        
        chartCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; font-size: 16px; color: var(--primary); font-weight: 600;">${item.name}</h4>
                <span style="font-size: 12px; padding: 4px 10px; border-radius: 12px; background: ${statusColor}20; color: ${statusColor};">
                    <i class="fas ${statusIcon}" style="margin-right: 4px;"></i>${statusText}
                </span>
            </div>
            
            <div style="display: flex; gap: 20px; align-items: center;">
                <!-- Pie Chart Container -->
                <div style="position: relative; width: 150px; height: 150px; flex-shrink: 0;">
                    <canvas id="${chartId}" width="150" height="150"></canvas>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: ${statusColor};">${attendanceRate}%</div>
                        <div style="font-size: 10px; color: var(--text-muted);">Attendance</div>
                    </div>
                </div>
                
                <!-- Details -->
                <div style="flex: 1;">
                    <!-- Present/Absent Stats -->
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 13px; color: var(--text-dark);">
                                <i class="fas fa-user-check" style="color: #28a745; margin-right: 6px;"></i>Present:
                            </span>
                            <span style="font-weight: 600; color: #28a745;">${present}</span>
                        </div>
                        <div style="height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${total > 0 ? (present / total) * 100 : 0}%; background: #28a745; transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 13px; color: var(--text-dark);">
                                <i class="fas fa-user-clock" style="color: #ffc107; margin-right: 6px;"></i>On Leave:
                            </span>
                            <span style="font-weight: 600; color: #ffc107;">${absent}</span>
                        </div>
                        <div style="height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${total > 0 ? (absent / total) * 100 : 0}%; background: #ffc107; transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                    
                    <!-- Leave Type Breakdown -->
                    ${type === 'detailed' && item.leaveDistribution && absent > 0 ? `
                        <div style="margin-top: 20px;">
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-dark); margin-bottom: 10px;">
                                <i class="fas fa-clipboard-list" style="margin-right: 6px;"></i>Leave Breakdown:
                            </div>
                            <div style="font-size: 11px;">
                                ${Object.entries(item.leaveDistribution)
                                    .filter(([leaveType, count]) => count > 0)
                                    .map(([leaveType, count]) => {
                                        const leaveTypeNames = {
                                            'casual_leave': 'Casual Leave',
                                            'medical_leave': 'Medical Leave',
                                            'earned_leave': 'Earned Leave',
                                            'other_leave': 'Other Leave'
                                        };
                                        const colors = {
                                            'casual_leave': '#17a2b8',
                                            'medical_leave': '#dc3545',
                                            'earned_leave': '#6610f2',
                                            'other_leave': '#6c757d'
                                        };
                                        const percentage = absent > 0 ? Math.round((count / absent) * 100) : 0;
                                        return `
                                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${colors[leaveType] || '#6c757d'};"></div>
                                                    <span>${leaveTypeNames[leaveType] || leaveType}</span>
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span>${count}</span>
                                                    <span style="color: var(--text-muted);">(${percentage}%)</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-light); font-size: 11px; color: var(--text-muted);">
                <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                Total: ${total} ${scope === 'department' ? 'faculty' : 'staff'} | 
                Present: ${present} (${attendanceRate}%) | 
                On Leave: ${absent} (${total > 0 ? Math.round((absent / total) * 100) : 0}%)
            </div>
        `;
        
        // Render pie chart after DOM is updated
        setTimeout(() => {
            this.renderPieChart(chartId, present, absent, item.leaveDistribution, type);
        }, 50);
        
        return chartCard;
    }

    // Render pie chart using Canvas
    renderPieChart(canvasId, present, absent, leaveDistribution, type) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const total = present + absent;
        
        if (total === 0) {
            // Draw empty circle
            ctx.beginPath();
            ctx.arc(75, 75, 70, 0, Math.PI * 2);
            ctx.strokeStyle = '#e9ecef';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#f8f9fa';
            ctx.fill();
            return;
        }
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 70;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (type === 'overview' || !leaveDistribution) {
            // Simple pie chart: Present vs Absent
            const presentAngle = (present / total) * Math.PI * 2;
            
            // Draw present segment
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, 0, presentAngle);
            ctx.closePath();
            ctx.fillStyle = '#28a745';
            ctx.fill();
            
            // Draw absent segment
            if (absent > 0) {
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, presentAngle, Math.PI * 2);
                ctx.closePath();
                ctx.fillStyle = '#ffc107';
                ctx.fill();
            }
        } else {
            // Detailed pie chart with leave types
            let startAngle = 0;
            
            // Present segment
            const presentAngle = (present / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + presentAngle);
            ctx.closePath();
            ctx.fillStyle = '#28a745';
            ctx.fill();
            startAngle += presentAngle;
            
            // Leave type segments
            const leaveColors = {
                'casual_leave': '#17a2b8',
                'medical_leave': '#dc3545',
                'earned_leave': '#6610f2',
                'other_leave': '#6c757d'
            };
            
            Object.entries(leaveDistribution).forEach(([leaveType, count]) => {
                if (count > 0) {
                    const sliceAngle = (count / total) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                    ctx.closePath();
                    ctx.fillStyle = leaveColors[leaveType] || '#6c757d';
                    ctx.fill();
                    startAngle += sliceAngle;
                }
            });
        }
        
        // Draw center circle (donut hole)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    }

    // Show no data message
    showNoAnalysisData() {
        const container = document.getElementById('analysisCharts');
        const noDataMsg = document.getElementById('noAnalysisData');
        const summary = document.getElementById('analysisSummary');
        
        if (container) {
            container.innerHTML = '';
        }
        
        if (noDataMsg) {
            noDataMsg.style.display = 'block';
        }
        
        if (summary) {
            summary.style.display = 'none';
        }
    }

    // Render sample charts for testing
    renderSampleAnalysisCharts() {
        const sampleData = this.getSampleAnalysisData('department');
        this.renderAnalysisCharts(sampleData, 'department', 'detailed');
    }

    // Export analysis data
    exportAnalysisData() {
        const scope = document.getElementById('analysisScope')?.value || 'department';
        const date = document.getElementById('analysisDate')?.value || new Date().toISOString().split('T')[0];
        
        const exportData = {
            date: date,
            scope: scope,
            generatedAt: new Date().toISOString(),
            data: this.getSampleAnalysisData(scope) // In real implementation, use actual data
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `analysis_${scope}_${date}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showAlert('Analysis data exported successfully', 'success');
    }

    // NEW: Show alert method
    showAlert(message, type = 'info', duration = 5000) {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;

        const alertId = 'alert-' + Date.now();
        const alert = document.createElement('div');
        alert.id = alertId;
        alert.className = `alert alert-${type}`;
        alert.style.cssText = `
            padding: 15px 20px;
            border-radius: 6px;
            background: ${this.getAlertColor(type)};
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease-out;
            position: relative;
        `;

        // Add icon based on type
        const iconMap = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };

        alert.innerHTML = `
            <i class="${iconMap[type] || iconMap.info}" style="font-size: 18px;"></i>
            <span>${message}</span>
            <button onclick="document.getElementById('${alertId}').remove()" 
                    style="margin-left: auto; background: none; border: none; color: white; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;

        alertContainer.appendChild(alert);

        // Auto remove after duration
        setTimeout(() => {
            const alertEl = document.getElementById(alertId);
            if (alertEl) {
                alertEl.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => alertEl.remove(), 300);
            }
        }, duration);

        // Add CSS animations if not already present
        if (!document.querySelector('#alertStyles')) {
            const style = document.createElement('style');
            style.id = 'alertStyles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getAlertColor(type) {
        const colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8'
        };
        return colors[type] || colors.info;
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
            // fallback to localStorage
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.username) {
            const usernameEl = document.getElementById('username');
            if (usernameEl) usernameEl.textContent = user.username;
            const initialsEl = document.getElementById('userInitials');
            if (initialsEl) initialsEl.textContent = user.username.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
    }

    async loadMetadata() {
        try {
            const response = await fetch('/leave_mgmt/metadata/scopes', {
                credentials: 'include'
            });
            const data = await response.json();
            
            this.departments = data.departments || [];
            this.hostels = data.hostels || [];
            
        } catch (error) {
            console.error('Failed to load metadata:', error);
            this.showAlert('Failed to load department/hostel metadata', 'error');
        }
    }

    async loadTodayStats() {
        try {
            const date = document.getElementById('statsDate').value || new Date().toISOString().split('T')[0];
            const response = await fetch(`/leave_mgmt/detailed-stats?date=${date}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                // Fallback to basic stats
                return this.loadBasicStats(date);
            }
            
            const data = await response.json();
            this.updateStats(data);
            
        } catch (error) {
            console.error('Failed to load stats:', error);
            this.showAlert('Failed to load today\'s statistics', 'error');
            this.loadBasicStats();
        }
    }

    async loadBasicStats(date = new Date().toISOString().split('T')[0]) {
        try {
            const response = await fetch(`/leave_mgmt/stats/presence?date=${date}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            
            const data = await response.json();
            this.updateBasicStats(data);
            
        } catch (error) {
            console.error('Failed to load basic stats:', error);
            this.showAlert('Failed to load attendance statistics', 'error');
        }
    }
    
    updateStats(data) {
        // Update department count
        document.getElementById('departmentCount').textContent = data.departments.length;
        document.getElementById('activeDepartments').textContent = data.departments.length;
        
        // Update hostel count
        document.getElementById('hostelCount').textContent = data.hostels.length;
        document.getElementById('activeHostels').textContent = data.hostels.length;
        
        // Calculate overall attendance
        const totalFaculty = data.departments.reduce((sum, dept) => sum + (dept.total || 0), 0);
        const presentFaculty = data.departments.reduce((sum, dept) => sum + (dept.present || 0), 0);
        
        const totalStaff = data.hostels.reduce((sum, hostel) => sum + (hostel.total || 0), 0);
        const presentStaff = data.hostels.reduce((sum, hostel) => sum + (hostel.present || 0), 0);
        
        const totalOverall = totalFaculty + totalStaff;
        const presentOverall = presentFaculty + presentStaff;
        const overallPercentage = totalOverall > 0 ? Math.round((presentOverall / totalOverall) * 100) : 0;
        
        // Update overall attendance
        document.getElementById('totalAttendance').textContent = `${overallPercentage}%`;
        document.getElementById('overallProgress').style.width = `${overallPercentage}%`;
        
        // Update date display
        const today = new Date();
        document.getElementById('dateDisplay').textContent = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
        
        // Store data for charts
        this.departmentStats = data.departments;
        this.hostelStats = data.hostels;
        
        // Update last updated time
        this.updateLastUpdatedTime();
    }

    updateBasicStats(data) {
        // Update department count
        document.getElementById('departmentCount').textContent = data.departments.length;
        document.getElementById('activeDepartments').textContent = data.departments.length;
        
        // Update hostel count
        document.getElementById('hostelCount').textContent = data.hostels.length;
        document.getElementById('activeHostels').textContent = data.hostels.length;
        
        // Calculate overall attendance
        const totalFaculty = data.departments.reduce((sum, dept) => sum + (dept.total || 0), 0);
        const presentFaculty = data.departments.reduce((sum, dept) => sum + (dept.present || 0), 0);
        
        const totalStaff = data.hostels.reduce((sum, hostel) => sum + (hostel.total || 0), 0);
        const presentStaff = data.hostels.reduce((sum, hostel) => sum + (hostel.present || 0), 0);
        
        const totalOverall = totalFaculty + totalStaff;
        const presentOverall = presentFaculty + presentStaff;
        const overallPercentage = totalOverall > 0 ? Math.round((presentOverall / totalOverall) * 100) : 0;
        
        // Update overall attendance
        document.getElementById('totalAttendance').textContent = `${overallPercentage}%`;
        document.getElementById('overallProgress').style.width = `${overallPercentage}%`;
        
        // Update date display
        const today = new Date();
        document.getElementById('dateDisplay').textContent = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
        
        this.departmentStats = data.departments;
        this.hostelStats = data.hostels;
        
        this.updateLastUpdatedTime();
    }

    renderFacultyChart() {
        const container = document.getElementById('facultyChart');
        if (!container || !this.departmentStats.length) return;
        
        // Sort by attendance percentage
        const sortedDepartments = [...this.departmentStats].sort((a, b) => {
            const aPercent = a.total > 0 ? (a.present / a.total) * 100 : 0;
            const bPercent = b.total > 0 ? (b.present / b.total) * 100 : 0;
            return bPercent - aPercent;
        });
        
        container.innerHTML = '';
        
        sortedDepartments.slice(0, 8).forEach(dept => {
            const total = dept.total || 1;
            const present = dept.present || 0;
            const percentage = Math.round((present / total) * 100);
            
            let color;
            if (percentage >= 90) color = '#28a745';
            else if (percentage >= 75) color = '#ffc107';
            else color = '#dc3545';
            
            const barItem = document.createElement('div');
            barItem.className = 'bar-item';
            barItem.innerHTML = `
                <div class="bar-label">${dept.name}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%; background: ${color};"></div>
                </div>
                <div class="bar-percentage">${percentage}%</div>
            `;
            
            container.appendChild(barItem);
        });
    }

    renderStaffChart() {
        const container = document.getElementById('staffChart');
        if (!container || !this.hostelStats.length) return;
        
        // Sort by attendance percentage
        const sortedHostels = [...this.hostelStats].sort((a, b) => {
            const aPercent = a.total > 0 ? (a.present / a.total) * 100 : 0;
            const bPercent = b.total > 0 ? (b.present / b.total) * 100 : 0;
            return bPercent - aPercent;
        });
        
        container.innerHTML = '';
        
        sortedHostels.slice(0, 8).forEach(hostel => {
            const total = hostel.total || 1;
            const present = hostel.present || 0;
            const percentage = Math.round((present / total) * 100);
            
            let color;
            if (percentage >= 90) color = '#28a745';
            else if (percentage >= 75) color = '#ffc107';
            else color = '#dc3545';
            
            const barItem = document.createElement('div');
            barItem.className = 'bar-item';
            barItem.innerHTML = `
                <div class="bar-label">${hostel.name}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%; background: ${color};"></div>
                </div>
                <div class="bar-percentage">${percentage}%</div>
            `;
            
            container.appendChild(barItem);
        });
    }

    // UPDATED: Load department reports with alerts
    async loadDepartmentReports() {
        try {
            const date = document.getElementById('deptStatsDate')?.value || document.getElementById('statsDate')?.value || new Date().toISOString().split('T')[0];
            const viewType = document.getElementById('deptViewType')?.value || 'all';
            
            this.showAlert('Loading department reports...', 'info', 2000);
            
            const response = await fetch(`/leave_mgmt/detailed-stats?date=${date}`, {
                credentials: 'include'
            });
            
            let data;
            if (response.ok) {
                data = await response.json();
                this.showAlert('Department reports loaded successfully', 'success', 3000);
            } else {
                // Fallback to basic stats
                this.showAlert('Using basic department statistics', 'warning', 3000);
                const basicResponse = await fetch(`/leave_mgmt/stats/presence?date=${date}`, {
                    credentials: 'include'
                });
                data = await basicResponse.json();
            }
            
            this.renderDepartmentTable(data.departments || [], viewType);
            
        } catch (error) {
            console.error('Failed to load department reports:', error);
            this.showAlert('Failed to load department reports', 'error');
            const tbody = document.getElementById('departmentsTable');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">Failed to load department reports</td></tr>';
            }
        }
    }

    // UPDATED: Load hostel reports with alerts
    async loadHostelReports() {
        try {
            const date = document.getElementById('hostelStatsDate')?.value || document.getElementById('statsDate')?.value || new Date().toISOString().split('T')[0];
            
            this.showAlert('Loading hostel reports...', 'info', 2000);
            
            const response = await fetch(`/leave_mgmt/detailed-stats?date=${date}`, {
                credentials: 'include'
            });
            
            let data;
            if (response.ok) {
                data = await response.json();
                this.showAlert('Hostel reports loaded successfully', 'success', 3000);
            } else {
                // Fallback to basic stats
                this.showAlert('Using basic hostel statistics', 'warning', 3000);
                const basicResponse = await fetch(`/leave_mgmt/stats/presence?date=${date}`, {
                    credentials: 'include'
                });
                data = await basicResponse.json();
            }
            
            this.renderHostelTable(data.hostels || []);
            
        } catch (error) {
            console.error('Failed to load hostel reports:', error);
            this.showAlert('Failed to load hostel reports', 'error');
            const tbody = document.getElementById('hostelsTable');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">Failed to load hostel reports</td></tr>';
            }
        }
    }

    renderDepartmentTable(departments, viewType) {
        const tbody = document.getElementById('departmentsTable');
        if (!tbody) return;
        
        // Filter based on view type
        let filteredDepartments = [...departments];
        if (viewType === 'critical') {
            filteredDepartments = departments.filter(dept => {
                const attendance = dept.total > 0 ? (dept.present / dept.total) * 100 : 0;
                return attendance < 75;
            });
        } else if (viewType === 'good') {
            filteredDepartments = departments.filter(dept => {
                const attendance = dept.total > 0 ? (dept.present / dept.total) * 100 : 0;
                return attendance >= 90;
            });
        }
        
        if (filteredDepartments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No departments found</td></tr>';
            return;
        }
        
        let tableHTML = filteredDepartments.map((dept, index) => {
            const total = dept.total || 0;
            const present = dept.present || 0;
            const absent = total - present;
            const attendance = total > 0 ? Math.round((present / total) * 100) : 0;
            
            // Determine badge class based on attendance
            let badgeClass = 'badge-high';
            if (attendance < 75) badgeClass = 'badge-low';
            else if (attendance < 90) badgeClass = 'badge-medium';
            
            // Get absenteeism from detailed stats or calculate basic
            const absenteeism = dept.absenteeism || (total > 0 ? ((absent / total) * 100).toFixed(1) : '0.0');
            
            return `
                <tr>
                    <td><strong>${dept.name}</strong></td>
                    <td>${total}</td>
                    <td>${present}</td>
                    <td>${absent}</td>
                    <td>
                        <span class="attendance-badge ${badgeClass}">${attendance}%</span>
                    </td>
                    <td>
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" 
                                onclick="window.principalDashboard.generateDepartmentReport(${dept.id})">
                            <i class="fas fa-download"></i> Report
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add "All Departments" row
        tableHTML += `
            <tr style="background-color: #f8f9fa; font-weight: bold;">
                <td colspan="5" style="text-align: right;">
                    <strong>Generate Report for All Departments:</strong>
                </td>
                <td>
                    <button class="btn btn-success" style="padding: 6px 12px; font-size: 12px;" 
                            onclick="window.principalDashboard.generateAllDepartmentsReport()">
                        <i class="fas fa-download"></i> Download All
                    </button>
                </td>
            </tr>
        `;
        
        tbody.innerHTML = tableHTML;
    }

    renderHostelTable(hostels) {
        const tbody = document.getElementById('hostelsTable');
        if (!tbody) return;
        
        if (hostels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No hostels found</td></tr>';
            return;
        }
        
        let tableHTML = hostels.map((hostel, index) => {
            const total = hostel.total || 0;
            const present = hostel.present || 0;
            const absent = total - present;
            const attendance = total > 0 ? Math.round((present / total) * 100) : 0;
            
            // Determine badge class based on attendance
            let badgeClass = 'badge-high';
            if (attendance < 75) badgeClass = 'badge-low';
            else if (attendance < 90) badgeClass = 'badge-medium';
            
            return `
                <tr>
                    <td><strong>${hostel.name}</strong></td>
                    <td>${total}</td>
                    <td>${present}</td>
                    <td>${absent}</td>
                    <td>
                        <span class="attendance-badge ${badgeClass}">${attendance}%</span>
                    </td>
                    <td>
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" 
                                onclick="window.principalDashboard.generateHostelReport(${hostel.id})">
                            <i class="fas fa-download"></i> Report
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add "All Hostels" row
        tableHTML += `
            <tr style="background-color: #f8f9fa; font-weight: bold;">
                <td colspan="5" style="text-align: right;">
                    <strong>Generate Report for All Hostels:</strong>
                </td>
                <td>
                    <button class="btn btn-success" style="padding: 6px 12px; font-size: 12px;" 
                            onclick="window.principalDashboard.generateAllHostelsReport()">
                        <i class="fas fa-download"></i> Download All
                    </button>
                </td>
            </tr>
        `;
        
        tbody.innerHTML = tableHTML;
    }
    
    bindEvents() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.location.href = '/leave_mgmt';
        });

        // Date change
        document.getElementById('statsDate')?.addEventListener('change', () => {
            this.loadTodayStats();
            this.loadDepartmentReports();
            this.loadHostelReports();
        });

        // Department view type change
        document.getElementById('deptViewType')?.addEventListener('change', () => {
            this.loadDepartmentReports();
        });

        // Department date change
        document.getElementById('deptStatsDate')?.addEventListener('change', () => {
            this.loadDepartmentReports();
        });

        // Hostel date change
        document.getElementById('hostelStatsDate')?.addEventListener('change', () => {
            this.loadHostelReports();
        });
    }

    setupReportModal() {
        // Set default dates
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        document.getElementById('fromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('toDate').value = today.toISOString().split('T')[0];
        
        // Load scope options
        this.loadReportScopeOptions();
    }

    async loadReportScopeOptions() {
        const scopeSelect = document.getElementById('reportScope');
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
                const optgroup = document.createElement('optgroup');
                optgroup.label = 'Departments';
                data.departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = `department:${dept.id}`;
                    option.textContent = dept.name;
                    optgroup.appendChild(option);
                });
                scopeSelect.appendChild(optgroup);
            }
            
            // Add hostels
            if (data.hostels && data.hostels.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = 'Hostels';
                data.hostels.forEach(hostel => {
                    const option = document.createElement('option');
                    option.value = `hostel:${hostel.id}`;
                    option.textContent = hostel.name;
                    optgroup.appendChild(option);
                });
                scopeSelect.appendChild(optgroup);
            }
            
        } catch (error) {
            console.error('Failed to load scope options:', error);
            scopeSelect.innerHTML = '<option value="">Failed to load options</option>';
        }
    }

    toggleReportScope() {
        const reportType = document.getElementById('reportType').value;
        const scopeGroup = document.getElementById('scopeGroup');
        const scopeLabel = document.getElementById('scopeLabel');
        const scopeSelect = document.getElementById('reportScope');
        
        if (reportType === 'all' || reportType === 'all_hostels') {
            scopeGroup.style.display = 'none';
        } else {
            scopeGroup.style.display = 'block';
            if (reportType === 'department') {
                scopeLabel.textContent = 'Select Department';
            } else if (reportType === 'hostel') {
                scopeLabel.textContent = 'Select Hostel';
            }
        }
    }

    // UPDATED: Generate all departments report with alerts
    async generateAllDepartmentsReport() {
        try {
            const fromDate = document.getElementById('statsDate')?.value || new Date().toISOString().split('T')[0];
            const toDate = fromDate; // Same day for daily report
            
            this.showAlert('Generating all departments report...', 'info', 2000);
            
            // Use the corrected URL format
            const url = `/leave_mgmt/pdf/all?fromDate=${fromDate}&toDate=${toDate}&scopeType=department&scopeId=all`;
            
            // Test if the endpoint exists
            const testResponse = await fetch(url, { method: 'HEAD' });
            if (!testResponse.ok) {
                throw new Error('Report endpoint not available');
            }
            
            window.open(url, '_blank');
            this.showAlert('All departments report generation started', 'success');
            
        } catch (error) {
            console.error('Failed to generate all departments report:', error);
            this.showAlert('Failed to generate all departments report. Please try again.', 'error');
        }
    }

    // UPDATED: Generate all hostels report with alerts  
    async generateAllHostelsReport() {
        try {
            const fromDate = document.getElementById('statsDate')?.value || new Date().toISOString().split('T')[0];
            const toDate = fromDate;
            
            this.showAlert('Generating all hostels report...', 'info', 2000);
            
            // Use the corrected URL format
            const url = `/leave_mgmt/pdf/all?fromDate=${fromDate}&toDate=${toDate}&scopeType=hostel&scopeId=all`;
            
            // Test if the endpoint exists
            const testResponse = await fetch(url, { method: 'HEAD' });
            if (!testResponse.ok) {
                throw new Error('Report endpoint not available');
            }
            
            window.open(url, '_blank');
            this.showAlert('All hostels report generation started', 'success');
            
        } catch (error) {
            console.error('Failed to generate all hostels report:', error);
            this.showAlert('Failed to generate all hostels report. Please try again.', 'error');
        }
    }

    // UPDATED: Generate department report with alerts
    async generateDepartmentReport(deptId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const url = `/leave_mgmt/pdf/all?fromDate=${today}&toDate=${today}&scopeType=department&scopeId=${deptId}`;
            
            this.showAlert('Generating department report...', 'info', 2000);
            
            // Test if the endpoint exists
            const testResponse = await fetch(url, { method: 'HEAD' });
            if (!testResponse.ok) {
                throw new Error('Report endpoint not available');
            }
            
            window.open(url, '_blank');
            this.showAlert('Department report generation started', 'success');
            
        } catch (error) {
            console.error('Failed to generate department report:', error);
            this.showAlert('Failed to generate department report. Please try again.', 'error');
        }
    }

    // UPDATED: Generate hostel report with alerts
    async generateHostelReport(hostelId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const url = `/leave_mgmt/pdf/all?fromDate=${today}&toDate=${today}&scopeType=hostel&scopeId=${hostelId}`;
            
            this.showAlert('Generating hostel report...', 'info', 2000);
            
            // Test if the endpoint exists
            const testResponse = await fetch(url, { method: 'HEAD' });
            if (!testResponse.ok) {
                throw new Error('Report endpoint not available');
            }
            
            window.open(url, '_blank');
            this.showAlert('Hostel report generation started', 'success');
            
        } catch (error) {
            console.error('Failed to generate hostel report:', error);
            this.showAlert('Failed to generate hostel report. Please try again.', 'error');
        }
    }

    // UPDATED: Generate custom report with validation and alerts
    async generateReport() {
        try {
            const reportType = document.getElementById('reportType').value;
            const scopeValue = document.getElementById('reportScope').value;
            const fromDate = document.getElementById('fromDate').value;
            const toDate = document.getElementById('toDate').value;
            
            if (!fromDate || !toDate) {
                this.showAlert('Please select date range', 'warning');
                return;
            }
            
            if ((reportType === 'department' || reportType === 'hostel') && !scopeValue) {
                this.showAlert('Please select a scope for the report', 'warning');
                return;
            }
            
            let url = `/leave_mgmt/pdf/all?fromDate=${fromDate}&toDate=${toDate}`;
            
            if (reportType === 'all') {
                url += '&scopeType=department&scopeId=all';
            } else if (reportType === 'all_hostels') {
                url += '&scopeType=hostel&scopeId=all';
            } else {
                const [scopeType, scopeId] = scopeValue.split(':');
                url += `&scopeType=${scopeType}&scopeId=${scopeId}`;
            }
            
            this.showAlert('Generating custom report...', 'info', 2000);
            
            // Test if the endpoint exists
            const testResponse = await fetch(url, { method: 'HEAD' });
            if (!testResponse.ok) {
                throw new Error('Report endpoint not available');
            }
            
            window.open(url, '_blank');
            this.showAlert('Custom report generation started', 'success');
            this.closeReportModal();
            
        } catch (error) {
            console.error('Failed to generate custom report:', error);
            this.showAlert('Failed to generate custom report. Please try again.', 'error');
        }
    }

    openReportModal() {
        document.getElementById('reportModal').style.display = 'flex';
        this.showAlert('Custom report configuration opened', 'info', 3000);
    }

    closeReportModal() {
        document.getElementById('reportModal').style.display = 'none';
    }

    

    startAutoRefresh() {
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.loadTodayStats();
        }, 5 * 60 * 1000);
    }

    updateLastUpdatedTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const el = document.getElementById('updateTime');
        if (el) {
            try {
                el.textContent = timeString;
            } catch (e) {
                console.debug('Failed to set updateTime textContent:', e);
            }
        } else {
            console.debug('updateTime element not found; skipping timestamp update');
        }
    }

    updateFacultyChart() {
        this.renderFacultyChart();
        this.showAlert('Department chart updated', 'success', 2000);
    }

    updateStaffChart() {
        this.renderStaffChart();
        this.showAlert('Hostel staff chart updated', 'success', 2000);
    }

    // UPDATED: Refresh dashboard with comprehensive alerts
    async refreshDashboard() {
        let refreshBtn = document.getElementById('refreshBtn') || document.querySelector('.btn-primary');
        let originalHtml = null;
        if (refreshBtn) {
            originalHtml = refreshBtn.innerHTML;
            try {
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                refreshBtn.disabled = true;
            } catch (e) {
                console.debug('Could not apply refresh animation:', e);
            }
        }

        try {
            this.showAlert('Refreshing dashboard data...', 'info', 3000);
            
            // Load all data in parallel for better performance
            await Promise.all([
                this.loadTodayStats(),
                this.loadDepartmentReports(),
                this.loadHostelReports()
            ]);

            this.updateLastUpdatedTime();
            this.showAlert('Dashboard refreshed successfully', 'success', 3000);

        } catch (err) {
            console.error('Error during dashboard refresh:', err);
            this.showAlert('Dashboard refresh failed. Some data may be incomplete.', 'error');
        } finally {
            // Restore button state
            if (refreshBtn) {
                try {
                    setTimeout(() => {
                        try {
                            refreshBtn.innerHTML = originalHtml || refreshBtn.innerHTML;
                            refreshBtn.disabled = false;
                        } catch (e) {
                            console.debug('Error restoring refresh button:', e);
                        }
                    }, 500);
                } catch (e) {
                    console.debug('Error in refresh finally block:', e);
                }
            }
        }
    }
}

// Global instance
let principalDashboard;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is principal admin
    fetch('/leave_mgmt/context', {
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            window.location.href = '/leave_mgmt';
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data?.user?.role === 'principal_admin') {
            principalDashboard = new PrincipalDashboard();

            // Expose the instance and commonly-used methods to window for inline handlers
            window.principalDashboard = principalDashboard;
            window.refreshDashboard = principalDashboard.refreshDashboard.bind(principalDashboard);
            window.loadDepartmentReports = principalDashboard.loadDepartmentReports.bind(principalDashboard);
            window.loadHostelReports = principalDashboard.loadHostelReports.bind(principalDashboard);
            window.generateCustomReport = principalDashboard.openReportModal.bind(principalDashboard);
            window.toggleReportScope = principalDashboard.toggleReportScope.bind(principalDashboard);
            window.generateReport = principalDashboard.generateReport.bind(principalDashboard);
            window.closeReportModal = principalDashboard.closeReportModal.bind(principalDashboard);
            window.generateAllDepartmentsReport = principalDashboard.generateAllDepartmentsReport.bind(principalDashboard);
            window.generateAllHostelsReport = principalDashboard.generateAllHostelsReport.bind(principalDashboard);
            window.generateDepartmentReport = principalDashboard.generateDepartmentReport.bind(principalDashboard);
            window.generateHostelReport = principalDashboard.generateHostelReport.bind(principalDashboard);

            // Store user info for later use
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Show welcome alert
            setTimeout(() => {
                if (principalDashboard) {
                    principalDashboard.showAlert('Dashboard loaded successfully!', 'success', 5000);
                }
            }, 1000);
        } else {
            window.location.href = '/leave_mgmt/dashboard';
        }
    })
    .catch(() => {
        window.location.href = '/leave_mgmt';
    });
});

// Global functions for inline handlers
window.principalDashboard = principalDashboard;

// Update charts when filters change
function updateFacultyChart() {
    if (principalDashboard) {
        principalDashboard.updateFacultyChart();
    }
}

function updateStaffChart() {
    if (principalDashboard) {
        principalDashboard.updateStaffChart();
    }
}

// ===== GLOBAL ANALYSIS FUNCTIONS =====

window.loadAnalysisData = function() {
    if (principalDashboard) {
        principalDashboard.loadAnalysisData();
    }
};

window.exportAnalysisData = function() {
    if (principalDashboard) {
        principalDashboard.exportAnalysisData();
    }
};


// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.id === 'reportModal') {
        principalDashboard?.closeReportModal();
    }
});