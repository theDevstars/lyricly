use rustfft::num_complex::Complex;
use rustfft::FftPlanner;
use std::sync::Arc;

/// Bands sent to the UI for the waveform drawing.
pub const BANDS: usize = 16;
const FFT_SIZE: usize = 2048;

/// What the lyrics styles get: three broad bands, a level, and a beat flag.
#[derive(Clone, Debug, Default, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioView {
    /// False when no device is open or nothing is playing.
    pub active: bool,
    pub level: f32,
    pub bass: f32,
    pub mid: f32,
    pub high: f32,
    pub beat: bool,
    /// Estimated from beat spacing; 0 when unknown.
    pub bpm: f32,
    pub bands: Vec<f32>,
}

impl AudioView {
    pub fn silent() -> Self {
        Self {
            active: false,
            bands: vec![0.0; BANDS],
            ..Default::default()
        }
    }
}

/// Turns microphone-style samples into the numbers the styles use.
pub struct Analyzer {
    fft: Arc<dyn rustfft::Fft<f32>>,
    sample_rate: f32,
    window: Vec<f32>,
    bands: [f32; BANDS],
    previous_bass: f32,
    bass_average: f32,
    last_beat_ms: f64,
    beat_gaps: Vec<f64>,
}

impl Analyzer {
    pub fn new(sample_rate: f32) -> Self {
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(FFT_SIZE);
        let sample_rate = if sample_rate > 1000.0 { sample_rate } else { 48_000.0 };
        // Hann window, computed once.
        let window = (0..FFT_SIZE)
            .map(|index| {
                let x = std::f32::consts::PI * 2.0 * index as f32 / (FFT_SIZE as f32 - 1.0);
                0.5 - 0.5 * x.cos()
            })
            .collect();

        Self {
            fft,
            sample_rate,
            window,
            bands: [0.0; BANDS],
            previous_bass: 0.0,
            bass_average: 0.02,
            last_beat_ms: 0.0,
            beat_gaps: Vec::new(),
        }
    }

    /// Frequency edges for the 16 display bands, log-spaced from 30 Hz to 16 kHz.
    fn edges(&self) -> [f32; BANDS + 1] {
        let low = 30.0_f32;
        let high = self.sample_rate.min(16_000.0).max(low * 4.0);
        let mut edges = [0.0_f32; BANDS + 1];
        for (index, edge) in edges.iter_mut().enumerate() {
            let t = index as f32 / BANDS as f32;
            *edge = low * (high / low).powf(t);
        }
        edges
    }

    /// Analyses one slice of mono samples. Short slices are zero-padded.
    pub fn push(&mut self, samples: &[f32], now_ms: f64) -> AudioView {
        if samples.is_empty() {
            return self.silent_view();
        }

        let mut buffer = vec![Complex::new(0.0, 0.0); FFT_SIZE];
        let take = samples.len().min(FFT_SIZE);
        for index in 0..take {
            buffer[index] = Complex::new(samples[index] * self.window[index], 0.0);
        }
        self.fft.process(&mut buffer);

        let bin_hz = self.sample_rate / FFT_SIZE as f32;
        let edges = self.edges();
        let mut raw = [0.0_f32; BANDS];
        for band in 0..BANDS {
            let low = (edges[band] / bin_hz).floor() as usize;
            let high = ((edges[band + 1] / bin_hz).ceil() as usize).min(FFT_SIZE / 2);
            let mut sum = 0.0;
            let mut count = 0;
            for bin in low..high.max(low + 1) {
                let magnitude = buffer[bin].norm() / (FFT_SIZE as f32 / 4.0);
                sum += magnitude;
                count += 1;
            }
            raw[band] = if count > 0 { sum / count as f32 } else { 0.0 };
        }

        // Smooth each band: fast attack, slow release, so bars do not flicker.
        for band in 0..BANDS {
            let target = (raw[band] * 3.2).min(1.0);
            let previous = self.bands[band];
            self.bands[band] = if target > previous {
                previous + (target - previous) * 0.55
            } else {
                previous + (target - previous) * 0.18
            };
        }

        let mean = |from: usize, to: usize| -> f32 {
            let slice = &self.bands[from..to];
            slice.iter().sum::<f32>() / slice.len().max(1) as f32
        };

        // 30–250 Hz bass, 250 Hz–2 kHz mids, 2–8 kHz highs.
        let bass = mean(0, 5);
        let mid = mean(5, 11);
        let high = mean(11, BANDS);

        let rms = (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32)
            .sqrt();
        let level = (rms * 8.0).min(1.0);

        // Beat: bass energy well above its own moving average.
        self.bass_average = self.bass_average * 0.92 + bass * 0.08;
        let flux = bass - self.previous_bass;
        self.previous_bass = bass;
        let mut beat = false;
        if flux > 0.02 && bass > self.bass_average * 1.25 && now_ms - self.last_beat_ms > 200.0 {
            if self.last_beat_ms > 0.0 {
                self.beat_gaps.push(now_ms - self.last_beat_ms);
                if self.beat_gaps.len() > 8 {
                    self.beat_gaps.remove(0);
                }
            }
            self.last_beat_ms = now_ms;
            beat = true;
        }

        let bpm = if self.beat_gaps.is_empty() {
            0.0
        } else {
            let average = self.beat_gaps.iter().sum::<f64>() / self.beat_gaps.len() as f64;
            if average > 1.0 {
                (60_000.0 / average) as f32
            } else {
                0.0
            }
        };

        AudioView {
            active: true,
            level,
            bass,
            mid,
            high,
            beat,
            bpm: bpm.clamp(40.0, 200.0),
            bands: self.bands.to_vec(),
        }
    }

    fn silent_view(&self) -> AudioView {
        AudioView {
            active: true,
            bands: self.bands.to_vec(),
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(freq: f32, sample_rate: f32, seconds: f32) -> Vec<f32> {
        let count = (sample_rate * seconds) as usize;
        (0..count)
            .map(|index| {
                (2.0 * std::f32::consts::PI * freq * index as f32 / sample_rate).sin() * 0.6
            })
            .collect()
    }

    #[test]
    fn silence_is_quiet() {
        let mut analyzer = Analyzer::new(48_000.0);
        let view = analyzer.push(&vec![0.0; 4096], 0.0);
        assert!(view.level < 0.02, "level {}", view.level);
        assert!(view.bass < 0.05);
    }

    #[test]
    fn low_tone_lands_in_the_bass() {
        let mut analyzer = Analyzer::new(48_000.0);
        let view = analyzer.push(&tone(60.0, 48_000.0, 0.1), 100.0);
        assert!(view.bass > view.mid, "bass {} mid {}", view.bass, view.mid);
        assert!(view.bass > view.high, "bass {} high {}", view.bass, view.high);
    }

    #[test]
    fn high_tone_lands_in_the_highs() {
        let mut analyzer = Analyzer::new(48_000.0);
        let view = analyzer.push(&tone(5_000.0, 48_000.0, 0.1), 100.0);
        assert!(view.high > view.bass, "high {} bass {}", view.high, view.bass);
    }

    #[test]
    fn mid_tone_lands_in_the_middle() {
        let mut analyzer = Analyzer::new(48_000.0);
        let view = analyzer.push(&tone(700.0, 48_000.0, 0.1), 100.0);
        assert!(view.mid > view.high, "mid {} high {}", view.mid, view.high);
    }

    #[test]
    fn bands_stay_in_range() {
        let mut analyzer = Analyzer::new(44_100.0);
        let view = analyzer.push(&tone(220.0, 44_100.0, 0.2), 0.0);
        assert_eq!(view.bands.len(), BANDS);
        for band in &view.bands {
            assert!((0.0..=1.0).contains(band), "band {band}");
        }
    }

    #[test]
    fn a_sudden_hit_is_a_beat() {
        let mut analyzer = Analyzer::new(48_000.0);
        for step in 0..6 {
            let quiet: Vec<f32> = vec![0.0; 4096];
            analyzer.push(&quiet, step as f64 * 100.0);
        }
        let hit = analyzer.push(&tone(70.0, 48_000.0, 0.1), 700.0);
        assert!(hit.beat, "expected a beat on the transient");
    }

    #[test]
    fn empty_input_is_safe() {
        let mut analyzer = Analyzer::new(48_000.0);
        let view = analyzer.push(&[], 0.0);
        assert_eq!(view.bands.len(), BANDS);
        assert!(!view.beat);
    }

    #[test]
    fn falls_back_to_a_sane_sample_rate() {
        let mut analyzer = Analyzer::new(0.0);
        let view = analyzer.push(&tone(440.0, 48_000.0, 0.05), 0.0);
        assert!(view.active);
    }
}
