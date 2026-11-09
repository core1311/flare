# Flare Demo

Canvas bar chart in Rust/WASM with a Mirror DOM accessibility bridge.

## Why

Canvas-based charting libraries (ECharts, Lumen Charts) have no accessibility — the `<canvas>` element is opaque to screen readers. SVG libraries get a11y free from the DOM but can't handle high-frequency data visualisation at scale.

Figma solved this for their canvas editor in July 2026: a hidden parallel HTML tree (the "Mirror DOM") with ARIA roles, kept in sync with the canvas. They mirror a spatial scenegraph.

Charts are different — the semantic representation isn't a tree of shapes, it's a **data table**. This demo proves the pattern works for data visualisation: one canvas for rendering, one hidden table for screen readers.

See [Mirror DOM: accessible canvas rendering](../docs/mirror-dom.md) for background on the pattern.

## What it does

- Renders a bar chart on `<canvas>` via Rust/WASM (wasm-bindgen + web-sys)
- Builds a transparent **overlay Mirror DOM** alongside it:
  - Absolutely-positioned `<div>` overlays at each bar's pixel coordinates (adjusted for device pixel ratio)
  - Each overlay has `role="button"`, `tabindex="0"`, and `aria-label` with the bar's value
  - Focus rings appear directly on the bars via `:focus-visible`
  - Visually hidden semantic `<table>` with `<caption>`, scoped `<th>` headers, one row per bar
  - `aria-live="polite"` region announces drill-down transitions
- Canvas gets `role="img"` + `aria-describedby` pointing to the table
- 3-level drill-down: year (12 months) → month (4-5 weeks) → week (5 weekdays)
- 3-page SPA with sidebar navigation:
  - **Chart** — the interactive canvas chart
  - **Guide** — keyboard navigation guide for non-technical users
  - **How It Works** — Mirror DOM explanation (overview + technical deep-dive covering canvas ecosystem, WebGL/WebGPU, why Rust/WASM)

## Running

```bash
wasm-pack build --target web --out-name flare
python3 -m http.server 8081
```

Open `http://localhost:8081`. The generated `pkg/` directory is ignored by git.

## Failure flags

Append `?fail=` to the URL to break specific a11y/security features. No flags = clean baseline that should pass all scanners.

| Flag | What breaks | Scanners |
|---|---|---|
| `keyboard` | Mirror DOM cells lose tabindex + role=button | axe, Scout |
| `aria` | Canvas + mirror DOM lose ARIA roles/labels | axe |
| `contrast` | Text colours set to #ccc on white | axe, Lens |
| `csp` | CSP meta tag removed | Security |
| `heading` | h1 replaced with unsemantic div | axe, Scout |
| `table` | Data table replaced with div soup | axe |
| `lang` | lang attribute removed from html | axe |
| `live-region` | aria-live region stripped | axe |
| `focus` | All focus indicators removed | axe, Scout |
| `skip-link` | Skip navigation link removed | axe, Scout |
| `breadcrumb` | Breadcrumb navigation removed | axe, Scout |
| `drill-keyboard` | Drillable cells lose role=button + tabindex | axe |
| `drill-announce` | Live region announcements suppressed on drill | axe |
| `drill-focus` | Focus not moved after drill navigation | Scout |
| `all` | Everything above | all scanners |

Flags compose: `?fail=keyboard,contrast` breaks both.

### Examples

```bash
# Clean baseline
open http://localhost:8081/

# All violations
open http://localhost:8081/?fail=all

# Just keyboard + contrast
open http://localhost:8081/?fail=keyboard,contrast

```

## Testing

```bash
cargo test --workspace
```

VoiceOver: navigate to the chart, it announces the title and summary. Tab through bars to hear each data point. Enter to drill down, Escape/Backspace/Alt+Left to go back.

## Dependencies

Libraries from the flare workspace (sibling crates):

- **`flare-chart`** (Rust crate, `../chart/`) — base bar chart: `Theme`, `BarRect`, `ChartDescription`, `render_chart`, `create_canvas`, tick math, and animation. Animation reads `prefers-reduced-motion` directly in Rust. The demo depends on this and adds `#[wasm_bindgen]` exports.
- **`flare-core`** (Rust crate, `../crates/flare-core/`) — `SemNode`, `Role`, `Describable` trait. Platform-neutral and re-exported through flare-chart.
- **`mirror-dom`** (JS module, `../mirror-dom/`) — `buildMirrorDom()`, `extractBarRects()`, `announce()`. Takes SemNode JSON from WASM and builds overlay DOM, sr-only table, and live region.

The WASM render functions return `Vec<SemNode>` serialised as JSON. `app.js` parses it and calls the JS lib.

## Stack

Rust, wasm-bindgen, web-sys, flare-chart (which re-exports flare-core). No JS framework, no bundler, no npm.

The chart renderer is web-specific. Future Android and iOS integrations should use `flare-core` through platform bindings and implement native accessibility views separately.

## How the shim works

`fail-shim.js` loads as a module after WASM init. It reads `?fail=` from the URL and runs DOM mutations — stripping attributes, injecting bad styles, replacing elements. The Rust code always builds the full correct DOM; the shim breaks it post-render. This means new failure modes don't need a WASM recompile.
