# FastMock Chrome Extension - Technical Architecture

## System Overview

FastMock is a Chrome extension implementing client-side request interception through monkeypatching of global web APIs. The system intercepts `fetch()` and `XMLHttpRequest` calls within the page context and returns user-defined mock responses. The extension operates at the page level rather than network level, ensuring all interception occurs within the DOM context of the target page.

The options page implements a modern modular architecture using ES6 modules (type="module") to improve code organization, maintainability, and development workflow.

## Component Architecture

### Core Components

1. **manifest.json** - Extension configuration defining permissions, content scripts, and background services
2. **background.js** - Service worker managing per-tab rule hit counters using `chrome.storage.session`
3. **content-script.js** - Coordinates communication between background and page context, injects runtime code
4. **injected.js** - Executes in page context with DOM access, implements request interception mechanisms
5. **popup.html/popup.js** - Frontend interface for rule management and hit monitoring
6. **tailwind-v4.js** - Embedded CSS framework for UI rendering
7. **src/optionsPage/** - Modular options page implementation with the following modules:
   - **main.js** - Entry point for the options page application using ES6 modules
   - **storage.js** - Handles all Chrome storage operations (getRules, setRule, etc.)
   - **ui.js** - Manages UI rendering functions (renderRulesList, renderRuleDetails, etc.)
   - **ruleManager.js** - Handles rule and group management, selection logic
   - **state.js** - Centralized state management for the options page
   - **utils.js** - Shared utility functions (uid, isValidJSON, escapeHtml, flashStatus)

### Component Interaction Flow

```
[User Interface (popup)] 
    ↓ (Rule Configuration)
[chrome.storage (sync/local)]
    ↓ (Rule Sync)
[content-script.js] 
    ↓ (Code Injection)
[injected.js (Page Context)]
    ↓ (Request Interception)
[fetch/XMLHttpRequest Patching]
    ↓ (Response Mocking)
[Background (Hit Tracking)]
```

## Modular Architecture

The options page implements a modular architecture using ES6 modules with `type="module"`:

### Module Structure
- **Main Module**: `src/optionsPage/main.js` - Initializes the application and sets up event listeners
- **Storage Module**: `src/optionsPage/storage.js` - Handles all Chrome storage operations
- **UI Module**: `src/optionsPage/ui.js` - Contains rendering functions for the UI
- **Rule Manager Module**: `src/optionsPage/ruleManager.js` - Manages rule logic and selection
- **State Module**: `src/optionsPage/state.js` - Centralized state management
- **Utils Module**: `src/optionsPage/utils.js` - Shared utility functions

### Benefits
- Improved maintainability through separation of concerns
- Better code organization with clear module responsibilities
- Enhanced testability with isolated modules
- Easier debugging with modular boundaries

## Request Interception Implementation

### Fetch API Interception
The system implements fetch interception by:
1. Backing up the original `window.fetch` function
2. Replacing with a patched implementation that:
   - Extracts URL from request parameters
   - Normalizes URL to absolute form using `location.href`
   - Matches against configured rule patterns
   - Returns mock response if match found
   - Calls original fetch if no match

### XMLHttpRequest Interception
XHR interception is implemented by patching:
- `XMLHttpRequest.prototype.open` - Captures request method and URL
- `XMLHttpRequest.prototype.send` - Intercepts request execution
- Response handling is patched to return mock data when patterns match

### Pattern Matching Algorithm
```
For each request:
1. Normalize URL to absolute form
2. For each rule:
   a. If matchType is "substring":
      - Check if pattern exists within URL (case-insensitive)
   b. If matchType is "exact":
      - Compare normalized pattern with normalized URL
3. Return first matching rule's response
```

## Storage Architecture

### Data Segmentation Strategy
The system implements a segmented storage approach:

#### chrome.storage.sync
- Stores rule metadata (pattern, matchType, bodyType)
- Synchronized across user's Chrome profile
- Limited to 8.192 bytes per item
- Structure: `{rules: [{id, pattern, matchType, bodyType, enabled}]}`

#### chrome.storage.local
- Stores rule body content to avoid sync quotas
- Local to individual browser instance
- Structure: `{bodies: {ruleId: bodyContent}}`

#### chrome.storage.session
- Maintains per-tab hit counters
- Cleared upon browser restart
- Structure: `{hits: {tabId: {ruleId: count, lastMatchedUrl}}}`

## Security and CSP Compliance

### Content Security Policy Resilience
The system implements multiple injection strategies:
1. Standard script injection via `scripting.executeScript`
2. Fallback to programmatic injection in DOM for CSP-restricted environments
3. Uses immediate execution to ensure patching occurs before first requests

### Isolation Boundaries
- Content scripts operate in isolated world
- Page context code has full DOM access
- Communication uses secure Chrome extension APIs
- No external network calls from injected code

## Extension Permissions

```
permissions: [
  "scripting",    // Runtime code injection
  "storage",      // Rule and hit data persistence
  "activeTab"     // Current tab information access
]
host_permissions: ["<all_urls>"] // Request interception capability
```

## Runtime Architecture

### Initialization Sequence
1. Content script loads and establishes storage listeners
2. Retrieves rules from `chrome.storage.sync`
3. Fetches rule bodies from `chrome.storage.local`
4. Injects `injected.js` into page context
5. `injected.js` applies fetch/XHR patches
6. Background service registers tab hit tracking

### Performance Considerations
- Pattern matching occurs synchronously during request cycle
- Rule evaluation stops at first match
- Storage operations batched where possible
- Memory usage optimized by separating metadata from body content

## API Implementation Details

### Mock Response Generation
```javascript
function createMockResponse(rule) {
  const headers = new Headers();
  headers.set('Content-Type', rule.bodyType === 'json' ? 'application/json' : 'text/plain');
  
  return new Response(rule.body, {
    status: 200,
    statusText: 'OK',
    headers: headers
  });
}
```

### URL Normalization Logic
- Relative URLs resolved against `location.href`
- Query parameters preserved in matching
- Protocol/hostname normalization for consistency
- Automatic quote/backtick removal from patterns

## Error Handling and Validation

### JSON Validation
- Performed in popup UI before storage
- Invalid JSON returned as string response to prevent runtime errors
- Validation feedback provided to user interface

### Request Error Handling
- Falls back to original request if patching fails
- Preserves original error behaviors
- Detailed logging for debugging

## Debugging Infrastructure

### Logging Mechanism
- Console logging from `injected.js` for request tracing
- Hit counter tracking in background service
- Pattern match logging for debugging

### Developer Tools Integration
- Console messages identify FastMock origin
- Network tab shows mock responses with distinguishing headers
- Extension popup displays hit statistics per tab