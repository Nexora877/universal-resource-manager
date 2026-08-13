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
  historyLimit: 8,
  liveScan: false,
  language: 'en'
};

const THEME_PACKS = [
  { id: 'midnight', name: 'Midnight', note: 'Professional default', dark: ['#0a0f1d','#11192b','#172139','#6d5dfc'], light: ['#f5f7fb','#ffffff','#eef2f8','#5b50e6'] },
  { id: 'arctic', name: 'Arctic', note: 'Cool and minimal', dark: ['#071522','#0c2032','#12314b','#22a6f2'], light: ['#eef9ff','#ffffff','#e8f5fd','#1686c8'] },
  { id: 'forest', name: 'Forest', note: 'Calm and green', dark: ['#07140f','#0f2119','#163025','#22a06b'], light: ['#eff9f3','#ffffff','#e9f4ed','#177d53'] },
  { id: 'sunset', name: 'Sunset', note: 'Warm and energetic', dark: ['#1b0d0b','#2a1512','#3a1c17','#ef7d43'], light: ['#fff7f2','#ffffff','#fff0e8','#cc5d2b'] },
  { id: 'rose', name: 'Rose', note: 'Modern and vivid', dark: ['#190b13','#28101d','#38152a','#e24b92'], light: ['#fff4f8','#ffffff','#fdeaf2','#c43779'] },
  { id: 'mono', name: 'Mono', note: 'Distraction-free focus', dark: ['#0b0c0e','#15171a','#1f2226','#9ca3af'], light: ['#f3f4f6','#ffffff','#f0f1f3','#4b5563'] },
  { id: 'amoled', name: 'AMOLED', note: 'Deep black', dark: ['#000000','#050505','#0d0d0d','#ffffff'], light: ['#ffffff','#ffffff','#f3f3f3','#111111'] }
];

const $ = selector => document.querySelector(selector);
const BUILD = globalThis.UM_BUILD || { channel: 'public' };
const T = key => (globalThis.URM_I18N?.dictionaries?.[document.documentElement.lang || 'en']?.[key] || globalThis.URM_I18N?.dictionaries?.en?.[key] || key);

const showSaved = message => {
  $('#saved').textContent = message;
  clearTimeout(showSaved.timer);
  showSaved.timer = setTimeout(() => { $('#saved').textContent = ''; }, 1400);
};

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
}

function applyTheme(theme, accentColor, themePack, compactMode, reduceMotion) {
  document.documentElement.dataset.theme = theme || 'system';
  document.documentElement.dataset.accent = accentColor || 'default';
  document.documentElement.dataset.themePack = themePack || 'midnight';
  document.documentElement.classList.toggle('compact', Boolean(compactMode));
  document.documentElement.classList.toggle('reduce-motion', Boolean(reduceMotion));
}

function themePreview(pack) {
  const dark = pack.dark;
  return `<div class="theme-preview" style="background:${dark[0]}"><span style="background:${dark[1]}"></span><span style="background:${dark[3]}"></span><span style="background:${dark[2]}"></span><span style="background:${dark[1]}"></span></div>`;
}

function renderThemeStore(activeId) {
  const lang = document.documentElement.lang || 'en';
  const names = { midnight: { en: 'Midnight', fa: 'نیمه‌شب' }, arctic:{en:'Arctic',fa:'قطبی'}, forest:{en:'Forest',fa:'جنگل'}, sunset:{en:'Sunset',fa:'غروب'}, rose:{en:'Rose',fa:'رز'}, mono:{en:'Mono',fa:'تک‌رنگ'}, amoled:{en:'AMOLED',fa:'AMOLED'} };
  const notes = { midnight:{en:'Professional default',fa:'پیش‌فرض حرفه‌ای'}, arctic:{en:'Cool and minimal',fa:'خنک و مینیمال'}, forest:{en:'Calm and green',fa:'سبز و آرام'}, sunset:{en:'Warm and energetic',fa:'گرم و پرانرژی'}, rose:{en:'Modern and vivid',fa:'مدرن و پررنگ'}, mono:{en:'Distraction-free focus',fa:'تمرکز بدون حواس‌پرتی'}, amoled:{en:'Deep black',fa:'سیاه عمیق'} };
  $('#themeStore').innerHTML = THEME_PACKS.map(pack => `
    <div class="theme-card ${pack.id === activeId ? 'active' : ''}" data-theme-card="${pack.id}">
      ${themePreview(pack)}
      <div class="theme-meta">
        <div><strong>${names[pack.id]?.[lang] || pack.name}</strong><small>${notes[pack.id]?.[lang] || pack.note}</small></div>
        <button type="button" data-theme-apply="${pack.id}">${pack.id === activeId ? (lang === 'fa' ? 'فعال' : 'Active') : (lang === 'fa' ? 'فعال‌سازی' : 'Apply')}</button>
      </div>
    </div>`).join('');
}

async function load() {
  const manifest = chrome.runtime.getManifest();
  const settings = await getSettings();
  $('#buildChannel').textContent = BUILD.channel;
  $('#language').value = settings.language || 'en';
  await chrome.storage.local.set({ language: settings.language || 'en' });
  await globalThis.URM_I18N?.apply();
  $('#version').textContent = manifest.version;
  $('#manifestVersion').textContent = `MV${manifest.manifest_version}`;
  $('#chromeMinimum').textContent = manifest.minimum_chrome_version || '—';
  $('#confirmDownloads').checked = settings.confirmDownloads;
  $('#keepQueryStrings').checked = settings.keepQueryStrings;
  $('#maxParallelDownloads').value = String(settings.maxParallelDownloads);
  $('#theme').value = settings.theme;
  $('#accentColor').value = settings.accentColor;
  $('#compactMode').checked = settings.compactMode;
  $('#reduceMotion').checked = settings.reduceMotion;
  $('#diagnostics').checked = settings.diagnostics;
  $('#loggingLevel').value = settings.loggingLevel;
  $('#logLimit').value = String(settings.logLimit);
  $('#historyLimit').value = String(settings.historyLimit);
  $('#liveScan').checked = false;
  applyTheme(settings.theme, settings.accentColor, settings.themePack, settings.compactMode, settings.reduceMotion);
  renderThemeStore(settings.themePack);
  await refreshDiagnostics();
  await refreshSiteHistoryStats();
}

async function save() {
  const current = await getSettings();
  const settings = {
    ...current,
    confirmDownloads: $('#confirmDownloads').checked,
    keepQueryStrings: $('#keepQueryStrings').checked,
    maxParallelDownloads: Number($('#maxParallelDownloads').value),
    theme: $('#theme').value,
    accentColor: $('#accentColor').value,
    compactMode: $('#compactMode').checked,
    reduceMotion: $('#reduceMotion').checked,
    diagnostics: $('#diagnostics').checked,
    loggingLevel: $('#loggingLevel').value,
    logLimit: Number($('#logLimit').value),
    historyLimit: Number($('#historyLimit').value),
    liveScan: false,
    language: $('#language').value === 'fa' ? 'fa' : 'en'
  };
  await chrome.storage.local.set(settings);
  await globalThis.URM_I18N?.apply();
  applyTheme(settings.theme, settings.accentColor, settings.themePack, settings.compactMode, settings.reduceMotion);
  renderThemeStore(settings.themePack);
  showSaved('ذخیره شد');
}

async function applyThemePack(id) {
  if (!THEME_PACKS.some(theme => theme.id === id)) return;
  await chrome.storage.local.set({ themePack: id });
  const settings = await getSettings();
  applyTheme(settings.theme, settings.accentColor, id, settings.compactMode, settings.reduceMotion);
  renderThemeStore(id);
  showSaved(`تم «${THEME_PACKS.find(theme => theme.id === id).name}» فعال شد`);
}

async function refreshDiagnostics() {
  const response = await chrome.runtime.sendMessage({ type: 'getDiagnostics' });
  if (!response?.ok) {
    $('#diagnosticsView').textContent = response?.error || 'خطا در دریافت گزارش';
    $('#errorCenter').innerHTML = '<div class="error-item"><strong>دریافت گزارش ناموفق بود</strong><p>جزئیات Diagnostics در دسترس نیست.</p></div>';
    $('#errorBadge').textContent = 'خطا';
    return;
  }
  const data = response.data;
  $('#diagnosticsView').textContent = JSON.stringify(data, null, 2);
  const logs = Array.isArray(data.logs) ? data.logs : [];
  const errors = logs.filter(log => ['error', 'fatal'].includes(log.level));
  $('#errorBadge').textContent = `${errors.length.toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US')} خطا`;
  $('#errorCenter').innerHTML = errors.length ? errors.slice(-8).reverse().map(item => `
    <article class="error-item">
      <div class="head"><strong>${escapeHtml(errorLabel(item.event))}</strong><code>${escapeHtml(item.errorId || 'URM-GENERIC')}</code></div>
      <p>${escapeHtml(formatErrorDetails(item.details))}</p>
      <time>${escapeHtml(new Date(item.time).toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US'))}</time>
    </article>`).join('') : '<div class="error-item"><strong>خطای ثبت‌شده‌ای وجود ندارد</strong><p>آخرین رخدادهای بحرانی سالم هستند.</p></div>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function errorLabel(event) {
  const labels = {
    'scan.failed': 'اسکن ناموفق',
    'scan.execute.failed': 'اجرای موتور Scan ناموفق',
    'history.save.failed': 'ذخیره تاریخچه ناموفق',
    'download.start.failed': 'شروع دانلود ناموفق',
    'download.batch.failed': 'Batch دانلود ناموفق',
    'contextMenu.open-panel.failed': 'بازکردن پنل ناموفق'
  };
  return labels[event] || event || 'خطای ناشناخته';
}

function formatErrorDetails(details) {
  if (!details || typeof details !== 'object') return 'جزئیات ثبت نشده است.';
  const text = Object.entries(details).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
  return text || 'جزئیات ثبت نشده است.';
}

async function getDiagnosticsText() {
  const response = await chrome.runtime.sendMessage({ type: 'getDiagnostics' });
  return { response, text: JSON.stringify(response?.data || { error: response?.error }, null, 2) };
}

async function copyDiagnostics() {
  const { text } = await getDiagnosticsText();
  await navigator.clipboard.writeText(text);
  showSaved('گزارش کپی شد');
}

async function exportDiagnostics() {
  const { text } = await getDiagnosticsText();
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `universal-resource-manager-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportTheme() {
  const settings = await getSettings();
  const theme = {
    format: 'urm-theme',
    version: 1,
    product: 'Universal Resource Manager',
    themePack: settings.themePack,
    theme: settings.theme,
    accentColor: settings.accentColor
  };
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `urm-theme-${settings.themePack}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showSaved('تم ذخیره شد');
}

function openThemeFile() {
  $('#themeFile').click();
}

async function importTheme(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const themePack = THEME_PACKS.some(theme => theme.id === parsed.themePack) ? parsed.themePack : 'midnight';
    const theme = ['system', 'dark', 'light'].includes(parsed.theme) ? parsed.theme : 'system';
    const accentColor = ['default', 'blue', 'purple', 'teal', 'orange', 'rose', 'green'].includes(parsed.accentColor) ? parsed.accentColor : 'default';
    await chrome.storage.local.set({ themePack, theme, accentColor });
    await load();
    showSaved('تم درون‌ریزی شد');
  } catch {
    showSaved('فایل تم نامعتبر است');
  }
}

async function refreshSiteHistoryStats() {
  const response = await chrome.runtime.sendMessage({ type: 'getScanHistory' });
  const history = response?.history || [];
  const sites = new Map();
  for (const item of history) {
    const origin = item.origin || item.data?.page?.origin || '';
    const domain = item.domain || item.data?.page?.domain || origin || 'نامشخص';
    if (!sites.has(origin || domain)) sites.set(origin || domain, { domain, count: 0 });
    sites.get(origin || domain).count += 1;
  }
  $('#siteHistoryStats').innerHTML = `
    <div class="mini-stat"><span>کل اسکن‌ها</span><strong>${history.length.toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US')}</strong></div>
    <div class="mini-stat"><span>سایت‌ها</span><strong>${sites.size.toLocaleString((document.documentElement.lang || 'en') === 'fa' ? 'fa-IR' : 'en-US')}</strong></div>
    <div class="mini-stat"><span>سایت اخیر</span><strong>${history[0]?.domain || history[0]?.data?.page?.domain || '—'}</strong></div>`;
}

function filterSettings(query) {
  const text = query.trim().toLowerCase();
  for (const card of document.querySelectorAll('.card[data-search]')) {
    const haystack = `${card.dataset.search} ${card.textContent}`.toLowerCase();
    card.hidden = Boolean(text) && !haystack.includes(text);
  }
}

for (const control of document.querySelectorAll('input:not(#settingsSearch):not(#themeFile),select')) control.addEventListener('change', save);
$('#settingsSearch').addEventListener('input', event => filterSettings(event.target.value));
$('#themeStore').addEventListener('click', event => { const id = event.target.closest('[data-theme-apply]')?.dataset.themeApply; if (id) applyThemePack(id); });
$('#exportTheme').addEventListener('click', exportTheme);
$('#importTheme').addEventListener('click', openThemeFile);
$('#themeFile').addEventListener('change', event => importTheme(event.target.files?.[0]));
$('#clearHistory').addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'clearScanHistory' }); await refreshSiteHistoryStats(); showSaved('کل تاریخچه پاک شد'); });
$('#resetSettings').addEventListener('click', async () => { await chrome.storage.local.set(DEFAULTS); await load(); showSaved('همه تنظیمات بازنشانی شد'); });
$('#resetAppearance').addEventListener('click', async () => { await chrome.storage.local.set({ theme: 'system', accentColor: 'default', themePack: 'midnight', compactMode: false, reduceMotion: false }); await load(); showSaved('ظاهر بازنشانی شد'); });
$('#refreshDiagnostics').addEventListener('click', refreshDiagnostics);
$('#copyDiagnostics').addEventListener('click', copyDiagnostics);
$('#exportDiagnostics').addEventListener('click', exportDiagnostics);
$('#clearDiagnostics').addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'clearDiagnostics' }); await refreshDiagnostics(); showSaved('لاگ‌ها پاک شدند'); });
load();
