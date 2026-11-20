use super::analyze::{Analyzer, AudioView};
use super::{now_ms, publish};
use std::thread::sleep;
use std::time::Duration;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// Quiet for this many consecutive reads counts as "nothing is playing".
const QUIET_READS: u32 = 30;
const QUIET_LEVEL: f32 = 0.004;

pub fn spawn() {
    let _ = std::thread::Builder::new()
        .name("lyrica-audio".into())
        .spawn(run);
}

fn run() {
    loop {
        if let Err(error) = session() {
            eprintln!("audio: {error}");
        }
        publish(AudioView::silent());
        sleep(Duration::from_secs(3));
    }
}

/// Opens the default render device as a loopback source and reads until the
/// device goes away. Returns an error for the caller to retry.
fn session() -> windows::core::Result<()> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;

        let format = client.GetMixFormat()?;
        if format.is_null() {
            return Ok(());
        }
        // Read the format before it is freed: Initialize only copies it, and the
        // pointer is invalid the moment CoTaskMemFree runs.
        let format_ref = &*format;
        let sample_rate = format_ref.nSamplesPerSec as f32;
        let channels = format_ref.nChannels.max(1) as usize;
        let float = format_ref.wBitsPerSample == 32;

        let init = client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            0,
            0,
            format,
            None,
        );
        CoTaskMemFree(Some(format as *const _ as *const core::ffi::c_void));
        init?;

        let capture: IAudioCaptureClient = client.GetService()?;
        client.Start()?;

        let mut analyzer = Analyzer::new(sample_rate);
        let mut quiet = 0_u32;
        let mut announced = false;
        eprintln!("audio: loopback open at {sample_rate} Hz, {channels} ch");

        loop {
            let mut packet = capture.GetNextPacketSize().unwrap_or(0);

            while packet > 0 {
                let mut data: *mut u8 = std::ptr::null_mut();
                let mut frames = 0_u32;
                let mut flags = 0_u32;
                let mut position = 0_u64;
                let mut qpc = 0_u64;

                if capture
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
                    .is_err()
                {
                    break;
                }

                let silent = flags & (AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) != 0;
                let samples = if silent || data.is_null() || frames == 0 {
                    Vec::new()
                } else {
                    downmix(data, frames as usize, channels, float)
                };

                let mut view = if samples.is_empty() {
                    analyzer.push(&[], now_ms())
                } else {
                    analyzer.push(&samples, now_ms())
                };

                // Nothing audible: tell the styles to fall back.
                if view.level < QUIET_LEVEL {
                    quiet = quiet.saturating_add(1);
                } else {
                    quiet = 0;
                }
                if quiet > QUIET_READS {
                    view.active = false;
                    view.beat = false;
                }

                // One line per state change: enough to diagnose a silent device
                // without filling the log while a song plays.
                if view.active != announced {
                    announced = view.active;
                    eprintln!(
                        "audio: {}",
                        if view.active {
                            "signal detected"
                        } else {
                            "no signal, styles fall back to lyric energy"
                        }
                    );
                }

                publish(view);
                let _ = capture.ReleaseBuffer(frames);
                packet = capture.GetNextPacketSize().unwrap_or(0);
            }

            sleep(Duration::from_millis(12));
        }

        let _ = client.Stop();
    }

    Ok(())
}

/// Averages channels to mono and converts to f32.
fn downmix(data: *mut u8, frames: usize, channels: usize, float: bool) -> Vec<f32> {
    let mut out = Vec::with_capacity(frames);
    unsafe {
        if float {
            let samples = std::slice::from_raw_parts(data as *const f32, frames * channels);
            for frame in 0..frames {
                let mut sum = 0.0;
                for channel in 0..channels {
                    sum += samples[frame * channels + channel];
                }
                out.push(sum / channels as f32);
            }
        } else {
            let samples = std::slice::from_raw_parts(data as *const i16, frames * channels);
            for frame in 0..frames {
                let mut sum = 0.0;
                for channel in 0..channels {
                    sum += samples[frame * channels + channel] as f32 / 32768.0;
                }
                out.push(sum / channels as f32);
            }
        }
    }
    out
}
