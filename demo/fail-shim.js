/**
 * Failure shim for the Flare demo.
 *
 * Usage: append ?fail=flag1,flag2 to the URL.
 * No flags = clean baseline. ?fail=all = everything breaks.
 *
 * Waits for the chart to render before mutating the DOM.
 */

// --- failure functions ---

function breakKeyboard() {
  for (const el of document.querySelectorAll('.bar-overlay[tabindex]')) {
    el.removeAttribute('tabindex');
  }
  for (const el of document.querySelectorAll('.bar-overlay[role="button"]')) {
    el.removeAttribute('role');
  }
  const mirrorDom = document.getElementById('flare-mirror-figure');
  if (!mirrorDom) return;
  for (const el of mirrorDom.querySelectorAll('[tabindex]')) {
    el.removeAttribute('tabindex');
  }
  for (const el of mirrorDom.querySelectorAll('[role="button"]')) {
    el.removeAttribute('role');
  }
}

function breakAria() {
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.removeAttribute('role');
    canvas.removeAttribute('aria-label');
    canvas.removeAttribute('aria-describedby');
  }
  const mirrorDom = document.getElementById('flare-mirror-figure');
  if (mirrorDom) {
    mirrorDom.removeAttribute('role');
    mirrorDom.removeAttribute('aria-label');
  }
  const overlay = document.querySelector('.mirror-overlay');
  if (overlay) {
    overlay.removeAttribute('role');
    overlay.removeAttribute('aria-label');
  }
  for (const el of document.querySelectorAll('.bar-overlay')) {
    el.removeAttribute('aria-label');
  }
}

function breakContrast() {
  const style = document.createElement('style');
  style.textContent = `
    [role="figure"] { color: #ccc !important; }
    [role="figure"] th, [role="figure"] td, [role="figure"] caption {
      color: #ccc !important;
    }
    #page-chart h2 { color: #ccc !important; }
  `;
  document.head.appendChild(style);
}

function breakCsp() {
  const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (csp) csp.remove();
}

function breakHeading() {
  const heading = document.querySelector('#page-chart h2');
  if (!heading) return;
  const div = document.createElement('div');
  div.textContent = heading.textContent;
  div.style.fontSize = '1.3rem';
  div.style.fontWeight = 'bold';
  heading.replaceWith(div);
}

function breakTable() {
  const table = document.getElementById('flare-a11y-table');
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  const container = document.createElement('div');
  container.id = 'flare-a11y-table';
  for (const row of rows) {
    const cells = row.querySelectorAll('th, td');
    const div = document.createElement('div');
    div.textContent = Array.from(cells).map(c => c.textContent).join(': ');
    container.appendChild(div);
  }
  table.replaceWith(container);
}

function breakLang() {
  document.documentElement.removeAttribute('lang');
}

function breakLiveRegion() {
  for (const region of document.querySelectorAll('[aria-live]')) {
    region.removeAttribute('aria-live');
    region.removeAttribute('aria-atomic');
    region.removeAttribute('role');
  }
}

function breakFocus() {
  const style = document.createElement('style');
  style.textContent = `*:focus, *:focus-visible { outline: none !important; box-shadow: none !important; }`;
  document.head.appendChild(style);
}

function breakSkipLink() {
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) skipLink.remove();
}

function breakBreadcrumb() {
  const nav = document.getElementById('flare-breadcrumb');
  if (nav) nav.remove();
}

function breakDrillKeyboard() {
  for (const el of document.querySelectorAll('.bar-overlay[role="button"]')) {
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
    el.removeAttribute('aria-label');
  }
}

function breakDrillAnnounce() {
  const region = document.getElementById('flare-live-region');
  if (region) region.textContent = '';
  const observer = new MutationObserver(() => {
    if (region) region.textContent = '';
  });
  if (region) observer.observe(region, { childList: true, characterData: true, subtree: true });
}

function breakDrillFocus() {
  const style = document.createElement('style');
  style.id = 'fail-drill-focus';
  document.head.appendChild(style);
  const observer = new MutationObserver(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.body.focus();
    }
  });
  const main = document.getElementById('flare-main');
  if (main) observer.observe(main, { childList: true, subtree: true });
}

// --- registry ---

const FAILURES = {
  keyboard: breakKeyboard,
  aria: breakAria,
  contrast: breakContrast,
  csp: breakCsp,
  heading: breakHeading,
  table: breakTable,
  lang: breakLang,
  'live-region': breakLiveRegion,
  focus: breakFocus,
  'skip-link': breakSkipLink,
  breadcrumb: breakBreadcrumb,
  'drill-keyboard': breakDrillKeyboard,
  'drill-announce': breakDrillAnnounce,
  'drill-focus': breakDrillFocus,
};

// --- execute (wait for chart to render) ---

function applyFailures() {
  const raw = new URLSearchParams(window.location.search).get('fail');
  if (!raw) return;

  const flags = raw === 'all'
    ? Object.keys(FAILURES)
    : raw.split(',').map(f => f.trim()).filter(Boolean);

  for (const flag of flags) {
    const fn = FAILURES[flag];
    if (fn) {
      fn();
    } else {
      console.warn(`[fail-shim] unknown flag: "${flag}"`);
    }
  }

  console.log(`[fail-shim] active flags: ${flags.join(', ')}`);
}

// Wait for the canvas to appear (app.js is async)
const observer = new MutationObserver((_, obs) => {
  if (document.getElementById('flare-chart')) {
    obs.disconnect();
    setTimeout(applyFailures, 300);
  }
});

if (document.getElementById('flare-chart')) {
  setTimeout(applyFailures, 300);
} else {
  observer.observe(document.getElementById('flare-main') || document.body, {
    childList: true, subtree: true
  });
}
