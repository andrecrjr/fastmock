// Content script: injects the page script and syncs rules from storage

// Safe helper: consider injected as present to avoid runtime errors
function isInjected() {
  // We cannot reliably read page-world globals from the content script due to
  // isolated worlds. Treat injection as successful after appending the tag.
  return true;
}

// Inject the page script early to override fetch/XHR in page context
(function inject() {
  try {
    // Avoid duplicate injection across extension reloads or multiple content scripts
    if (document.querySelector('script[data-source="response-replacer"]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.type = 'text/javascript';
    script.dataset.source = 'response-replacer';
    // Ensure synchronous execution order with page scripts
    script.async = false;

    // Remove the tag only after it loads to avoid cancelling execution
    script.addEventListener('load', () => {
      try {
        console.log('Mockzilla: injected.js loaded');
        script.remove();
      } catch {}
    });

    (document.documentElement || document.head || document.body).appendChild(script);
    // After a brief delay, verify it's loaded; if not, ask background to inject in MAIN world.
    setTimeout(async () => {
      if (!isInjected()) {
        try {
          const resp = await chrome.runtime.sendMessage({ type: 'INJECT_MAIN_WORLD' });
          if (!resp || !resp.ok) {
            console.warn('Mockzilla: background MAIN-world injection failed', resp?.error);
          } else {
            console.log('Mockzilla: background MAIN-world injection succeeded');
          }
        } catch (err) {
          console.warn('Mockzilla: failed to request MAIN-world injection', err);
        }
      }
      // Send rules once injection is likely in place
      try { await loadRules(); } catch {}
    }, 50);
  } catch (e) {
    console.warn('Mockzilla: failed to inject', e);
  }
})();

// Send initial rules to injected script
async function sendRulesToPage(rules) {
  window.postMessage({ __rr: true, type: 'RULES_UPDATE', rules }, '*');
}

// Load rules from chrome.storage (metadata from sync, body from local)
async function loadRules() {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) return [];
  const [metaItems, bodyItems] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null),
  ]);
  const globalEnabled = metaItems?.rr_enabled !== false; // default true when unset
  const rules = [];
  for (const key in metaItems) {
    if (key.startsWith('rr_rule_')) {
      const id = key.substring('rr_rule_'.length);
      const value = metaItems[key];
      if (value && typeof value === 'object') {
        const bodyKey = `rr_body_${id}`;
        const bodyFromLocal = bodyItems[bodyKey];
        rules.push({
          id,
          matchType: value.matchType || 'substring',
          pattern: value.pattern || '',
          enabled: value.enabled !== false, // default to true when unset
          bodyType: value.bodyType || 'text',
          statusCode: value.statusCode || 200,
          statusText: value.statusText || '',
          body: (typeof bodyFromLocal === 'string') ? bodyFromLocal : (value.body || ''),
          globalEnabled: globalEnabled // Pass global state to page script
        });
      }
    }
  }
  // Send to page
  try {
    sendRulesToPage(rules);
    console.log('Mockzilla: global enabled:', globalEnabled, 'sending', rules.length, 'rules');
  } catch {}
  return rules;
}

// Listen for changes to rules in storage and notify the page
if (window.chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync' || areaName === 'local') {
      await loadRules();
    }
  });
}

// Forward rule hits from the page to the background script
window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (!msg || !msg.__rr) return;
  if (msg.type === 'RULE_HIT') {
    chrome.runtime.sendMessage({ type: 'RULE_HIT', ruleId: msg.ruleId, url: msg.url });
  }
  // Injected script can actively request rules; respond with latest
  if (msg.type === 'REQUEST_RULES') {
    (async () => {
      try {
        await loadRules(); // loadRules will call sendRulesToPage
      } catch {}
    })();
  }
});

// Initial load
loadRules();