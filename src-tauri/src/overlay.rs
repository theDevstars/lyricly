//! Win32 plumbing for the ambient overlay: layered click-through, always-on-top
//! pinning, the WorkerW wallpaper layer, exclusive-fullscreen detection and idle
//! time. Declared directly against user32/gdi32/dwmapi to stay independent of
//! the `windows` crate's wrapper types.

#![cfg(windows)]

use core::ffi::c_void;

type Hwnd = isize;

const GWL_STYLE: i32 = -16;
const GWL_EXSTYLE: i32 = -20;

const WS_POPUP: u32 = 0x8000_0000;
const WS_CAPTION: u32 = 0x00c0_0000;
const WS_EX_LAYERED: u32 = 0x0008_0000;
const WS_EX_TRANSPARENT: u32 = 0x0000_0020;
const WS_EX_TOOLWINDOW: u32 = 0x0000_0080;
const WS_EX_NOACTIVATE: u32 = 0x0800_0000;

const HWND_TOPMOST: Hwnd = -1;
const SWP_NOSIZE: u32 = 0x0001;
const SWP_NOMOVE: u32 = 0x0002;
const SWP_NOACTIVATE: u32 = 0x0010;
const SW_SHOWNOACTIVATE: i32 = 4;
const SW_HIDE: i32 = 0;
const MONITOR_DEFAULTTONEAREST: u32 = 2;
const DWMWA_EXTENDED_FRAME_BOUNDS: u32 = 9;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct MonitorInfo {
    cb_size: u32,
    rc_monitor: Rect,
    rc_work: Rect,
    dw_flags: u32,
}

#[repr(C)]
struct LastInputInfo {
    cb_size: u32,
    dw_time: u32,
}

#[link(name = "user32")]
extern "system" {
    fn GetWindowLongW(hwnd: Hwnd, index: i32) -> i32;
    fn SetWindowLongW(hwnd: Hwnd, index: i32, value: i32) -> i32;
    fn SetWindowPos(
        hwnd: Hwnd,
        insert_after: Hwnd,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        flags: u32,
    ) -> i32;
    fn ShowWindow(hwnd: Hwnd, command: i32) -> i32;
    fn FindWindowW(class: *const u16, name: *const u16) -> Hwnd;
    fn FindWindowExW(parent: Hwnd, child_after: Hwnd, class: *const u16, name: *const u16) -> Hwnd;
    fn EnumWindows(callback: extern "system" fn(Hwnd, isize) -> i32, lparam: isize) -> i32;
    fn SendMessageTimeoutW(
        hwnd: Hwnd,
        msg: u32,
        wparam: usize,
        lparam: isize,
        flags: u32,
        timeout_ms: u32,
        result: *mut usize,
    ) -> isize;
    fn SetParent(child: Hwnd, parent: Hwnd) -> Hwnd;
    fn GetForegroundWindow() -> Hwnd;
    fn GetWindowRect(hwnd: Hwnd, rect: *mut Rect) -> i32;
    fn GetWindowThreadProcessId(hwnd: Hwnd, process_id: *mut u32) -> u32;
    fn MonitorFromWindow(hwnd: Hwnd, flags: u32) -> isize;
    fn GetLastInputInfo(info: *mut LastInputInfo) -> i32;
}

#[link(name = "gdi32")]
extern "system" {
    fn GetMonitorInfoW(monitor: isize, info: *mut MonitorInfo) -> i32;
}

#[link(name = "dwmapi")]
extern "system" {
    fn DwmGetWindowAttribute(hwnd: Hwnd, attribute: u32, value: *mut c_void, size: u32) -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn GetTickCount() -> u32;
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Makes the window invisible to the mouse and keeps it out of Alt+Tab.
pub fn make_click_through(hwnd: Hwnd) {
    unsafe {
        let style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        let applied = style | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        SetWindowLongW(hwnd, GWL_EXSTYLE, applied as i32);
    }
}

pub fn set_click_through(hwnd: Hwnd, enabled: bool) {
    unsafe {
        let style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        let applied = if enabled {
            style | WS_EX_LAYERED | WS_EX_TRANSPARENT
        } else {
            style & !WS_EX_TRANSPARENT
        };
        SetWindowLongW(hwnd, GWL_EXSTYLE, applied as i32);
    }
}

/// Pins the window above normal and borderless-fullscreen windows without
/// taking focus.
pub fn pin_topmost(hwnd: Hwnd) {
    unsafe {
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

pub fn show_without_focus(hwnd: Hwnd) {
    unsafe {
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

pub fn hide(hwnd: Hwnd) {
    unsafe {
        ShowWindow(hwnd, SW_HIDE);
    }
}

extern "system" fn find_worker(hwnd: Hwnd, lparam: isize) -> i32 {
    unsafe {
        let target = lparam as *mut Hwnd;
        let def_view = wide("SHELLDLL_DefView");
        let worker_class = wide("WorkerW");

        let view = FindWindowExW(hwnd, 0, def_view.as_ptr(), core::ptr::null());
        if view != 0 {
            let worker = FindWindowExW(0, hwnd, worker_class.as_ptr(), core::ptr::null());
            if worker != 0 {
                *target = worker;
                return 0;
            }
        }
        1
    }
}

/// Parents the window to the WorkerW layer that sits behind the desktop icons,
/// so lyrics render as wallpaper rather than floating above everything.
pub fn attach_to_wallpaper(hwnd: Hwnd) -> bool {
    unsafe {
        let progman_class = wide("Progman");
        let program = FindWindowW(progman_class.as_ptr(), core::ptr::null());

        if program != 0 {
            let mut result = 0usize;
            SendMessageTimeoutW(program, 0x052c, 0, 0, 0, 1_000, &mut result);
        }

        let mut worker: Hwnd = 0;
        EnumWindows(find_worker, &mut worker as *mut Hwnd as isize);

        if worker == 0 {
            return false;
        }
        SetParent(hwnd, worker);
        true
    }
}

pub fn detach_from_wallpaper(hwnd: Hwnd) {
    unsafe {
        SetParent(hwnd, 0);
    }
}

fn monitor_rect(hwnd: Hwnd) -> Option<Rect> {
    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor == 0 {
            return None;
        }
        let mut info = MonitorInfo {
            cb_size: std::mem::size_of::<MonitorInfo>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(monitor, &mut info) != 0 {
            Some(info.rc_monitor)
        } else {
            None
        }
    }
}

/// True when an application other than ours owns the screen with a borderless,
/// caption-less, monitor-sized window.
fn foreground_is_fullscreen(window: Hwnd) -> bool {
    unsafe {
        let mut rect = Rect::default();
        if GetWindowRect(window, &mut rect) == 0 {
            return false;
        }
        let Some(monitor) = monitor_rect(window) else {
            return false;
        };

        let covers = rect.left <= monitor.left
            && rect.top <= monitor.top
            && rect.right >= monitor.right
            && rect.bottom >= monitor.bottom;

        let style = GetWindowLongW(window, GWL_STYLE) as u32;
        let borderless = style & WS_POPUP != 0 && style & WS_CAPTION == 0;

        covers && borderless
    }
}

/// A window the compositor cannot report frame bounds for is very likely an
/// exclusive-fullscreen swapchain rather than a borderless window, so the
/// ambient layer steps aside instead of fighting it.
fn exclusive_swapchain(window: Hwnd) -> bool {
    unsafe {
        let style = GetWindowLongW(window, GWL_EXSTYLE) as u32;
        if style & WS_EX_LAYERED != 0 {
            return false;
        }
        let mut bounds = Rect::default();
        let result = DwmGetWindowAttribute(
            window,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut bounds as *mut Rect as *mut c_void,
            std::mem::size_of::<Rect>() as u32,
        );
        result != 0
    }
}

/// Whether an exclusive-fullscreen app currently owns the display.
pub fn exclusive_fullscreen_active() -> bool {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground == 0 {
            return false;
        }

        let mut process_id = 0u32;
        GetWindowThreadProcessId(foreground, &mut process_id);
        if process_id == std::process::id() {
            return false;
        }

        foreground_is_fullscreen(foreground) && exclusive_swapchain(foreground)
    }
}

/// Seconds since the last keyboard or mouse input.
pub fn idle_seconds() -> u64 {
    unsafe {
        let mut info = LastInputInfo {
            cb_size: std::mem::size_of::<LastInputInfo>() as u32,
            dw_time: 0,
        };
        if GetLastInputInfo(&mut info) == 0 {
            return 0;
        }
        let now = GetTickCount();
        ((now.wrapping_sub(info.dw_time)) / 1000) as u64
    }
}
