// Main module for options page - initializes the UI and handles event listeners

import { addRule, addGroup, expandAll, collapseAll, exportRules, importRules, refresh } from './ruleManager.js';
import { setEnabled, getEnabled } from './storage.js';
import { flashStatus } from './utils.js';

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await refresh();
  initializeEventListeners();
  initializeToggleRuleButton();
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
    await importRules(importText);
    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('importTextarea').value = '';
  });
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