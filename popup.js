// Popup script: manage rules in chrome.storage and show per-tab hit counts

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


async function getActiveTabId() {
  if (!window.chrome || !chrome.tabs) return 0;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function render(rules, hits) {
  const root = document.getElementById('rules');
  root.innerHTML = '';

  rules.forEach((rule) => {
    const div = document.createElement('div');
    div.className = 'rule rounded-md border border-gray-200 p-3 mb-3 shadow-sm bg-white hover:shadow-md transition-shadow';

    div.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <input class="name flex-1 text-xs border border-gray-300 rounded px-2 py-1 mr-2" placeholder="Rule name" value="${escapeHtml(rule.name || '')}" />
        <button class="delete inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100">Delete</button>
      </div>
      <div class="row mb-2 flex gap-2">
        <select class="matchType text-xs border border-gray-300 rounded px-2 py-1">
          <option value="substring" ${rule.matchType === 'substring' ? 'selected' : ''}>Substring</option>
          <option value="exact" ${rule.matchType === 'exact' ? 'selected' : ''}>Exact</option>
        </select>
        <input class="pattern w-full text-xs border border-gray-300 rounded px-2 py-1" placeholder="URL pattern" value="${escapeHtml(rule.pattern)}" />
        <select class="bodyType text-xs border border-gray-300 rounded px-2 py-1">
          <option value="text" ${rule.bodyType === 'text' ? 'selected' : ''}>Text</option>
          <option value="json" ${rule.bodyType === 'json' ? 'selected' : ''}>JSON</option>
        </select>
      </div>
      <div class="row mb-2">
        <textarea class="body w-full text-xs border border-gray-300 rounded p-2 min-h-[120px]" placeholder="Replacement body">${escapeHtml(rule.body)}</textarea>
      </div>
      <div class="hits text-xs text-gray-600 mt-1">Hits: <strong>${hits?.[rule.id]?.count || 0}</strong> ${hits?.[rule.id]?.lastUrl ? `<span class="small">(last: ${escapeHtml(hits[rule.id].lastUrl)})</span>` : ''}</div>
    `;
    // Track rule id on the DOM node for later collection
    div.__ruleId = rule.id;

    const nameEl = div.querySelector('.name');
    const matchTypeEl = div.querySelector('.matchType');
    const patternEl = div.querySelector('.pattern');
    const bodyTypeEl = div.querySelector('.bodyType');
    const bodyEl = div.querySelector('.body');
    const deleteBtn = div.querySelector('.delete');

    nameEl.addEventListener('input', () => {
      rule.name = nameEl.value;
      setRuleMeta(rule);
    });
    matchTypeEl.addEventListener('change', () => {
      rule.matchType = matchTypeEl.value;
      setRuleMeta(rule);
    });
    patternEl.addEventListener('input', () => {
      rule.pattern = patternEl.value;
      setRuleMeta(rule);
    });
    bodyTypeEl.addEventListener('change', () => {
      rule.bodyType = bodyTypeEl.value;
      setRuleMeta(rule);
    });
    bodyEl.addEventListener('input', () => {
      rule.body = bodyEl.value;
      setRuleBody(rule.id, rule.body);
    });
    deleteBtn.addEventListener('click', async () => {
      await deleteRule(rule.id);
      await refresh();
    });

    root.appendChild(div);
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

document.getElementById('addRule').addEventListener('click', async () => {
  const newRule = { id: uid(), name: '', matchType: 'substring', pattern: '', bodyType: 'text', body: '' };
  await setRule(newRule);
  await refresh();
});

// document.getElementById('saveRules').addEventListener('click', async () => {
//   // This button is now redundant, but we'll keep the handler for now
//   // to avoid breaking anything before we remove the button from popup.html
//   // In practice, changes are saved automatically.
// });

document.getElementById('clearHits').addEventListener('click', async () => {
  const tabId = await getActiveTabId();
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
    await chrome.runtime.sendMessage({ type: 'CLEAR_TAB_HITS', tabId });
  }
  await refresh();
});

// These functions are no longer needed as rules are saved on change.
/*
async function collectRulesFromDOM() {
  const containers = Array.from(document.querySelectorAll('.rule'));
  return containers.map((div) => {
    return {
      id: div.__ruleId || uid(),
      matchType: div.querySelector('.matchType').value,
      pattern: div.querySelector('.pattern').value,
      bodyType: div.querySelector('.bodyType').value,
      body: div.querySelector('.body').value,
    };
  });
}

async function saveRules() {
  const rules = await collectRulesFromDOM();
  await setRules(rules);
}
*/

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
      root.innerHTML = `<div class="error">Error loading rules. See console for details.</div>`;
    }
  }
}

// Toggle: enable/disable data processing rules
(function initToggle() {
  const btn = document.getElementById('toggleRules');
  const statusEl = document.getElementById('statusMessage');
  if (!btn) return;

  function showStatus(message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  }

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
    showStatus(next ? 'Rules enabled' : 'Rules disabled');
  });

  btn.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      btn.click();
    }
  });

  applyInitial();
})();

refresh();