using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal static class AgentBrowserBundle
    {
        internal sealed class Status
        {
            internal bool Ready;
            internal bool Downloading;
            internal int Percent;
            internal string Version = "";
            internal string Detail = "";
        }

        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static readonly object StateLock = new object();
        private const int RequiredHostBuild = 8;
        private const string RequiredHostArch = "x64";
        private static int _backgroundRunning;
        private static int _cleanupScheduled;
        private static bool _downloading;
        private static int _percent;
        private static string _version = "";
        private static string _detail = "Chưa tải trình duyệt Agent.";

        private static string Root
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SUPRA Inventory", "ConfirmBrowser", "OwnedWebView2");
            }
        }

        internal static string BrowserDataRoot
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SUPRA Inventory", "ConfirmBrowser");
            }
        }

        internal static void CleanupObsoleteBackground(Action<string> log)
        {
            if (Interlocked.CompareExchange(ref _cleanupScheduled, 1, 0) != 0) return;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    var active = ReadActiveFolder();
                    CleanupInactiveBundles(active, log);
                }
                catch (Exception ex)
                {
                    if (log != null)
                        log("SUPRA_BROWSER cleanup=FAIL type=" + ex.GetType().Name +
                            " detail=" + AgentDiagnostics.Sanitize(ex.Message));
                }
            });
        }

        internal static void EnsureBackground(Action<string> log)
        {
            if (Interlocked.CompareExchange(ref _backgroundRunning, 1, 0) != 0) return;
            SetState(true, 0, _version, "Đang kiểm tra gói trình duyệt Agent...");
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    EnsureInstalled(log);
                    var snapshot = SnapshotStatus();
                    SetState(false, 100, snapshot.Version, "Trình duyệt Agent khả dụng.");
                }
                catch (Exception ex)
                {
                    SetState(false, 0, _version, "Tải trình duyệt thất bại: " + AgentDiagnostics.Sanitize(ex.Message));
                    if (log != null) log("SUPRA_BROWSER owned_bundle=FAILED detail=" + AgentDiagnostics.Sanitize(ex.Message) + " auto_fallback=false");
                }
                finally { Interlocked.Exchange(ref _backgroundRunning, 0); }
            });
        }

        internal static Status SnapshotStatus()
        {
            string host;
            string runtime;
            var ready = TryGetReady(out host, out runtime);
            lock (StateLock)
            {
                var version = _version;
                if (ready && string.IsNullOrWhiteSpace(version))
                {
                    try
                    {
                        var active = Path.Combine(Root, "active.txt");
                        var folder = File.Exists(active) ? File.ReadAllText(active).Trim() : "";
                        var match = Regex.Match(folder, @"^wv2-(?<version>[0-9]+(?:\.[0-9]+){3})-");
                        if (match.Success) version = match.Groups["version"].Value;
                    }
                    catch { }
                }
                var effectiveReady = ready && !_downloading;
                return new Status
                {
                    Ready = effectiveReady,
                    Downloading = _downloading,
                    Percent = effectiveReady ? 100 : Math.Max(0, Math.Min(100, _percent)),
                    Version = version ?? "",
                    Detail = effectiveReady ? "Trình duyệt Agent khả dụng." : (_detail ?? "")
                };
            }
        }

        private static void SetState(bool downloading, int percent, string version, string detail)
        {
            lock (StateLock)
            {
                _downloading = downloading;
                _percent = Math.Max(0, Math.Min(100, percent));
                if (!string.IsNullOrWhiteSpace(version)) _version = version;
                _detail = detail ?? "";
            }
        }

        internal static bool TryGetReady(out string hostExe, out string runtimeFolder)
        {
            hostExe = "";
            runtimeFolder = "";
            try
            {
                var active = Path.Combine(Root, "active.txt");
                if (!File.Exists(active)) return false;
                var folder = File.ReadAllText(active).Trim();
                if (!Regex.IsMatch(folder, "^[0-9A-Za-z._-]{1,96}$")) return false;
                var dir = Path.Combine(Root, folder);
                var host = Path.Combine(dir, "host", "SUPRA.Inventory.WebView2Host.exe");
                var runtime = Path.Combine(dir, "runtime");
                var hostBuildMarker = Path.Combine(dir, "host-build.txt");
                var hostArchMarker = Path.Combine(dir, "host-arch.txt");
                if (!File.Exists(host) || !File.Exists(Path.Combine(runtime, "msedgewebview2.exe"))) return false;
                if (!File.Exists(hostBuildMarker) ||
                    !string.Equals(File.ReadAllText(hostBuildMarker).Trim(), RequiredHostBuild.ToString(), StringComparison.Ordinal))
                    return false;
                if (!File.Exists(hostArchMarker) ||
                    !string.Equals(File.ReadAllText(hostArchMarker).Trim(), RequiredHostArch, StringComparison.OrdinalIgnoreCase))
                    return false;
                hostExe = host;
                runtimeFolder = runtime;
                return true;
            }
            catch { return false; }
        }

        private static void EnsureInstalled(Action<string> log)
        {
            var raw = RequestText(AgentConfig.AgentBrowserBundleManifestUrl, true);
            var manifest = Json.DeserializeObject(raw) as Dictionary<string, object>;
            if (manifest == null) throw new InvalidOperationException("Browser bundle manifest không hợp lệ.");

            var version = Value(manifest, "version");
            var sha = Value(manifest, "sha256").ToLowerInvariant();
            int hostBuild;
            if (!int.TryParse(Value(manifest, "host_build"), out hostBuild))
                throw new InvalidOperationException("Browser bundle thiếu host_build.");
            var hostArch = Value(manifest, "host_arch");
            if (hostBuild < RequiredHostBuild)
                throw new InvalidOperationException("Browser bundle host quá cũ. Cần host build " + RequiredHostBuild + ".");
            if (!string.Equals(hostArch, RequiredHostArch, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Browser bundle host không đúng kiến trúc x64.");
            SetState(true, 0, version, "Đang chuẩn bị tải WebView2 Fixed " + version + " · host " + hostBuild + " " + hostArch + "...");
            if (!Regex.IsMatch(version, @"^[0-9]+(?:\.[0-9]+){3}$"))
                throw new InvalidOperationException("Browser bundle version không hợp lệ.");
            if (!Regex.IsMatch(sha, "^[0-9a-f]{64}$"))
                throw new InvalidOperationException("Browser bundle checksum không hợp lệ.");

            string currentHost, currentRuntime;
            if (TryGetReady(out currentHost, out currentRuntime))
            {
                var marker = Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(currentHost)), "bundle.sha256");
                if (File.Exists(marker) && string.Equals(File.ReadAllText(marker).Trim(), sha, StringComparison.OrdinalIgnoreCase))
                {
                    var activeFolder = Path.GetFileName(Path.GetDirectoryName(Path.GetDirectoryName(currentHost)));
                    CleanupInactiveBundles(activeFolder, log);
                    SetState(false, 100, version, "Trình duyệt Agent khả dụng.");
                    return;
                }
            }

            Directory.CreateDirectory(Root);
            var versionFolder = "wv2-" + version + "-h" + hostBuild + "-" + sha.Substring(0, 12);
            var target = Path.Combine(Root, versionFolder);
            if (!Directory.Exists(target))
            {
                var tempZip = Path.Combine(Root, versionFolder + ".zip.download");
                var tempExtract = Path.Combine(Root, versionFolder + ".extract");
                TryDelete(tempZip);
                TryDeleteDirectory(tempExtract);

                DownloadFile(AgentConfig.AgentBrowserBundleUrl, tempZip, (downloaded, total) =>
                {
                    var percent = total > 0 ? (int)Math.Min(99L, downloaded * 100L / total) : 0;
                    SetState(true, percent, version,
                        total > 0
                            ? "Đang tải trình duyệt Agent · " + percent + "%"
                            : "Đang tải trình duyệt Agent...");
                });
                var actual = Sha256(tempZip);
                if (!string.Equals(actual, sha, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Browser bundle SHA-256 không khớp.");

                Directory.CreateDirectory(tempExtract);
                ZipFile.ExtractToDirectory(tempZip, tempExtract);
                TryDelete(tempZip);

                var host = Path.Combine(tempExtract, "host", "SUPRA.Inventory.WebView2Host.exe");
                var loader = Path.Combine(tempExtract, "host", "loader", "x64", "WebView2Loader.dll");
                var runtime = Path.Combine(tempExtract, "runtime", "msedgewebview2.exe");
                if (!File.Exists(host) || !File.Exists(loader) || !File.Exists(runtime))
                    throw new InvalidOperationException("Browser bundle thiếu host, WebView2Loader x64 hoặc Fixed Runtime.");

                File.WriteAllText(Path.Combine(tempExtract, "bundle.sha256"), sha);
                File.WriteAllText(Path.Combine(tempExtract, "host-build.txt"), hostBuild.ToString());
                File.WriteAllText(Path.Combine(tempExtract, "host-arch.txt"), hostArch);
                if (Directory.Exists(target)) TryDeleteDirectory(target);
                Directory.Move(tempExtract, target);
            }

            File.WriteAllText(Path.Combine(Root, "active.txt"), versionFolder);
            CleanupInactiveBundles(versionFolder, log);
            SetState(false, 100, version, "Trình duyệt Agent khả dụng.");
            if (log != null) log("SUPRA_BROWSER owned_bundle=READY version=" + version);
        }

        private static string ReadActiveFolder()
        {
            try
            {
                var active = Path.Combine(Root, "active.txt");
                if (!File.Exists(active)) return "";
                var folder = File.ReadAllText(active).Trim();
                return Regex.IsMatch(folder, "^[0-9A-Za-z._-]{1,96}$") ? folder : "";
            }
            catch { return ""; }
        }

        private static void CleanupInactiveBundles(string activeFolder, Action<string> log)
        {
            if (!Directory.Exists(Root)) return;
            var deleted = 0;
            long reclaimed = 0;

            foreach (var dir in Directory.GetDirectories(Root))
            {
                var name = Path.GetFileName(dir);
                if (string.Equals(name, activeFolder, StringComparison.OrdinalIgnoreCase)) continue;
                if (!name.StartsWith("wv2-", StringComparison.OrdinalIgnoreCase)) continue;

                var bytes = DirectorySizeBestEffort(dir);
                try
                {
                    Directory.Delete(dir, true);
                    deleted++;
                    reclaimed += bytes;
                }
                catch (Exception ex)
                {
                    if (log != null)
                        log("SUPRA_BROWSER cleanup=SKIP folder=" + AgentDiagnostics.Sanitize(name) +
                            " type=" + ex.GetType().Name);
                }
            }

            foreach (var file in Directory.GetFiles(Root, "*.zip.download"))
            {
                try
                {
                    reclaimed += new FileInfo(file).Length;
                    File.Delete(file);
                    deleted++;
                }
                catch { }
            }

            foreach (var dir in Directory.GetDirectories(Root, "*.extract"))
            {
                var bytes = DirectorySizeBestEffort(dir);
                try
                {
                    Directory.Delete(dir, true);
                    deleted++;
                    reclaimed += bytes;
                }
                catch { }
            }

            if (log != null && deleted > 0)
                log("SUPRA_BROWSER cleanup=PASS removed=" + deleted +
                    " reclaimed_bytes=" + reclaimed +
                    " active=" + AgentDiagnostics.Sanitize(activeFolder));
        }

        private static long DirectorySizeBestEffort(string root)
        {
            long total = 0;
            try
            {
                foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
                {
                    try { total += new FileInfo(file).Length; } catch { }
                }
            }
            catch { }
            return total;
        }

        private static string RequestText(string url, bool manifest)
        {
            using (var response = OpenTrusted(url, manifest))
            using (var reader = new StreamReader(response.GetResponseStream()))
                return reader.ReadToEnd();
        }

        private static void DownloadFile(string url, string target, Action<long, long> progress)
        {
            using (var response = OpenTrusted(url, false))
            using (var input = response.GetResponseStream())
            using (var output = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                var buffer = new byte[1024 * 1024];
                var total = response.ContentLength;
                long downloaded = 0;
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    output.Write(buffer, 0, read);
                    downloaded += read;
                    if (progress != null) progress(downloaded, total);
                }
            }
        }

        private static HttpWebResponse OpenTrusted(string url, bool manifest)
        {
            var current = new Uri(url);
            for (var redirect = 0; redirect < 6; redirect++)
            {
                Validate(current, manifest, redirect > 0);
                var request = (HttpWebRequest)WebRequest.Create(current);
                request.Method = "GET";
                request.AllowAutoRedirect = false;
                request.Timeout = 15000;
                request.ReadWriteTimeout = 180000;
                request.UserAgent = "SUPRA-Inventory-Relay-Agent/v" + AgentConfig.AgentBuild;
                HttpWebResponse response;
                try { response = (HttpWebResponse)request.GetResponse(); }
                catch (WebException ex)
                {
                    var failed = ex.Response as HttpWebResponse;
                    if (failed != null)
                    {
                        var status = (int)failed.StatusCode;
                        failed.Dispose();
                        throw new InvalidOperationException("Browser bundle HTTP " + status + ".");
                    }
                    throw;
                }

                var statusCode = (int)response.StatusCode;
                if (statusCode == 301 || statusCode == 302 || statusCode == 303 || statusCode == 307 || statusCode == 308)
                {
                    var location = response.Headers["Location"];
                    response.Dispose();
                    if (string.IsNullOrWhiteSpace(location)) throw new InvalidOperationException("Browser bundle redirect thiếu Location.");
                    current = new Uri(current, location);
                    continue;
                }
                if (statusCode < 200 || statusCode > 299)
                {
                    response.Dispose();
                    throw new InvalidOperationException("Browser bundle HTTP " + statusCode + ".");
                }
                return response;
            }
            throw new InvalidOperationException("Browser bundle redirect vượt giới hạn.");
        }

        private static void Validate(Uri uri, bool manifest, bool redirected)
        {
            if (!string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Browser bundle chỉ cho phép HTTPS.");
            if (!redirected)
            {
                var expected = manifest ? "/downloads/agent/browser/manifest" : "/downloads/agent/browser/latest";
                if (!string.Equals(uri.Host, "inventory-beta.supra.cc.cd", StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(uri.AbsolutePath, expected, StringComparison.Ordinal))
                    throw new InvalidOperationException("Browser bundle không thuộc dịch vụ tin cậy.");
                return;
            }
            if (string.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase))
            {
                const string prefix = "/tamnv2/supra-inventory/releases/download/inventory-channel/";
                if (!uri.AbsolutePath.StartsWith(prefix, StringComparison.Ordinal))
                    throw new InvalidOperationException("Browser bundle GitHub path không hợp lệ.");
                return;
            }
            var host = uri.Host.ToLowerInvariant();
            if (host != "release-assets.githubusercontent.com" &&
                host != "objects.githubusercontent.com" &&
                !host.EndsWith(".githubusercontent.com", StringComparison.Ordinal))
                throw new InvalidOperationException("Browser bundle redirect không thuộc CDN tin cậy.");
        }

        private static string Value(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static string Sha256(string path)
        {
            using (var sha = SHA256.Create())
            using (var stream = File.OpenRead(path))
            {
                var hash = sha.ComputeHash(stream);
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }

        private static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch { }
        }

        private static void TryDeleteDirectory(string path)
        {
            try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
        }
    }
}
