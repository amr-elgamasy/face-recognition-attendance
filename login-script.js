// Login credentials (stored in code - for production, use backend)
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

// Check if already logged in
window.addEventListener('load', () => {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const loginTime = localStorage.getItem('adminLoginTime');
    
    if (isLoggedIn === 'true' && loginTime) {
        // Check if login is still valid (24 hours)
        const currentTime = Date.now();
        const timeDiff = currentTime - parseInt(loginTime);
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
            // Still logged in, redirect to admin
            window.location.href = 'admin.html';
            return;
        } else {
            // Session expired
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminLoginTime');
        }
    }
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const errorMessage = document.getElementById('errorMessage');
    
    // Validate credentials
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        // Successful login
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminLoginTime', Date.now().toString());
        
        if (rememberMe) {
            localStorage.setItem('adminRememberMe', 'true');
        } else {
            localStorage.removeItem('adminRememberMe');
        }
        
        // Show success message briefly
        errorMessage.style.display = 'flex';
        errorMessage.style.background = 'rgba(16, 185, 129, 0.1)';
        errorMessage.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        errorMessage.style.color = '#10B981';
        document.getElementById('errorText').textContent = '✓ تم تسجيل الدخول بنجاح!';
        
        // Redirect to admin panel
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 500);
        
    } else {
        // Failed login
        errorMessage.style.display = 'flex';
        errorMessage.style.background = 'rgba(239, 68, 68, 0.1)';
        errorMessage.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        errorMessage.style.color = '#EF4444';
        document.getElementById('errorText').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        
        // Shake animation
        errorMessage.style.animation = 'none';
        setTimeout(() => {
            errorMessage.style.animation = 'shake 0.3s ease';
        }, 10);
        
        // Clear password field
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    }
});

// Auto-hide error message after 5 seconds
let errorTimeout;
document.getElementById('loginForm').addEventListener('input', () => {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage.style.display === 'flex') {
        clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
});
