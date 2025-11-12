// State management module for options page - handles shared application state

// Store group expansion state
const groupExpandedState = {};

// Track currently selected rule or group
let selectedId = null;
let selectedType = null; // 'rule' or 'group'

// UI preference state (persisted)
let prefs = {
  theme: 'light', // 'light' | 'dark'
  density: 'comfortable', // 'comfortable' | 'compact'
  sortOrder: 'recent', // 'recent' | 'az' | 'enabled'
  filterStatus: 'all', // 'all' | 'enabled' | 'disabled'
  showUngrouped: true,
  searchQuery: ''
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem('mockzilla:prefs');
    if (raw) {
      const obj = JSON.parse(raw);
      prefs = { ...prefs, ...obj };
    }
  } catch {}
  applyPrefsToDOM();
}

function savePrefs() {
  try { localStorage.setItem('mockzilla:prefs', JSON.stringify(prefs)); } catch {}
}

function applyPrefsToDOM() {
  const html = document.documentElement;
  // Theme
  html.setAttribute('data-theme', prefs.theme);
  html.classList.toggle('dark', prefs.theme === 'dark');
  // Some Tailwind dark-mode setups look for the class on body; add it for safety
  document.body.classList.toggle('dark', prefs.theme === 'dark');
  // Density: toggle a class on body for easy targeting if needed
  document.body.classList.toggle('density-compact', prefs.density === 'compact');
}

// Selection state
function setSelectedRule(ruleId) {
  selectedId = ruleId;
  selectedType = 'rule';
}

function setSelectedGroup(groupId) {
  selectedId = groupId;
  selectedType = 'group';
}

function getSelectedId() { return selectedId; }
function getSelectedType() { return selectedType; }
function clearSelection() { selectedId = null; selectedType = null; }
function setSelectedId(id) { selectedId = id; }
function setSelectedType(type) { selectedType = type; }

// Group expansion state
function setGroupExpanded(groupId, isExpanded) { groupExpandedState[groupId] = isExpanded; }
function getGroupExpanded(groupId) { return groupExpandedState[groupId] !== false; }
function clearGroupExpandedState() { for (const key in groupExpandedState) delete groupExpandedState[key]; }

// Preferences API
function getTheme() { return prefs.theme; }
function setTheme(theme) { prefs.theme = theme; savePrefs(); applyPrefsToDOM(); }
function getDensity() { return prefs.density; }
function setDensity(density) { prefs.density = density; savePrefs(); applyPrefsToDOM(); }
function getSortOrder() { return prefs.sortOrder; }
function setSortOrder(order) { prefs.sortOrder = order; savePrefs(); }
function getFilterStatus() { return prefs.filterStatus; }
function setFilterStatus(status) { prefs.filterStatus = status; savePrefs(); }
function getShowUngrouped() { return prefs.showUngrouped; }
function setShowUngrouped(show) { prefs.showUngrouped = !!show; savePrefs(); }
function getSearchQuery() { return prefs.searchQuery; }
function setSearchQuery(q) { prefs.searchQuery = q || ''; savePrefs(); }

// Initialize prefs on module import
loadPrefs();

export {
  groupExpandedState,
  selectedId,
  selectedType,
  setSelectedRule,
  setSelectedGroup,
  getSelectedId,
  getSelectedType,
  clearSelection,
  setSelectedId,
  setSelectedType,
  setGroupExpanded,
  getGroupExpanded,
  clearGroupExpandedState,
  // prefs
  getTheme,
  setTheme,
  getDensity,
  setDensity,
  getSortOrder,
  setSortOrder,
  getFilterStatus,
  setFilterStatus,
  getShowUngrouped,
  setShowUngrouped,
  getSearchQuery,
  setSearchQuery,
  applyPrefsToDOM
};