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
  // Also show a transient toast message
  showToast(message, type, timeout);
}

// Lightweight debounce helper
function debounce(fn, wait = 200) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function showToast(message, type = 'info', timeout = 2000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info'}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0','transition-opacity');
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

export { uid, isValidJSON, escapeHtml, flashStatus, debounce, showToast };