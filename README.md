# Mockzilla

Mockzilla is a Chrome extension that intercepts page-level `fetch` and `XMLHttpRequest` calls and returns mocked responses based on rules you define. It’s ideal for prototyping, isolating frontend work from unstable APIs, and reproducing edge cases without changing backend services.

## Overview
- Intercepts requests initiated from the page context (not network-wide).
- Matches requests via `substring` or `exact` URL patterns.
- Returns `text` or `json` bodies with `200 OK` status.
- Tracks per-tab rule hits and last matched URL to help verify mocks.
- Resilient to CSP: falls back to programmatic injection in the page’s main world.

## Features
- Multiple rules with independent pattern, match type, and body type.
- Live editing in the popup: changes persist immediately.
- Per-tab hit counters with last matched URL for each rule.
- Syncs rule metadata across devices via `chrome.storage.sync`.
- Stores large mock bodies locally via `chrome.storage.local` (avoids sync quotas).

## Installation
- Enable Developer Mode in Chrome (`chrome://extensions/`).
- Click `Load unpacked` and select the project folder: `mockzilla`.
- The extension icon will appear; open the popup to start adding rules.

## Usage
- Open the extension popup and click `Add Rule`.
- Set `Match Type`:
  - `Substring`: matches if the URL contains your pattern (absolute or relative).
  - `Exact`: matches only when the normalized absolute URL equals your pattern.
- Enter `URL pattern` (absolute or relative). Quotes around the pattern are stripped automatically.
- Choose `Body Type`:
  - `Text`: raw string returned with `Content-Type: text/plain`.
  - `JSON`: parsed with `JSON.parse`; if invalid, returned as string. Response header is `application/json`.
- Fill `Replacement body` and navigate or trigger requests on the page. Hits appear under each rule with the last matched URL.
- Use `Clear Hits` to reset counters for the current tab.
- Use `Delete` to remove a rule.

## Rule Matching
- Patterns are normalized and compared to request URLs as absolute URLs when possible.
- `Exact` compares absolute forms; `Substring` checks both raw and absolute forms.
- Quotes/backticks around patterns are removed (e.g., `"/api/users"`).
- Relative patterns (e.g., `/api/users`) are valid; they’re resolved against `location.href`.

## How It Works
- `content-script.js` injects `injected.js` at `document_start` to override page `fetch` and `XMLHttpRequest`.
- Rules are loaded from storage and sent into the page via `window.postMessage`.
- `injected.js` applies the patches, finds matching rules, builds responses, and reports hits.
- `background.js` tracks per-tab hit counts in `chrome.storage.session` and serves them to the popup.
- If CSP blocks tag injection, the background script programmatically injects `injected.js` into the page’s `MAIN` world via `chrome.scripting`.

## Permissions
- `scripting`, `storage`, `activeTab`, `tabs`
- `host_permissions`: `<all_urls>`
- Manifest version: `3` (`service_worker` background).

## Data & Privacy
- Rule metadata (`matchType`, `pattern`, `bodyType`) is stored in `chrome.storage.sync` for portability.
- Rule bodies are stored in `chrome.storage.local` to avoid per-item sync quotas.
- Hit counters live in `chrome.storage.session` and reset with the browser session.
- No data leaves your browser; all operations are local.

## Development
- Files:
  - `manifest.json`: extension config and permissions.
  - `popup.html` / `popup.js`: UI for managing rules and viewing hits.
  - `content-script.js`: injects page script and syncs rules to page context.
  - `injected.js`: overrides `fetch`/`XHR`, applies matching and returns responses.
  - `background.js`: tracks hits, handles injection fallback, answers popup requests.
- Typical workflow:
  - Edit rules via the popup and test on any page.
  - Use DevTools console to observe logs from `injected.js` and content script.
  - Reload the extension from `chrome://extensions/` when you change source files.

## Design System (Tailwind CSS)
- Color scheme:
  - Primary: Tailwind `blue` (actions, focus rings)
  - Neutral: Tailwind `gray`/`slate` (surfaces, borders, text)
  - Success: Tailwind `green` (positive feedback)
  - Danger: Tailwind `red` (destructive actions, validation errors)
- Typography:
  - Base `text-sm` for headers, `text-xs` for inputs and meta text
  - Clear hierarchy via `font-semibold` in headers and action buttons
- Spacing:
  - Consistent `px-3 py-2` for headers, `px-3 py-1` for controls
  - `space-y-2` for stacked lists; `gap-2` for inline control groups
- Components (defined via `@layer components` in `popup.html`):
  - `btn`, `btn-primary`, `btn-neutral`, `btn-danger`
  - `input`, `select`, `textarea`, `card`, `label`
  - All interactive elements include `focus-visible` rings for accessibility
- States & feedback:
  - The status area (`#statusMessage`) shows transient messages for saves, errors, and toggles with semantic colors.

## Accessibility
- Keyboard navigation:
  - Rule headers are focusable; `Enter`/`Space` toggles the accordion.
  - Arrow keys navigate between rule headers; `Home`/`End` jumps to first/last.
- ARIA:
  - Toggle uses `role="switch"` with `aria-checked` state.
  - Panels use `role="region"` and are labelled by their headers.
  - Validation sets `aria-invalid` and displays an alert region when JSON is invalid.
- Contrast:
  - Buttons and focus rings use accessible color pairs (e.g. blue-600 on white).

## Responsive Layouts
- The popup adapts from `min-w-[360px]` (compact) up to `md:min-w-[600px]`.
- Content scrolls inside the rules list while the header remains accessible.

## Notes on Preview Functionality
- There is no preview pane in the popup UI. The redesign removes any prior preview-related UI, while preserving all rule management features.

## Troubleshooting
- Mocks not applying:
  - Confirm the pattern matches the request URL; try `substring` first.
  - Ensure the page initiates the request via `fetch`/`XHR` (service worker or extension requests aren’t intercepted).
  - Check console logs: look for "Mockzilla: injected.js loaded" and any warnings.
- JSON body not returning as expected:
  - Validate the JSON; invalid JSON is returned as a string.
- No hits recorded:
  - Verify the tab is active; counters are per-tab.
  - Click `Clear Hits` to reset and try again.

## Notes
- Responses always return `200 OK` with the designated `Content-Type`.
- This extension patches page context only. Network-level interception (`chrome.webRequest`) is not used.
- Patterns may include quotes; they’re stripped for matching.
