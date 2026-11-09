use serde::{Deserialize, Serialize};
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, Document, HtmlCanvasElement};

use flare_core::{Describable, Role, SemNode};

use crate::ChartData;
use crate::ticks::calculate_y_ticks;
use crate::text::{fill_text_spaced, measure_text_spaced};

const MARGIN_LEFT: f64 = 70.0;
const MARGIN_TOP: f64 = 50.0;
const MARGIN_RIGHT: f64 = 20.0;
const MARGIN_BOTTOM: f64 = 50.0;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
    pub bar_color: String,
    pub axis_color: String,
    pub bg_color: String,
    pub label_font: String,
    pub title_font: String,
    #[serde(default)]
    pub letter_spacing: f64,
    #[serde(default)]
    pub word_spacing: f64,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            bar_color: "#386A20".into(),
            axis_color: "#1A1C18".into(),
            bg_color: "#FCFDF6".into(),
            label_font: "13px system-ui, sans-serif".into(),
            title_font: "bold 16px system-ui, sans-serif".into(),
            letter_spacing: 0.0,
            word_spacing: 0.0,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BarRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub index: usize,
}

pub struct ChartDescription<'a> {
    pub bars: &'a [BarRect],
    pub data: &'a ChartData,
}

impl Describable for ChartDescription<'_> {
    fn describe(&self) -> Vec<SemNode> {
        let bar_nodes: Vec<SemNode> = self.bars.iter().map(|bar| {
            let label = self.data.x_labels.get(bar.index)
                .cloned()
                .unwrap_or_else(|| format!("Bar {}", bar.index));
            let value = self.data.y_values.get(bar.index)
                .map(|v| format!("{}", v))
                .unwrap_or_default();
            SemNode::new(Role::Button, label)
                .with_value(value)
                .with_geometry(bar.x, bar.y, bar.w, bar.h)
                .with_focusable(true)
        }).collect();

        let figure = SemNode::new(Role::Figure, &self.data.title)
            .with_children(vec![
                SemNode::new(Role::Group, "Bars").with_children(bar_nodes),
            ]);

        vec![figure]
    }
}

pub fn create_canvas(document: &Document, id: &str, width: u32, height: u32) -> HtmlCanvasElement {
    let el = document.create_element("canvas").expect("create canvas");
    let canvas: HtmlCanvasElement = el.dyn_into().expect("cast to HtmlCanvasElement");
    canvas.set_id(id);
    canvas.set_width(width);
    canvas.set_height(height);
    let main = document.get_element_by_id("flare-main").expect("no #flare-main");
    main.append_child(&canvas).ok();
    canvas
}

fn get_ctx(canvas: &HtmlCanvasElement) -> CanvasRenderingContext2d {
    canvas
        .get_context("2d")
        .expect("get_context")
        .expect("2d context")
        .dyn_into()
        .expect("cast to CanvasRenderingContext2d")
}

pub fn render_chart(canvas: &HtmlCanvasElement, data: &ChartData, theme: &Theme) -> Vec<BarRect> {
    let ctx = get_ctx(canvas);
    let w = canvas.width() as f64;
    let h = canvas.height() as f64;

    let ticks = calculate_y_ticks(&data.y_values);

    // Compute left margin from widest tick label
    ctx.set_font(&theme.label_font);
    let max_tick_w = ticks.iter().map(|&tick| {
        let label = if tick.fract().abs() < 0.001 {
            format_with_commas(tick as i64)
        } else {
            format!("{:.1}", tick)
        };
        measure_text_spaced(&ctx, &label, theme)
    }).fold(0.0_f64, f64::max);
    let margin_left = (max_tick_w + 18.0).max(MARGIN_LEFT);

    let chart_w = w - margin_left - MARGIN_RIGHT;
    let chart_h = h - MARGIN_TOP - MARGIN_BOTTOM;

    ctx.set_fill_style_str(&theme.bg_color);
    ctx.fill_rect(0.0, 0.0, w, h);

    ctx.set_fill_style_str(&theme.axis_color);
    ctx.set_font(&theme.title_font);
    ctx.set_text_align("center");
    fill_text_spaced(&ctx, &data.title, w / 2.0, 30.0, theme);

    let y_min_tick = *ticks.first().unwrap_or(&0.0);
    let y_max_tick = *ticks.last().unwrap_or(&1.0);
    // When all values are equal (e.g. single bar), anchor to 0 so bars are visible
    let (y_min, y_range) = if (y_max_tick - y_min_tick).abs() < f64::EPSILON {
        (0.0_f64, y_max_tick.abs().max(1.0))
    } else {
        (y_min_tick, y_max_tick - y_min_tick)
    };

    draw_axes(&ctx, data, &ticks, margin_left, chart_w, chart_h, y_min, y_range, theme);
    draw_bars(&ctx, data, margin_left, chart_w, chart_h, y_min, y_range, theme)
}

fn draw_axes(
    ctx: &CanvasRenderingContext2d,
    data: &ChartData,
    ticks: &[f64],
    margin_left: f64,
    chart_w: f64,
    chart_h: f64,
    y_min: f64,
    y_range: f64,
    theme: &Theme,
) {
    ctx.set_stroke_style_str(&theme.axis_color);
    ctx.set_fill_style_str(&theme.axis_color);
    ctx.set_font(&theme.label_font);
    ctx.set_line_width(1.0);

    ctx.begin_path();
    ctx.move_to(margin_left, MARGIN_TOP);
    ctx.line_to(margin_left, MARGIN_TOP + chart_h);
    ctx.stroke();

    ctx.begin_path();
    ctx.move_to(margin_left, MARGIN_TOP + chart_h);
    ctx.line_to(margin_left + chart_w, MARGIN_TOP + chart_h);
    ctx.stroke();

    ctx.set_text_align("right");
    ctx.set_text_baseline("middle");
    for &tick in ticks {
        let y = MARGIN_TOP + chart_h - ((tick - y_min) / y_range) * chart_h;
        ctx.begin_path();
        ctx.move_to(margin_left - 5.0, y);
        ctx.line_to(margin_left, y);
        ctx.stroke();

        let label = if tick.fract().abs() < 0.001 {
            format_with_commas(tick as i64)
        } else {
            format!("{:.1}", tick)
        };
        fill_text_spaced(ctx, &label, margin_left - 8.0, y, theme);
    }

    let n = data.x_labels.len();
    let bar_area = chart_w / n as f64;
    ctx.set_text_align("center");
    ctx.set_text_baseline("top");
    for (i, label) in data.x_labels.iter().enumerate() {
        let x = margin_left + bar_area * i as f64 + bar_area / 2.0;
        fill_text_spaced(ctx, label, x, MARGIN_TOP + chart_h + 8.0, theme);
    }
}

fn draw_bars(
    ctx: &CanvasRenderingContext2d,
    data: &ChartData,
    margin_left: f64,
    chart_w: f64,
    chart_h: f64,
    y_min: f64,
    y_range: f64,
    theme: &Theme,
) -> Vec<BarRect> {
    let n = data.y_values.len();
    let bar_area = chart_w / n as f64;
    let bar_width = bar_area * 0.65;
    let gap = (bar_area - bar_width) / 2.0;
    let mut rects = Vec::with_capacity(n);

    ctx.set_fill_style_str(&theme.bar_color);

    for (i, &val) in data.y_values.iter().enumerate() {
        let bar_h = ((val - y_min) / y_range) * chart_h;
        let x = margin_left + bar_area * i as f64 + gap;
        let y = MARGIN_TOP + chart_h - bar_h;
        ctx.fill_rect(x, y, bar_width, bar_h);
        rects.push(BarRect { x, y, w: bar_width, h: bar_h, index: i });
    }

    rects
}

fn format_with_commas(n: i64) -> String {
    let s = n.abs().to_string();
    let mut result = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
    }
    if n < 0 {
        result.push('-');
    }
    result.chars().rev().collect()
}
