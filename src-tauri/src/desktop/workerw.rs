//! Win32 plumbing for the desktop scene: the WorkerW layer Explorer keeps behind
//! the icons, plus child-window placement inside it. Declared directly against
//! user32 so the scene does not depend on the ambient overlay's wrappers.

#![cfg(windows)]

type Hwnd = isize;

const GWL_STYLE: i32 = -16;
const GWL_EXSTYLE: i32 = -20;

const WS_CHILD: u32 = 0x4000_0000;
const WS_POPUP: u32 = 0x8000_0000;
const WS_EX_APPWINDOW: u32 = 0x0004_0000;
const WS_EX_TOOLWINDOW: u32 = 0x0000_0080;
const WS_EX_NOACTIVATE: u32 = 0x0800_0000;

const HWND_TOP: Hwnd = 0;
const HWND_BOTTOM: Hwnd = 1;
const SWP_NOACTIVATE: u32 = 0x0010;
const SWP_SHOWWINDOW: u32 = 0x0040;
const SW_SHOWNOACTIVATE: i32 = 4;

#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
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
    fn GetParent(hwnd: Hwnd) -> Hwnd;
    fn GetWindowRect(hwnd: Hwnd, rect: *mut Rect) -> i32;
    fn GetClassNameW(hwnd: Hwnd, buffer: *mut u16, max: i32) -> i32;
    fn IsWindow(hwnd: Hwnd) -> i32;
    fn SetLastError(code: u32);
    fn GetLastError() -> u32;
    fn EnumChildWindows(
        parent: Hwnd,
        callback: extern "system" fn(Hwnd, isize) -> i32,
        lparam: isize,
    ) -> i32;
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Asks Progman to spawn the wallpaper `WorkerW`. A freshly restarted Explorer
/// has none, and the message that creates it is version-specific: 0x052C with
/// wParam 0xD is what Windows 10 1803 and 11 look for, while older builds took
/// wParam 0. Both are sent, and the caller re-scans afterwards.
fn spawn_worker() -> Hwnd {
    let program = unsafe { FindWindowW(wide("Progman").as_ptr(), core::ptr::null()) };
    if program == 0 {
        return 0;
    }
    for wparam in [0x0dusize, 0] {
        for lparam in [0isize, 1] {
            let mut result = 0usize;
            unsafe {
                SendMessageTimeoutW(program, 0x052c, wparam, lparam, 0, 1_000, &mut result);
            }
        }
    }
    program
}

extern "system" fn find_worker(hwnd: Hwnd, lparam: isize) -> i32 {
    unsafe {
        let target = lparam as *mut Hwnd;
        let def_view = wide("SHELLDLL_DefView");
        let worker_class = wide("WorkerW");

        // Explorer's icon host lives inside one WorkerW; the wallpaper layer is
        // the WorkerW that follows it in z-order.
        if FindWindowExW(hwnd, 0, def_view.as_ptr(), core::ptr::null()) != 0 {
            let worker = FindWindowExW(0, hwnd, worker_class.as_ptr(), core::ptr::null());
            if worker != 0 {
                *target = worker;
                return 0;
            }
        }
        1
    }
}

/// The wallpaper layer behind the icons.
///
/// Windows 11 keeps `SHELLDLL_DefView` and a `WorkerW` as siblings inside
/// `Progman`, with the WorkerW at the bottom of that z-order and spanning the
/// whole virtual desktop — so it is the parent a scene wants. Windows 10 instead
/// spawns a second top-level `WorkerW` behind the icon host; that is the fallback.
pub fn worker_layer() -> Option<Hwnd> {
    let program = spawn_worker();

    if program != 0 {
        let mut search = ChildSearch { hwnd: 0, area: 0 };
        unsafe {
            EnumChildWindows(
                program,
                find_child_worker,
                &mut search as *mut ChildSearch as isize,
            );
        }
        if search.hwnd != 0 {
            return Some(search.hwnd);
        }
    }

    let mut worker: Hwnd = 0;
    unsafe {
        EnumWindows(find_worker, &mut worker as *mut Hwnd as isize);
    }
    if worker != 0 {
        return Some(worker);
    }

    // Nothing found: Progman still owns the wallpaper, and a child placed low
    // enough in its z-order renders behind the icons.
    (program != 0).then_some(program)
}

struct ChildSearch {
    hwnd: Hwnd,
    area: i64,
}

extern "system" fn find_child_worker(hwnd: Hwnd, lparam: isize) -> i32 {
    unsafe {
        let search = &mut *(lparam as *mut ChildSearch);
        let mut buffer = [0u16; 64];
        let len = GetClassNameW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        if len <= 0 || String::from_utf16_lossy(&buffer[..len as usize]) != "WorkerW" {
            return 1;
        }

        let mut rect = Rect::default();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return 1;
        }
        let area = (rect.right - rect.left) as i64 * (rect.bottom - rect.top) as i64;
        if area > search.area {
            search.area = area;
            search.hwnd = hwnd;
        }
        1
    }
}

/// What happened when the scene was put into the desktop layer.
pub struct Attach {
    pub parent: Hwnd,
    pub class: String,
    pub win32_error: u32,
}

/// Re-parents a shown, decorated=false window into the wallpaper layer and makes
/// it a real child, so it clips, scales and hides with the desktop instead of
/// floating above every app.
pub fn attach(hwnd: Hwnd) -> Attach {
    let Some(worker) = worker_layer() else {
        return Attach {
            parent: 0,
            class: String::new(),
            win32_error: 0,
        };
    };
    unsafe {
        SetLastError(0);
        SetParent(hwnd, worker);
        let win32_error = GetLastError();

        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        let style = (style & !WS_POPUP) | WS_CHILD;
        SetWindowLongW(hwnd, GWL_STYLE, style as i32);

        let ex = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        let ex = (ex & !WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        SetWindowLongW(hwnd, GWL_EXSTYLE, ex as i32);

        Attach {
            parent: GetParent(hwnd),
            class: class_of(worker),
            win32_error,
        }
    }
}

impl Attach {
    pub fn ok(&self) -> bool {
        self.parent != 0
    }
}

/// Screen rect of the wallpaper layer; child coordinates are relative to it.
pub fn parent_rect(hwnd: Hwnd) -> Option<Rect> {
    unsafe {
        let parent = GetParent(hwnd);
        if parent == 0 {
            return None;
        }
        let mut rect = Rect::default();
        if GetWindowRect(parent, &mut rect) == 0 {
            None
        } else {
            Some(rect)
        }
    }
}

/// Places the scene over a monitor. Coordinates arrive in virtual-screen pixels;
/// a child window wants them relative to its parent.
///
/// Inside a `WorkerW` the whole subtree already renders behind the icons, so the
/// window can go on top of its siblings. When the fallback parent is `Progman`
/// itself, the icons are a *sibling*, so the scene has to be pushed to the
/// bottom of that z-order instead.
pub fn place(hwnd: Hwnd, x: i32, y: i32, width: i32, height: i32) -> bool {
    let Some(parent) = parent_rect(hwnd) else {
        return false;
    };
    let insert_after = if unsafe { class_of(GetParent(hwnd)) } == "Progman" {
        HWND_BOTTOM
    } else {
        HWND_TOP
    };
    let placed = unsafe {
        SetWindowPos(
            hwnd,
            insert_after,
            x - parent.left,
            y - parent.top,
            width,
            height,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
    };
    placed != 0
}

pub fn show(hwnd: Hwnd) {
    unsafe {
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

fn class_of(hwnd: Hwnd) -> String {
    let mut buffer = [0u16; 64];
    let len = unsafe { GetClassNameW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32) };
    if len <= 0 {
        String::new()
    } else {
        String::from_utf16_lossy(&buffer[..len as usize])
    }
}

/// True while the window is still a child of the desktop (`WorkerW`, or
/// `Progman` on the fallback path). An Explorer restart destroys that parent, so
/// this goes false and the scene re-attaches.
pub fn is_attached(hwnd: Hwnd) -> bool {
    unsafe {
        let parent = GetParent(hwnd);
        if parent == 0 || IsWindow(parent) == 0 {
            return false;
        }
        matches!(class_of(parent).as_str(), "WorkerW" | "Progman")
    }
}

/// A scene child dies with the shell that owns it: Explorer restarting destroys
/// the `WorkerW`, and Windows destroys its children with it. Such a window can
/// only be recreated, never re-attached.
pub fn is_alive(hwnd: Hwnd) -> bool {
    unsafe { IsWindow(hwnd) != 0 }
}

/// Class name of the window's parent, for logs and tests.
pub fn parent_class(hwnd: Hwnd) -> String {
    unsafe { class_of(GetParent(hwnd)) }
}
