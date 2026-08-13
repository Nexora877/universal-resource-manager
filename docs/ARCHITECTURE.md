# Architecture v0.2.4

## Product model

Universal Resource Manager is one product with two views over one scan dataset. Multipart detection and generic link collection are not separate scanners.

## Layers

1. **Access layer** — activeTab first; current-origin optional host permission only when required.
2. **Scan layer** — DOM, attributes, open Shadow DOM, script text, Performance resources.
3. **Intelligence layer** — URL parsing, link classification, download-likeness, multipart evidence, mirror grouping, confidence.
4. **State layer** — current-page dataset, selection sets, settings.
5. **Views** — Parts and Links.
6. **Action layer** — copy, TXT/JSON export, and explicit downloads through `chrome.downloads`.

## Part detection policy

Strong filename evidence wins (`part01.rar`, `part-02.zip`). Context-based detection is only accepted when the URL also looks download-like. Arbitrary `P30` or unrelated numeric text is not sufficient evidence.

## Data contract

```text
page
parts.groups[]
  part
  mirrors[]
    url
    normalizedUrl
    domain
    file
    source
    partConfidence
links.items[]
  id
  url
  normalizedUrl
  domain
  file
  type
  source
  part
  partConfidence
  isDownload
  isExternal
```

## Non-goals

The scanner does not bypass authentication, CAPTCHA, access controls, DRM, or site-side authorization. It only processes information the active page exposes to the extension through permitted browser APIs.
