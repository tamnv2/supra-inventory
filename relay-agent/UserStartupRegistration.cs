using System;
using System.Diagnostics;
using System.Reflection;
using Microsoft.Win32;

namespace SupraInventoryRelayAgent
{
    internal static class UserStartupRegistration
    {
        private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string ValueName = "SUPRA Inventory Relay Agent";
        private const string PreferencesKey = @"Software\SupraInventory\RelayAgent";
        private const string EnabledValue = "AutoStartEnabled";

        internal static bool IsEnabled()
        {
            try
            {
                using(var key=Registry.CurrentUser.OpenSubKey(PreferencesKey,false))
                    return key==null || Convert.ToInt32(key.GetValue(EnabledValue,1))!=0;
            }
            catch { return true; } // Legacy behavior until an explicit per-user choice.
        }

        internal static bool SetEnabled(bool enabled)
        {
            try
            {
                using(var key=Registry.CurrentUser.CreateSubKey(PreferencesKey,true))
                {
                    if(key==null) return false;
                    key.SetValue(EnabledValue,enabled?1:0,RegistryValueKind.DWord);
                }
                EnsureRegistered();
                return true;
            }
            catch(Exception ex)
            {
                AgentDiagnostics.Write("AUTOSTART preference=FAIL type="+ex.GetType().Name);
                return false;
            }
        }

        internal static void EnsureRegistered()
        {
            try
            {
                if(!IsEnabled())
                {
                    using(var existing=Registry.CurrentUser.OpenSubKey(RunKey,true))
                        if(existing!=null) existing.DeleteValue(ValueName,false);
                    AgentDiagnostics.Write("AUTOSTART registration=DISABLED scope=HKCU");
                    return;
                }
                var exe = Assembly.GetExecutingAssembly().Location;
                if (string.IsNullOrWhiteSpace(exe))
                    exe = Process.GetCurrentProcess().MainModule == null ? "" : Process.GetCurrentProcess().MainModule.FileName;
                if (string.IsNullOrWhiteSpace(exe))
                    throw new InvalidOperationException("Không xác định được đường dẫn Agent.");

                var command = "\"" + exe.Replace("\"", "") + "\" --autostart";
                using (var key = Registry.CurrentUser.CreateSubKey(RunKey, true))
                {
                    if (key == null)
                        throw new InvalidOperationException("Không mở được HKCU Run.");
                    var current = Convert.ToString(key.GetValue(ValueName, "")) ?? "";
                    if (!string.Equals(current, command, StringComparison.Ordinal))
                        key.SetValue(ValueName, command, RegistryValueKind.String);
                }
                AgentDiagnostics.Write("AUTOSTART registration=PASS scope=HKCU admin_required=false");
            }
            catch (Exception ex)
            {
                AgentDiagnostics.Write(
                    "AUTOSTART registration=FAIL type=" + ex.GetType().Name +
                    " message=" + AgentDiagnostics.Sanitize(ex.Message));
            }
        }
    }
}
