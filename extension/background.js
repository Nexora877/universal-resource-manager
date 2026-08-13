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
  loggingLevel: 'normal',
  logLimit: 500,
  historyLimit: 8
};

const DEFAULT_LOG_LIMIT = 500;
const LEVELS = { off: 0, normal: 1, full: 2 };
const EVENT_LEVEL = new Map([['scan.engine.executed', 'full'], ['scan.result.read', 'full'], ['scan.result.empty', 'warn'], ['scan.execute.failed', 'error'], ['scan.completed', 'info'], ['scan.failed', 'error'], ['download.start.failed', 'error'], ['download.state.changed', 'full']]);
const ERROR_IDS = {
  'scan.execute.failed': 'URM-SCAN-EXEC-001',
  'scan.result.empty': 'URM-SCAN-RESULT-002',
  'scan.failed': 'URM-SCAN-003',
  'download.start.failed': 'URM-DOWNLOAD-001',
  'download.batch.failed': 'URM-DOWNLOAD-002',
  'storage.defaults.failed': 'URM-STORAGE-001',
  'history.save.failed': 'URM-HISTORY-001',
  'command.scan-current-tab.failed': 'URM-COMMAND-001'
};

function errText(error) {
  return String(error?.message || error || 'Unknown error');
}

async function log(level, event, details = {}) {
  try {
    const settings = await chrome.storage.local.get({ diagnostics: true, loggingLevel: 'normal', logLimit: DEFAULT_LOG_LIMIT });
    if (!settings.diagnostics || settings.loggingLevel === 'off') return;
    const configured = LEVELS[settings.loggingLevel] ?? LEVELS.normal;
    const required = level === 'error' ? 1 : level === 'warn' ? 1 : level === 'info' ? 1 : 2;
    if (configured < required) return;
    const now = new Date().toISOString();
    const sanitized = { ...details };
    if (sanitized.url) {
      try { sanitized.origin = new URL(sanitized.url).origin; } catch {}
      delete sanitized.url;
    }
    delete sanitized.token;
    delete sanitized.query;
    const entry = { time: now, level, event, errorId: ERROR_IDS[event] || null, details: sanitized };
    const current = await chrome.storage.local.get({ umLogs: [] });
    const limit = Math.max(100, Math.min(1000, Number(settings.logLimit) || DEFAULT_LOG_LIMIT));
    const logs = [...(Array.isArray(current.umLogs) ? current.umLogs : []), entry].slice(-limit);
    await chrome.storage.local.set({ umLogs: logs });
  } catch {}
}

async function setPanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    await log('warn', 'sidePanel.setPanelBehavior.failed', { error: errText(error) });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const current = await chrome.storage.local.get(DEFAULTS);
    await chrome.storage.local.set({ ...DEFAULTS, ...current });
  } catch (error) {
    await log('error', 'storage.defaults.failed', { error: errText(error) });
  }
  await setPanelBehavior();
  await log('info', 'extension.installed-or-updated');
});

chrome.runtime.onStartup.addListener(() => { setPanelBehavior(); processDownloadQueue().catch(() => {}); });
processDownloadQueue().catch(() => {});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: 'urm-open-panel', title: 'Universal Resource Manager — باز کردن پنل', contexts: ['page'] });
  } catch (error) {
    await log('warn', 'contextMenus.setup.failed', { error: errText(error) });
  }
});

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'urm-open-panel' || !tab?.windowId) return;
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    await log('info', 'contextMenu.open-panel', { tabId: tab.id });
  } catch (error) {
    await log('error', 'contextMenu.open-panel.failed', { tabId: tab.id, error: errText(error) });
  }
});

const QUEUE_KEY = 'umDownloadQueue';
let queueProcessing = false;

async function getQueue() {
  const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  return Array.isArray(data[QUEUE_KEY]) ? data[QUEUE_KEY] : [];
}

async function setQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(-500) });
}

async function processDownloadQueue() {
  if (queueProcessing) return;
  queueProcessing = true;
  try {
    const settings = await chrome.storage.local.get({ maxParallelDownloads: 3 });
    const maxParallel = Math.max(1, Math.min(8, Number(settings.maxParallelDownloads) || 3));
    let queue = await getQueue();
    const active = queue.filter(item => item.state === 'downloading');
    let slots = Math.max(0, maxParallel - active.length);
    for (const item of queue) {
      if (slots <= 0) break;
      if (item.state !== 'queued') continue;
      try {
        const id = await chrome.downloads.download({ url: item.url, saveAs: false, conflictAction: 'uniquify' });
        item.chromeId = id;
        item.state = 'downloading';
        item.startedAt = new Date().toISOString();
        slots -= 1;
        await log('info', 'download.queue.started', { queueId: item.id, chromeId: id });
      } catch (error) {
        item.state = 'failed';
        item.error = errText(error);
        item.finishedAt = new Date().toISOString();
        await log('error', 'download.start.failed', { queueId: item.id, url: item.url, error: item.error });
      }
    }
    await setQueue(queue);
  } finally {
    queueProcessing = false;
  }
}

async function enqueueDownloads(items) {
  const queue = await getQueue();
  const now = new Date().toISOString();
  const newItems = items.map(item => ({ id: crypto.randomUUID(), url: item.url, file: item.file || '', state: 'queued', createdAt: now, chromeId: null, error: null }));
  await setQueue([...queue, ...newItems]);
  await processDownloadQueue();
  return newItems;
}

async function updateQueueFromDownload(delta) {
  const queue = await getQueue();
  const item = queue.find(entry => entry.chromeId === delta.id);
  if (!item) return;
  if (delta.state?.current === 'complete') { item.state = 'completed'; item.finishedAt = new Date().toISOString(); }
  else if (delta.state?.current === 'interrupted') { item.state = 'failed'; item.finishedAt = new Date().toISOString(); item.error = delta.error?.current || 'interrupted'; }
  if (delta.error?.current) { item.error = delta.error.current; item.state = 'failed'; }
  if (delta.paused?.current) item.state = 'paused';
  else if (delta.paused?.current === false && item.state === 'paused') item.state = 'downloading';
  await setQueue(queue);
  await processDownloadQueue();
}

async function queueAction(action, queueId) {
  const queue = await getQueue();
  const item = queue.find(entry => entry.id === queueId);
  if (!item) return { ok: false, error: 'Queue item not found.' };
  try {
    if (action === 'cancel') {
      if (item.chromeId && ['downloading','paused'].includes(item.state)) await chrome.downloads.cancel(item.chromeId);
      item.state = 'cancelled';
    } else if (action === 'pause') {
      if (item.chromeId && item.state === 'downloading') { await chrome.downloads.pause(item.chromeId); item.state = 'paused'; }
    } else if (action === 'resume') {
      if (item.chromeId && item.state === 'paused') { await chrome.downloads.resume(item.chromeId); item.state = 'downloading'; }
      else if (item.state === 'queued' || item.state === 'failed') { item.state = 'queued'; item.error = null; }
    } else if (action === 'retry') {
      if (item.state === 'failed' || item.state === 'cancelled') { item.state = 'queued'; item.error = null; item.chromeId = null; }
    }
    await setQueue(queue);
    await processDownloadQueue();
    return { ok: true, queue: await getQueue() };
  } catch (error) { return { ok: false, error: errText(error) }; }
}

chrome.commands?.onCommand.addListener(async command => {
  if (command !== 'scan-current-tab') return;
  try {
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getLastFocused()).id });
    await log('info', 'command.scan-current-tab');
  } catch (error) {
    await log('error', 'command.scan-current-tab.failed', { error: errText(error) });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'log') {
    log(message.level || 'info', message.event || 'client.event', message.details || {}).finally(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'getDiagnostics') {
    (async () => {
      try {
        const data = await chrome.storage.local.get({ umLogs: [], umHistory: [], ...DEFAULTS });
        const manifest = chrome.runtime.getManifest();
        sendResponse({
          ok: true,
          data: {
            version: manifest.version,
            manifestVersion: manifest.manifest_version,
            chromeMinimum: manifest.minimum_chrome_version,
            permissions: manifest.permissions || [],
            hostPermissions: manifest.host_permissions || [],
            historyCount: Array.isArray(data.umHistory) ? data.umHistory.length : 0,
            downloadQueueCount: Array.isArray(data.umDownloadQueue) ? data.umDownloadQueue.length : 0,
            logCount: Array.isArray(data.umLogs) ? data.umLogs.length : 0,
            settings: {
              theme: data.theme,
              accentColor: data.accentColor,
              themePack: data.themePack,
              compactMode: data.compactMode,
              reduceMotion: data.reduceMotion,
              maxParallelDownloads: data.maxParallelDownloads,
              loggingLevel: data.loggingLevel,
              logLimit: data.logLimit
            },
            privacy: {
              telemetry: false,
              remoteDiagnostics: false,
              processing: 'local'
            },
            logs: data.umLogs.slice(-Math.min(100, Math.max(10, Number(data.logLimit) || 100)))
          }
        });
      } catch (error) {
        sendResponse({ ok: false, error: errText(error) });
      }
    })();
    return true;
  }

  if (message?.type === 'clearDiagnostics') {
    (async () => {
      try {
        await chrome.storage.local.remove(['umLogs']);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: errText(error) });
      }
    })();
    return true;
  }

  if (message?.type === 'saveScanHistory') {
    (async () => {
      try {
        const settings = await chrome.storage.local.get({ historyLimit: 8 });
        const current = await chrome.storage.local.get({ umHistory: [] });
        const page = message.data?.page || {};
        const entry = {
          id: crypto.randomUUID(),
          savedAt: new Date().toISOString(),
          origin: page.origin || '',
          domain: page.domain || '',
          title: page.title || '',
          data: message.data
        };
        const history = [entry, ...(Array.isArray(current.umHistory) ? current.umHistory : [])]
          .filter((item, index, list) => item?.id && list.findIndex(other => other.id === item.id) === index)
          .slice(0, Math.max(1, Math.min(30, Number(settings.historyLimit) || 8)));
        await chrome.storage.local.set({ umHistory: history });
        sendResponse({ ok: true, id: history[0].id });
      } catch (error) {
        await log('error', 'history.save.failed', { error: errText(error) });
        sendResponse({ ok: false, error: errText(error) });
      }
    })();
    return true;
  }

  if (message?.type === 'getScanHistory') {
    chrome.storage.local.get({ umHistory: [] }).then(data => sendResponse({ ok: true, history: data.umHistory || [] })).catch(error => sendResponse({ ok: false, error: errText(error) }));
    return true;
  }

  if (message?.type === 'clearScanHistory') {
    chrome.storage.local.remove('umHistory').then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: errText(error) }));
    return true;
  }

  if (message?.type === 'downloadSelected') {
    (async () => {
      try {
        const items = Array.isArray(message.items) ? message.items : [];
        const added = await enqueueDownloads(items);
        await log('info', 'download.queue.enqueued', { count: added.length });
        sendResponse({ ok: true, queued: added.length });
      } catch (error) {
        await log('error', 'download.batch.failed', { error: errText(error) });
        sendResponse({ ok: false, error: errText(error) });
      }
    })();
    return true;
  }

  if (message?.type === 'validateResources') {
    (async () => {
      const urls = Array.isArray(message.urls) ? message.urls.slice(0, 200) : [];
      const results = await Promise.all(urls.map(async url => {
        const base = { url, status: 0, statusText: '', contentType: '', statusClass: 'missing' };
        try {
          const response = await fetch(url, { method: 'HEAD', redirect: 'follow', credentials: 'omit', cache: 'no-store' });
          base.status = response.status;
          base.statusText = response.statusText;
          base.contentType = response.headers.get('content-type') || '';
          base.statusClass = response.ok ? 'ok' : 'missing';
        } catch (error) {
          base.statusText = errText(error);
        }
        return base;
      }));
      await log('info', 'resource.validation.completed', { count: results.length, ok: results.filter(item => item.statusClass === 'ok').length, missing: results.filter(item => item.statusClass !== 'ok').length });
      sendResponse({ ok: true, results });
    })().catch(async error => { await log('error', 'resource.validation.failed', { error: errText(error) }); sendResponse({ ok: false, error: errText(error) }); });
    return true;
  }

  if (message?.type === 'getDownloadQueue') {
    getQueue().then(queue => sendResponse({ ok: true, queue })).catch(error => sendResponse({ ok: false, error: errText(error) }));
    return true;
  }

  if (message?.type === 'queueAction') {
    queueAction(message.action, message.queueId).then(sendResponse);
    return true;
  }

  if (message?.type === 'getActiveWebTab') {
    (async () => {
      try {
        let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const tab = tabs.find(item => Number.isInteger(item?.id)) || null;
        sendResponse({ ok: Boolean(tab), tab });
      } catch (error) {
        sendResponse({ ok: false, error: errText(error) });
      }
    })();
    return true;
  }
});

chrome.downloads?.onChanged.addListener(delta => {
  if (!delta?.id) return;
  updateQueueFromDownload(delta).catch(() => {});
  if (delta.state?.current || delta.error?.current || delta.paused?.current != null) {
    log('info', 'download.state.changed', {
      id: delta.id,
      state: delta.state?.current || null,
      error: delta.error?.current || null,
      paused: delta.paused?.current ?? null
    });
  }
});

chrome.runtime.onMessageExternal?.addListener(() => {});
