# Development Guide

## Prerequisites

- Node.js 18+
- Chromium/Chrome 114+
- Git

## Test

```bash
npm test
npm run validate
```

## Build

```bash
npm run build:public
npm run build:personal
npm run build:developer
```

Artifacts are written to `dist/`.

## Manual smoke test

1. Load the unpacked `extension/` directory.
2. Open a normal `https://` page containing ordinary links and multipart downloads.
3. Click Scan.
4. Verify that the page is not navigated and no download is initiated by scanning.
5. Switch between Parts and Links.
6. Select records and test Copy/TXT/JSON.
7. Test Download Selected only after explicit user action.
