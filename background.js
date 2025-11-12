// Background service worker: tracks per-tab rule hit counts and serves them to popup

// Use session storage to survive service worker restarts within the same browser session
async function getSession(key, defaultValue) {
  const data = await chrome.storage.session.get(key);
  return data[key] ?? defaultValue;
}

async function setSession(key, value) {
  await chrome.storage.session.set({ [key]: value });
}

async function incrementHit(sender, payload) {
  const tabId = sender?.tab?.id;
  if (!tabId || !payload?.ruleId) return;
  const hitsByTab = await getSession('hitsByTab', {});
  const tabHits = hitsByTab[tabId] ?? {};
  const ruleHits = tabHits[payload.ruleId] ?? { count: 0, lastUrl: null, lastAt: null };
  ruleHits.count += 1;
  ruleHits.lastUrl = payload.url || null;
  ruleHits.lastAt = Date.now();
  tabHits[payload.ruleId] = ruleHits;
  hitsByTab[tabId] = tabHits;
  await setSession('hitsByTab', hitsByTab);
  
  // Change the extension icon to indicate activity
  chrome.action.setIcon({
    path: {
      "16": "assets/mockzila-active.png",
      "32": "assets/mockzila-active.png", 
      "48": "assets/mockzila-active.png",
      "128": "assets/mockzila-active.png"
    }
  });
}

async function getTabHits(tabId) {
  const hitsByTab = await getSession('hitsByTab', {});
  return hitsByTab[tabId] ?? {};
}

// Function to determine and set the appropriate icon for a tab
async function updateTabIcon(tabId) {
  const hits = await getTabHits(tabId);
  const hasHits = Object.keys(hits).some(ruleId => hits[ruleId].count > 0);
  
  const iconPath = hasHits ? {
    "16": "assets/mockzila-active.png",
    "32": "assets/mockzila-active.png", 
    "48": "assets/mockzila-active.png",
    "128": "assets/mockzila-active.png"
  } : {
    "16": "assets/mockzilla.png",
    "32": "assets/mockzilla.png", 
    "48": "assets/mockzilla.png",
    "128": "assets/mockzilla.png"
  };
  
  // Update the icon for the specific tab (if available) or globally
  try {
    // First try to set for the specific tab
    if (tabId) {
      chrome.action.setIcon({
        tabId: tabId,
        path: iconPath
      });
    } else {
      // If no specific tab, set globally
      chrome.action.setIcon({
        path: iconPath
      });
    }
  } catch (error) {
    // If tab-specific icon fails (tab might not be active), set global icon
    chrome.action.setIcon({
      path: iconPath
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type === 'RULE_HIT') {
    const tabId = sender?.tab?.id;
    incrementHit(sender, message).then(() => {
      updateTabIcon(tabId); // Update icon after incrementing hit
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (type === 'GET_TAB_HITS') {
    const tabId = message?.tabId || sender?.tab?.id;
    getTabHits(tabId).then((hits) => sendResponse({ ok: true, hits })).catch(() => sendResponse({ ok: false, hits: {} }));
    return true;
  }

  if (type === 'CLEAR_TAB_HITS') {
    const tabId = message?.tabId || sender?.tab?.id;
    getSession('hitsByTab', {}).then((hitsByTab) => {
      hitsByTab[tabId] = {};
      return setSession('hitsByTab', hitsByTab);
    }).then(() => {
      updateTabIcon(tabId); // Update icon after clearing hits
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }

  // Fallback: programmatically inject injected.js into the page's MAIN world.
  // This bypasses CSP that can block <script src="chrome-extension://..."> tags.
  if (type === 'INJECT_MAIN_WORLD') {
    const tabId = message?.tabId || sender?.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No tabId to inject' });
      return true;
    }
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['injected.js'],
      world: 'MAIN',
      injectImmediately: true,
    }).then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }

  return false;
});

// Also listen for tab updates to reset icon when a tab is navigated to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Update icon when tab is fully loaded
    updateTabIcon(tabId);
  }
});

// Initialize the default icon when the service worker starts
chrome.action.setIcon({
  path: {
    "16": "assets/mockzilla.png",
    "32": "assets/mockzilla.png", 
    "48": "assets/mockzilla.png",
    "128": "assets/mockzilla.png"
  }
});