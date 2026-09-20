using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace SupraInventoryRelayAgent
{
    internal static class AgentRuntimeGuard
    {
        private static readonly object Gate = new object();
        private static Process _watchdog;

        internal static void EnsureWatchdog()
        {
            lock (Gate)
            {
                try
                {
                    if (_watchdog != null && !_watchdog.HasExited) return;
                }
                catch { }

                try
                {
                    var process = Process.GetCurrentProcess();
                    var exe = process.MainModule == null ? "" : process.MainModule.FileName;
                    if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe)) return;

                    _watchdog = Process.Start(new ProcessStartInfo
                    {
                        FileName = exe,
                        Arguments = "--watchdog " + process.Id,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    });
                    AgentDiagnostics.Write("RUNTIME_GUARD watchdog=PASS parent_pid=" + process.Id);
                }
                catch (Exception ex)
                {
                    AgentDiagnostics.Write("RUNTIME_GUARD watchdog=FAIL type=" + ex.GetType().Name);
                }
            }
        }

        internal static int RunWatchdog(int parentPid)
        {
            try
            {
                var parent = Process.GetProcessById(parentPid);
                parent.WaitForExit();

                if (ConsumePlannedExit(parentPid)) return 0;

                Thread.Sleep(750);
                var current = Process.GetCurrentProcess();
                var exe = current.MainModule == null ? "" : current.MainModule.FileName;
                if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe)) return 2;

                Process.Start(new ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = "--autostart --watchdog-restart",
                    UseShellExecute = false,
                    CreateNoWindow = false
                });
                return 0;
            }
            catch
            {
                return 1;
            }
        }

        internal static void MarkPlannedExit()
        {
            try
            {
                var pid = Process.GetCurrentProcess().Id;
                var path = PlannedExitPath(pid);
                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(path, DateTime.UtcNow.ToString("o"));
            }
            catch { }
        }

        private static bool ConsumePlannedExit(int parentPid)
        {
            try
            {
                var path = PlannedExitPath(parentPid);
                if (!File.Exists(path)) return false;
                File.Delete(path);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string PlannedExitPath(int pid)
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SUPRA Inventory",
                "RelayPoc",
                "runtime",
                "planned-exit-" + pid + ".flag");
        }
    }
}
