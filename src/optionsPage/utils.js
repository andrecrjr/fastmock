// Utilities module for options page - contains helper functions

function uid() {
  return Math.random().toString(36).slice(2, 10);
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

export { uid, isValidJSON, escapeHtml, flashStatus };