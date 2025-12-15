// Admin Panel Script

// Check if user is logged in
function checkAuth() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const loginTime = localStorage.getItem('adminLoginTime');
    
    if (isLoggedIn !== 'true' || !loginTime) {
        // Not logged in, redirect to login page
        window.location.href = 'login.html';
        return false;
    }
    
    // Check if login is still valid (24 hours)
    const currentTime = Date.now();
    const timeDiff = currentTime - parseInt(loginTime);
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff >= 24) {
        // Session expired
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminLoginTime');
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// Check auth before loading
if (!checkAuth()) {
    // Stop execution if not authenticated
    throw new Error('Not authenticated');
}

// Logout functionality
document.addEventListener('DOMContentLoaded', () => {
    // Add logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                localStorage.removeItem('adminLoggedIn');
                localStorage.removeItem('adminLoginTime');
                window.location.href = 'login.html';
            }
        });
    }
    
    initializeNavigation();
    loadDashboard();
    loadEmployees();
    loadRecords();
    loadSettings();
});

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items and pages
            navItems.forEach(nav => nav.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Show corresponding page
            const targetPage = item.getAttribute('data-page');
            document.getElementById(targetPage).classList.add('active');
            
            // Reload data based on page
            if (targetPage === 'dashboard') loadDashboard();
            else if (targetPage === 'employees') loadEmployees();
            else if (targetPage === 'records') loadRecords();
            else if (targetPage === 'settings') loadSettings();
        });
    });
}

// Dashboard Functions
function loadDashboard() {
    const stats = JSON.parse(localStorage.getItem('stats')) || { 
        checkin: 0, 
        checkout: 0 
    };
    const registeredFacesObj = JSON.parse(localStorage.getItem('registeredFaces')) || {};
    const registeredFaces = Object.values(registeredFacesObj);
    const attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
    
    // Update stats
    document.getElementById('totalEmployees').textContent = registeredFaces.length;
    document.getElementById('totalRecords').textContent = attendanceRecords.length;
    
    // Load today's records
    const today = new Date().toDateString();
    const todayRecords = attendanceRecords.filter(r => {
        return new Date(r.timestamp).toDateString() === today;
    });
    
    const todayCheckIns = todayRecords.filter(r => r.type === 'checkin').length;
    const todayCheckOuts = todayRecords.filter(r => r.type === 'checkout').length;
    
    document.getElementById('todayCheckin').textContent = todayCheckIns;
    document.getElementById('todayCheckout').textContent = todayCheckOuts;
    
    const recentActivity = attendanceRecords.slice(-5).reverse();
    const tbody = document.querySelector('#dashboard .data-table tbody');
    tbody.innerHTML = '';
    
    if (recentActivity.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">لا توجد سجلات حديثة</td></tr>';
        return;
    }
    
    recentActivity.forEach(record => {
        const row = document.createElement('tr');
        const time = new Date(record.timestamp).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const date = new Date(record.timestamp).toLocaleDateString('ar-EG');
        const type = record.type === 'checkin' ? 'حضور' : 'انصراف';
        const badgeClass = record.type === 'checkin' ? 'badge-success' : 'badge-warning';
        
        row.innerHTML = `
            <td>${record.userName || record.name || 'غير محدد'}</td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
            <td>${time}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(row);
    });
}

// Employees Functions
function loadEmployees() {
    const registeredFacesObj = JSON.parse(localStorage.getItem('registeredFaces')) || {};
    const registeredFaces = Object.values(registeredFacesObj);
    const searchInput = document.getElementById('searchEmployee');
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.trim().toLowerCase();
            displayEmployees(registeredFaces, searchTerm);
        });
    }
    
    displayEmployees(registeredFaces);
}

function displayEmployees(employees, searchTerm = '') {
    const grid = document.getElementById('employeesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const filteredEmployees = searchTerm 
        ? employees.filter(emp => 
            (emp.userName || emp.name || '').toLowerCase().includes(searchTerm) ||
            (emp.userId || emp.employeeId || '').toLowerCase().includes(searchTerm) ||
            (emp.department || '').toLowerCase().includes(searchTerm)
        )
        : employees;
    
    if (filteredEmployees.length === 0) {
        grid.innerHTML = `
            <div class="no-employees">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16,13C15.71,13 15.38,13.02 15.03,13.05C16.19,13.89 17,15.02 17,16.5V19H23V16.5C23,14.17 18.33,13 16,13M8,13C5.67,13 1,14.17 1,16.5V19H15V16.5C15,14.17 10.33,13 8,13M8,11A3,3 0 0,0 11,8A3,3 0 0,0 8,5A3,3 0 0,0 5,8A3,3 0 0,0 8,11M16,11A3,3 0 0,0 19,8A3,3 0 0,0 16,5A3,3 0 0,0 13,8A3,3 0 0,0 16,11Z"/>
                </svg>
                <p>لا يوجد موظفين مطابقين للبحث</p>
            </div>
        `;
        return;
    }
    
    // Get attendance stats for each employee
    const attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
    
    filteredEmployees.forEach(employee => {
        const empId = employee.userId || employee.employeeId;
        const empName = employee.userName || employee.name;
        const regDate = employee.registeredAt ? new Date(employee.registeredAt).toLocaleDateString('ar-EG') : 'غير محدد';
        const regTime = employee.registeredAt ? new Date(employee.registeredAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
        
        // Calculate employee stats
        const empRecords = attendanceRecords.filter(r => (r.userId || r.employeeId) === empId);
        const totalCheckins = empRecords.filter(r => r.type === 'checkin').length;
        const totalCheckouts = empRecords.filter(r => r.type === 'checkout').length;
        
        // Get last attendance
        const lastRecord = empRecords[0];
        let lastActivity = 'لم يسجل بعد';
        if (lastRecord) {
            const lastDate = new Date(lastRecord.timestamp).toLocaleDateString('ar-EG');
            const lastTime = new Date(lastRecord.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            const lastType = lastRecord.type === 'checkin' ? 'حضور' : 'انصراف';
            lastActivity = `${lastType} - ${lastDate} ${lastTime}`;
        }
        
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.innerHTML = `
            <div class="employee-card-header">
                <img src="${employee.faceImage || employee.image}" alt="${empName}" class="employee-avatar">
                <div class="employee-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M16.59,7.58L10,14.17L7.41,11.59L6,13L10,17L18,9L16.59,7.58Z"/>
                    </svg>
                    مفعل
                </div>
            </div>
            
            <div class="employee-card-body">
                <h3 class="employee-name">${empName}</h3>
                
                <div class="employee-info">
                    <div class="info-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9Z"/>
                        </svg>
                        <span class="info-label">الرقم الوظيفي:</span>
                        <span class="info-value">${empId}</span>
                    </div>
                    
                    <div class="info-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,3L1,9L5,11.18V17.18L12,21L19,17.18V11.18L21,10.09V17H23V9L12,3M18.82,9L12,12.72L5.18,9L12,5.28L18.82,9M17,15.99L12,18.72L7,15.99V12.27L12,15L17,12.27V15.99Z"/>
                        </svg>
                        <span class="info-label">القسم:</span>
                        <span class="info-value">${employee.department || 'غير محدد'}</span>
                    </div>
                    
                    <div class="info-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z"/>
                        </svg>
                        <span class="info-label">تاريخ التسجيل:</span>
                        <span class="info-value">${regDate} ${regTime}</span>
                    </div>
                    
                    <div class="info-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                        </svg>
                        <span class="info-label">آخر نشاط:</span>
                        <span class="info-value">${lastActivity}</span>
                    </div>
                </div>
                
                <div class="employee-stats">
                    <div class="stat-box stat-success">
                        <div class="stat-number">${totalCheckins}</div>
                        <div class="stat-label">حضور</div>
                    </div>
                    <div class="stat-box stat-warning">
                        <div class="stat-number">${totalCheckouts}</div>
                        <div class="stat-label">انصراف</div>
                    </div>
                    <div class="stat-box stat-info">
                        <div class="stat-number">${empRecords.length}</div>
                        <div class="stat-label">إجمالي</div>
                    </div>
                </div>
            </div>
            
            <div class="employee-card-footer">
                <button class="btn-action btn-delete" onclick="deleteEmployee('${empId}')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                    </svg>
                    حذف
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function viewEmployeeDetails(employeeId) {
    const registeredFacesObj = JSON.parse(localStorage.getItem('registeredFaces')) || {};
    const employee = registeredFacesObj[employeeId];
    const attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
    
    if (!employee) return;
    
    const empName = employee.userName || employee.name;
    const regDate = employee.registeredAt ? new Date(employee.registeredAt).toLocaleDateString('ar-EG') : 'غير محدد';
    const regTime = employee.registeredAt ? new Date(employee.registeredAt).toLocaleTimeString('ar-EG') : '';
    
    // Get employee records
    const empRecords = attendanceRecords.filter(r => (r.userId || r.employeeId) === employeeId);
    const totalCheckins = empRecords.filter(r => r.type === 'checkin').length;
    const totalCheckouts = empRecords.filter(r => r.type === 'checkout').length;
    
    // Get last 5 records
    const recentRecords = empRecords.slice(0, 5).map(r => {
        const date = new Date(r.timestamp).toLocaleDateString('ar-EG');
        const time = new Date(r.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const type = r.type === 'checkin' ? 'حضور' : 'انصراف';
        return `${type} - ${date} ${time}`;
    }).join('\n');
    
    alert(`
━━━━━━━━━━━━━━━━━━━━━
👤 بيانات الموظف
━━━━━━━━━━━━━━━━━━━━━

الاسم: ${empName}
الرقم الوظيفي: ${employeeId}
القسم: ${employee.department || 'غير محدد'}
تاريخ التسجيل: ${regDate} ${regTime}

━━━━━━━━━━━━━━━━━━━━━
📊 إحصائيات الحضور
━━━━━━━━━━━━━━━━━━━━━

إجمالي الحضور: ${totalCheckins}
إجمالي الانصراف: ${totalCheckouts}
إجمالي السجلات: ${empRecords.length}

${recentRecords ? '━━━━━━━━━━━━━━━━━━━━━\n🕒 آخر 5 سجلات\n━━━━━━━━━━━━━━━━━━━━━\n\n' + recentRecords : ''}
    `);
}

function viewEmployee(employeeId) {
    viewEmployeeDetails(employeeId);
}

function deleteEmployee(employeeId) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
    
    let registeredFaces = JSON.parse(localStorage.getItem('registeredFaces')) || {};
    let attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
    
    // Remove employee
    delete registeredFaces[employeeId];
    
    // Remove employee's records
    attendanceRecords = attendanceRecords.filter(record => 
        (record.userId || record.employeeId) !== employeeId
    );
    
    // Recalculate stats
    const stats = calculateStats(attendanceRecords);
    
    localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    localStorage.setItem('stats', JSON.stringify(stats));
    
    loadEmployees();
    alert('تم حذف الموظف بنجاح');
}

// Records Functions
function loadRecords() {
    const attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
    const filterSelect = document.getElementById('filterType');
    const exportBtn = document.getElementById('exportRecords');
    
    // Filter functionality
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            const filterType = filterSelect.value;
            displayRecords(attendanceRecords, filterType);
        });
    }
    
    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', exportRecords);
    }
    
    displayRecords(attendanceRecords);
}

function displayRecords(records, filterType = 'all') {
    const tbody = document.querySelector('#records .data-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const filteredRecords = filterType === 'all' 
        ? records 
        : records.filter(record => record.type === filterType);
    
    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">لا توجد سجلات</td></tr>';
        return;
    }
    
    // Sort by newest first
    filteredRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    filteredRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        const time = new Date(record.timestamp).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const date = new Date(record.timestamp).toLocaleDateString('ar-EG');
        const type = record.type === 'checkin' ? 'حضور' : 'انصراف';
        const badgeClass = record.type === 'checkin' ? 'badge-success' : 'badge-warning';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.userName || record.name || 'غير محدد'}</td>
            <td>${record.userId || record.employeeId || 'غير محدد'}</td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
            <td>${time}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(row);
    });
}

function exportRecords() {
    const attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
    const registeredFaces = JSON.parse(localStorage.getItem('registeredFaces')) || [];
    const stats = JSON.parse(localStorage.getItem('stats')) || {};
    
    const data = {
        exportDate: new Date().toISOString(),
        employees: registeredFaces,
        records: attendanceRecords,
        stats: stats
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('تم تصدير البيانات بنجاح');
}

// Settings Functions
function loadSettings() {
    const systemSettings = JSON.parse(localStorage.getItem('systemSettings')) || {
        checkinTime: '09:00',
        checkoutTime: '17:00'
    };
    
    const checkinTimeInput = document.getElementById('checkinTime');
    const checkoutTimeInput = document.getElementById('checkoutTime');
    const saveBtn = document.getElementById('saveSettings');
    const exportBtn = document.getElementById('exportAllData');
    const clearBtn = document.getElementById('clearAllData');
    
    if (checkinTimeInput) checkinTimeInput.value = systemSettings.checkinTime;
    if (checkoutTimeInput) checkoutTimeInput.value = systemSettings.checkoutTime;
    
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    if (exportBtn) exportBtn.addEventListener('click', exportRecords);
    if (clearBtn) clearBtn.addEventListener('click', deleteAllData);
}

function saveSettings() {
    const checkinTime = document.getElementById('checkinTime').value;
    const checkoutTime = document.getElementById('checkoutTime').value;
    
    if (!checkinTime || !checkoutTime) {
        alert('يرجى إدخال جميع الأوقات');
        return;
    }
    
    const systemSettings = {
        checkinTime: checkinTime,
        checkoutTime: checkoutTime
    };
    
    localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
    alert('تم حفظ الإعدادات بنجاح');
}

function deleteAllData() {
    const confirmed = confirm('تحذير: سيتم حذف جميع البيانات بشكل نهائي. هل أنت متأكد؟');
    if (!confirmed) return;
    
    const doubleConfirm = confirm('هل أنت متأكد تماماً؟ لا يمكن التراجع عن هذا الإجراء');
    if (!doubleConfirm) return;
    
    localStorage.removeItem('registeredFaces');
    localStorage.removeItem('attendanceRecords');
    localStorage.removeItem('stats');
    
    alert('تم حذف جميع البيانات بنجاح');
    
    // Reload all data
    loadDashboard();
    loadEmployees();
    loadRecords();
}

// Helper Functions
function calculateStats(records) {
    const checkIns = records.filter(r => r.type === 'checkin').length;
    const checkOuts = records.filter(r => r.type === 'checkout').length;
    
    return {
        totalCheckIns: checkIns,
        totalCheckOuts: checkOuts
    };
}
