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
      const varBodyKey = `rr_varbody_${id}`;
      const bodyFromLocal = allBodyItems[bodyKey];
      const varBodiesFromLocal = allBodyItems[varBodyKey] || {};
      if (value && typeof value === 'object') {
        const variantsMeta = Array.isArray(value.variants) ? value.variants : [];
        const variants = variantsMeta.map(v => ({
          key: String(v.key || ''),
          bodyType: v.bodyType || value.bodyType || 'json',
          statusCode: v.statusCode || value.statusCode || 200,
          body: typeof varBodiesFromLocal[String(v.key || '')] === 'string' ? varBodiesFromLocal[String(v.key || '')] : ''
        }));
        rules.push({
          id,
          name: value.name || '',
          matchType: value.matchType || 'substring',
          pattern: value.pattern || '',
          enabled: value.enabled !== false, // default to true when unset
          bodyType: value.bodyType || 'json',
          group: value.group || '', // default to no group
          statusCode: value.statusCode || 200, // default to 200 when unset
          // Prefer body from local storage; fall back to any legacy body in sync
          body: (typeof bodyFromLocal === 'string') ? bodyFromLocal : (value.body || ''),
          variants,
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
    variants: Array.isArray(rule.variants) ? rule.variants.map(v => ({ key: String(v.key || ''), bodyType: v.bodyType || rule.bodyType, statusCode: v.statusCode || rule.statusCode || 200 })) : [],
  };
  const bodyKey = `rr_body_${rule.id}`;
  const bodyValue = rule.body ?? '';
  const varBodyKey = `rr_varbody_${rule.id}`;
  const varBodyValue = (() => {
    const out = {};
    const arr = Array.isArray(rule.variants) ? rule.variants : [];
    for (const v of arr) {
      out[String(v.key || '')] = v.body ?? '';
    }
    return out;
  })();
  await Promise.all([
    chrome.storage.sync.set({ [metaKey]: metaValue }),
    chrome.storage.local.set({ [bodyKey]: bodyValue }),
    chrome.storage.local.set({ [varBodyKey]: varBodyValue }),
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
    variants: Array.isArray(rule.variants) ? rule.variants.map(v => ({ key: String(v.key || ''), bodyType: v.bodyType || rule.bodyType, statusCode: v.statusCode || rule.statusCode || 200 })) : [],
  };
  await chrome.storage.sync.set({ [metaKey]: metaValue });
}

async function setRuleBody(id, body) {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;
  const bodyKey = `rr_body_${id}`;
  await chrome.storage.local.set({ [bodyKey]: body ?? '' });
}

async function setRuleVariantsMeta(id, variants) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;
  const metaKey = `rr_rule_${id}`;
  const { [metaKey]: existing } = await chrome.storage.sync.get(metaKey);
  const base = existing && typeof existing === 'object' ? existing : {};
  const metaValue = { ...base, variants: Array.isArray(variants) ? variants.map(v => ({ key: String(v.key || ''), bodyType: v.bodyType || base.bodyType || 'json', statusCode: v.statusCode || base.statusCode || 200 })) : [] };
  await chrome.storage.sync.set({ [metaKey]: metaValue });
}

async function setRuleVariantBody(id, key, body) {
  if (!window.chrome || !chrome.storage || !chrome.storage.local) return;
  const varBodyKey = `rr_varbody_${id}`;
  const all = await chrome.storage.local.get(varBodyKey);
  const current = all[varBodyKey] || {};
  current[String(key || '')] = body ?? '';
  await chrome.storage.local.set({ [varBodyKey]: current });
}

async function deleteRule(id) {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }
  const metaKey = `rr_rule_${id}`;
  const bodyKey = `rr_body_${id}`;
  const varBodyKey = `rr_varbody_${id}`;
  await Promise.all([
    chrome.storage.sync.remove(metaKey),
    chrome.storage.local.remove(bodyKey),
    chrome.storage.local.remove(varBodyKey),
  ]);
}

async function deleteRuleVariant(id, key) {
  if (!window.chrome || !chrome.storage) return;
  const metaKey = `rr_rule_${id}`;
  const bodyKey = `rr_varbody_${id}`;
  const [{ [metaKey]: existing }, varsObj] = await Promise.all([
    chrome.storage.sync.get(metaKey),
    chrome.storage.local.get(bodyKey),
  ]);
  const base = existing && typeof existing === 'object' ? existing : {};
  const nextVariants = Array.isArray(base.variants) ? base.variants.filter(v => String(v.key || '') !== String(key || '')) : [];
  const bodies = varsObj[bodyKey] || {};
  delete bodies[String(key || '')];
  await Promise.all([
    chrome.storage.sync.set({ [metaKey]: { ...base, variants: nextVariants } }),
    chrome.storage.local.set({ [bodyKey]: bodies }),
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

export { getRules, getGroups, setRule, setRuleMeta, setRuleBody, setRuleVariantsMeta, setRuleVariantBody, deleteRule, deleteRuleVariant, setGroup, deleteGroup, getEnabled, setEnabled, defaults };