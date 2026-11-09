use web_sys::CanvasRenderingContext2d;

use crate::Theme;

/// Draw text with per-character letter-spacing and word-spacing.
/// Falls back to a single `fill_text` call when spacing is zero.
pub fn fill_text_spaced(ctx: &CanvasRenderingContext2d, text: &str, x: f64, y: f64, theme: &Theme) {
    if theme.letter_spacing.abs() < 0.01 && theme.word_spacing.abs() < 0.01 {
        ctx.fill_text(text, x, y).ok();
        return;
    }

    let align = ctx.text_align();
    let total_w = measure_text_spaced(ctx, text, theme);

    let start_x = match align.as_str() {
        "center" => x - total_w / 2.0,
        "right" | "end" => x - total_w,
        _ => x,
    };

    let saved_align = ctx.text_align();
    ctx.set_text_align("left");
    let mut cx = start_x;
    for ch in text.chars() {
        let s = ch.to_string();
        ctx.fill_text(&s, cx, y).ok();
        let char_w = ctx.measure_text(&s).map(|m| m.width()).unwrap_or(0.0);
        cx += char_w + theme.letter_spacing;
        if ch == ' ' {
            cx += theme.word_spacing;
        }
    }
    ctx.set_text_align(&saved_align);
}

/// Measure text width accounting for extra letter-spacing and word-spacing.
pub fn measure_text_spaced(ctx: &CanvasRenderingContext2d, text: &str, theme: &Theme) -> f64 {
    if theme.letter_spacing.abs() < 0.01 && theme.word_spacing.abs() < 0.01 {
        return ctx.measure_text(text).map(|m| m.width()).unwrap_or(0.0);
    }
    let chars: Vec<char> = text.chars().collect();
    let mut w = 0.0;
    for (i, &ch) in chars.iter().enumerate() {
        let s = ch.to_string();
        w += ctx.measure_text(&s).map(|m| m.width()).unwrap_or(0.0);
        if i < chars.len() - 1 {
            w += theme.letter_spacing;
        }
        if ch == ' ' {
            w += theme.word_spacing;
        }
    }
    w
}
