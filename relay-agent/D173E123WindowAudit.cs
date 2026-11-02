using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace SupraInventoryRelayAgent
{
    // E119 evidence only. Never hide or modify native windows without PID/owner proof.
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
