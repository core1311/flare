# Mirror DOM: accessible canvas rendering

## The problem

Canvas-based UIs render pixels to a `<canvas>` element. To a screen reader, that's one opaque rectangle — no buttons, no headings, no data. The entire visual interface is invisible to assistive technology.

This hits hardest in two domains:

- **Data visualisation** — charting libraries like ECharts and Lumen Charts use canvas for performance with large datasets, but ship zero accessibility. SVG libraries (Highcharts, D3) get a11y free from the DOM but choke on high-frequency data.
- **Application UIs** — Figma, game engines, and GPU-rendered frameworks draw everything to canvas. A blind user tabbing through the app hears silence.

## The pattern: one tree, two projections

The fix is to stop treating pixels as the UI and treat them as *one projection* of it. Every visual element also describes itself semantically — what it *is*, not how it looks. Those descriptions project into a second tree: a hidden DOM layer that sits on top of the canvas.

**Visual projection** → canvas pixels (for sighted users)
**Semantic projection** → DOM elements (for screen readers, keyboard, agents)

The two projections share the same source of truth. When data changes, both update together. The DOM elements are positioned at the exact pixel coordinates of their canvas counterparts — transparent overlays, invisible to the eye but structurally real to the browser.

## How it works

### 1. Render to canvas

The rendering engine (Rust/WASM in Flare, C++/WASM in Vel, whatever in Figma) draws the visual representation and returns the bounding rectangles of every interactive element.

```
render(canvas, data) → [{ x, y, w, h, index, label, role }]
```

### 2. Build the DOM mirror

A JS layer takes those rectangles and creates DOM elements positioned exactly over the canvas:

```html
<!-- Canvas is the visual layer -->
<canvas id="chart" width="700" height="450"></canvas>

<!-- Mirror overlay — transparent, positioned over the canvas -->
<div class="mirror-overlay" style="position:relative">
  <div role="button" tabindex="0" aria-label="Jan: 1,200 Trades"
       style="position:absolute; left:85px; top:62px; width:36px; height:338px;
              background:transparent; cursor:pointer;">
  </div>
  <div role="button" tabindex="0" aria-label="Feb: 980 Trades"
       style="position:absolute; left:136px; top:108px; width:36px; height:292px;
              background:transparent; cursor:pointer;">
  </div>
  <!-- one per bar -->
</div>
```

Each overlay element:
- Has the correct ARIA role and label
- Is positioned at the bar's exact pixel coordinates
- Is transparent — the canvas shows through
- Receives native focus (Tab moves through them, `:focus-visible` draws a ring)
- Has click and keyboard handlers that route back to the app

### 3. Keep them in sync

When data changes (drill-down, filter, new query), both projections update:

1. Call WASM to re-render the canvas → get new bar rects
2. Tear down old mirror DOM overlays, build new ones from new rects
3. Update the summary, breadcrumb, and live region
4. Move focus to the first interactive element

This is the critical invariant: **the mirror DOM and canvas always reflect the same data**. If they drift, a screen reader describes something different from what's on screen.

## Libraries

The mirror DOM pattern is implemented as a Cargo workspace of reusable packages. Any renderer that produces `SemNode` output can use the web accessibility layer.

### flare-chart (Rust crate)

Base bar chart renderer — `Theme`, `BarRect`, `ChartDescription`, `render_chart`, `create_canvas`, tick math, and animation. This crate uses browser APIs and is intended for web/WebAssembly consumers. It re-exports `flare-core`; it is not the native Android or iOS integration.

### flare-core (Rust crate)

Platform-neutral types — no web or operating-system dependencies, pure Rust + serde. This is the shared semantic model for current and future platform adapters.

- **`SemNode`** — geometry (x, y, w, h) + semantics (role, label, value, focusable, children)
- **`Role`** — Button, Cell, Figure, Group, Img, Row, Table
- **`Describable` trait** — any renderer implements `fn describe(&self) -> Vec<SemNode>`

A chart renderer holds both its pixel output and the data context. It implements `Describable` to produce a semantic tree: typically a `Figure` containing a `Group` of `Button` nodes (one per bar/point/slice), each with geometry from the render pass and label/value from the data.

### mirror-dom (JS module)

Framework-agnostic ES module, no build step. Takes `SemNode[]` from any WASM renderer and builds the full DOM layer:

```js
import { buildMirrorDom } from 'mirror-dom/mirror-dom.js';

buildMirrorDom(container, semNodes, {
  onSelect: (index) => drillIn(index),
  drillable: true,
  yAxisTitle: 'Trades',
});
```

Builds: positioned overlay divs, sr-only figure with data table, live region for announcements. Handles DPR scaling, focus management, and keyboard routing.

### Data flow

```
Renderer (Rust)          Platform boundary      Accessibility adapter
─────────────────       ──────────────         ──────────────
render() → pixels
describe() → Vec<SemNode>  → JSON string  →   Web: mirror-dom (available)
                                               Android: native adapter (planned)
                                               iOS: native adapter (planned)
```

The semantic model can be shared across platforms, while rendering and accessibility adapters remain platform-specific. The current web consumer uses JavaScript; Android and iOS adapters are future work and will need Kotlin/Swift bindings plus native accessibility implementations.

## Prior art

### Vel/Lume (Sai Chandan Kadarla, June 2026)

C++/WASM GPU UI framework. Every widget has a `describe()` method that fills a `SemNode` (role, label, value, focusable, editable, rect). A collector walks the widget tree into a flat list, and a JS layer maintains a hidden DOM positioned over the canvas. Editable nodes get real `<input>` elements for native IME/keyboard support.

Key insight: the same semantic tree serialises to JSON for AI agents — the accessibility tree and the agent-automation tree are the same tree, because both ask "what is here and what can I do with it?"

Source: [kadarla.com/blog/accessible-canvas-ui](https://kadarla.com/blog/accessible-canvas-ui)

### Figma (July 2026)

Canvas editor with a mirror DOM for their spatial scenegraph. Every object on the Figma canvas has a semantic counterpart in the DOM. Tab order follows the layer structure. Focus rings track the selected element.

### Flutter Web

Flutter compiles to canvas on the web and builds a parallel `<flt-semantics-host>` tree with `<flt-semantics>` elements. Each element has ARIA attributes and is positioned over its canvas counterpart. The implementation is mature but Flutter-specific.

## Applying it to data visualisation

Charts are a specific case. The visual elements are bars, lines, points, slices — and the natural semantic representation is a **data table**, not a spatial tree.

Flare's approach:

| Visual (canvas) | Semantic (mirror DOM) |
|---|---|
| Bar at (85, 62, 36, 338) | `<div role="button">` at same coordinates, with `aria-label="Jan: 1,200 Trades"` |
| Chart title | `<h2>` or `aria-label` on the figure |
| Y-axis labels | Not mirrored (decorative — data is in the table) |
| Entire chart | `role="figure"` container with summary paragraph |

Additionally, a semantic `<table>` (visually hidden) provides a structured data representation for screen readers that prefer to navigate tabularly rather than spatially.

## Why this matters for testing

The mirror DOM pattern creates a unique a11y testing challenge. Automated scanners need to verify:

1. **Existence** — every interactive canvas element has a mirror DOM counterpart
2. **Positioning** — overlays are aligned to their canvas elements (drift = broken)
3. **Sync** — after data changes, both projections match
4. **Completeness** — roles, labels, and states are correct
5. **Keyboard** — Tab order follows visual order, Enter/Space activate
6. **Announcements** — live regions fire on state changes

Standard a11y scanners (axe) can check the DOM side but can't verify it matches what's on canvas. That's where vision-based scanners (Lens) and cognitive load scanners (Scout) add value — they can detect when the visual and semantic layers have drifted.

### Failure modes unique to mirror DOM

These are the things that go wrong in canvas a11y that don't exist in regular DOM UIs:

- **Missing mirror** — canvas element has no DOM counterpart (invisible to AT)
- **Stale mirror** — data changed, canvas updated, mirror didn't
- **Misaligned mirror** — overlay is at wrong coordinates (focus ring in wrong place)
- **Role mismatch** — canvas shows a button, mirror says it's a heading
- **Lost focus** — after re-render, focus disappears instead of moving to new content
- **Silent transitions** — data drill-down happens visually but live region doesn't announce it

Flare's `?fail=` flags let us toggle each of these failure modes on and off for scanner testing.

## Canvas text: the accessibility overlay blind spot

Third-party accessibility overlays (UserWay, AccessiBe, EqualWeb) work by injecting CSS at runtime — toggling `letter-spacing`, `word-spacing`, `font-family`, and `line-height` on DOM elements. This covers most web content, but **canvas-rendered text is invisible to CSS**. The browser's style engine never touches pixels drawn via `ctx.fillText()`, so overlay widgets have no mechanism to adjust spacing or fonts inside a `<canvas>`.

This is a structural gap, not a bug in any specific overlay. The Canvas 2D API has no native `letter-spacing` or `word-spacing` properties — text is rasterised in a single draw call with no per-character control.

Flare's `fill_text_spaced()` in `flare-chart` fills this gap by drawing text character-by-character with configurable spacing. The spacing values are read from CSS custom properties (`--flare-letter-spacing`, `--flare-word-spacing`) so they can be toggled by the app's own preference controls — or by an overlay that sets CSS variables on `<body>`. The values default to 0.08em letter spacing and 0.16em word spacing.

This means any canvas charting library that uses the mirror-dom pattern gets two things overlays can't provide:

1. **Dyslexia-friendly text spacing** on canvas labels, titles, and tick marks
2. **Dynamic left margin** that recalculates when spacing widens tick labels, preventing clipping

The same approach generalises: any text property that CSS can express but canvas ignores (letter-spacing, word-spacing, text-decoration) can be implemented as a custom draw function in the renderer, driven by CSS variables that the host page controls.

## References

- [Vel/Lume: Making a canvas-rendered UI a screen reader can actually use](https://kadarla.com/blog/accessible-canvas-ui) — Sai Chandan Kadarla (June 2026)
- [Wham](https://github.com/superfield-ai/wham) — Rust/WASM GPU forms, claims WCAG 2.1 AA
- [Lumen Charts](https://github.com/jagtesh/lumen-charts) — Rust/WASM GPU charting, no a11y
