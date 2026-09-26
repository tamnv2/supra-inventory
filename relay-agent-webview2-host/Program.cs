using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraInventoryWebView2Host
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try
            {
                var options = HostOptions.Parse(args);
                Application.Run(new BrowserForm(options));
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(Path.GetTempPath(), "supra-webview2-host.log"),
                        DateTime.UtcNow.ToString("o") + " " + ex.GetType().Name + " " + ex.Message + Environment.NewLine);
                }
                catch { }
                Environment.ExitCode = 2;
            }
        }
    }

    internal sealed class HostOptions
    {
        internal string Url = "";
        internal string Profile = "";
        internal string Runtime = "";
        internal int DebugPort;

        internal static HostOptions Parse(string[] args)
        {
            var value = new HostOptions();
            foreach (var arg in args ?? new string[0])
            {
                if (arg.StartsWith("--url=", StringComparison.Ordinal)) value.Url = arg.Substring(6);
                else if (arg.StartsWith("--profile=", StringComparison.Ordinal)) value.Profile = arg.Substring(10);
                else if (arg.StartsWith("--runtime=", StringComparison.Ordinal)) value.Runtime = arg.Substring(10);
                else if (arg.StartsWith("--debug-port=", StringComparison.Ordinal)) int.TryParse(arg.Substring(13), out value.DebugPort);
            }
            if (!Uri.TryCreate(value.Url, UriKind.Absolute, out var url) ||
                !string.Equals(url.Scheme, "https", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(url.Host, "wms-supra.winmart.vn", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Invalid Supra URL.");
            if (value.DebugPort <= 0 || value.DebugPort > 65535) throw new InvalidOperationException("Invalid debug port.");
            if (string.IsNullOrWhiteSpace(value.Profile)) throw new InvalidOperationException("Missing profile path.");
            if (string.IsNullOrWhiteSpace(value.Runtime) ||
                !File.Exists(Path.Combine(value.Runtime, "msedgewebview2.exe")))
                throw new InvalidOperationException("Fixed WebView2 Runtime is unavailable.");
            Directory.CreateDirectory(value.Profile);
            return value;
        }
    }

    internal sealed class BrowserForm : Form
    {
        private readonly HostOptions _options;
        private readonly WebView2 _web = new WebView2 { Dock = DockStyle.Fill };

        internal BrowserForm(HostOptions options)
        {
            _options = options;
            Text = "SUPRA Confirm PickList · Agent";
            Width = 1360;
            Height = 900;
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Add(_web);
            Shown += async (_, __) => await InitializeSafeAsync();
        }

        private async Task InitializeSafeAsync()
        {
            try
            {
                await InitializeAsync();
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(Path.GetTempPath(), "supra-webview2-host.log"),
                        DateTime.UtcNow.ToString("o") + " INIT_FAIL " + ex.GetType().Name + " " + ex.Message + Environment.NewLine);
                }
                catch { }
                Environment.ExitCode = 2;
                try { Close(); } catch { }
            }
        }

        private async Task InitializeAsync()
        {
            if (!Environment.Is64BitProcess)
                throw new BadImageFormatException("SUPRA WebView2 host phải chạy tiến trình x64.");

            var loaderFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "loader", "x64");
            var loaderPath = Path.Combine(loaderFolder, "WebView2Loader.dll");
            if (!File.Exists(loaderPath))
                throw new FileNotFoundException("Thiếu WebView2Loader.dll x64.", loaderPath);

            // D127 v54: bind the native loader explicitly. Relying on default probing can
            // load a loader of the wrong architecture on .NET Framework and throw 0x8007000B.
            CoreWebView2Environment.SetLoaderDllFolderPath(loaderFolder);

            GrantAppContainerReadBestEffort(_options.Runtime);
            var envOptions = new CoreWebView2EnvironmentOptions(
                "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + _options.DebugPort);
            var env = await CoreWebView2Environment.CreateAsync(_options.Runtime, _options.Profile, envOptions);
            await _web.EnsureCoreWebView2Async(env);
            _web.CoreWebView2.Settings.IsPasswordAutosaveEnabled = true;
            _web.CoreWebView2.Settings.IsGeneralAutofillEnabled = true;
            _web.Source = new Uri(_options.Url);
        }

        private static void GrantAppContainerReadBestEffort(string path)
        {
            foreach (var sid in new[] { "*S-1-15-2-2", "*S-1-15-2-1" })
            {
                try
                {
                    using (var process = Process.Start(new ProcessStartInfo
                    {
                        FileName = "icacls.exe",
                        Arguments = "\"" + path.Replace("\"", "") + "\" /grant " + sid + ":(OI)(CI)(RX)",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }))
                    {
                        process?.WaitForExit(5000);
                    }
                }
                catch { }
            }
        }
    }
}
