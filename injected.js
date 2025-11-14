// Injected script: runs in page context; monkeypatches fetch and XHR
// Supports multiple rules with substring or exact matching. Each rule:
// { id: string, pattern: string, matchType: 'substring' | 'exact', bodyType: 'text' | 'json', body: string }

(function () {
  console.log('Mockzilla RR injected script running');
  const RR_NS = '__RR__';
  const state = {
    rules: [],
    originalFetch: window.fetch,
    originalXHR: window.XMLHttpRequest,
  };

  function normalizeUrl(u) {
    try {
      const s = String(u ?? '');
      // Convert relative URLs to absolute using current page as base
      try {
        return new URL(s, location.href).href;
      } catch {
        return s;
      }
    } catch {
      return '';
    }
  }

  function sanitizePattern(p) {
    let s = String(p ?? '');
    s = s.trim();
    // Strip surrounding quotes or backticks if present
    const first = s[0];
    const last = s[s.length - 1];
    if (s.length >= 2 && ((first === '`' && last === '`') || (first === '"' && last === '"') || (first === "'" && last === "'"))) {
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  function matchesRule(url, rule) {
    // If globally disabled, no rules should match
    if (rule.globalEnabled === false) {
      return false;
    }
    // If the rule is individually disabled, don't match anything
    if (rule.enabled === false) {
      return false;
    }
    const target = normalizeUrl(url);
    const rawPattern = sanitizePattern(rule.pattern);
    // If the pattern is empty, don't match anything
    if (!rawPattern) {
      return false;
    }
    const absPattern = normalizeUrl(rawPattern);
    if (rule.matchType === 'exact') {
      // Compare normalized absolute forms for exact matching
      return target === absPattern;
    }
    if (rule.matchType === 'wildcard') {
      const m1 = matchWildcard(target, absPattern);
      if (m1.ok) return true;
      const m2 = matchWildcard(target, rawPattern);
      return m2.ok;
    }
    return target.includes(rawPattern) || target.includes(absPattern);
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function wildcardToRegex(p) {
    const s = String(p || '');
    const parts = s.split('*').map(escapeRegex);
    const pattern = parts.join('(.+?)');
    const anchored = s.includes('://') ? '^' + pattern + '$' : '.*' + pattern + '.*';
    return new RegExp(anchored);
  }

  function matchWildcard(url, pattern) {
    const p = String(pattern || '');
    const re = wildcardToRegex(p);
    const m = re.exec(url);
    if (!m) return { ok: false, captures: [] };
    const caps = m.slice(1);
    return { ok: true, captures: caps };
  }

  function selectVariant(rule, url) {
    if (rule.matchType !== 'wildcard') return null;
    const rawPattern = sanitizePattern(rule.pattern);
    const absPattern = normalizeUrl(rawPattern);
    const mAbs = matchWildcard(url, absPattern);
    const mRaw = mAbs.ok ? mAbs : matchWildcard(url, rawPattern);
    const m = mRaw;
    if (!m.ok) return null;
    const key = m.captures.join('|');
    const variants = Array.isArray(rule.variants) ? rule.variants : [];
    const v = variants.find(x => String(x.key) === key);
    if (!v) return null;
    return {
      bodyType: v.bodyType || rule.bodyType,
      statusCode: v.statusCode || rule.statusCode || 200,
      body: v.body ?? ''
    };
  }

  function buildResponse(rule, url) {
    const variant = selectVariant(rule, url);
    const bodyType = variant ? variant.bodyType : rule.bodyType;
    const statusCode = variant ? variant.statusCode : (rule.statusCode || 200);
    const bodyRaw = variant ? variant.body : rule.body;
    const headers = new Headers({ 'Content-Type': bodyType === 'json' ? 'application/json' : 'text/plain' });
    const body = bodyType === 'json' ? JSON.stringify(safeParseJSON(bodyRaw)) : String(bodyRaw ?? '');
    const statusText = getStatusCodeText(statusCode);
    return new Response(body, { status: statusCode, statusText: statusText, headers, url });
  }

  function getStatusCodeText(statusCode) {
    const statusTexts = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };
    return statusTexts[statusCode] || 'OK';
  }

  function safeParseJSON(text) {
    try {
      const v = JSON.parse(text);
      return v;
    } catch {
      // Fall back to raw text; emit as string
      return text;
    }
  }

  function notifyRuleHit(ruleId, url) {
    window.postMessage({ __rr: true, type: 'RULE_HIT', ruleId, url }, '*');
    console.log('Rule HIT:', ruleId, url);
  }

  function patchFetch() {
    window.fetch = async function patchedFetch(input, init) {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      const absUrl = normalizeUrl(url);
      const rule = state.rules.find((r) => matchesRule(absUrl, r));
      if (rule) {
        notifyRuleHit(rule.id, absUrl);
        return buildResponse(rule, absUrl);
      }
      return state.originalFetch.apply(this, arguments);
    };
  }

  function patchXHR() {
    const OriginalXHR = state.originalXHR;
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;

    // Guard to avoid double-patching
    if (OriginalXHR.prototype.__rrPatched) return;
    Object.defineProperty(OriginalXHR.prototype, '__rrPatched', { value: true, configurable: true });

    OriginalXHR.prototype.open = function (method, url) {
      try {
        this.__rrMethod = method;
        this.__rrUrl = url;
      } catch (e) {
        // noop
      }
      return originalOpen.apply(this, arguments);
    };

    OriginalXHR.prototype.send = function (body) {
      const _url = this.__rrUrl || '';
      const absUrl = normalizeUrl(_url);
      const rule = state.rules.find((r) => matchesRule(absUrl, r));
      if (rule) {
        notifyRuleHit(rule.id, absUrl);
        const variant = selectVariant(rule, absUrl);
        const bodyType = variant ? variant.bodyType : rule.bodyType;
        const bodyRaw = variant ? variant.body : rule.body;
        const responseText = bodyType === 'json' ? JSON.stringify(safeParseJSON(bodyRaw)) : String(bodyRaw ?? '');
        const statusCode = variant ? variant.statusCode : (rule.statusCode || 200);
        const statusText = getStatusCodeText(statusCode);
        const _dispatch = this.dispatchEvent.bind(this);

        // Simulate readyState changes and set response fields
        setTimeout(() => {
          try { Object.defineProperty(this, 'readyState', { value: 4, configurable: true }); } catch {}
          try { Object.defineProperty(this, 'status', { value: statusCode, configurable: true }); } catch {}
          try { Object.defineProperty(this, 'statusText', { value: statusText, configurable: true }); } catch {}
          try { Object.defineProperty(this, 'responseURL', { value: absUrl, configurable: true }); } catch {}
          try { Object.defineProperty(this, 'response', { value: responseText, configurable: true }); } catch {}
          try { Object.defineProperty(this, 'responseText', { value: responseText, configurable: true }); } catch {}
          _dispatch(new Event('readystatechange'));
          _dispatch(new Event('load'));
          _dispatch(new Event('loadend'));
        }, 0);
        return;
      }
      return originalSend.apply(this, arguments);
    };
  }

  function updateRules(newRules) {
    state.rules = Array.isArray(newRules) ? 
      newRules.filter(Boolean).map(rule => ({
        ...rule,
        enabled: rule.enabled !== false, // default to true when unset
        globalEnabled: rule.globalEnabled !== false,
        variants: Array.isArray(rule.variants) ? rule.variants : []
      })) : [];
  }

  // Receive rules updates from content script
  window.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (!msg || !msg.__rr) return;
    if (msg.type === 'RULES_UPDATE') {
      updateRules(msg.rules);
    }
  });

  // Expose debug namespace
  window[RR_NS] = {
    getRules: () => state.rules.slice(),
  };

  // Apply patches early
  patchFetch();
  patchXHR();

  // Actively request rules from the content script at startup.
  try {
    window.postMessage({ __rr: true, type: 'REQUEST_RULES' }, '*');
  } catch {}
})();