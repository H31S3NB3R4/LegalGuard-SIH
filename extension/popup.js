const API_BASE_URL = 'http://localhost:5000';

// DOM elements - Auth
const loginContainer = document.getElementById('loginContainer');
const signupContainer = document.getElementById('signupContainer');
const mainApp = document.getElementById('mainApp');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');

// Forms
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// Role selector
const roleBtns = document.querySelectorAll('.role-btn');
let selectedRole = 'customer';

// Main app elements
const backendDot = document.getElementById('backendDot');
const statusText = document.getElementById('statusText');
const toggleBtn = document.getElementById('toggleBtn');
const toggleIcon = document.getElementById('pd-toggle-icon');
const toggleText = document.getElementById('toggleText');
const logsContainer = document.getElementById('logsContainer');
const demoBanner = document.getElementById('demoBanner');
const logoutBtn = document.getElementById('logoutBtn');
const displayUsername = document.getElementById('displayUsername');
const displayRole = document.getElementById('displayRole');

// ==================== UTILITY FUNCTIONS ====================

function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 4000);
}

function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `
    <span>${time}</span>
    <span class="pd-log-msg ${type}">${message}</span>
  `;
  logsContainer.insertBefore(logEntry, logsContainer.firstChild);
  
  while (logsContainer.children.length > 10) {
    logsContainer.removeChild(logsContainer.lastChild);
  }
}

function updateBackendStatus(status) {
  if (status === 'online') {
    backendDot.classList.remove('inactive');
    statusText.textContent = '🟢 Backend Connected';
    addLog('Backend is online', 'success');
  } else {
    backendDot.classList.add('inactive');
    statusText.textContent = '⚫ Backend Offline';
    addLog('Backend is offline', 'error');
  }
}

function updateToggleUI(enabled) {
  if (enabled) {
    toggleIcon.textContent = '🟢';
    toggleText.textContent = 'Disable Extension';
    toggleBtn.style.background = 'rgba(16, 185, 129, 0.3)';
    addLog('Extension enabled', 'success');
  } else {
    toggleIcon.textContent = '🔴';
    toggleText.textContent = 'Enable Extension';
    toggleBtn.style.background = 'rgba(103, 126, 234, 0.3)';
    addLog('Extension disabled', 'info');
  }
}

function updateDemoBanner(demoMode) {
  if (demoBanner) {
    demoBanner.style.display = demoMode ? 'block' : 'none';
  }
}

async function checkBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      credentials: 'include', // Important: include cookies
      signal: AbortSignal.timeout(5000)
    });
    
    const status = response.ok ? 'online' : 'offline';
    chrome.storage.sync.set({ backendStatus: status });
    updateBackendStatus(status);

    if (response.ok) {
      const data = await response.json();
      updateDemoBanner(Boolean(data.demo_mode));
    } else {
      updateDemoBanner(false);
    }
    
  } catch (error) {
    chrome.storage.sync.set({ backendStatus: 'offline' });
    updateBackendStatus('offline');
    updateDemoBanner(false);
  }
}

// ==================== AUTH FUNCTIONS ====================

// Toggle between login and signup
showSignupBtn.addEventListener('click', () => {
  loginContainer.classList.add('hidden');
  signupContainer.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', () => {
  signupContainer.classList.add('hidden');
  loginContainer.classList.remove('hidden');
});

// Role selector
roleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    roleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRole = btn.dataset.role;
  });
});

// Login handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    showError(loginError, 'Please fill in all fields');
    return;
  }
  
  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: store session cookies
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Save user data to chrome storage
      chrome.storage.sync.set({
        isLoggedIn: true,
        userId: data.user.id,
        username: data.user.username,
        userRole: data.user.role
      });
      
      // Show main app
      showMainApp(data.user);
      
    } else {
      showError(loginError, data.error || 'Login failed');
    }
    
  } catch (error) {
    showError(loginError, 'Connection error. Check if backend is running.');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

// Signup handler
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  
  if (!username || !password) {
    showError(signupError, 'Please fill in all fields');
    return;
  }
  
  if (password.length < 6) {
    showError(signupError, 'Password must be at least 6 characters');
    return;
  }
  
  const signupBtn = document.getElementById('signupBtn');
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: store session cookies
      body: JSON.stringify({ username, password, role: selectedRole })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Auto-login after signup
      chrome.storage.sync.set({
        isLoggedIn: true,
        userId: data.user_id,
        username: data.username,
        userRole: data.role
      });
      
      showMainApp({ id: data.user_id, username: data.username, role: data.role });
      
    } else {
      showError(signupError, data.error || 'Signup failed');
    }
    
  } catch (error) {
    showError(signupError, 'Connection error. Check if backend is running.');
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE_URL}/api/logout`, { 
      method: 'POST',
      credentials: 'include' // Important: clear session cookies
    });
  } catch (error) {
    console.error('Logout API error:', error);
  }
  
  // Clear storage
  chrome.storage.sync.set({
    isLoggedIn: false,
    userId: null,
    username: null,
    userRole: null
  });
  
  // Show login screen
  mainApp.classList.remove('active');
  loginContainer.classList.remove('hidden');
  signupContainer.classList.add('hidden');
});

// Show main app after login
function showMainApp(user) {
  loginContainer.classList.add('hidden');
  signupContainer.classList.add('hidden');
  mainApp.classList.add('active');
  
  displayUsername.textContent = user.username;
  displayRole.textContent = user.role;
  
  addLog(`Logged in as ${user.username} (${user.role})`, 'success');
  
  // Check backend and initialize
  checkBackend();
  
  chrome.storage.sync.get(['extensionEnabled', 'backendStatus'], (data) => {
    updateToggleUI(data.extensionEnabled || false);
    updateBackendStatus(data.backendStatus || 'checking');
  });
}

// ==================== MAIN APP FUNCTIONS ====================

// Toggle extension
toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'toggleExtension' }, (response) => {
    if (response && response.enabled !== undefined) {
      updateToggleUI(response.enabled);
    }
  });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.extensionEnabled) {
    updateToggleUI(changes.extensionEnabled.newValue);
  }
  if (changes.backendStatus) {
    updateBackendStatus(changes.backendStatus.newValue);
  }
});

// ==================== INITIALIZATION ====================

// Check if user is already logged in
chrome.storage.sync.get(['isLoggedIn', 'userId', 'username', 'userRole'], (data) => {
  if (data.isLoggedIn && data.username) {
    showMainApp({
      id: data.userId,
      username: data.username,
      role: data.userRole
    });
  } else {
    // Show login screen
    loginContainer.classList.remove('hidden');
  }
});
