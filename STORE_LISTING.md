# Chrome Web Store Listing Draft

## Name
Universal Manager

## Short description
Scan web pages locally, collect links, detect multipart downloads, choose mirrors, export URLs, and download selected items.

## Full description
Universal Manager combines two related workflows in one Chrome side panel: multipart download management and general page-link collection.

Scan only the page you explicitly choose. Review Parts, missing segments, mirrors, and link categories before copying, exporting, or starting downloads.

Key features:
- multipart Part detection with conservative filename/context evidence
- mirror selection per Part
- missing-Part hints
- page-link collection with category filters
- DOM, data-attribute, open Shadow DOM, script, and Performance resource discovery
- TXT and JSON export
- user-confirmed downloads through Chrome Downloads API
- local-first processing with no developer-owned telemetry endpoint

## Privacy

The extension does not upload scan results or extracted links to a developer-owned server. See `docs/PRIVACY_POLICY.md`.
