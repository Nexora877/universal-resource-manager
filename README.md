# Universal Manager

**Unified Link Intelligence for Chrome.**

Universal Manager is a Manifest V3 extension that scans a page only when the user asks it to, then exposes one local dataset through two coordinated views:

- **Parts** — multipart download detection, missing-part analysis, mirror selection, exports, and user-triggered batch downloads.
- **Links** — page URL discovery with download, archive, media, image, document, internal, and external filters.

The scanner combines DOM URLs, data attributes, inline script URLs, open Shadow DOM roots, and resources already visible through the page Performance API. It never clicks download controls just to discover links.

## Architecture

```text
Active Tab
   |
   v
Scan Engine
   +-- DOM / data-* / attributes
   +-- open Shadow DOM
   +-- inline scripts
   +-- Performance resources
   |
   v
Unified Link Dataset
   +-- URL metadata
   +-- classification
   +-- multipart evidence
   +-- source / confidence
   |
   +-------------------+
   |                   |
   v                   v
Parts View          Links View
   |                   |
   +---------+---------+
             |
             v
        Selection Model
             |
       +-----+-----+
       |     |     |
      Copy Export Download
```

## Permission model

The extension uses `activeTab` first. When temporary access is insufficient, it requests only the current site origin from the optional host-permission set. It does not require `<all_urls>` at install time.

## Local-first privacy

The scanner runs in the page context and returns results to the extension UI. No developer-owned telemetry endpoint is required. Extracted URLs are not uploaded by the extension.

## Development

```bash
npm run validate
npm test
npm run build:public
npm run build:personal
npm run build:developer
```

Load `extension/` unpacked from `chrome://extensions` for local development.

## Release channels

- `developer`: full repository, diagnostics, tests, release tooling, and architecture docs.
- `personal`: richer local diagnostics and a personal build profile for daily use.
- `public`: clean Chrome Web Store package and public-facing documentation.

## License

MIT.

## Languages

The extension defaults to **English** and also supports **Persian (Farsi)**. Language can be changed from **Settings → Appearance & Experience → Language**.

## Publishing

See `docs/PUBLISHING.md` for Chrome Web Store and GitHub release instructions.
