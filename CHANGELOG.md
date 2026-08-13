# Changelog

## 0.2.4 - 2026-08-13
- Fix Side Panel target resolution when Chrome does not expose the active tab URL to the extension context.
- Prefer an HTTP(S) candidate when available, otherwise retain the active tab by ID and let `scripting.executeScript` validate access.
- Preserve the existing `activeTab`-first permission model without adding the broad `tabs` permission.
- Improve restricted-page diagnostics when the current tab cannot be accessed.

## 0.2.3
- Harden active-tab resolution for Side Panel scanning.
- Add background fallback for resolving the active HTTP(S) tab.
- Improve scan error diagnostics when the active tab is restricted or unavailable.

## 0.2.3 - 2026-08-13

- Unified Parts and Links around a shared scan dataset.
- Added source-aware link metadata and multipart confidence.
- Hardened multipart detection against arbitrary `P30`-style false positives.
- Switched runtime access requests to the current site origin instead of requesting `<all_urls>` directly.
- Added developer, personal, and public release channels.
- Added build profiles, expanded tests, GitHub contribution templates, and release documentation.
- Refined the side panel for local-first scanning and explicit download actions.
- Added Persian project documentation.

## 0.2.1

- Added conservative Part detection.
- Added mirror selection and filtered Link Collector categories.
- Added local privacy documentation and release tooling.
