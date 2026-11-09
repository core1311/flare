use wasm_bindgen::prelude::*;
use flare_chart::{ChartData, Theme, ChartDescription, render_chart};
use flare_chart::animation::{AnimationState, start_animation};
use flare_chart::flare_core::Describable;

pub use flare_chart;

#[wasm_bindgen]
pub fn create_canvas(canvas_id: &str, width: u32, height: u32) {
    let document = web_sys::window()
        .expect("no window")
        .document()
        .expect("no document");
    flare_chart::canvas::create_canvas(&document, canvas_id, width, height);
}

#[wasm_bindgen]
pub fn render(canvas_id: &str, title: &str, labels_json: &str, values_json: &str, y_title: &str, theme_json: &str) -> String {
    let document = web_sys::window()
        .expect("no window")
        .document()
        .expect("no document");

    let labels: Vec<String> = serde_json::from_str(labels_json).unwrap_or_default();
    let values: Vec<f64> = serde_json::from_str(values_json).unwrap_or_default();
    let theme: Theme = serde_json::from_str(theme_json).unwrap_or_default();

    let data = ChartData {
        title: title.into(),
        x_labels: labels,
        y_values: values,
        y_axis_title: y_title.into(),
    };

    let canvas_el = document.get_element_by_id(canvas_id).expect("no canvas");
    let canvas: web_sys::HtmlCanvasElement = canvas_el.dyn_into().expect("not a canvas");

    let bar_rects = render_chart(&canvas, &data, &theme);
    let desc = ChartDescription { bars: &bar_rects, data: &data };
    let sem_nodes = desc.describe();

    serde_json::to_string(&sem_nodes).unwrap_or_else(|_| "[]".into())
}

fn has_reduce_motion_class() -> bool {
    web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.body())
        .map(|b| b.class_list().contains("reduce-motion"))
        .unwrap_or(false)
}

#[wasm_bindgen]
pub fn render_animated(
    canvas_id: &str,
    title: &str,
    labels_json: &str,
    from_json: &str,
    to_json: &str,
    y_title: &str,
    theme_json: &str,
    duration_ms: f64,
    on_complete: &js_sys::Function,
) -> String {
    let document = web_sys::window()
        .expect("no window")
        .document()
        .expect("no document");

    let labels: Vec<String> = serde_json::from_str(labels_json).unwrap_or_default();
    let from_values: Vec<f64> = serde_json::from_str(from_json).unwrap_or_default();
    let to_values: Vec<f64> = serde_json::from_str(to_json).unwrap_or_default();
    let theme: Theme = serde_json::from_str(theme_json).unwrap_or_default();

    let to_data = ChartData {
        title: title.into(),
        x_labels: labels.clone(),
        y_values: to_values.clone(),
        y_axis_title: y_title.into(),
    };

    let canvas_el = document.get_element_by_id(canvas_id).expect("no canvas");
    let canvas: web_sys::HtmlCanvasElement = canvas_el.dyn_into().expect("not a canvas");

    let final_rects = render_chart(&canvas, &to_data, &theme);

    let from_data = ChartData {
        title: title.into(),
        x_labels: labels,
        y_values: from_values.clone(),
        y_axis_title: y_title.into(),
    };

    start_animation(AnimationState {
        canvas,
        data: from_data,
        from: from_values,
        to: to_values,
        theme,
        duration_ms,
        start_time: 0.0,
        on_complete: on_complete.clone(),
        reduced_motion_override: has_reduce_motion_class(),
    });

    let desc = ChartDescription { bars: &final_rects, data: &to_data };
    serde_json::to_string(&desc.describe()).unwrap_or_else(|_| "[]".into())
}
