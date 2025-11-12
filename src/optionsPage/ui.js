// UI rendering module for options page - handles all DOM rendering functions

import { escapeHtml, flashStatus, isValidJSON } from './utils.js';
import { selectRule, selectGroup, refresh } from './ruleManager.js';
import { setRuleMeta, setRuleBody, deleteRule, deleteGroup, setGroup, getRules } from './storage.js';
import { groupExpandedState, getSelectedId, getSelectedType, getGroupExpanded, setGroupExpanded, getSearchQuery, getSortOrder, getFilterStatus, getShowUngrouped, getDensity, clearSelection } from './state.js';

function renderRulesList(rules, groups) {
  const root = document.getElementById('rulesList');
  root.innerHTML = '';

  if (groups.length === 0 && rules.length === 0) {
    root.innerHTML = '<div class="text-center text-gray-500 p-4 text-sm">No groups or rules defined</div>';
    return;
  }

  // Apply search, filter, sort
  let filtered = [...rules];
  const q = getSearchQuery().toLowerCase();
  if (q) {
    filtered = filtered.filter(r => (r.name || '').toLowerCase().includes(q) || (r.pattern || '').toLowerCase().includes(q));
  }
  const status = getFilterStatus();
  if (status === 'enabled') filtered = filtered.filter(r => r.enabled);
  if (status === 'disabled') filtered = filtered.filter(r => !r.enabled);
  const sort = getSortOrder();
  if (sort === 'az') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (sort === 'enabled') filtered.sort((a, b) => Number(b.enabled) - Number(a.enabled));

  // Group rules by their group ID (after filtering)
  const rulesByGroup = {};
  filtered.forEach(rule => {
    const groupId = rule.group || 'ungrouped';
    if (!rulesByGroup[groupId]) rulesByGroup[groupId] = [];
    rulesByGroup[groupId].push(rule);
  });

  // Render groups first
  groups.forEach(group => {
    // Determine if this group should be expanded
    const isExpanded = getGroupExpanded(group.id); // Default to true if not set
    
    const groupItem = document.createElement('div');
    const densityPad = getDensity() === 'compact' ? 'p-1' : 'p-2';
    groupItem.className = `group-item ${densityPad} rounded cursor-pointer flex items-center justify-between ${getSelectedType() === 'group' && getSelectedId() === group.id ? 'bg-purple-900 border border-blue-200' : 'hover:bg-gray-800'}`;
    groupItem.dataset.groupId = group.id;

    // Get rules in this group to show count
    const groupRules = rulesByGroup[group.id] || [];
    
    groupItem.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate flex items-center">
          <svg class="w-4 h-4 mr-1 expand-icon ${isExpanded ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg class="w-4 h-4 mr-1 group-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          ${escapeHtml(group.name)}
          <span class="ml-2 badge badge-gray">${groupRules.length} rules</span>
        </div>
        <div class="text-xs text-gray-500 truncate">${escapeHtml(group.description)}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="delete-group-btn text-red-500 hover:text-red-700" title="Delete group">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;

    // Add click handler for expanding/collapsing
    groupItem.addEventListener('click', (e) => {
      // Check if they clicked on the delete button
      if (!e.target.closest('.delete-group-btn')) {
        // Toggle expansion state
        setGroupExpanded(group.id, !isExpanded);
        renderRulesList(window.currentRules, window.currentGroups);
        selectGroup(group.id); // Select the group when clicked
      }
    });

    const deleteBtn = groupItem.querySelector('.delete-group-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete group "${group.name}" and all its rules?`)) {
        await deleteGroup(group.id);
        setGroupExpanded(group.id, undefined); // Remove expansion state
        await refresh();
        flashStatus('Group deleted', 'success');
      }
    });

    root.appendChild(groupItem);

    // Render rules within this group if expanded
    if (isExpanded) {
      const groupRules = rulesByGroup[group.id] || [];
      groupRules.forEach(rule => {
        const ruleItem = document.createElement('div');
        const densityPad = getDensity() === 'compact' ? 'p-1' : 'p-2';
        ruleItem.className = `rule-item ${densityPad} rounded cursor-pointer flex items-center justify-between ml-4 ${getSelectedType() === 'rule' && getSelectedId() === rule.id ? 'bg-purple-900 border border-blue-200' : 'hover:bg-gray-800'}`;
        ruleItem.dataset.ruleId = rule.id;

        ruleItem.innerHTML = `
          <div class="flex-1 min-w-0 ml-4">
            <div class="font-medium text-sm truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
            <div class="text-xs text-gray-500 truncate">${escapeHtml(rule.pattern)}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${rule.enabled ? 'badge-green' : 'badge-gray'}">${rule.enabled ? 'ON' : 'OFF'}</span>
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
            if (getSelectedType() === 'rule' && getSelectedId() === rule.id) {
              clearSelection();
              renderRuleDetails(null);
            }
            flashStatus('Rule deleted', 'success');
          }
        });

        root.appendChild(ruleItem);
      });
    }
  });

  // Render ungrouped rules if any exist
  const showUngrouped = getShowUngrouped();
  const ungroupedRules = rulesByGroup.ungrouped || [];
  if (showUngrouped && ungroupedRules.length > 0) {
    // Add toggle for ungrouped rules
    const ungroupedExpanded = getGroupExpanded('ungrouped');
    const ungroupedHeader = document.createElement('div');
    ungroupedHeader.className = 'p-2 font-medium text-gray-700 text-xs uppercase tracking-wider flex items-center cursor-pointer';
    ungroupedHeader.innerHTML = `
      <svg class="w-4 h-4 mr-1 expand-icon ${ungroupedExpanded ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
      Ungrouped Rules <span class="ml-1 badge badge-gray">${ungroupedRules.length}</span>
    `;
    
    ungroupedHeader.addEventListener('click', () => {
      setGroupExpanded('ungrouped', !ungroupedExpanded);
      renderRulesList(window.currentRules, window.currentGroups);
    });
    
    root.appendChild(ungroupedHeader);

    // Render ungrouped rules if expanded
    if (ungroupedExpanded) {
      ungroupedRules.forEach(rule => {
        const ruleItem = document.createElement('div');
        const densityPad = getDensity() === 'compact' ? 'p-1' : 'p-2';
        ruleItem.className = `rule-item ${densityPad} rounded cursor-pointer flex items-center justify-between ${getSelectedType() === 'rule' && getSelectedId() === rule.id ? 'bg-purple-900 border border-blue-200' : 'hover:bg-gray-800'}`;
        ruleItem.dataset.ruleId = rule.id;

        ruleItem.innerHTML = `
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
            <div class="text-xs text-gray-500 truncate">${escapeHtml(rule.pattern)}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${rule.enabled ? 'badge-green' : 'badge-gray'}">${rule.enabled ? 'ON' : 'OFF'}</span>
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
            if (getSelectedType() === 'rule' && getSelectedId() === rule.id) {
              clearSelection();
              renderRuleDetails(null);
            }
            flashStatus('Rule deleted', 'success');
          }
        });

        root.appendChild(ruleItem);
      });
    }
  }
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
          <label class="label block mb-1">Group</label>
          <select class="group-select select w-full" aria-label="Select group">
            <option value="" ${rule.group === '' ? 'selected' : ''}>No Group</option>
            ${window.currentGroups?.map(group => 
              `<option value="${escapeHtml(group.id)}" ${rule.group === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`
            ).join('')}
          </select>
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
        
        <div>
          <label class="label block mb-1">Status Code</label>
          <select class="statusCode select w-full" aria-label="Status code">
            <option value="200" ${rule.statusCode === 200 ? 'selected' : ''}>200 OK</option>
            <option value="201" ${rule.statusCode === 201 ? 'selected' : ''}>201 Created</option>
            <option value="204" ${rule.statusCode === 204 ? 'selected' : ''}>204 No Content</option>
            <option value="400" ${rule.statusCode === 400 ? 'selected' : ''}>400 Bad Request</option>
            <option value="401" ${rule.statusCode === 401 ? 'selected' : ''}>401 Unauthorized</option>
            <option value="403" ${rule.statusCode === 403 ? 'selected' : ''}>403 Forbidden</option>
            <option value="404" ${rule.statusCode === 404 ? 'selected' : ''}>404 Not Found</option>
            <option value="422" ${rule.statusCode === 422 ? 'selected' : ''}>422 Unprocessable Entity</option>
            <option value="500" ${rule.statusCode === 500 ? 'selected' : ''}>500 Internal Server Error</option>
            <option value="502" ${rule.statusCode === 502 ? 'selected' : ''}>502 Bad Gateway</option>
            <option value="503" ${rule.statusCode === 503 ? 'selected' : ''}>503 Service Unavailable</option>
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
  const groupSelectEl = detailsContainer.querySelector('.group-select');
  const matchTypeEl = detailsContainer.querySelector('.matchType');
  const patternEl = detailsContainer.querySelector('.pattern');
  const bodyTypeEl = detailsContainer.querySelector('.bodyType');
  const statusCodeEl = detailsContainer.querySelector('.statusCode');
  const bodyEl = detailsContainer.querySelector('.body');
  const enabledToggle = detailsContainer.querySelector('.enabled-toggle');

  nameEl.addEventListener('blur', async () => {
    rule.name = nameEl.value;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar
    flashStatus('Name saved', 'success');
  });

  groupSelectEl.addEventListener('change', async () => {
    rule.group = groupSelectEl.value;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar
    flashStatus('Group updated', 'success');
  });

  matchTypeEl.addEventListener('change', async () => {
    rule.matchType = matchTypeEl.value;
    await setRuleMeta(rule);
    flashStatus('Match type updated', 'success');
  });

  patternEl.addEventListener('blur', async () => {
    rule.pattern = patternEl.value;
    await setRuleMeta(rule);
    flashStatus('Pattern saved', 'success');
  });

  statusCodeEl.addEventListener('change', async () => {
    rule.statusCode = parseInt(statusCodeEl.value, 10);
    await setRuleMeta(rule);
    flashStatus('Status code updated', 'success');
  });

  enabledToggle.addEventListener('change', async () => {
    rule.enabled = enabledToggle.checked;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar display
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

  bodyEl.addEventListener('blur', async () => {
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

function renderGroupDetails(group) {
  const detailsContainer = document.getElementById('ruleDetails');
  
  if (!group) {
    detailsContainer.innerHTML = `
      <div class="text-center text-gray-500 p-8">
        <div class="mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-1">Select a rule or group to manage</h3>
        <p class="text-gray-500">Choose a rule or group from the sidebar to view and edit its details</p>
      </div>
    `;
    return;
  }

  detailsContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-gray-900">Group Details</h2>
      </div>
      
      <div class="space-y-4">
        <div>
          <label class="label block mb-1">Group Name</label>
          <input class="group-name input w-full" placeholder="Group name" value="${escapeHtml(group.name)}" aria-label="Group name" />
        </div>
        
        <div>
          <label class="label block mb-1">Description</label>
          <textarea class="group-description textarea" placeholder="Group description">${escapeHtml(group.description)}</textarea>
        </div>
        
        <div>
          <label class="label block mb-1">Rules in this Group</label>
          <div class="border rounded p-2 bg-gray-800 max-h-60 overflow-y-auto">
            ${(window.currentRules || [])
              .filter(rule => rule.group === group.id)
              .map(rule => 
                `<div class="p-2 border-b border-gray-200 flex justify-between items-center">
                  <div class="truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
                  <span class="text-xs ${rule.enabled ? 'text-green-500' : 'text-gray-400'}">${rule.enabled ? 'ON' : 'OFF'}</span>
                </div>`
              ).join('') || '<div class="text-gray-500 text-center py-2">No rules in this group</div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up the event listeners
  const nameEl = detailsContainer.querySelector('.group-name');
  const descriptionEl = detailsContainer.querySelector('.group-description');

  nameEl.addEventListener('blur', async (e) => {
    group.name = e.target.value;
    await setGroup(group);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar
    flashStatus('Group name updated', 'success');
  });

  descriptionEl.addEventListener('blur', async (e) => {
    group.description = e.target.value;
    await setGroup(group);
    flashStatus('Group description updated', 'success');
  });
}

export { renderRulesList, renderRuleDetails, renderGroupDetails, groupExpandedState };