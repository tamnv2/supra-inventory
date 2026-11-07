using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace SupraInventoryRelayAgent
{
    // E119 own-PID evidence; E146 protects only known framework helper HWND styles.
    // Leave the helper message pumps alive: never call ShowWindow(SW_HIDE) on them.
    internal static class D173E123WindowAudit
    {
        private delegate bool EnumWindowsProc(IntPtr window, IntPtr state);
        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr param);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder output, int maxCount);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
        private const uint GW_OWNER = 4;
        private const long WS_EX_TOOLWINDOW = 0x80;
        private const long WS_EX_APPWINDOW = 0x40000;


        // WinEventHook is process-scoped, not a system-wide window enumeration timer.
        private delegate void WinEventCallback(IntPtr hook, uint eventType, IntPtr hwnd,
            int objectId, int childId, uint threadId, uint eventTime);
        [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint minEvent,
            uint maxEvent, IntPtr module, WinEventCallback callback, uint processId,
            uint threadId, uint flags);
        [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
        private static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr newStyle);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hwnd, StringBuilder output, int capacity);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(
            IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
        private const uint EVENT_OBJECT_CREATE = 0x8000;
        private const uint EVENT_OBJECT_SHOW = 0x8002;
        private const uint WINEVENT_OUTOFCONTEXT = 0;
        private const uint SWP_STYLE_REFRESH = 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0020;
        private static WinEventCallback _ownEventCallback;
        private static IntPtr _ownEventHook;
        private static uint _ownPid;
        private static Action<string> _safeLog;

        private static bool IsFrameworkHelper(string cls, string title)
        {
            // Never use arbitrary substring "GDI" or "WindowsForms" here: those
            // can also be genuine main forms and hosted WMS/WebView2 windows.
            return cls.IndexOf("BroadcastEventWindow", StringComparison.OrdinalIgnoreCase) >= 0
                || title.StartsWith(".NET-BroadcastEventWindow", StringComparison.OrdinalIgnoreCase)
                || cls.StartsWith("GDI+ ", StringComparison.OrdinalIgnoreCase)
                || string.Equals(title, "GDI+ Window", StringComparison.OrdinalIgnoreCase);
        }

        private static void SuppressOwnHelperFromShell(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return;
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            if (pid == 0 || pid != _ownPid) return;
            var clsText = new StringBuilder(128);
            var titleText = new StringBuilder(128);
            GetClassName(hwnd, clsText, clsText.Capacity);
            GetWindowText(hwnd, titleText, titleText.Capacity);
            var cls = clsText.ToString();
            var title = titleText.ToString();
            if (!IsFrameworkHelper(cls, title)) return;
            // WS_EX_TOOLWINDOW excludes these HWNDs from Taskbar/Alt+Tab.
            // Never hide/destroy/disable: broadcast and GDI+ messages must flow.
            long oldStyle = GetWindowLongPtr(hwnd, -20).ToInt64();
            long newStyle = (oldStyle | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
            if (newStyle == oldStyle) return;
            SetWindowLongPtr(hwnd, -20, new IntPtr(newStyle));
            SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_STYLE_REFRESH);
            var log = _safeLog;
            if (log != null) log("D173_E146_HELPER_SHELL own_pid=true type=" +
                (cls.IndexOf("Broadcast", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 title.StartsWith(".NET-Broadcast", StringComparison.OrdinalIgnoreCase)
                    ? "BROADCAST" : "GDI_PLUS") + " taskbar=false");
        }

        internal static void StartOwnedHelperVisibilityGuard(Action<string> safeLog)
        {
            if (_ownEventHook != IntPtr.Zero) return;
            _ownPid = (uint)Process.GetCurrentProcess().Id;
            _safeLog = safeLog;
            _ownEventCallback = (hook, eventType, hwnd, objectId, childId, threadId, eventTime) =>
            {
                if (objectId != 0 || childId != 0 || hwnd == IntPtr.Zero) return;
                try { SuppressOwnHelperFromShell(hwnd); }
                catch (Exception ex) {
                    if (_safeLog != null) _safeLog("D173_E146_HELPER_SHELL status=DEFER type=" + ex.GetType().Name);
                }
            };
            _ownEventHook = SetWinEventHook(EVENT_OBJECT_CREATE, EVENT_OBJECT_SHOW,
                IntPtr.Zero, _ownEventCallback, _ownPid, 0, WINEVENT_OUTOFCONTEXT);
            if (_ownEventHook == IntPtr.Zero)
            {
                if (_safeLog != null) _safeLog("D173_E146_HELPER_SHELL hook=UNAVAILABLE");
                return;
            }
            // Normalize already-created helper HWNDs without touching any other PID.
            EnumWindows((hwnd, state) => {
                try { SuppressOwnHelperFromShell(hwnd); }
                catch { /* One invalid handle must not interrupt the Agent. */ }
                return true;
            }, IntPtr.Zero);
        }

        internal static void StopOwnedHelperVisibilityGuard()
        {
            var hook = _ownEventHook;
            _ownEventHook = IntPtr.Zero;
            if (hook != IntPtr.Zero) UnhookWinEvent(hook);
            _ownEventCallback = null;
            _safeLog = null;
        }

        internal static void CaptureOwnedWindows(Action<string> safeLog)
        {
            if (safeLog == null) return;
            try
            {
                uint pid = (uint)Process.GetCurrentProcess().Id;
                var inspected = 0;
                EnumWindows((hwnd, context) =>
                {
                    uint windowPid;
                    GetWindowThreadProcessId(hwnd, out windowPid);
                    if (windowPid != pid || inspected++ >= 30) return true;
                    if (!IsWindowVisible(hwnd)) return true;
                    var name = new StringBuilder(128);
                    GetClassName(hwnd, name, name.Capacity);
                    var cls = name.ToString();
                    if (cls.IndexOf("Broadcast", StringComparison.OrdinalIgnoreCase) < 0 &&
                        cls.IndexOf("GDI", StringComparison.OrdinalIgnoreCase) < 0 &&
                        cls.IndexOf("WindowsForms", StringComparison.OrdinalIgnoreCase) < 0) return true;
                    var owner = GetWindow(hwnd, GW_OWNER);
                    var style = GetWindowLongPtr(hwnd, -20).ToInt64();
                    safeLog("D173_E123_WINDOW_AUDIT own_pid=true class=" +
                        AgentDiagnostics.Sanitize(cls) + " visible=true owner=" +
                        (owner == IntPtr.Zero ? "NONE" : "OWNED") +
                        " toolwindow=" + ((style & WS_EX_TOOLWINDOW) != 0 ? "true" : "false") +
                        " appwindow=" + ((style & WS_EX_APPWINDOW) != 0 ? "true" : "false"));
                    return true;
                }, IntPtr.Zero);
            }
            catch (Exception ex)
            {
                safeLog("D173_E123_WINDOW_AUDIT status=DEFER type=" + ex.GetType().Name);
            }
        }
    }
}
