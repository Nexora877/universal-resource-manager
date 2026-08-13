const DEFAULTS = {
  mode: 'parts',
  confirmDownloads: true,
  keepQueryStrings: true,
  maxParallelDownloads: 3,
  theme: 'system',
  accentColor: 'default',
  themePack: 'midnight',
  compactMode: false,
  reduceMotion: false,
  diagnostics: true,
  historyLimit: 8,
  language: 'en'
};

const BUILD = globalThis.UM_BUILD || { channel: 'public', debug: false, diagnostics: false, appName: 'Universal Resource Manager', subtitle: 'Local Resource Intelligence' };
const T = key => (globalThis.URM_I18N?.dictionaries?.[document.documentElement.lang || 'en']?.[key] || globalThis.URM_I18N?.dictionaries?.en?.[key] || key);

const state = {
  mode: 'parts',
  linkFilter: 'all',
  data: null,
  selectedParts: new Set(),
  selectedLinks: new Set(),
  selectedMirrors: new Map(),
  settings: { ...DEFAULTS },
  view: 'results',
  historyScope: 'site',
  queue: []
};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function log(level, event, details = {}) {
  if (!state.settings.diagnostics && !BUILD.diagnostics) return;
  chrome.runtime.sendMessage({ type: 'log', level, event, details }).catch(() => {});
}

function errorText(error) {
  return String(error?.message || error || 'Unknown error').replace(/^Error:\s*/, '');
}

async function loadSettings() {
  state.settings = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
  await globalThis.URM_I18N?.apply();
  state.mode = state.settings.mode;
  applyAppearance();
  $('.tab.active')?.classList.remove('active');
  document.querySelector(`.tab[data-mode="${state.mode}"]`)?.classList.add('active');
}

function applyAppearance() {
  document.documentElement.dataset.theme = state.settings.theme || 'system';
  document.documentElement.dataset.accent = state.settings.accentColor || 'default';
  document.documentElement.dataset.themePack = state.settings.themePack || 'midnight';
  document.documentElement.classList.toggle('compact', Boolean(state.settings.compactMode));
  document.documentElement.classList.toggle('reduce-motion', Boolean(state.settings.reduceMotion));
}

function setStatus(message = '', kind = 'info') {
  const node = $('#status');
  node.textContent = message;
  node.className = message ? `status ${kind}` : 'status hidden';
}

async function getTargetTab() {
  const candidates = [];
  for (const query of [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true }
  ]) {
    try {
      const tabs = await chrome.tabs.query(query);
      if (tabs[0] && !candidates.some(tab => tab.id === tabs[0].id)) candidates.push(tabs[0]);
    } catch (error) {
      log('warn', 'tabs.query.failed', { error: errorText(error) });
    }
  }
  try {
    const result = await chrome.runtime.sendMessage({ type: 'getActiveWebTab' });
    if (result?.tab && !candidates.some(tab => tab.id === result.tab.id)) candidates.push(result.tab);
  } catch (error) {
    log('warn', 'background.active-tab.failed', { error: errorText(error) });
  }
  const tab = candidates.find(item => Number.isInteger(item?.id));
  if (!tab) throw new Error(T('error.noTab'));
  return tab;
}

async function readScannerResult(tabId) {
  const read = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const value = globalThis.__URM_SCAN_RESULT;
      return value && typeof value === 'object' ? value : null;
    }
  });
  return read?.[0]?.result || null;
}

async function ensurePageAccess(tab) {
  if (!Number.isInteger(tab?.id)) throw new Error(T('error.invalidTab'));
  let liveTab;
  try {
    liveTab = await chrome.tabs.get(tab.id);
  } catch (error) {
    throw new Error(`${T('error.tabGone')} ${errorText(error)}`);
  }
  const url = liveTab?.url || tab?.url || '';
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(T('error.httpPage'));
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { delete globalThis.__URM_SCAN_RESULT; }
    });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scanner.js'] });
  } catch (error) {
    const text = errorText(error);
    log('error', 'scan.execute.failed', { tabId: tab.id, url, error: text });
    throw new Error(`${T('error.pageAccess')} ${text}`);
  }

  const first = await readScannerResult(tab.id);
  if (first) return first;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { delete globalThis.__URM_SCAN_RESULT; }
  }).catch(() => {});

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scanner.js'] });
  } catch (error) {
    throw new Error(`${T('error.scanRetry')} ${errorText(error)}`);
  }
  const second = await readScannerResult(tab.id);
  if (!second) throw new Error(T('error.noResult'));
  return second;
}

function isValidScanData(data) {
  return Boolean(
    data && typeof data === 'object' &&
    data.page && typeof data.page === 'object' &&
    data.parts && Array.isArray(data.parts.groups) &&
    data.links && Array.isArray(data.links.items)
  );
}

async function saveHistory(data) {
  try {
    await chrome.runtime.sendMessage({ type: 'saveScanHistory', data });
  } catch (error) {
    log('warn', 'history.save.message.failed', { error: errorText(error) });
  }
}

async function scan() {
  $('#scanButton').disabled = true;
  $('#scanButton').textContent = T('side.scanning');
  setStatus(T('status.scanning'), 'info');
  const started = performance.now();
  log('info', 'scan.started', { mode: state.mode });

  try {
    const tab = await getTargetTab();
    const data = await ensurePageAccess(tab);
    if (!isValidScanData(data)) {
      throw new Error(T('error.invalidResult'));
    }
    state.data = data;
    state.selectedParts.clear();
    state.selectedLinks.clear();
    state.selectedMirrors.clear();
    $('#pageMeta').textContent = `${data.page.domain || 'Page'} · ${data.page.title || 'Untitled'}`;
    const parts = data.parts.total;
    const links = data.links.total;
    const duration = Math.round(performance.now() - started);
    const sourceInfo = BUILD.diagnostics && data.links.sources ? ` · DOM ${data.links.sources.DOM || 0} · Network ${data.links.sources.Network || 0}` : '';
    setStatus(`${T('status.scanComplete')} · ${parts} ${T('unit.parts')} · ${links} ${T('unit.links')} · ${duration} ms${sourceInfo}`, 'good');
    await saveHistory(data);
    log('info', 'scan.completed', { parts, links, duration, resources: data.resources?.total || links, duplicates: data.resources?.duplicates?.groups || 0 });
    render();
  } catch (error) {
    state.data = null;
    const message = errorText(error);
    $('#pageMeta').textContent = T('status.scanUnavailable');
    setStatus(message, 'error');
    log('error', 'scan.failed', { error: message });
    render();
  } finally {
    $('#scanButton').disabled = false;
    $('#scanButton').textContent = T('side.scan');
  }
}

function filteredParts() {
  const query = $('#search').value.trim().toLowerCase();
  return (state.data?.parts?.groups || []).filter(group => {
    if (!query) return true;
    return group.part.toString().includes(query) || group.mirrors.some(item => `${item.url} ${item.file} ${item.domain}`.toLowerCase().includes(query));
  });
}

function filteredLinks() {
  const query = $('#search').value.trim().toLowerCase();
  return (state.data?.links?.items || []).filter(item => {
    if (state.linkFilter === 'download' && !item.isDownload) return false;
    if (state.linkFilter === 'external' && !item.isExternal) return false;
    if (state.linkFilter === 'internal' && item.isExternal) return false;
    if (['archive', 'package', 'media', 'image', 'document', 'script'].includes(state.linkFilter) && item.type !== state.linkFilter) return false;
    if (!query) return true;
    return `${item.url} ${item.file} ${item.domain} ${item.type} ${item.source} ${item.part ?? ''}`.toLowerCase().includes(query);
  });
}

function renderSummary() {
  const summary = $('#summary');
  if (!state.data) {
    summary.innerHTML = '';
    return;
  }

  if (state.mode === 'parts') {
    const { total, mirrorGroups, missing, complete } = state.data.parts;
    summary.innerHTML = `
      <span class="badge">${total} parts</span>
      <span class="badge ${complete ? 'good' : missing.length ? 'warn' : ''}">${complete ? 'Complete' : missing.length ? `Missing ${missing.join(', ')}` : 'Detected'}</span>
      <span class="badge">${mirrorGroups} mirror groups</span>
      <span class="badge">${state.data.resources?.duplicates?.groups || 0} duplicate groups</span>`;
  } else {
    const { counts, total } = state.data.links;
    summary.innerHTML = `
      <span class="badge">${total} links</span>
      <span class="badge">${counts.download || 0} downloads</span>
      <span class="badge">${counts.external || 0} external</span>
      <span class="badge">${counts.archive || 0} archives</span>
      <span class="badge">${state.data.resources?.total || total} resources</span>`;
  }
}

function renderList() {
  const list = $('#list');

  if (!state.data) {
    list.innerHTML = `
      <div class="empty">
        <strong>${T('empty.ready')}</strong>
        ${T('empty.ready.desc')}
      </div>`;
    return;
  }

  if (state.mode === 'parts') {
    const items = filteredParts();
    if (!items.length) {
      list.innerHTML = `<div class="empty">${T('empty.noParts')}</div>`;
      return;
    }

    list.innerHTML = items.map(group => {
      const index = state.data.parts.groups.indexOf(group);
      const checked = state.selectedParts.has(group.part) ? 'checked' : '';
      const selectedIndex = state.selectedMirrors.get(group.part) ?? 0;
      const selectedMirror = group.mirrors[selectedIndex] || group.mirrors[0];
      const options = group.mirrors.map((mirror, mirrorIndex) =>
        `<option value="${mirrorIndex}" ${mirrorIndex === selectedIndex ? 'selected' : ''}>Mirror ${mirrorIndex + 1} · ${escapeHtml(mirror.domain)}</option>`
      ).join('');

      return `
        <label class="row">
          <input type="checkbox" data-part-index="${index}" ${checked}>
          <span class="part-number">Part ${String(group.part).padStart(2, '0')}</span>
          <span class="file" title="${escapeHtml(selectedMirror.file || selectedMirror.url)}">
            <span class="file-name">${escapeHtml(selectedMirror.file || selectedMirror.url)}</span>
            <span class="source">${escapeHtml(selectedMirror.source)}${group.mirrors.length > 1 ? ` · ${group.mirrors.length} mirrors` : ''}</span>
          </span>
          <span class="domain">${escapeHtml(selectedMirror.domain)}</span>
          ${group.mirrors.length > 1 ? `<select class="mirror-select" data-part-mirror="${index}" aria-label="Select mirror">${options}</select>` : '<span class="domain">1 mirror</span>'}
        </label>`;
    }).join('');
    return;
  }

  const items = filteredLinks();
  if (!items.length) {
    list.innerHTML = `<div class="empty">${T('empty.noLinks')}</div>`;
    return;
  }

  list.innerHTML = items.map(item => {
    const index = state.data.links.items.indexOf(item);
    const checked = state.selectedLinks.has(item.url) ? 'checked' : '';
    return `
      <label class="link-row">
        <input type="checkbox" data-link-index="${index}" ${checked}>
        <span class="type">${escapeHtml(item.type)}</span>
        <span class="file" title="${escapeHtml(item.url)}">
          <span class="file-name">${escapeHtml(item.file || item.url)}</span>
          <span class="source">${escapeHtml(item.source)}${item.part ? ` · Part ${item.part}` : ''}${item.isDownload ? ' · download-like' : ''}</span>
        </span>
        <span class="domain">${escapeHtml(item.domain)}</span>
      </label>`;
  }).join('');
}

function updateCount() {
  const count = state.mode === 'parts' ? state.selectedParts.size : state.selectedLinks.size;
  $('#count').textContent = `${count} selected`;
  $('#copyButton').disabled = count === 0;
  $('#txtButton').disabled = count === 0;
  $('#jsonButton').disabled = count === 0;
  $('#downloadButton').disabled = count === 0;
}

function render() {
  document.querySelectorAll('.tab').forEach(tab => {
    const active = state.view === 'results' ? tab.dataset.view === 'results' && tab.dataset.mode === state.mode : tab.dataset.view === state.view;
    tab.classList.toggle('active', active);
  });
  $('#resultsView').classList.toggle('hidden', state.view !== 'results');
  $('#historyView').classList.toggle('hidden', state.view !== 'history');
  $('#errorsView').classList.toggle('hidden', state.view !== 'errors');
  $('#resultsFooter').classList.toggle('hidden', state.view !== 'results');
  $('#linkFilter').style.display = state.mode === 'links' ? '' : 'none';
  renderSummary();
  renderList();
  updateCount();
}

async function currentSiteOrigin() {
  if (state.data?.page?.origin) return state.data.page.origin;
  try {
    const tab = await getTargetTab();
    const url = tab?.url || '';
    if (/^https?:\/\//i.test(url)) return new URL(url).origin;
  } catch {}
  return '';
}

async function renderHistory() {
  const response = await chrome.runtime.sendMessage({ type: 'getScanHistory' });
  const history = response?.history || [];
  const site = await currentSiteOrigin();
  const scoped = state.historyScope === 'site' && site ? history.filter(item => (item.origin || item.data?.page?.origin || '') === site) : history;
  $('#historyScopeLabel').textContent = state.historyScope === 'site' && site ? `${T('history.scansOf')} ${new URL(site).hostname}` : T('history.allSites');
  $('#historyPanel').innerHTML = scoped.length ? scoped.map(item => {
    const data = item.data || {};
    const date = item.savedAt ? new Date(item.savedAt).toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US') : '';
    const links = data.links?.total || 0;
    const parts = data.parts?.total || 0;
    const domain = item.domain || data.page?.domain || T('common.unknown');
    const complete = data.parts?.complete ? T('common.complete') : data.parts?.missing?.length ? `${T('common.incomplete')} · ${data.parts.missing.join(', ')}` : T('common.detected');
    return `<button class="history-item" data-history-id="${escapeHtml(item.id)}"><strong>${escapeHtml(data.page?.title || domain || 'Scan')}</strong><small>${escapeHtml(date)}</small><span class="site">${escapeHtml(domain)}</span><span class="tags"><span class="tag">${parts} پارت</span><span class="tag">${links} لینک</span><span class="tag">${escapeHtml(complete)}</span></span></button>`;
  }).join('') : `<div class="empty"><strong>${T('empty.noHistory')}</strong>${T('empty.noHistory.desc')}</div>`;
}

async function toggleHistory() {
  state.view = 'history';
  await renderHistory();
  render();
}

async function restoreHistory(id) {
  const response = await chrome.runtime.sendMessage({ type: 'getScanHistory' });
  const item = (response?.history || []).find(entry => entry.id === id);
  if (!item?.data) return;
  state.data = item.data;
  state.selectedParts.clear();
  state.selectedLinks.clear();
  state.selectedMirrors.clear();
  $('#pageMeta').textContent = `${state.data.page?.domain || 'Page'} · ${state.data.page?.title || 'Untitled'}`;
  setStatus(T('status.historyRestored'), 'good');
  state.view = 'results';
  render();
}

function errorLabel(event) {
  const labels = {
    'scan.failed': T('error.scanFailed'), 'scan.execute.failed': T('error.scanExecute'), 'history.save.failed': T('error.historySave'), 'download.start.failed': T('error.downloadStart'), 'download.batch.failed': T('error.downloadBatch'), 'contextMenu.open-panel.failed': T('error.contextMenu')
  };
  return labels[event] || event || T('error.unknown');
}

async function renderErrors() {
  const response = await chrome.runtime.sendMessage({ type: 'getDiagnostics' });
  const logs = response?.data?.logs || [];
  const errors = logs.filter(item => ['error', 'fatal'].includes(item.level)).slice(-20).reverse();
  $('#errorCount').textContent = errors.length.toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US');
  $('#errorsPanel').innerHTML = errors.length ? errors.map(item => {
    const details = item.details && typeof item.details === 'object' ? Object.entries(item.details).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ') : 'جزئیات ثبت نشده است.';
    return `<article class="error-item"><div class="error-head"><strong>${escapeHtml(errorLabel(item.event))}</strong><code>${escapeHtml(item.errorId || 'URM-GENERIC')}</code></div><p>${escapeHtml(details)}</p><time>${escapeHtml(new Date(item.time).toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US'))}</time></article>`;
  }).join('') : `<div class="empty"><strong>${T('empty.noErrors')}</strong>${T('empty.noErrors.desc')}</div>`;
}

async function toggleErrors() {
  state.view = 'errors';
  await renderErrors();
  await refreshQueue();
  render();
}

async function refreshQueue() {
  const response = await chrome.runtime.sendMessage({ type: 'getDownloadQueue' });
  state.queue = response?.queue || [];
  renderQueue();
}

function queueLabel(stateName) {
  return T(`queue.${stateName}`) || stateName;
}

function renderQueue() {
  const panel = $('#queuePanel');
  if (!panel) return;
  if (!state.queue.length) { panel.innerHTML = `<div class="empty"><strong>${T('queue.empty')}</strong></div>`; return; }
  panel.innerHTML = state.queue.slice().reverse().map(item => {
    const label = queueLabel(item.state);
    const action = item.state === 'downloading' ? `<button data-queue-action="pause" data-queue-id="${item.id}">${T('queue.pause')}</button>` : item.state === 'paused' ? `<button data-queue-action="resume" data-queue-id="${item.id}">${T('queue.resume')}</button>` : (item.state === 'failed' || item.state === 'cancelled') ? `<button data-queue-action="retry" data-queue-id="${item.id}">${T('queue.retry')}</button>` : '';
    const cancel = ['queued','downloading','paused'].includes(item.state) ? `<button data-queue-action="cancel" data-queue-id="${item.id}">${T('queue.cancel')}</button>` : '';
    return `<article class="queue-item"><div><strong>${escapeHtml(item.file || item.url)}</strong><small>${escapeHtml(label)}</small></div><div class="queue-actions">${action}${cancel}</div></article>`;
  }).join('');
}

async function validateSelected() {
  const urls = selectedUrls().map(normalizedUrl);
  if (!urls.length) return;
  setStatus(T('status.validating'), 'info');
  const response = await chrome.runtime.sendMessage({ type: 'validateResources', urls });
  if (!response?.ok) { setStatus(response?.error || T('error.downloadRequest'), 'error'); return; }
  const summary = response.results.reduce((acc, item) => { acc[item.statusClass] = (acc[item.statusClass] || 0) + 1; return acc; }, {});
  setStatus(`${T('status.validation')} · ${response.results.length} · OK ${summary.ok || 0} · ${summary.missing || 0} unavailable`, summary.missing ? 'warn' : 'good');
  log('info', 'resource.validation.completed', { count: response.results.length, summary });
}

function selectedRows() {
  if (!state.data) return [];

  if (state.mode === 'links') {
    return state.data.links.items.filter(item => state.selectedLinks.has(item.url));
  }

  return state.data.parts.groups
    .filter(group => state.selectedParts.has(group.part))
    .map(group => {
      const mirrorIndex = state.selectedMirrors.get(group.part) ?? 0;
      return { ...group, selected: group.mirrors[mirrorIndex] || group.mirrors[0] };
    });
}

function exportRows() {
  if (state.mode === 'links') return selectedRows();
  return selectedRows().map(group => ({
    part: group.part,
    url: group.selected.url,
    file: group.selected.file,
    domain: group.selected.domain,
    source: group.selected.source
  }));
}

function selectedUrls() {
  return exportRows().map(item => item.url);
}

function normalizedUrl(url) {
  if (state.settings.keepQueryStrings) return url;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  setStatus(T('status.copied'), 'good');
}

function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadSelected() {
  const urls = selectedUrls().map(normalizedUrl);
  if (!urls.length) return;

  if (state.settings.confirmDownloads) {
    const ok = confirm(`${T('confirm.downloadStart')} ${urls.length}`);
    if (!ok) return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'downloadSelected',
    items: urls.map(url => ({ url })),
    maxParallel: state.settings.maxParallelDownloads
  });

  if (!response?.ok) {
    setStatus(response?.error || T('error.downloadRequest'), 'error');
    return;
  }

  setStatus(`${response.queued || urls.length} ${T('status.queueAdded')}`, 'good');
  await refreshQueue();
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', async () => {
    if (tab.dataset.view === 'history') { await toggleHistory(); return; }
    if (tab.dataset.view === 'errors') { await toggleErrors(); return; }
    if (tab.dataset.view === 'queue') { state.view = 'queue'; await refreshQueue(); render(); return; }
    state.view = 'results';
    state.mode = tab.dataset.mode;
    state.selectedParts.clear();
    state.selectedLinks.clear();
    state.selectedMirrors.clear();
    state.linkFilter = 'all';
    $('#linkFilter').value = 'all';
    $('#search').value = '';
    await chrome.storage.local.set({ mode: state.mode });
    render();
  });
}

$('#scanButton').addEventListener('click', scan);
$('#optionsButton').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#search').addEventListener('input', renderList);
$('#linkFilter').addEventListener('change', event => {
  state.linkFilter = event.target.value;
  renderList();
});

$('#selectAll').addEventListener('click', () => {
  if (state.mode === 'parts') filteredParts().forEach(group => state.selectedParts.add(group.part));
  else filteredLinks().forEach(item => state.selectedLinks.add(item.url));
  renderList();
  updateCount();
});

$('#selectNone').addEventListener('click', () => {
  if (state.mode === 'parts') state.selectedParts.clear();
  else state.selectedLinks.clear();
  renderList();
  updateCount();
});

$('#invert').addEventListener('click', () => {
  if (state.mode === 'parts') {
    filteredParts().forEach(group => state.selectedParts.has(group.part) ? state.selectedParts.delete(group.part) : state.selectedParts.add(group.part));
  } else {
    filteredLinks().forEach(item => state.selectedLinks.has(item.url) ? state.selectedLinks.delete(item.url) : state.selectedLinks.add(item.url));
  }
  renderList();
  updateCount();
});

$('#copyButton').addEventListener('click', () => copyText(selectedUrls().map(normalizedUrl).join('\n')));
$('#txtButton').addEventListener('click', () => downloadFile(`${state.mode}.txt`, 'text/plain;charset=utf-8', selectedUrls().map(normalizedUrl).join('\n')));
$('#jsonButton').addEventListener('click', () => downloadFile(`${state.mode}.json`, 'application/json;charset=utf-8', JSON.stringify(exportRows(), null, 2)));
$('#downloadButton').addEventListener('click', downloadSelected);
$('#historyButton').addEventListener('click', toggleHistory);
$('#historyPanel').addEventListener('click', event => { const button = event.target.closest('[data-history-id]'); if (button) restoreHistory(button.dataset.historyId); });
$('#historyScopeSite').addEventListener('click', async () => { state.historyScope = 'site'; await renderHistory(); });
$('#historyScopeAll').addEventListener('click', async () => { state.historyScope = 'all'; await renderHistory(); });
$('#historyRefresh').addEventListener('click', renderHistory);
$('#errorsButton').addEventListener('click', toggleErrors);
$('#queueButton').addEventListener('click', async () => { state.view = 'queue'; await refreshQueue(); render(); });
$('#queueRefresh').addEventListener('click', refreshQueue);
$('#queuePanel').addEventListener('click', async event => { const button = event.target.closest('[data-queue-action]'); if (!button) return; await chrome.runtime.sendMessage({ type: 'queueAction', action: button.dataset.queueAction, queueId: button.dataset.queueId }); await refreshQueue(); });
$('#validateButton').addEventListener('click', validateSelected);
$('#errorsRefresh').addEventListener('click', renderErrors);
$('#errorsOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('#list').addEventListener('change', event => {
  const partIndex = event.target.dataset.partIndex;
  const linkIndex = event.target.dataset.linkIndex;
  const mirrorIndex = event.target.dataset.partMirror;

  if (partIndex !== undefined) {
    const part = state.data.parts.groups[Number(partIndex)].part;
    if (event.target.checked) state.selectedParts.add(part);
    else state.selectedParts.delete(part);
    updateCount();
  }

  if (linkIndex !== undefined) {
    const url = state.data.links.items[Number(linkIndex)].url;
    if (event.target.checked) state.selectedLinks.add(url);
    else state.selectedLinks.delete(url);
    updateCount();
  }

  if (mirrorIndex !== undefined) {
    const group = state.data.parts.groups[Number(mirrorIndex)];
    state.selectedMirrors.set(group.part, Number(event.target.value));
    renderList();
  }
});

(async () => {
  await loadSettings();
  await renderErrors();
  await refreshQueue();
  render();
})();
