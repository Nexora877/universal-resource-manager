(() => {
  const normalize = value => String(value || '')
    .replace(/[۰-۹]/g, char => '۰۱۲۳۴۵۶۷۸۹'.indexOf(char))
    .replace(/\u200c/g, ' ')
    .trim();

  const absolute = value => {
    try {
      return new URL(value, location.href).href;
    } catch {
      return null;
    }
  };

  const validHttp = value => {
    const url = absolute(value);
    return !!url && /^https?:\/\//i.test(url) && !/^(?:javascript|data|blob|mailto):/i.test(url);
  };

  const fileName = value => {
    try {
      return decodeURIComponent(new URL(value).pathname.split('/').pop() || '');
    } catch {
      return '';
    }
  };

  const hostname = value => {
    try {
      return new URL(value).hostname;
    } catch {
      return '';
    }
  };

  const normalizeResourceUrl = value => {
    try {
      const parsed = new URL(value);
      parsed.hash = '';
      parsed.searchParams.sort();
      return parsed.href;
    } catch {
      return String(value || '');
    }
  };

  const basePartKey = (file, domain) => {
    const clean = normalize(file).replace(/\.[a-z0-9]{1,8}(?:[?#].*)?$/i, '');
    const base = clean
      .replace(/(?:^|[._ -])(?:part|pt)[._ -]?\d{1,5}(?=$|[._ -])/i, '')
      .replace(/(?:^|[._ -])(?:cd|disc|disk)[._ -]?\d{1,5}(?=$|[._ -])/i, '')
      .replace(/(?:^|[._ -])(?:\d{3})(?=$|[._ -])/i, '')
      .replace(/[._ -]+$/g, '')
      .toLowerCase();
    return `${domain}|${base}`;
  };

  const classify = value => {
    const text = String(value || '').toLowerCase();
    if (/\.(?:rar|zip|7z|001|002|003|004|005|006|007|008|009|010|011|012|013|014|015|016|017|018|019|020|iso|tar|gz|bz2|xz)(?:[?#].*)?$/i.test(text)) return 'archive';
    if (/\.(?:exe|msi|apk|dmg|deb|rpm|pkg|appimage)(?:[?#].*)?$/i.test(text)) return 'package';
    if (/\.(?:mp4|mkv|avi|mov|webm|mp3|wav|flac|m4a|ogg)(?:[?#].*)?$/i.test(text)) return 'media';
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|ico|avif|bmp|tiff)(?:[?#].*)?$/i.test(text)) return 'image';
    if (/\.(?:pdf|docx?|xlsx?|pptx?|txt|csv|epub|rtf)(?:[?#].*)?$/i.test(text)) return 'document';
    if (/\.(?:js|mjs|css|map|wasm|json|xml)(?:[?#].*)?$/i.test(text)) return 'script';
    return 'other';
  };

  const isDownloadLike = value => {
    const text = String(value || '').toLowerCase();
    return (
      classify(text) === 'archive' ||
      classify(text) === 'package' ||
      /(?:\/(?:download|downloads|dl\d*|file|files|attachment|attachments|storage)(?:\/|\?|$)|\/cdn(?:\/|\?|$))/i.test(text)
    );
  };

  const partFromFilename = value => {
    const text = normalize(value);
    const patterns = [
      /(?:^|[._-])part[._ -]?(\d{1,5})(?=[._-]|$)/i,
      /(?:^|[._-])part(\d{1,5})(?=\.[^.]+(?:[?#]|$))/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return Number(match[1]);
    }
    return null;
  };

  const partFromContext = value => {
    const text = normalize(value);
    const match = text.match(/(?:download\s+)?(?:part|پارت|قسمت|episode)\s*[-_.:#-]?\s*(\d{1,5})(?=$|[\s)\]}:|._-])/i);
    return match ? Number(match[1]) : null;
  };

  const linkMap = new Map();
  const partMap = new Map();

  const addLink = (rawUrl, source, context = '') => {
    const url = absolute(rawUrl);
    if (!validHttp(url)) return;

    const file = fileName(url);
    const downloadLike = isDownloadLike(url);
    const filePart = partFromFilename(file);
    const contextPart = partFromContext(context);
    let part = filePart;
    let partConfidence = filePart != null ? 1 : 0;

    if (part == null && contextPart != null && downloadLike) {
      part = contextPart;
      partConfidence = 0.86;
    }

    const parsed = new URL(url);
    const domain = hostname(url);
    const normalizedUrl = normalizeResourceUrl(url);
    const item = {
      id: crypto.randomUUID(),
      url,
      normalizedUrl,
      duplicateKey: normalizedUrl,
      resourceGroup: basePartKey(file, domain),
      domain,
      file,
      type: classify(url),
      source,
      part,
      partConfidence,
      isDownload: downloadLike,
      isExternal: parsed.origin !== location.origin
    };

    const existing = linkMap.get(normalizedUrl);
    if (existing) {
      existing.source = existing.source === source ? source : `${existing.source},${source}`;
      existing.isDownload = existing.isDownload || item.isDownload;
      existing.part = existing.part ?? item.part;
      existing.partConfidence = Math.max(existing.partConfidence || 0, item.partConfidence || 0);
    } else {
      linkMap.set(normalizedUrl, item);
    }

    if (
      part != null &&
      part >= 1 &&
      part <= 9999 &&
      (filePart != null || (contextPart != null && downloadLike))
    ) {
      const key = `${part}|${url}`;
      partMap.set(key, item);
    }
  };

  const scanText = (text, source, context = '') => {
    for (const url of normalize(text).match(/https?:\/\/[^\s"'<>\\)]+/g) || []) {
      addLink(url, source, context || text);
    }
  };

  const scanRoot = root => {
    if (!root?.querySelectorAll) return;

    const selector = 'a[href],area[href],iframe[src],source[src],video[src],audio[src],img[src],script[src],link[href],[data-href],[data-url],[data-link],[data-download],[data-file],[data-src],[onclick]';

    for (const element of root.querySelectorAll(selector)) {
      const context = normalize(
        element.innerText ||
        element.textContent ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        ''
      );

      for (const attribute of ['href','src','data-href','data-url','data-link','data-download','data-file','data-src']) {
        const value = element.getAttribute(attribute);
        if (value) addLink(value, 'DOM', context || value);
      }

      for (const attribute of element.getAttributeNames?.() || []) {
        const value = element.getAttribute(attribute) || '';
        scanText(value, 'DOM', context || value);
      }

      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
        scanText(element.textContent || '', element.tagName === 'SCRIPT' ? 'Script' : 'Style', context);
      }

      if (element.shadowRoot) scanRoot(element.shadowRoot);
    }

    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) scanRoot(element.shadowRoot);
    }
  };

  scanRoot(document);

  for (const resource of performance.getEntriesByType('resource')) {
    addLink(resource.name, 'Network');
  }

  for (const script of document.scripts) {
    scanText(script.textContent || '', 'Script');
  }

  const links = [...linkMap.values()].sort((a, b) => a.url.localeCompare(b.url));
  const groups = new Map();
  for (const item of partMap.values()) {
    const groupKey = `${item.resourceGroup}|${item.part}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { part: item.part, resourceGroup: item.resourceGroup, mirrors: [] });
    groups.get(groupKey).mirrors.push(item);
  }

  const partGroups = [...groups.values()]
    .sort((a, b) => a.part - b.part || a.resourceGroup.localeCompare(b.resourceGroup))
    .map(group => ({
      part: group.part,
      resourceGroup: group.resourceGroup,
      mirrors: [...new Map(group.mirrors.map(item => [item.normalizedUrl, item])).values()]
        .sort((a, b) => b.partConfidence - a.partConfidence || a.url.localeCompare(b.url))
    }));

  const numbers = partGroups.map(group => group.part);
  const missing = [];
  if (numbers.length >= 2) {
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const span = max - min;
    if (span <= 100 && numbers.filter(number => number <= min + 64).length >= Math.min(3, span + 1)) {
      for (let n = min; n <= max; n++) {
        if (!numbers.includes(n)) missing.push(n);
      }
    }
  }

  const linkCounts = links.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    if (item.isDownload) counts.download = (counts.download || 0) + 1;
    if (item.isExternal) counts.external = (counts.external || 0) + 1;
    else counts.internal = (counts.internal || 0) + 1;
    return counts;
  }, {});

  const sourceCounts = links.reduce((counts, item) => {
    counts[item.source] = (counts[item.source] || 0) + 1;
    return counts;
  }, {});

  const duplicateBuckets = new Map();
  for (const item of links) {
    const key = item.duplicateKey || item.normalizedUrl || item.url;
    if (!duplicateBuckets.has(key)) duplicateBuckets.set(key, []);
    duplicateBuckets.get(key).push(item);
  }
  const duplicateGroups = [...duplicateBuckets.values()].filter(group => group.length > 1);
  const resources = {
    total: links.length,
    downloadable: links.filter(item => item.isDownload).length,
    types: linkCounts,
    duplicates: { groups: duplicateGroups.length, items: duplicateGroups.reduce((n, group) => n + group.length, 0) },
    sources: sourceCounts
  };

  const result = {
    version: 6,
    scannerVersion: '0.2.4',
    scanId: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    page: {
      title: document.title,
      url: location.href,
      domain: location.hostname,
      origin: location.origin
    },
    parts: {
      groups: partGroups,
      missing,
      total: partGroups.length,
      mirrorGroups: partGroups.filter(group => group.mirrors.length > 1).length,
      complete: missing.length === 0 && partGroups.length > 0
    },
    links: { items: links, total: links.length, counts: linkCounts, sources: sourceCounts },
    resources
  };

  globalThis.__URM_SCAN_RESULT = result;
  return result;
})();
