/**
 * mirror-dom — builds accessible DOM overlays from a SemNode tree.
 *
 * Any WASM canvas renderer that returns SemNode[] can use this lib
 * to get screen reader support, keyboard navigation, and focus management.
 *
 * @typedef {{ x: number, y: number, w: number, h: number }} Geometry
 * @typedef {{ role: string, label: string, value?: string, geometry?: Geometry, focusable?: boolean, children?: SemNode[] }} SemNode
 * @typedef {{ dpr?: number, onSelect?: (index: number) => void, focusAfterUpdate?: boolean, yAxisTitle?: string, drillable?: boolean }} MirrorDomOptions
 */

/**
 * Walk the SemNode tree and collect focusable leaf nodes with geometry.
 * @param {SemNode[]} nodes
 * @returns {{ node: SemNode, index: number }[]}
 */
function collectInteractiveNodes(nodes) {
  const results = [];
  let index = 0;
  function walk(node) {
    if (node.geometry && node.focusable) {
      results.push({ node, index: index++ });
    }
    if (node.children) node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return results;
}

/**
 * Extract flat bar rects from SemNode tree (for hit-testing or external use).
 * @param {SemNode[]} nodes
 * @returns {{ x: number, y: number, w: number, h: number, index: number }[]}
 */
export function extractBarRects(nodes) {
  return collectInteractiveNodes(nodes).map(({ node, index }) => ({
    ...node.geometry,
    index,
  }));
}

/**
 * Build the mirror DOM: overlay divs + sr-only figure/table + live region.
 *
 * @param {HTMLElement} container — the chart-container (position: relative)
 * @param {SemNode[]} semNodes — semantic tree from WASM renderer
 * @param {MirrorDomOptions} [options]
 */
export function buildMirrorDom(container, semNodes, options = {}) {
  const {
    dpr = window.devicePixelRatio || 1,
    onSelect,
    focusAfterUpdate = false,
    yAxisTitle = '',
    drillable = false,
  } = options;

  const canvas = container.querySelector('canvas');

  // Clean up previous mirror DOM
  const oldOverlay = container.querySelector('.mirror-overlay');
  if (oldOverlay) oldOverlay.remove();
  const oldFigure = container.parentElement?.querySelector('#flare-mirror-figure');
  if (oldFigure) oldFigure.remove();

  container.style.width = canvas.clientWidth + 'px';
  container.style.height = canvas.clientHeight + 'px';

  // --- Overlay layer ---
  const figureNode = semNodes[0];
  const title = figureNode?.label || '';

  const overlay = document.createElement('div');
  overlay.className = 'mirror-overlay';
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', `${title} — interactive bars`);

  const interactive = collectInteractiveNodes(semNodes);

  interactive.forEach(({ node, index }) => {
    const el = document.createElement('div');
    el.className = 'bar-overlay';
    el.style.left = (node.geometry.x / dpr) + 'px';
    el.style.top = (node.geometry.y / dpr) + 'px';
    el.style.width = (node.geometry.w / dpr) + 'px';
    el.style.height = (node.geometry.h / dpr) + 'px';

    const valueLabel = `${node.label}: ${node.value || ''} ${yAxisTitle}`.trim();

    if (drillable && onSelect) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `${valueLabel}. Click to drill down.`);
      el.addEventListener('click', () => onSelect(index));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(index);
        }
      });
    } else {
      el.setAttribute('role', 'img');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', valueLabel);
    }

    overlay.appendChild(el);
  });

  container.appendChild(overlay);

  // --- sr-only figure with data table ---
  const figure = document.createElement('div');
  figure.id = 'flare-mirror-figure';
  figure.setAttribute('role', 'figure');
  figure.setAttribute('aria-label', title);
  figure.className = 'sr-only';

  const values = interactive.map(({ node }) => parseFloat(node.value) || 0);
  const labels = interactive.map(({ node }) => node.label);

  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minLabel = labels[values.indexOf(min)];
    const maxLabel = labels[values.indexOf(max)];

    const summary = document.createElement('p');
    summary.textContent = `Bar chart: ${title}. ${labels.length} categories. Values range from ${min} (${minLabel}) to ${max} (${maxLabel}).`;
    figure.appendChild(summary);
  }

  const table = document.createElement('table');
  table.id = 'flare-a11y-table';
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', `${title} data`);

  const caption = document.createElement('caption');
  caption.textContent = title;
  table.appendChild(caption);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const thCat = document.createElement('th');
  thCat.setAttribute('scope', 'col');
  thCat.textContent = 'Category';
  headerRow.appendChild(thCat);
  const thVal = document.createElement('th');
  thVal.setAttribute('scope', 'col');
  thVal.textContent = yAxisTitle || 'Value';
  headerRow.appendChild(thVal);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  interactive.forEach(({ node }) => {
    const row = document.createElement('tr');
    const th = document.createElement('th');
    th.setAttribute('scope', 'row');
    th.textContent = node.label;
    row.appendChild(th);
    const td = document.createElement('td');
    td.textContent = node.value || '';
    row.appendChild(td);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  figure.appendChild(table);

  const live = document.createElement('div');
  live.id = 'flare-live-region';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  figure.appendChild(live);

  const main = container.closest('#flare-main') || container.parentElement;
  main.appendChild(figure);

  // Focus first interactive overlay after drill actions
  if (focusAfterUpdate) {
    const firstOverlay = overlay.querySelector('[tabindex="0"]');
    if (firstOverlay) firstOverlay.focus();
  }
}

/**
 * Update the live region text for screen reader announcements.
 * Clears then sets via rAF so screen readers re-announce identical text.
 * @param {string} text
 */
export function announce(text) {
  const live = document.getElementById('flare-live-region');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = text; });
}
