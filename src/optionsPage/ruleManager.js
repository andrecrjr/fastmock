// Rule manager module for options page - handles rule/group selection and management

import { renderRuleDetails, renderGroupDetails, renderRulesList } from './ui.js';
import { setRuleMeta, setRuleBody, setGroup, deleteGroup, deleteRule, setEnabled, getRules, getGroups, setRule } from './storage.js';
import { flashStatus, uid } from './utils.js';
import { setSelectedRule as setInternalSelectedRule, setSelectedGroup as setInternalSelectedGroup, setSelectedId, setSelectedType, getSelectedType, getSelectedId, clearSelection, setGroupExpanded } from './state.js';

function selectRule(ruleId) {
  setInternalSelectedRule(ruleId);
  const rule = window.currentRules?.find(r => r.id === ruleId) || null;
  renderRuleDetails(rule);
}

function selectGroup(groupId) {
  setInternalSelectedGroup(groupId);
  const group = window.currentGroups?.find(g => g.id === groupId) || null;
  renderGroupDetails(group);
}

async function refresh() {
  try {
    const rules = await getRules();
    const groups = await getGroups();
    window.currentRules = rules; // Store for later use
    window.currentGroups = groups; // Store groups for later use
    
    // Update folders count pill if present
    const countEl = document.getElementById('groupsCount');
    if (countEl) {
      countEl.textContent = `${groups.length} ${groups.length === 1 ? 'folder' : 'folders'}`;
    }

    renderRulesList(rules, groups);
    
    // Update the selected item in the details panel if it was previously selected
    if (getSelectedType() === 'rule' && getSelectedId()) {
      const selectedRule = rules.find(r => r.id === getSelectedId());
      if (selectedRule) {
        renderRuleDetails(selectedRule);
      } else {
        // If the selected rule was deleted, clear the selection
        clearSelection();
        renderRuleDetails(null);
      }
    } else if (getSelectedType() === 'group' && getSelectedId()) {
      const selectedGroup = groups.find(g => g.id === getSelectedId());
      if (selectedGroup) {
        renderGroupDetails(selectedGroup);
      } else {
        // If the selected group was deleted, clear the selection
        clearSelection();
        renderRuleDetails(null);
      }
    } else {
      // If nothing selected, render the default message
      renderRuleDetails(null);
    }
  } catch (e) {
    console.error('Error refreshing options:', e);
    const container = document.getElementById('ruleDetails');
    if (container) {
      container.innerHTML = `<div class="card p-3 text-sm text-red-700 bg-red-50 border-red-200">Error loading rules. See console for details.</div>`;
    }
  }
}

// Add rule and group functions
async function addRule() {
  const newRule = { id: uid(), name: '', matchType: 'exact', pattern: '', enabled: true, bodyType: 'json', group: '', statusCode: 200, body: '', variants: [] };
  await setRule(newRule);
  await refresh();
  // Automatically select the new rule
  selectRule(newRule.id);
  flashStatus('New rule added', 'success');
}

async function addGroup(groupName, groupDescription) {
  if (!groupName) {
    flashStatus('Group name is required', 'error');
    return;
  }
  
  const group = { id: uid(), name: groupName, description: groupDescription };
  await setGroup(group);
  await refresh();
  flashStatus('Group created', 'success');
}

// Expand/collapse all functionality
function expandAll() {
  // Set all groups to expanded state
  const allGroups = (window.currentGroups || []).concat([{id: 'ungrouped'}]);
  allGroups.forEach(group => {
    setGroupExpanded(group.id, true);
  });
  renderRulesList(window.currentRules, window.currentGroups);
}

function collapseAll() {
  // Set all groups to collapsed state
  const allGroups = (window.currentGroups || []).concat([{id: 'ungrouped'}]);
  allGroups.forEach(group => {
    setGroupExpanded(group.id, false);
  });
  renderRulesList(window.currentRules, window.currentGroups);
}

// Export rules functionality
async function exportRules() {
  const rules = await getRules();
  const groups = await getGroups();
  const exportedAt = new Date().toISOString();
  // Create a minimal representation that excludes internal properties
  const rulesForExport = rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    matchType: rule.matchType,
    pattern: rule.pattern,
    enabled: rule.enabled,
    bodyType: rule.bodyType,
    group: rule.group, // Include group information
    statusCode: rule.statusCode,
    body: rule.body,
    variants: Array.isArray(rule.variants) ? rule.variants.map(v => ({ key: v.key, bodyType: v.bodyType, statusCode: v.statusCode, body: v.body })) : []
  }));
  
  const groupsForExport = groups.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description
  }));

  const dataStr = JSON.stringify({ exportedAt, rules: rulesForExport, groups: groupsForExport }, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

  // Include current date in the filename for clarity
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const stamp = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  const exportFileDefaultName = `mockzilla-rules-export_${stamp}.json`;

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  flashStatus('Rules and groups exported', 'success');
}

// Import rules functionality
async function importRules(importText) {
  if (!importText) {
    flashStatus('No data to import', 'error');
    return;
  }

  try {
    const importedData = JSON.parse(importText);
    let importedRules = [];
    let importedGroups = [];
    
    if (Array.isArray(importedData)) {
      // Legacy format - just rules
      importedRules = importedData;
    } else if (importedData.rules) {
      // New format with groups
      importedRules = importedData.rules || [];
      importedGroups = importedData.groups || [];
    } else {
      // Unknown format
      throw new Error('Invalid import format');
    }

    // Import groups first
    for (const group of importedGroups) {
      if (
        typeof group !== 'object' ||
        typeof group.id !== 'string' ||
        typeof group.name !== 'string'
      ) {
        throw new Error(`Invalid group structure: ${JSON.stringify(group)}`);
      }
      await setGroup(group);
    }

    // Import rules
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
      
      // Ensure default status code if not present in import
      if (rule.statusCode === undefined) rule.statusCode = 200;
      if (!Array.isArray(rule.variants)) rule.variants = [];
      
      // If rule already exists, update it; otherwise, create a new one
      await setRule(rule);
    }

    await refresh();
    flashStatus(`Imported ${importedRules.length} rules and ${importedGroups.length} groups`, 'success');
  } catch (e) {
    console.error('Import error:', e);
    flashStatus(`Import failed: ${e.message}`, 'error');
  }
}

export { 
  selectRule, 
  selectGroup, 
  refresh, 
  addRule, 
  addGroup, 
  expandAll, 
  collapseAll, 
  exportRules, 
  importRules
};