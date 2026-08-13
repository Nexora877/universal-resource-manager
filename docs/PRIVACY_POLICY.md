# Privacy Policy

Universal Resource Manager is designed for local-first processing.

## Data processed

When the user activates Scan, the extension reads URLs and related metadata exposed by the current page and by browser APIs available to the extension. This information is used to render the Parts and Links views.

## Data collection

The extension does not send discovered links, page contents, browsing history, or scan results to a developer-owned server.

## Storage

Settings are stored in `chrome.storage.local`. The scan result is kept in extension memory for the current session.

## Downloads

Downloads are started only after the user explicitly activates the download action. The extension delegates downloads to Chrome's built-in Downloads API.

## Permissions

`activeTab`, `scripting`, `sidePanel`, `downloads`, and `storage` support the product. Optional host access is requested only when page inspection needs origin access.

## Support

Public support is handled through the project repository issue tracker. Security-sensitive reports should use the private security reporting channel described in `SECURITY.md`.
