pub mod ticks;
pub mod canvas;
pub mod animation;
pub mod text;

pub use flare_core;

pub use ticks::calculate_y_ticks;
pub use canvas::{Theme, BarRect, ChartDescription, render_chart, create_canvas};
pub use animation::{AnimationState, start_animation, prefers_reduced_motion};
pub use text::{fill_text_spaced, measure_text_spaced};

#[derive(Debug, Clone, PartialEq)]
pub struct ChartData {
    pub title: String,
    pub x_labels: Vec<String>,
    pub y_values: Vec<f64>,
    pub y_axis_title: String,
}
