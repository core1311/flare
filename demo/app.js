import init, { create_canvas, render, render_animated } from './pkg/flare.js';
import { buildMirrorDom as libBuildMirrorDom, extractBarRects, announce } from '../mirror-dom/mirror-dom.js';

const CANVAS_ID = 'flare-chart';
const LOGICAL_W = 700;
const LOGICAL_H = 450;
const FETCH_DELAY = 200;

let dataset = null;
let semNodes = [];
let barRects = [];
let navStack = [];
let hasInteracted = false;

function parseSemNodes(json) {
  semNodes = JSON.parse(json);
  barRects = extractBarRects(semNodes);
}

// --- theme ---

function readTheme(level) {
  const style = getComputedStyle(document.body);
  const get = (name) => style.getPropertyValue(name).trim();

  const barTokens = { year: '--flare-bar-year', month: '--flare-bar-month', week: '--flare-bar-week' };
  const barColor = get(barTokens[level] || barTokens.year);

  const dpr = window.devicePixelRatio || 1;
  const fontFamily = get('--mat-sys-font-family');
  const labelSize = Math.round(13 * dpr);
  const titleSize = Math.round(16 * dpr);

  const letterEm = parseFloat(get('--flare-letter-spacing')) || 0;
  const wordEm = parseFloat(get('--flare-word-spacing')) || 0;

  return {
    barColor,
    axisColor: get('--mat-sys-on-surface'),
    bgColor: get('--mat-sys-surface'),
    labelFont: `${labelSize}px ${fontFamily}`,
    titleFont: `bold ${titleSize}px ${fontFamily}`,
    letterSpacing: Math.round(labelSize * letterEm * 10) / 10,
    wordSpacing: Math.round(labelSize * wordEm * 10) / 10,
  };
}

// --- init ---

async function start() {
  await init();
  dataset = await (await fetch('./data.json')).json();

  // DPR-aware canvas: buffer at physical pixels, CSS at logical pixels.
  // This is the standard HiDPI canvas pattern — reuse for any canvas component.
  const dpr = window.devicePixelRatio || 1;
  create_canvas(CANVAS_ID, LOGICAL_W * dpr, LOGICAL_H * dpr);

  const canvas = document.getElementById(CANVAS_ID);
  canvas.style.width = LOGICAL_W + 'px';
  canvas.style.height = LOGICAL_H + 'px';
  canvas.setAttribute('role', 'img');
  canvas.addEventListener('click', handleCanvasClick);
  document.addEventListener('keydown', handleKeydown);

  // Wrap canvas in a relative container for overlay positioning
  const container = document.createElement('div');
  container.className = 'chart-container';
  canvas.parentNode.insertBefore(container, canvas);
  container.appendChild(canvas);

  const backBtn = document.getElementById('flare-back');
  backBtn.addEventListener('click', drillOut);

  showLevel('year', null);
}

// --- data extraction ---

function getLevelData(level, key, parentKey) {
  if (level === 'year') {
    const labels = Object.keys(dataset.months);
    const values = labels.map(m => dataset.months[m].total);
    return { title: dataset.title, labels, values, yTitle: dataset.yAxisTitle, drillable: true };
  }

  if (level === 'month') {
    const month = dataset.months[key];
    const labels = Object.keys(month.weeks);
    const values = labels.map(w => month.weeks[w].total);
    return { title: `${key} 2025`, labels, values, yTitle: dataset.yAxisTitle, drillable: true };
  }

  if (level === 'week') {
    const month = dataset.months[parentKey];
    const week = month.weeks[key];
    const labels = Object.keys(week.days);
    const values = labels.map(d => week.days[d]);
    return { title: `${key}`, labels, values, yTitle: dataset.yAxisTitle, drillable: false };
  }

  return null;
}

function getNextLevel(level) {
  if (level === 'year') return 'month';
  if (level === 'month') return 'week';
  return null;
}

// --- navigation ---

async function showLevel(level, key) {
  const parentKey = navStack.length > 0 ? navStack[navStack.length - 1].key : null;
  const data = getLevelData(level, key, parentKey);
  if (!data) return;

  if (level !== 'year' || navStack.length === 0) {
    if (navStack.length === 0 || navStack[navStack.length - 1].level !== level) {
      navStack.push({ level, key, title: data.title });
    }
  }

  await simulateFetch();

  const theme = readTheme(level);
  const rectsJson = render(
    CANVAS_ID,
    data.title,
    JSON.stringify(data.labels),
    JSON.stringify(data.values),
    data.yTitle,
    JSON.stringify(theme)
  );
  parseSemNodes(rectsJson);

  const canvas = document.getElementById(CANVAS_ID);
  canvas.setAttribute('aria-label', data.title);

  renderMirrorDom(data);
  buildBreadcrumb();
  updateBackButton();
  announce(levelAnnouncement(data, level));
}

async function drillIn(index) {
  hasInteracted = true;
  const currentLevel = navStack[navStack.length - 1]?.level || 'year';
  const nextLevel = getNextLevel(currentLevel);
  if (!nextLevel) return;

  const data = getLevelData(currentLevel, navStack[navStack.length - 1]?.key, null);
  if (!data) return;
  const key = data.labels[index];
  if (!key) return;

  await showLevel(nextLevel, key);
}

async function drillOut() {
  hasInteracted = true;
  if (navStack.length <= 1) return;
  navStack.pop();
  const prev = navStack.pop();
  await showLevel(prev.level, prev.key);
}

async function jumpTo(depth) {
  hasInteracted = true;
  while (navStack.length > depth + 1) {
    navStack.pop();
  }
  const target = navStack.pop();
  await showLevel(target.level, target.key);
}

function simulateFetch() {
  return new Promise(resolve => setTimeout(resolve, FETCH_DELAY));
}

function levelAnnouncement(data, level) {
  const count = data.labels.length;
  if (level === 'year') return `Showing ${dataset.title}: ${count} months`;
  if (level === 'month') return `Showing ${data.title}: ${count} weeks`;
  if (level === 'week') return `Showing ${data.title}: ${count} days`;
  return '';
}

// --- mirror DOM (overlay approach) ---

function renderMirrorDom(data) {
  const container = document.querySelector('.chart-container');
  libBuildMirrorDom(container, semNodes, {
    onSelect: data.drillable ? (i) => drillIn(i) : undefined,
    focusAfterUpdate: hasInteracted,
    yAxisTitle: data.yTitle,
    drillable: data.drillable,
  });
}

// --- back button ---

function updateBackButton() {
  const btn = document.getElementById('flare-back');
  if (!btn) return;
  btn.style.display = navStack.length > 1 ? 'inline-block' : 'none';
}

// --- breadcrumb ---

function buildBreadcrumb() {
  const nav = document.getElementById('flare-breadcrumb');
  if (!nav) return;
  nav.innerHTML = '';

  const ol = document.createElement('ol');
  ol.className = 'breadcrumb-list';

  navStack.forEach((entry, i) => {
    const li = document.createElement('li');

    if (i < navStack.length - 1) {
      const btn = document.createElement('button');
      btn.textContent = entry.title;
      btn.className = 'breadcrumb-link';
      btn.addEventListener('click', () => jumpTo(i));
      li.appendChild(btn);

      const sep = document.createElement('span');
      sep.textContent = ' › ';
      sep.setAttribute('aria-hidden', 'true');
      li.appendChild(sep);
    } else {
      const current = document.createElement('span');
      current.textContent = entry.title;
      current.setAttribute('aria-current', 'page');
      li.appendChild(current);
    }

    ol.appendChild(li);
  });

  nav.appendChild(ol);
}

// --- event handlers ---

function handleCanvasClick(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  for (const bar of barRects) {
    if (x >= bar.x && x <= bar.x + bar.w && y >= bar.y && y <= bar.y + bar.h) {
      drillIn(bar.index);
      return;
    }
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    drillOut();
  }
  if (e.key === 'Backspace' && !isTextInput(e.target)) {
    e.preventDefault();
    drillOut();
  }
  if (e.key === 'ArrowLeft' && e.altKey) {
    e.preventDefault();
    drillOut();
  }
}

function isTextInput(el) {
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

// --- touch: swipe right to go back ---

let touchStartX = 0;
let touchStartY = 0;

function initSwipeBack() {
  const container = document.querySelector('.chart-container');
  if (!container) return;
  container.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  container.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (dx > 50 && dy < 40) drillOut();
  });
}

// --- theme toggle ---

function setTheme(theme) {
  document.body.classList.remove('dark', 'dataowl');
  if (theme === 'dark') document.body.classList.add('dark');
  if (theme === 'dataowl') document.body.classList.add('dataowl');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : theme === 'dataowl' ? '🦉' : '☾';
  syncSchemeButtons();
  reRenderChart();
}

function syncSchemeButtons() {
  const current = document.body.classList.contains('dark') ? 'dark'
    : document.body.classList.contains('dataowl') ? 'dataowl' : 'light';
  for (const id of ['pref-scheme-light', 'pref-scheme-dark', 'pref-scheme-dataowl']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('pref-btn-active', id === `pref-scheme-${current}`);
  }
}

function cycleTheme() {
  if (document.body.classList.contains('dark')) setTheme('dataowl');
  else if (document.body.classList.contains('dataowl')) setTheme('light');
  else setTheme('dark');
}

function reRenderChart() {
  const currentLevel = navStack[navStack.length - 1]?.level || 'year';
  const currentKey = navStack[navStack.length - 1]?.key || null;
  const parentKey = navStack.length > 1 ? navStack[navStack.length - 2].key : null;
  const data = getLevelData(currentLevel, currentKey, parentKey);
  if (!data) return;

  const theme = readTheme(currentLevel);
  const rectsJson = render(
    CANVAS_ID,
    data.title,
    JSON.stringify(data.labels),
    JSON.stringify(data.values),
    data.yTitle,
    JSON.stringify(theme)
  );
  parseSemNodes(rectsJson);
}

// --- page routing ---

function showPage(pageId) {
  for (const section of document.querySelectorAll('.page-section')) {
    section.style.display = section.id === pageId ? '' : 'none';
  }
  for (const link of document.querySelectorAll('#sidebar-nav a')) {
    if (link.dataset.page === pageId) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
  if (pageId === 'page-chart' && barRects.length > 0) {
    reRenderChart();
    if (streamActive && !streamInterval) startStream();
  } else {
    stopStream();
  }
}

function initRouting() {
  for (const link of document.querySelectorAll('#sidebar-nav a')) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(link.dataset.page);
    });
  }
  showPage('page-chart');

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.page-link[data-page]');
    if (link) { e.preventDefault(); showPage(link.dataset.page); }
  });

  // Auto-apply dark mode from OS preference (manual toggle overrides)
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '☀';
  }

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', cycleTheme);

  const printBtn = document.getElementById('flare-print');
  if (printBtn) printBtn.addEventListener('click', () => {
    const wasDark = document.body.classList.contains('dark');
    const wasDataowl = document.body.classList.contains('dataowl');
    const hadCream = document.body.classList.contains('tint-cream');
    const hadBlue = document.body.classList.contains('tint-blue');
    document.body.classList.remove('dark', 'dataowl', 'tint-cream', 'tint-blue');
    if (wasDark || wasDataowl || hadCream || hadBlue) reRenderChart();
    window.print();
    if (wasDark) document.body.classList.add('dark');
    if (wasDataowl) document.body.classList.add('dataowl');
    if (hadCream) document.body.classList.add('tint-cream');
    if (hadBlue) document.body.classList.add('tint-blue');
    if (wasDark || wasDataowl || hadCream || hadBlue) reRenderChart();
  });
}

// --- preferences ---

function initPreferences() {
  // Reduced motion toggle
  const motionDefault = document.getElementById('pref-motion-default');
  const motionReduce = document.getElementById('pref-motion-reduce');
  if (motionDefault && motionReduce) {
    motionDefault.addEventListener('click', () => {
      document.body.classList.remove('reduce-motion');
      motionDefault.classList.add('pref-btn-active');
      motionReduce.classList.remove('pref-btn-active');
    });
    motionReduce.addEventListener('click', () => {
      document.body.classList.add('reduce-motion');
      motionReduce.classList.add('pref-btn-active');
      motionDefault.classList.remove('pref-btn-active');
    });
  }

  // Colour scheme toggle (mirrors the sidebar theme button)
  const schemeBtns = [
    { id: 'pref-scheme-light', theme: 'light' },
    { id: 'pref-scheme-dark', theme: 'dark' },
    { id: 'pref-scheme-dataowl', theme: 'dataowl' },
  ];
  syncSchemeButtons();
  for (const b of schemeBtns) {
    const el = document.getElementById(b.id);
    if (el) el.addEventListener('click', () => setTheme(b.theme));
  }

  // Spacing toggle
  const spacingDefault = document.getElementById('pref-spacing-default');
  const spacingDyslexia = document.getElementById('pref-spacing-dyslexia');
  if (spacingDefault && spacingDyslexia) {
    spacingDefault.addEventListener('click', () => {
      document.body.classList.remove('dyslexia-friendly');
      spacingDefault.classList.add('pref-btn-active');
      spacingDyslexia.classList.remove('pref-btn-active');
      requestAnimationFrame(reRenderChart);
    });
    spacingDyslexia.addEventListener('click', () => {
      document.body.classList.add('dyslexia-friendly');
      spacingDyslexia.classList.add('pref-btn-active');
      spacingDefault.classList.remove('pref-btn-active');
      reRenderChart();
    });
  }

  // Tint toggle
  const tintBtns = [
    { id: 'pref-tint-none', cls: null },
    { id: 'pref-tint-cream', cls: 'tint-cream' },
    { id: 'pref-tint-blue', cls: 'tint-blue' },
  ];
  for (const btn of tintBtns) {
    const el = document.getElementById(btn.id);
    if (!el) continue;
    el.addEventListener('click', () => {
      document.body.classList.remove('tint-cream', 'tint-blue');
      if (btn.cls) document.body.classList.add(btn.cls);
      for (const b of tintBtns) {
        const bel = document.getElementById(b.id);
        if (bel) bel.classList.toggle('pref-btn-active', b.id === btn.id);
      }
      reRenderChart();
    });
  }
}

// --- streaming demo ---

const STREAM_TEXT = 'Trade volumes peaked in May at 1,720 trades — 43% above the yearly low in December. The autumn recovery in September through November suggests seasonal demand patterns.';

let streamTimers = [];

function initStreamDemo() {
  const playBtn = document.getElementById('stream-play');
  if (!playBtn) return;
  playBtn.addEventListener('click', runStreamDemo);
}

function runStreamDemo() {
  const output = document.getElementById('stream-output');
  if (!output) return;

  for (const t of streamTimers) clearTimeout(t);
  streamTimers = [];
  output.textContent = '';
  output.classList.remove('streaming');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.body.classList.contains('reduce-motion');

  if (prefersReduced) {
    output.textContent = STREAM_TEXT;
    return;
  }

  output.classList.add('streaming');
  const words = STREAM_TEXT.split(' ');

  words.forEach((word, i) => {
    const timer = setTimeout(() => {
      output.textContent += (i === 0 ? '' : ' ') + word;
      if (i === words.length - 1) {
        output.classList.remove('streaming');
      }
    }, i * 60);
    streamTimers.push(timer);
  });
}

// --- data streaming (simulated live feed) ---

let streamInterval = null;
let streamActive = true;

function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.body.classList.contains('reduce-motion');
}

function initStreaming() {
  const btn = document.getElementById('flare-stream');
  if (!btn) return;
  btn.addEventListener('click', toggleStreaming);
  startStream();
}

function toggleStreaming() {
  streamActive = !streamActive;
  const btn = document.getElementById('flare-stream');
  if (btn) {
    btn.textContent = streamActive ? '▷' : '⏸';
    btn.setAttribute('aria-pressed', String(streamActive));
  }
  if (streamActive) startStream();
  else stopStream();
}

function startStream() {
  if (streamInterval) return;
  streamInterval = setInterval(streamTick, 1500);
}

function stopStream() {
  clearInterval(streamInterval);
  streamInterval = null;
}

function streamTick() {
  const currentLevel = navStack[navStack.length - 1]?.level || 'year';
  const currentKey = navStack[navStack.length - 1]?.key || null;
  const parentKey = navStack.length > 1 ? navStack[navStack.length - 2].key : null;
  const data = getLevelData(currentLevel, currentKey, parentKey);
  if (!data) return;

  const fromValues = data.values.slice();
  const jitterPct = 0.05;
  const toValues = fromValues.map(v => {
    const delta = Math.max(1, Math.round(v * jitterPct * (0.5 + Math.random())));
    return Math.max(0, v + (Math.random() < 0.5 ? -delta : delta));
  });

  mutateDataset(currentLevel, currentKey, parentKey, data.labels, toValues);

  const theme = readTheme(currentLevel);
  const duration = isReducedMotion() ? 0 : 300;

  const rectsJson = render_animated(
    CANVAS_ID,
    data.title,
    JSON.stringify(data.labels),
    JSON.stringify(fromValues),
    JSON.stringify(toValues),
    data.yTitle,
    JSON.stringify(theme),
    duration,
    () => {
      const updated = { ...data, values: toValues };
      renderMirrorDom(updated);
    }
  );
  parseSemNodes(rectsJson);
}

function mutateDataset(level, key, parentKey, labels, values) {
  if (level === 'year') {
    labels.forEach((m, i) => { dataset.months[m].total = values[i]; });
  } else if (level === 'month') {
    labels.forEach((w, i) => { dataset.months[key].weeks[w].total = values[i]; });
  } else if (level === 'week') {
    labels.forEach((d, i) => { dataset.months[parentKey].weeks[key].days[d] = values[i]; });
  }
}

// --- go ---

initRouting();
initPreferences();
initStreamDemo();
initStreaming();
start().then(initSwipeBack);
