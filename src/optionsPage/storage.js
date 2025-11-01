// Storage module for options page - handles all Chrome storage operations

const defaults = { rr_rules: [], rr_groups: [] };

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
          group: value.group || '', // default to no group
          statusCode: value.statusCode || 200, // default to 200 when unset
          statusText: value.statusText || '', // default to empty string
          // Prefer body from local storage; fall back to any legacy body in sync
          body: (typeof bodyFromLocal === 'string') ? bodyFromLocal : (value.body || ''),
        });
      }
    }
  }
  return rules;
}

async function getGroups() {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    return [];
  }
  const items = await chrome.storage.sync.get(null);
  const groups = [];
  
  for (const key in items) {
    if (key.startsWith('rr_group_')) {
      const id = key.substring('rr_group_'.length);
      const value = items[key];
      if (value && typeof value === 'object') {
        groups.push({
          id,
          name: value.name || 'Untitled Group',
          description: value.description || '',
        });
      }
    }
  }
  return groups;
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
    group: rule.group || '', // Save group association
    statusCode: rule.statusCode || 200,
    statusText: rule.statusText || '',
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
    group: rule.group || '', // Save group association
    statusCode: rule.statusCode || 200,
    statusText: rule.statusText || '',
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

async function setGroup(group) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }
  const key = `rr_group_${group.id}`;
  const value = {
    name: group.name || 'Untitled Group',
    description: group.description || '',
  };
  await chrome.storage.sync.set({ [key]: value });
}

async function deleteGroup(id) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }
  const key = `rr_group_${id}`;
  await chrome.storage.sync.remove(key);
  
  // Remove group association from all rules that belonged to this group
  const rules = await getRules();
  for (const rule of rules) {
    if (rule.group === id) {
      rule.group = '';
      await setRuleMeta(rule);
    }
  }
}

// Toggle: enable/disable data processing rules
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

export { getRules, getGroups, setRule, setRuleMeta, setRuleBody, deleteRule, setGroup, deleteGroup, getEnabled, setEnabled, defaults };