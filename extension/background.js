// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ 
    extensionEnabled: false,
    backendStatus: 'checking'
  });
  checkBackendStatus();
});

// Check backend status periodically
async function checkBackendStatus() {
  try {
    const response = await fetch('http://localhost:5000/api/health', {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.timeout(5000)
    });
    
    const status = response.ok ? 'online' : 'offline';
    chrome.storage.sync.set({ backendStatus: status });
    
  } catch (error) {
    chrome.storage.sync.set({ backendStatus: 'offline' });
  }
}

setInterval(checkBackendStatus, 30000);

// ========== NEW: API PROXY FOR CONTENT SCRIPT ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Handle API requests from content script
  if (request.action === 'apiRequest') {
    const { url, method, body, headers } = request;
    
    fetch(url, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      credentials: 'include', // Session cookies included here
      body: body ? JSON.stringify(body) : undefined
    })
    .then(response => {
      return response.json().then(data => ({
        ok: response.ok,
        status: response.status,
        data: data
      }));
    })
    .then(result => {
      sendResponse(result);
    })
    .catch(error => {
      sendResponse({ 
        ok: false, 
        status: 0, 
        error: error.message 
      });
    });
    
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'checkBackend') {
    checkBackendStatus().then(() => {
      chrome.storage.sync.get(['backendStatus'], (data) => {
        sendResponse({ status: data.backendStatus });
      });
    });
    return true;
  }
  
  if (request.action === 'toggleExtension') {
    chrome.storage.sync.get(['extensionEnabled'], (data) => {
      const newState = !data.extensionEnabled;
      chrome.storage.sync.set({ extensionEnabled: newState });
      
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'extensionStateChanged', 
            enabled: newState 
          }).catch(() => {});
        });
      });
      
      sendResponse({ enabled: newState });
    });
    return true;
  }
});
