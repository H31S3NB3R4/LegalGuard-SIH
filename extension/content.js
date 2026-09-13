const API_BASE_URL = 'http://localhost:5000';

let isExtensionEnabled = false;
let overlayElement = null;
let currentProductUrl = '';
let isProcessing = false;

// Helper function to make API calls through background script
async function apiRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'apiRequest',
      url: `${API_BASE_URL}${endpoint}`,
      method: options.method || 'GET',
      body: options.body,
      headers: options.headers || {}
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (!response.ok) {
        reject(new Error(response.data?.error || `HTTP ${response.status}`));
        return;
      }
      
      resolve(response.data);
    });
  });
}

// Check if current page is a product page
function isProductPage() {
  const url = window.location.href;
  return (
    /\/dp\/[A-Z0-9]{10}/.test(url) ||
    /\/p\/[A-Za-z0-9-]+/.test(url) ||
    (url.includes('amazon') && url.includes('/dp/')) ||
    (url.includes('flipkart') && url.includes('/p/'))
  );
}

// Create sticky overlay
function createOverlay() {
  if (overlayElement) return;

  overlayElement = document.createElement('div');
  overlayElement.id = 'legalguard-overlay';
  overlayElement.innerHTML = `
    <div class="legalguard-card">
      <div class="legalguard-header">
        <div class="legalguard-title">
          <div class="legalguard-logo">L</div>
          <span>LegalGuard</span>
        </div>
        <button class="legalguard-close" id="legalguard-close">&#215;</button>
      </div>
      <div class="legalguard-content" id="legalguard-content">
        <div class="legalguard-status" id="legalguard-status">Ready to check compliance</div>
      </div>
      <div class="legalguard-mini" id="legalguard-mini"></div>
    </div>
  `;

  document.body.appendChild(overlayElement);

  const closeButton = document.getElementById('legalguard-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      overlayElement.classList.add('minimized');
    });
  }
  // Compact badge row re-expands the condensed report.
  const miniRow = document.getElementById('legalguard-mini');
  if (miniRow) {
    miniRow.addEventListener('click', () => {
      overlayElement.classList.remove('minimized');
    });
  }
}
function removeOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
}

function updateOverlay(content) {
  const contentDiv = document.getElementById('legalguard-content');
  if (contentDiv) {
    contentDiv.innerHTML = content;
  }
}

function showLoading(stage) {
  updateOverlay(`
    <div class="legalguard-status">${stage}</div>
    <div class="legalguard-progress">
      <div class="legalguard-progress-bar" style="width: 33%"></div>
    </div>
  `);
}

function showError(message) {
  updateOverlay(`
    <div class="legalguard-status">❌ Error</div>
    <div class="legalguard-details">${message}</div>
  `);
}

function showResult(data) {
  // Phase 12: N/A grade (indeterminate analysis) renders muted with an
  // explanatory line instead of a scary red F / 0%.
  const isNA = (data.final_grade === 'N/A' || data.final_grade === 'NA');
  const score = Number(data.compliance_score);
  // Badge color follows the design.md token scale by value:
  // >= 80 success, 40-79 warning, < 40 critical.
  const scoreClass = isNA
    ? 'legalguard-na'
    : score >= 80
      ? 'legalguard-pass'
      : score >= 40
        ? 'legalguard-warn'
        : 'legalguard-fail';
  const scoreText = data.compliance_score == null
    ? 'Not graded'
    : `Score: ${data.compliance_score}%`;
  const oneLine = isNA
    ? 'Analysis pending'
    : score >= 80
      ? 'Compliant listing'
      : score >= 40
        ? 'Needs attention'
        : 'Non-compliant listing';
  const passed = data.passed_checks || 0;
  const failed = Math.max(0, (data.total_checks || 0) - passed);
  updateOverlay(`
    <div class="legalguard-result">
      <div class="legalguard-grade">
        <div class="legalguard-grade-badge ${scoreClass}">${data.final_grade || 'N/A'}</div>
        <div>
          <div class="legalguard-score">${scoreText}</div>
          <div class="legalguard-na-note">${oneLine}</div>
        </div>
      </div>
      <div class="legalguard-stats">
        <div class="legalguard-stat">
          <div class="legalguard-stat-value legalguard-ok">${passed}</div>
          <div class="legalguard-stat-label">Passed</div>
        </div>
        <div class="legalguard-stat">
          <div class="legalguard-stat-value legalguard-bad">${failed}</div>
          <div class="legalguard-stat-label">Failed</div>
        </div>
        <div class="legalguard-stat">
          <div class="legalguard-stat-value">${data.total_checks || 0}</div>
          <div class="legalguard-stat-label">Checks</div>
        </div>
      </div>
      <button class="legalguard-button" id="legalguard-view-report">View full report</button>
    </div>
  `);

  // Compact badge shown when minimized (Phase 8: compact grade badge +
  // one-line status).
  const miniRow = document.getElementById('legalguard-mini');
  if (miniRow) {
    miniRow.innerHTML = `
      <div class="legalguard-mini-badge ${scoreClass}">${data.final_grade || 'N/A'}</div>
      <div class="legalguard-mini-line">${oneLine}<span>${scoreText}</span></div>
    `;
  }

  const viewReportBtn = document.getElementById('legalguard-view-report');
  if (viewReportBtn) {
    chrome.storage.sync.get(['userId', 'userRole'], (storage) => {
      const userId = storage.userId || 3;
      const userRole = storage.userRole || 'customer';
      viewReportBtn.addEventListener('click', () => {
        window.open(
          `http://localhost:3000/products/${data.product_id}?userId=${userId}&role=${userRole}`,
          '_blank'
        );
      });
    });
  }
}

//http://localhost:3000/products?userId=3&role=customer&productId=${data.product_id}

// Scrape and validate product using background script
async function checkCompliance() {
  if (isProcessing) return;

  const currentUrl = window.location.href;
  if (currentUrl.includes('flipkart')) {
    showError('Flipkart scraping is not yet available in LegalGuard. Please open an Amazon product page to run a compliance check.');
    return;
  }

  isProcessing = true;
  
  const url = window.location.href;
  
  chrome.storage.sync.get(['isLoggedIn'], async (storage) => {
    if (!storage.isLoggedIn) {
      showError('Please login first using the extension popup');
      isProcessing = false;
      return;
    }
    
    try {
      showLoading('🔍 Extracting product information...');
      
      // Use background script proxy instead of direct fetch
      const scrapeData = await apiRequest('/api/scrape', {
        method: 'POST',
        body: { 
          url: url.trim(),
          auto_analyze: true
        }
      });
      
      if (!scrapeData.product_id) {
        throw new Error('Product data incomplete');
      }
      
      if (scrapeData.compliance_analysis) {
        const validateData = {
          product_id: scrapeData.product_id,
          compliance_score: scrapeData.compliance_analysis.score,
          final_grade: scrapeData.compliance_analysis.grade,
          passed_checks: 10 - scrapeData.compliance_analysis.violations_count,
          total_checks: 10
        };
        showResult(validateData);
      } else {
        showLoading('⚖️ Running compliance validation...');
        
        const validateData = await apiRequest(`/api/products/validate/${scrapeData.product_id}`, {
          method: 'POST'
        });
        
        validateData.product_id = scrapeData.product_id;
        showResult(validateData);
      }
      
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Session expired')) {
        showError('Session expired. Please login again.');
        chrome.storage.sync.set({ isLoggedIn: false });
      } else {
        showError(error.message || 'Failed to check compliance');
      }
    } finally {
      isProcessing = false;
    }
  });
}

// Handle URL changes
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    handlePageChange();
  }
});

function handlePageChange() {
  if (!isExtensionEnabled) return;
  
  if (isProductPage()) {
    createOverlay();
    currentProductUrl = window.location.href;
    setTimeout(() => checkCompliance(), 1000);
  }
}

// Initialize
chrome.storage.sync.get(['extensionEnabled'], (data) => {
  isExtensionEnabled = data.extensionEnabled || false;
  
  if (isExtensionEnabled) {
    createOverlay();
    if (isProductPage()) {
      setTimeout(() => checkCompliance(), 1000);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extensionStateChanged') {
    isExtensionEnabled = request.enabled;
    
    if (isExtensionEnabled) {
      createOverlay();
      if (isProductPage()) {
        setTimeout(() => checkCompliance(), 1000);
      }
    } else {
      removeOverlay();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

if (isExtensionEnabled && isProductPage()) {
  createOverlay();
  setTimeout(() => checkCompliance(), 1000);
}
