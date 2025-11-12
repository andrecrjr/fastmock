// Main module for options page - initializes the UI and handles event listeners

import { addRule, addGroup, expandAll, collapseAll, exportRules, importRules, refresh } from './ruleManager.js';
import { setEnabled, getEnabled } from './storage.js';
import { flashStatus, debounce } from './utils.js';
import { getTheme, setTheme, getDensity, setDensity, setSearchQuery, setSortOrder, setFilterStatus, setShowUngrouped, applyPrefsToDOM, getSearchQuery, getFilterStatus, getShowUngrouped } from './state.js';

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await refresh();
  initializeEventListeners();
  initializeToggleRuleButton();
  initializeHeaderControls();
  applyPrefsToDOM();
});

function initializeEventListeners() {
  // Add rule button
  document.getElementById('addRule').addEventListener('click', async () => {
    await addRule();
  });

  // Add group button
  document.getElementById('addGroup').addEventListener('click', () => {
    document.getElementById('groupName').value = '';
    document.getElementById('groupDescription').value = '';
    document.getElementById('groupModal').classList.remove('hidden');
  });

  // Cancel group modal
  document.getElementById('cancelGroup').addEventListener('click', () => {
    document.getElementById('groupModal').classList.add('hidden');
  });

  // Save group modal
  document.getElementById('saveGroup').addEventListener('click', async () => {
    const groupName = document.getElementById('groupName').value.trim();
    const groupDescription = document.getElementById('groupDescription').value.trim();
    await addGroup(groupName, groupDescription);
    document.getElementById('groupModal').classList.add('hidden');
  });

  // Expand/collapse all functionality
  document.getElementById('expandAll').addEventListener('click', () => {
    expandAll();
  });

  document.getElementById('collapseAll').addEventListener('click', () => {
    collapseAll();
  });

  // Export rules functionality
  document.getElementById('exportRules').addEventListener('click', async () => {
    await exportRules();
  });
  const exportIcon = document.getElementById('exportIconBtn');
  if (exportIcon) {
    exportIcon.addEventListener('click', async () => { await exportRules(); });
  }

  // Import rules functionality
  document.getElementById('importRules').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('hidden');
  });
  const importIcon = document.getElementById('importIconBtn');
  if (importIcon) {
    importIcon.addEventListener('click', () => { document.getElementById('importModal').classList.remove('hidden'); });
  }

  document.getElementById('cancelImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('importTextarea').value = '';
  });

  document.getElementById('confirmImport').addEventListener('click', async () => {
    const importText = document.getElementById('importTextarea').value;
    await importRules(importText);
    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('importTextarea').value = '';
  });

  // Quick create folder card
  const quickCreateBtn = document.getElementById('quickCreateGroup');
  if (quickCreateBtn) {
    quickCreateBtn.addEventListener('click', async () => {
      const input = document.getElementById('quickGroupName');
      const name = (input?.value || '').trim();
      if (!name) { flashStatus('Folder name is required', 'error'); return; }
      await addGroup(name, '');
      if (input) input.value = '';
    });
  }
}

function initializeToggleRuleButton() {
  const btn = document.getElementById('toggleRules');
  if (!btn) return;

  async function updateButtonUI(enabled) {
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
}

function initializeHeaderControls() {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.checked = getTheme() === 'dark';
    themeToggle.addEventListener('change', () => {
      setTheme(themeToggle.checked ? 'dark' : 'light');
    });
  }
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      if (themeToggle) themeToggle.checked = next === 'dark';
      flashStatus(`Theme: ${next}`, 'info');
    });
  }

  // Density
  const densityToggle = document.getElementById('densityToggle');
  if (densityToggle) {
    densityToggle.value = getDensity();
    densityToggle.addEventListener('change', () => {
      setDensity(densityToggle.value);
      // re-render to apply spacing changes
      refresh();
    });
  }

  // Search
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    searchInput.value = getSearchQuery() || '';
    const onSearch = debounce(() => { setSearchQuery(searchInput.value); refresh(); }, 250);
    searchInput.addEventListener('input', onSearch);
  }

  // Sorting
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => { setSortOrder(sortSelect.value); refresh(); });
  }

  // Filters
  const filterAll = document.getElementById('filterAll');
  const filterEnabled = document.getElementById('filterEnabled');
  const filterDisabled = document.getElementById('filterDisabled');
  const filterUngrouped = document.getElementById('filterUngrouped');
  // Centralized, theme-aware chip active toggle using CSS class defined in options.html
  function setFilterChipActive(activeEl) {
    [filterAll, filterEnabled, filterDisabled].forEach(el => {
      if (!el) return;
      const isActive = el === activeEl;
      el.classList.toggle('chip-active', isActive);
    });
  }
  // Initialize chip state
  const currentStatus = getFilterStatus && getFilterStatus();
  if (typeof currentStatus === 'string') {
    if (currentStatus === 'all' && filterAll) setFilterChipActive(filterAll);
    if (currentStatus === 'enabled' && filterEnabled) setFilterChipActive(filterEnabled);
    if (currentStatus === 'disabled' && filterDisabled) setFilterChipActive(filterDisabled);
  } else if (filterAll) { setFilterChipActive(filterAll); }
  const showUngrouped = getShowUngrouped && getShowUngrouped();
  if (filterUngrouped) {
    filterUngrouped.classList.toggle('chip-active', !!showUngrouped);
  }
  if (filterAll) filterAll.addEventListener('click', () => { setFilterStatus('all'); setFilterChipActive(filterAll); refresh(); });
  if (filterEnabled) filterEnabled.addEventListener('click', () => { setFilterStatus('enabled'); setFilterChipActive(filterEnabled); refresh(); });
  if (filterDisabled) filterDisabled.addEventListener('click', () => { setFilterStatus('disabled'); setFilterChipActive(filterDisabled); refresh(); });
  if (filterUngrouped) filterUngrouped.addEventListener('click', () => { 
    const active = filterUngrouped.classList.toggle('chip-active');
    setShowUngrouped(active); 
    refresh(); 
  });
}

function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Focus search with '/' or Ctrl+K
    if ((e.key === '/' && !e.ctrlKey && !e.metaKey) || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
      const search = document.getElementById('globalSearch');
      if (search) { e.preventDefault(); search.focus(); }
      return;
    }
    // Toggle theme with 'd'
    if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      const toggle = document.getElementById('themeToggle');
      if (toggle) toggle.checked = next === 'dark';
      flashStatus(`Theme: ${next}`, 'info');
      return;
    }
  });
}