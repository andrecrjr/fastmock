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
}

async function getTabHits(tabId) {
  const hitsByTab = await getSession('hitsByTab', {});
  return hitsByTab[tabId] ?? {};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type === 'RULE_HIT') {
    incrementHit(sender, message).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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