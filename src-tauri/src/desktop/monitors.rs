//! Monitor targets for the desktop scene, in virtual-screen physical pixels —
//! the units Windows itself uses for window placement, so no scaling guesswork.

use tauri::AppHandle;

#[derive(Clone)]
pub struct MonitorTarget {
    pub index: usize,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub scale: f64,
}

impl MonitorTarget {
    pub fn label(&self) -> String {
        if self.index == 0 {
            "scene".into()
        } else {
            format!("scene-{}", self.index)
        }
    }

    pub fn size_label(&self) -> String {
        format!("{}×{} @ {}%", self.width, self.height, (self.scale * 100.0).round())
    }
}

/// Every monitor Windows reports, primary first.
pub fn targets(app: &AppHandle) -> Vec<MonitorTarget> {
    let Ok(monitors) = app.available_monitors() else {
        return Vec::new();
    };

    let mut targets: Vec<MonitorTarget> = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| MonitorTarget {
            index,
            name: monitor.name().cloned().unwrap_or_else(|| format!("Display {}", index + 1)),
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width as i32,
            height: monitor.size().height as i32,
            scale: monitor.scale_factor(),
        })
        .collect();

    // Keep geometry order (negative-x secondaries included) but make sure the
    // primary monitor is the first target, so its window keeps the plain label.
    targets.sort_by_key(|target| (target.x, target.y));
    targets
}
