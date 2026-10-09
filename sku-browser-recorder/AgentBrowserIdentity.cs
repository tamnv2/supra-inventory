using System;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.Text.RegularExpressions;

namespace SupraSkuRecorder
{
    internal sealed class AgentBrowserIdentity
    {
        internal string Runtime;
        internal string Profile;
        internal int DebugPort;
        internal int HostPid;

        internal static AgentBrowserIdentity Find()
        {
            var candidates = new List<AgentBrowserIdentity>();
            using (var searcher = new ManagementObjectSearcher(
                "SELECT ProcessId,CommandLine FROM Win32_Process WHERE Name='SUPRA.Inventory.WebView2Host.exe'"))
            using (var processes = searcher.Get())
            foreach (ManagementObject process in processes)
            {
                var command = Convert.ToString(process["CommandLine"]) ?? "";
                var profile = ReadArgument(command, "profile");
                var runtime = ReadArgument(command, "runtime");
                int port, pid;
                if (!int.TryParse(ReadArgument(command, "debug-port"), out port) ||
                    !int.TryParse(Convert.ToString(process["ProcessId"]), out pid) ||
                    port < 1 || port > 65535)
                    continue;
                if (!string.Equals(Path.GetFileName(profile.TrimEnd('\\', '/')),
                    "webview2-fixed-profile", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!Directory.Exists(profile) ||
                    !File.Exists(Path.Combine(runtime, "msedgewebview2.exe")))
                    continue;
                candidates.Add(new AgentBrowserIdentity
                {
                    Runtime = runtime, Profile = profile, DebugPort = port, HostPid = pid
                });
            }
            if (candidates.Count != 1)
                throw new InvalidOperationException(candidates.Count == 0
                    ? "Cần mở trình duyệt WebView2 của Agent trước."
                    : "Nhiều tiến trình WebView2 Agent; không chọn phiên ngẫu nhiên.");
            return candidates[0];
        }

        private static string ReadArgument(string command, string name)
        {
            var match = Regex.Match(command,
                @"(?:^|\s)--" + Regex.Escape(name) + @"=(?:""(?<q>[^""]*)""|(?<u>[^\s]+))");
            return !match.Success ? "" :
                (match.Groups["q"].Success ? match.Groups["q"].Value : match.Groups["u"].Value);
        }
    }
}
