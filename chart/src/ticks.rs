/// Calculate "nice" Y-axis tick marks for the chart.
/// Ticks are the horizontal gridlines and labels on the Y-axis (e.g. 0, 200, 400, ...).
/// Uses a standard "nice numbers" algorithm: round the step size to 1, 2, 5, or 10
/// multiples so the axis labels are human-readable, not arbitrary decimals.
pub fn calculate_y_ticks(data: &[f64]) -> Vec<f64> {
    if data.is_empty() {
        return vec![];
    }

    let min = data.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = data.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

    if (max - min).abs() < f64::EPSILON {
        return vec![min];
    }

    let range = max - min;
    let raw_step = range / 6.0;
    let magnitude = 10_f64.powf(raw_step.log10().floor());
    let normalized = raw_step / magnitude;

    let nice_step = if normalized <= 1.0 {
        magnitude
    } else if normalized <= 2.0 {
        2.0 * magnitude
    } else if normalized <= 5.0 {
        5.0 * magnitude
    } else {
        10.0 * magnitude
    };

    let tick_min = (min / nice_step).floor() * nice_step;
    let tick_max = (max / nice_step).ceil() * nice_step;

    let mut ticks = Vec::new();
    let mut current = tick_min;
    while current <= tick_max + nice_step * 0.001 {
        ticks.push((current * 1e10).round() / 1e10);
        current += nice_step;
    }

    ticks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trade_volumes() {
        let data = [1200.0, 980.0, 1450.0, 1100.0, 1680.0, 1320.0];
        let ticks = calculate_y_ticks(&data);
        assert!(ticks.len() >= 4 && ticks.len() <= 8, "got {} ticks: {:?}", ticks.len(), ticks);
        assert!(*ticks.first().unwrap() <= 980.0);
        assert!(*ticks.last().unwrap() >= 1680.0);
        // ticks should be evenly spaced
        let step = ticks[1] - ticks[0];
        for w in ticks.windows(2) {
            let diff = (w[1] - w[0] - step).abs();
            assert!(diff < 0.001, "uneven spacing: {:?}", ticks);
        }
    }

    #[test]
    fn small_floats() {
        let data = [2.4, 2.7, 3.1, 2.9];
        let ticks = calculate_y_ticks(&data);
        assert!(ticks.len() >= 4 && ticks.len() <= 8);
        assert!(*ticks.first().unwrap() <= 2.4);
        assert!(*ticks.last().unwrap() >= 3.1);
    }

    #[test]
    fn zero_and_outlier() {
        let data = [3.0, 0.0, 12.0, 45.0, 2.0];
        let ticks = calculate_y_ticks(&data);
        assert!(*ticks.first().unwrap() <= 0.0);
        assert!(*ticks.last().unwrap() >= 45.0);
    }

    #[test]
    fn empty_data() {
        assert!(calculate_y_ticks(&[]).is_empty());
    }

    #[test]
    fn single_value() {
        let ticks = calculate_y_ticks(&[42.0]);
        assert_eq!(ticks, vec![42.0]);
    }
}
