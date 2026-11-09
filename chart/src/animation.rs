use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::{ChartData, Theme, render_chart};

pub struct AnimationState {
    pub canvas: web_sys::HtmlCanvasElement,
    pub data: ChartData,
    pub from: Vec<f64>,
    pub to: Vec<f64>,
    pub theme: Theme,
    pub duration_ms: f64,
    pub start_time: f64,
    pub on_complete: js_sys::Function,
    pub reduced_motion_override: bool,
}

pub fn prefers_reduced_motion() -> bool {
    web_sys::window()
        .and_then(|w| w.match_media("(prefers-reduced-motion: reduce)").ok().flatten())
        .map(|mql| mql.matches())
        .unwrap_or(false)
}

pub fn start_animation(state: AnimationState) {
    if state.reduced_motion_override || prefers_reduced_motion() || state.duration_ms <= 0.0 {
        let to_data = ChartData {
            y_values: state.to.clone(),
            ..state.data
        };
        render_chart(&state.canvas, &to_data, &state.theme);
        state.on_complete.call0(&JsValue::NULL).ok();
        return;
    }

    let state = Rc::new(RefCell::new(state));
    let closure: Rc<RefCell<Option<Closure<dyn FnMut()>>>> = Rc::new(RefCell::new(None));
    let closure_clone = closure.clone();
    let state_clone = state.clone();

    *closure.borrow_mut() = Some(Closure::new(move || {
        let window = web_sys::window().unwrap();
        let now = window.performance().unwrap().now();
        let s = state_clone.borrow_mut();
        let elapsed = now - s.start_time;
        let progress = (elapsed / s.duration_ms).min(1.0);

        let interpolated: Vec<f64> = s.from.iter()
            .zip(s.to.iter())
            .map(|(&f, &t)| f + (t - f) * progress)
            .collect();

        let mut frame_data = s.data.clone();
        frame_data.y_values = interpolated;
        render_chart(&s.canvas, &frame_data, &s.theme);

        if progress >= 1.0 {
            s.on_complete.call0(&JsValue::NULL).ok();
            drop(s);
            *closure_clone.borrow_mut() = None;
        } else {
            drop(s);
            let c = closure_clone.borrow();
            let f = c.as_ref().unwrap().as_ref().unchecked_ref();
            window.request_animation_frame(f).ok();
        }
    }));

    let window = web_sys::window().unwrap();
    {
        let mut s = state.borrow_mut();
        s.start_time = window.performance().unwrap().now();
    }
    let c = closure.borrow();
    let f = c.as_ref().unwrap().as_ref().unchecked_ref();
    window.request_animation_frame(f).ok();
}
