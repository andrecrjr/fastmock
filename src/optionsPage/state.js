// State management module for options page - handles shared application state

// Store group expansion state
const groupExpandedState = {};

// Track currently selected rule or group
let selectedId = null;
let selectedType = null; // 'rule' or 'group'

// Functions to manage selection state
function setSelectedRule(ruleId) {
  selectedId = ruleId;
  selectedType = 'rule';
}

function setSelectedGroup(groupId) {
  selectedId = groupId;
  selectedType = 'group';
}

function getSelectedId() {
  return selectedId;
}

function getSelectedType() {
  return selectedType;
}

function clearSelection() {
  selectedId = null;
  selectedType = null;
}

// Additional setter functions to allow modification of state
function setSelectedId(id) { 
  selectedId = id; 
}

function setSelectedType(type) { 
  selectedType = type; 
}

// Functions to manage group expansion state
function setGroupExpanded(groupId, isExpanded) {
  groupExpandedState[groupId] = isExpanded;
}

function getGroupExpanded(groupId) {
  return groupExpandedState[groupId] !== false; // Default to true if not set
}

function clearGroupExpandedState() {
  for (const key in groupExpandedState) {
    delete groupExpandedState[key];
  }
}

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
  clearGroupExpandedState
};