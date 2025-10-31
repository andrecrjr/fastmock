// Options script: manage rules in chrome.storage with enhanced UI

const defaults = { rr_rules: [] };

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

// Track currently selected rule
let selectedRuleId = null;

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderRulesList(rules) {
  const root = document.getElementById('rulesList');
  root.innerHTML = '';

  if (rules.length === 0) {
    root.innerHTML = '<div class="text-center text-gray-500 p-4 text-sm">No rules defined</div>';
    return;
  }

  rules.forEach((rule, index) => {
    const ruleItem = document.createElement('div');
    ruleItem.className = `rule-item p-2 rounded cursor-pointer flex items-center justify-between ${selectedRuleId === rule.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`;
    ruleItem.dataset.ruleId = rule.id;

    ruleItem.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
        <div class="text-xs text-gray-500 truncate">${escapeHtml(rule.pattern)}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs ${rule.enabled ? 'text-green-500' : 'text-gray-400'}">${rule.enabled ? 'ON' : 'OFF'}</span>
        <button class="delete-btn text-red-500 hover:text-red-700" title="Delete rule">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;

    ruleItem.addEventListener('click', () => {
      selectRule(rule.id);
    });

    const deleteBtn = ruleItem.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete rule "${rule.name || 'Untitled rule'}"?`)) {
        await deleteRule(rule.id);
        await refresh();
        // If deleted rule was selected, clear selection
        if (selectedRuleId === rule.id) {
          selectedRuleId = null;
          renderRuleDetails(null);
        }
        flashStatus('Rule deleted', 'success');
      }
    });

    root.appendChild(ruleItem);
  });
}

function selectRule(ruleId) {
  selectedRuleId = ruleId;
  renderRulesList(window.currentRules || []);
  const rule = window.currentRules?.find(r => r.id === ruleId) || null;
  renderRuleDetails(rule);
}

function renderRuleDetails(rule) {
  const detailsContainer = document.getElementById('ruleDetails');
  
  if (!rule) {
    detailsContainer.innerHTML = `
      <div class="text-center text-gray-500 p-8">
        <div class="mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-1">Select a rule to manage</h3>
        <p class="text-gray-500">Choose a rule from the sidebar to view and edit its details</p>
      </div>
    `;
    return;
  }

  detailsContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-gray-900">Rule Details</h2>
        <div class="flex items-center gap-2">
          <label class="switch flex items-center cursor-pointer">
            <input type="checkbox" class="enabled-toggle" ${rule.enabled ? 'checked' : ''} aria-label="Enable rule" />
            <span class="slider ml-2"></span>
          </label>
          <span class="ml-2 text-sm ${rule.enabled ? 'text-green-600' : 'text-gray-500'}">${rule.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label block mb-1">Rule Name</label>
          <input class="name input w-full" placeholder="Rule name" value="${escapeHtml(rule.name || '')}" aria-label="Rule name" />
        </div>
        
        <div>
          <label class="label block mb-1">Match Type</label>
          <select class="matchType select w-full" aria-label="Match type">
            <option value="substring" ${rule.matchType === 'substring' ? 'selected' : ''}>Substring</option>
            <option value="exact" ${rule.matchType === 'exact' ? 'selected' : ''}>Exact</option>
          </select>
        </div>
        
        <div class="md:col-span-2">
          <label class="label block mb-1">URL Pattern</label>
          <input class="pattern input w-full" placeholder="URL pattern" value="${escapeHtml(rule.pattern)}" aria-label="URL pattern" />
        </div>
        
        <div>
          <label class="label block mb-1">Response Type</label>
          <select class="bodyType select w-full" aria-label="Body type">
            <option value="text" ${rule.bodyType === 'text' ? 'selected' : ''}>Text</option>
            <option value="json" ${rule.bodyType === 'json' ? 'selected' : ''}>JSON</option>
          </select>
        </div>
      </div>
      
      <div>
        <label class="label block mb-1">Response Body</label>
        <textarea class="body textarea" placeholder="Replacement body" aria-label="Replacement body">${escapeHtml(rule.body)}</textarea>
        <div class="validation text-xs text-red-600 mt-1 hidden" data-error="json" role="alert"></div>
      </div>
    </div>
  `;

  // Wire up the event listeners
  const nameEl = detailsContainer.querySelector('.name');
  const matchTypeEl = detailsContainer.querySelector('.matchType');
  const patternEl = detailsContainer.querySelector('.pattern');
  const bodyTypeEl = detailsContainer.querySelector('.bodyType');
  const bodyEl = detailsContainer.querySelector('.body');
  const enabledToggle = detailsContainer.querySelector('.enabled-toggle');

  nameEl.addEventListener('input', async () => {
    rule.name = nameEl.value;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || []); // Update the sidebar
    flashStatus('Name saved', 'success');
  });

  matchTypeEl.addEventListener('change', async () => {
    rule.matchType = matchTypeEl.value;
    await setRuleMeta(rule);
    flashStatus('Match type updated', 'success');
  });

  patternEl.addEventListener('input', async () => {
    rule.pattern = patternEl.value;
    await setRuleMeta(rule);
    flashStatus('Pattern saved', 'success');
  });

  enabledToggle.addEventListener('change', async () => {
    rule.enabled = enabledToggle.checked;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || []); // Update the sidebar display
    flashStatus(rule.enabled ? 'Rule enabled' : 'Rule disabled', 'success');
  });

  bodyTypeEl.addEventListener('change', async () => {
    rule.bodyType = bodyTypeEl.value;
    await setRuleMeta(rule);
    // Revalidate JSON when switching types
    const errorEl = detailsContainer.querySelector('[data-error="json"]');
    if (errorEl) errorEl.classList.add('hidden');
    bodyEl.removeAttribute('aria-invalid');
    bodyEl.classList.remove('ring-1','ring-red-300','border-red-500','ring-green-300','border-green-500');
    flashStatus('Body type updated', 'success');
  });

  bodyEl.addEventListener('input', async () => {
    rule.body = bodyEl.value;
    await setRuleBody(rule.id, rule.body);
    if (rule.bodyType === 'json') {
      const ok = isValidJSON(rule.body);
      const errorEl = detailsContainer.querySelector('[data-error="json"]');
      if (!ok) {
        bodyEl.setAttribute('aria-invalid','true');
        bodyEl.classList.remove('ring-green-300','border-green-500');
        bodyEl.classList.add('ring-1','ring-red-300','border-red-500');
        if (errorEl) { errorEl.textContent = 'Invalid JSON. It will be returned as text.'; errorEl.classList.remove('hidden'); }
        flashStatus('Invalid JSON', 'error');
      } else {
        bodyEl.removeAttribute('aria-invalid');
        bodyEl.classList.remove('ring-1','ring-red-300','border-red-500');
        bodyEl.classList.add('ring-green-300','border-green-500');
        if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
        flashStatus('Body saved', 'success');
      }
    } else {
      flashStatus('Body saved', 'success');
    }
  });
}

document.getElementById('addRule').addEventListener('click', async () => {
  const newRule = { id: uid(), name: '', matchType: 'substring', pattern: '', enabled: true, bodyType: 'text', body: '' };
  await setRule(newRule);
  await refresh();
  // Automatically select the new rule
  selectRule(newRule.id);
  flashStatus('New rule added', 'success');
});

// Export rules functionality
document.getElementById('exportRules').addEventListener('click', async () => {
  const rules = await getRules();
  // Create a minimal representation that excludes internal properties
  const rulesForExport = rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    matchType: rule.matchType,
    pattern: rule.pattern,
    enabled: rule.enabled,
    bodyType: rule.bodyType,
    body: rule.body
  }));

  const dataStr = JSON.stringify(rulesForExport, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

  const exportFileDefaultName = 'fastmock-rules-export.json';

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  flashStatus('Rules exported', 'success');
});

// Import rules functionality
document.getElementById('importRules').addEventListener('click', () => {
  document.getElementById('importModal').classList.remove('hidden');
});

document.getElementById('cancelImport').addEventListener('click', () => {
  document.getElementById('importModal').classList.add('hidden');
  document.getElementById('importTextarea').value = '';
});

document.getElementById('confirmImport').addEventListener('click', async () => {
  const importText = document.getElementById('importTextarea').value;
  if (!importText) {
    flashStatus('No data to import', 'error');
    return;
  }

  try {
    const importedRules = JSON.parse(importText);
    if (!Array.isArray(importedRules)) {
      throw new Error('Imported data is not an array of rules');
    }

    // Validate the imported data structure
    for (const rule of importedRules) {
      if (
        typeof rule !== 'object' ||
        typeof rule.id !== 'string' ||
        typeof rule.matchType !== 'string' ||
        typeof rule.pattern !== 'string' ||
        typeof rule.bodyType !== 'string' ||
        typeof rule.body !== 'string'
      ) {
        throw new Error(`Invalid rule structure: ${JSON.stringify(rule)}`);
      }
    }

    // Add the imported rules
    for (const rule of importedRules) {
      // If rule already exists, update it; otherwise, create a new one
      await setRule(rule);
    }

    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('importTextarea').value = '';
    await refresh();
    flashStatus(`Imported ${importedRules.length} rules`, 'success');
  } catch (e) {
    console.error('Import error:', e);
    flashStatus(`Import failed: ${e.message}`, 'error');
  }
});

// Toggle: enable/disable data processing rules
(function initToggle() {
  const btn = document.getElementById('toggleRules');
  const statusEl = document.getElementById('statusMessage');
  if (!btn) return;

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
    flashStatus(next ? 'Rules enabled' : 'Rules disabled', next ? 'success' : 'info');
  });

  btn.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      btn.click();
    }
  });

  applyInitial();
})();

async function refresh() {
  try {
    const rules = await getRules();
    window.currentRules = rules; // Store for later use
    renderRulesList(rules);
    
    // Update the selected rule in the details panel if it was previously selected
    if (selectedRuleId) {
      const selectedRule = rules.find(r => r.id === selectedRuleId);
      if (selectedRule) {
        renderRuleDetails(selectedRule);
      } else {
        // If the selected rule was deleted, clear the selection
        selectedRuleId = null;
        renderRuleDetails(null);
      }
    }
  } catch (e) {
    console.error('Error refreshing options:', e);
    const container = document.getElementById('ruleDetails');
    if (container) {
      container.innerHTML = `<div class="card p-3 text-sm text-red-700 bg-red-50 border-red-200">Error loading rules. See console for details.</div>`;
    }
  }
}

// Initialize the page
refresh();