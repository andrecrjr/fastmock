// Popup script: manage rules in chrome.storage and show per-tab hit counts

const defaults = { rr_rules: [] };

// Theme management
let themePrefs = {
  theme: 'light' // 'light' | 'dark'
};

// Load theme preferences
function loadThemePrefs() {
  try {
    const raw = localStorage.getItem('mockzilla:theme-prefs');
    if (raw) {
      const obj = JSON.parse(raw);
      themePrefs = { ...themePrefs, ...obj };
    }
  } catch {}
  applyThemeToDOM();
}

// Save theme preferences
function saveThemePrefs() {
  try { 
    localStorage.setItem('mockzilla:theme-prefs', JSON.stringify(themePrefs)); 
  } catch {}
}

// Apply theme to DOM
function applyThemeToDOM() {
  const html = document.documentElement;
  // Theme
  html.setAttribute('data-theme', themePrefs.theme);
  html.classList.toggle('dark', themePrefs.theme === 'dark');
  // Some Tailwind dark-mode setups look for the class on body; add it for safety
  document.body.classList.toggle('dark', themePrefs.theme === 'dark');
}

// Get current theme
function getTheme() { 
  return themePrefs.theme; 
}

// Set theme
function setTheme(theme) { 
  themePrefs.theme = theme; 
  saveThemePrefs(); 
  applyThemeToDOM(); 
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function getRules() {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    // When running outside of an extension, there is no storage.
    return [];
  }
  const allMetaItems = await chrome.storage.sync.get(null);
  const allBodyItems = await chrome.storage.local.get(null);
  const rules = [];
  for (const key in allMetaItems) {
    if (key.startsWith('rr_rule_')) {
      const id = key.substring('rr_rule_'.length);
      const value = allMetaItems[key];
      const bodyKey = `rr_body_${id}`;
      const bodyFromLocal = allBodyItems[bodyKey];
      if (value && typeof value === 'object') {
        rules.push({
          id,
          name: value.name || '',
          matchType: value.matchType || 'substring',
          pattern: value.pattern || '',
          enabled: value.enabled !== false, // default to true when unset
          bodyType: value.bodyType || 'text',
          statusCode: value.statusCode || 200, // default to 200 when unset
          // Prefer body from local storage; fall back to any legacy body in sync
          body: (typeof bodyFromLocal === 'string') ? bodyFromLocal : (value.body || ''),
        });
      }
    }
  }
  return rules;
}

async function setRule(rule) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }
  // Write metadata to sync and body to local to avoid per-item quota
  const metaKey = `rr_rule_${rule.id}`;
  const metaValue = {
    name: rule.name || '',
    matchType: rule.matchType,
    pattern: rule.pattern,
    enabled: rule.enabled !== false, // default to true when unset
    bodyType: rule.bodyType,
    statusCode: rule.statusCode || 200,
  };
  const bodyKey = `rr_body_${rule.id}`;
  const bodyValue = rule.body ?? '';
  await Promise.all([
    chrome.storage.sync.set({ [metaKey]: metaValue }),
    chrome.storage.local.set({ [bodyKey]: bodyValue }),
  ]);
}

async function setRuleMeta(rule) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;
  const metaKey = `rr_rule_${rule.id}`;
  const metaValue = {
    name: rule.name || '',
    matchType: rule.matchType,
    pattern: rule.pattern,
    enabled: rule.enabled !== false, // default to true when unset
    bodyType: rule.bodyType,
    statusCode: rule.statusCode || 200,
  };
  await chrome.storage.sync.set({ [metaKey]: metaValue });
}

async function setRuleBody(id, body) {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;
  const bodyKey = `rr_body_${id}`;
  await chrome.storage.local.set({ [bodyKey]: body ?? '' });
}

async function deleteRule(id) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }
  const metaKey = `rr_rule_${id}`;
  const bodyKey = `rr_body_${id}`;
  await Promise.all([
    chrome.storage.sync.remove(metaKey),
    chrome.storage.local.remove(bodyKey),
  ]);
}


async function getActiveTabId() {
  if (!window.chrome || !chrome.tabs) return 0;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Track accordion open state across renders
const __accordionOpen = Object.create(null);

// Lightweight, centralized status feedback with semantic colors
function flashStatus(message, type = 'info', timeout = 2000) {
  const el = document.getElementById('statusMessage');
  if (!el) return;
  const classes = ['text-gray-600','text-blue-600','text-green-600','text-red-600'];
  classes.forEach(c => el.classList.remove(c));
  const map = { info: 'text-blue-600', success: 'text-green-600', error: 'text-red-600' };
  el.classList.add(map[type] || 'text-gray-600');
  el.textContent = message;
  setTimeout(() => {
    el.textContent = '';
    classes.forEach(c => el.classList.remove(c));
    el.classList.add('text-gray-600');
  }, timeout);
}

function isValidJSON(text) {
  try { JSON.parse(text); return true; } catch { return false; }
}

function render(rules, hits) {
  const root = document.getElementById('rules');
  
  // Filter rules to only show those with hits
  const rulesWithHits = rules.filter(rule => hits?.[rule.id]?.count > 0);
  
  if (rulesWithHits.length === 0) {
    root.innerHTML = `
      <div class="flex items-center justify-center p-8 text-center text-gray-500">
        <div>
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No rules triggered</h3>
          <p class="mt-1 text-sm text-gray-500">No mock rules have been hit in the current tab yet.</p>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = '';

  // Helper: Chevron SVG
  const chevronSvg = `
    <svg class="chevron h-4 w-4 text-gray-500 transition-transform duration-200 ease-in-out" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd" />
    </svg>`;

  // Helper: Options SVG
  const optionsSvg = `
    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path>
    </svg>`;

  rulesWithHits.forEach((rule, index) => {
    const detail = document.createElement('section');
    detail.className = 'rule card';
    detail.setAttribute('name', rule.name || `Rule ${index + 1}`);
    detail.__ruleId = rule.id;

    // Header button - showing only title, address, enabled status, and match type
    const header = document.createElement('button');
    header.className = 'w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer';
    header.id = `header-${rule.id}`;
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', `panel-${rule.id}`);
    header.setAttribute('data-acc-header', 'true');
    header.tabIndex = 0;
    header.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="truncate max-w-[200px] dark:text-white">${escapeHtml(rule.name || 'Untitled rule')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs text-gray-500 truncate max-w-[150px]">${escapeHtml(rule.pattern)}</div>
        <div class="shrink-0">${chevronSvg}</div>
      </div>
    `;

    // Panel (collapsed by default) - showing only essential information
    const panel = document.createElement('div');
    panel.id = `panel-${rule.id}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', header.id);
    panel.className = 'overflow-hidden max-h-0 transition-all duration-300 ease-in-out';

    // Panel content - showing only essential information without edit controls
    const content = document.createElement('div');
    content.className = 'px-3 pb-3 pt-0';
    content.innerHTML = `
      <div class="rule-info mb-2">
        <div class="name-info mb-2">
          <div class="label">Name</div>
          <div class="text-sm break-all">${escapeHtml(rule.name || 'No name')}</div>
        </div>
        <div class="pattern-info mb-2">
          <div class="label">Address</div>
          <div class="text-sm font-mono bg-blue-100 dark:bg-[#1b2235] max-w-[300px] p-2 rounded overflow-x-auto">${escapeHtml(rule.pattern)}</div>
        </div>
        <div class="status-info flex gap-4">
          <div>
            <div class="label">Status</div>
            <div class="text-sm ${rule.enabled ? 'text-green-600' : 'text-gray-500'}">${rule.enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div>
            <div class="label">Match Type</div>
            <div class="text-sm">${escapeHtml(rule.matchType)}</div>
          </div>
        </div>
      </div>
    `;

    panel.appendChild(content);
    detail.appendChild(header);
    detail.appendChild(panel);


    function setOpen(isOpen) {
      header.setAttribute('aria-expanded', String(!!isOpen));
      const chevron = header.querySelector('.chevron');
      if (chevron) {
        chevron.classList.toggle('rotate-180', !!isOpen);
      }
      // Use Tailwind classes to animate height
      panel.classList.toggle('max-h-0', !isOpen);
      panel.classList.toggle('max-h-[500px]', !!isOpen);
      __accordionOpen[rule.id] = !!isOpen;
      if (isOpen) {
        // Focus first interactive element for accessibility
        setTimeout(() => { try { nameEl.focus(); } catch {} }, 150);
      }
    }

    header.addEventListener('click', (e) => {
      // Don't toggle if clicked on the options button or dropdown
      if (!e.target.closest('.options-btn') && !e.target.closest('.options-dropdown')) {
        const nowOpen = header.getAttribute('aria-expanded') !== 'true';
        setOpen(nowOpen);
      }
    });
    header.addEventListener('keydown', (ev) => {
      const key = ev.key;
      const headers = Array.from(root.querySelectorAll('[data-acc-header]'));
      const idx = headers.indexOf(header);
      if (key === 'Enter' || key === ' ') {
        ev.preventDefault();
        // Don't trigger if we're focused on the options button
        if (!ev.target.closest('.options-btn')) {
          header.click();
        }
      } else if (key === 'ArrowDown') {
        ev.preventDefault();
        const next = headers[idx + 1] || headers[0];
        next?.focus();
      } else if (key === 'ArrowUp') {
        ev.preventDefault();
        const prev = headers[idx - 1] || headers[headers.length - 1];
        prev?.focus();
      } else if (key === 'Home') {
        ev.preventDefault();
        headers[0]?.focus();
      } else if (key === 'End') {
        ev.preventDefault();
        headers[headers.length - 1]?.focus();
      }
    });

    // Apply initial open state
    setOpen(__accordionOpen[rule.id] === true);

    root.appendChild(detail);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}



document.getElementById('openOptions').addEventListener('click', async () => {
  if (window.chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    // Fallback: open in a new tab
    const url = chrome.runtime.getURL('options.html');
    const tab = await chrome.tabs.create({ url });
    console.log('Mockzilla: opened options page in tab', tab.id);
  }
});

document.getElementById('clearHits').addEventListener('click', async () => {
  const tabId = await getActiveTabId();
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
    await chrome.runtime.sendMessage({ type: 'CLEAR_TAB_HITS', tabId });
  }
  await refresh();
});

// Theme toggle button
document.getElementById('settingsBtn').addEventListener('click', () => {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  flashStatus(`Theme: ${next}`, 'info');
});



async function refresh() {
  try {
    const rules = await getRules();
    const tabId = await getActiveTabId();
    let hits = {};
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_TAB_HITS', tabId });
      hits = resp?.hits || {};
    }
    render(rules, hits);
  } catch (e) {
    console.error('Error refreshing popup:', e);
    const root = document.getElementById('rules');
    if (root) {
      root.innerHTML = `<div class="card p-3 text-sm text-red-700 bg-red-50 border-red-200">Error loading rules. See console for details.</div>`;
    }
  }
}

// Toggle: enable/disable data processing rules
(function initToggle() {
  const btn = document.getElementById('toggleRules');
  const statusEl = document.getElementById('statusMessage');
  if (!btn) return;

  function showStatus(message, type = 'info') { flashStatus(message, type); }

  async function getEnabled() {
    if (!window.chrome || !chrome.storage || !chrome.storage.sync) return true;
    const { rr_enabled } = await chrome.storage.sync.get('rr_enabled');
    return rr_enabled !== false; // default to true when unset
  }

  async function setEnabled(enabled) {
    if (window.chrome && chrome.storage && chrome.storage.sync) {
      await chrome.storage.sync.set({ rr_enabled: !!enabled });
    }
    try {
      console.log('Rules enabled state changed:', !!enabled);
    } catch {}
  }

  function updateButtonUI(enabled) {
    const isOn = !!enabled;
    btn.classList.toggle('on', isOn);
    btn.classList.toggle('off', !isOn);
    // Apply Tailwind styling dynamically
    const base = ['text-xs','font-semibold','rounded-full','px-3','py-1','border','focus:outline-none','focus:ring-2','focus:ring-blue-500'];
    base.forEach(cls => btn.classList.add(cls));
    btn.classList.remove('bg-green-600','border-green-700','bg-red-600','border-red-700');
    if (isOn) {
      btn.classList.add('bg-green-600','border-green-700','text-white');
      btn.classList.remove('bg-red-600','border-red-700');
    } else {
      btn.classList.add('bg-red-600','border-red-700','text-white');
      btn.classList.remove('bg-green-600','border-green-700');
    }
    btn.setAttribute('aria-checked', String(isOn));
    btn.textContent = isOn ? 'Disable Rules' : 'Enable Rules';
  }

  async function applyInitial() {
    const enabled = await getEnabled();
    updateButtonUI(enabled);
  }

  btn.addEventListener('click', async () => {
    const currentlyEnabled = btn.classList.contains('on');
    if (currentlyEnabled) {
      const ok = confirm('Disabling rules may allow real responses through and could cause data discrepancies. Continue?');
      if (!ok) {
        return; // abort change
      }
    }
    const next = !currentlyEnabled;
    await setEnabled(next);
    updateButtonUI(next);
    showStatus(next ? 'Rules enabled' : 'Rules disabled', next ? 'success' : 'info');
  });

  btn.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      btn.click();
    }
  });

  applyInitial();
})();

loadThemePrefs();
refresh();