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
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static int _backgroundRunning;

        private static string Root
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SUPRA Inventory", "ConfirmBrowser", "OwnedWebView2");
            }
        }

        internal static void EnsureBackground(Action<string> log)
        {
            if (Interlocked.CompareExchange(ref _backgroundRunning, 1, 0) != 0) return;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try { EnsureInstalled(log); }
                catch (Exception ex)
                {
                    if (log != null) log("SUPRA_BROWSER owned_bundle=FALLBACK detail=" + AgentDiagnostics.Sanitize(ex.Message));
                }
                finally { Interlocked.Exchange(ref _backgroundRunning, 0); }
            });
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
                if (!File.Exists(host) || !File.Exists(Path.Combine(runtime, "msedgewebview2.exe"))) return false;
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
            if (!Regex.IsMatch(version, @"^[0-9]+(?:\.[0-9]+){3}$"))
                throw new InvalidOperationException("Browser bundle version không hợp lệ.");
            if (!Regex.IsMatch(sha, "^[0-9a-f]{64}$"))
                throw new InvalidOperationException("Browser bundle checksum không hợp lệ.");

            string currentHost, currentRuntime;
            if (TryGetReady(out currentHost, out currentRuntime))
            {
                var marker = Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(currentHost)), "bundle.sha256");
                if (File.Exists(marker) && string.Equals(File.ReadAllText(marker).Trim(), sha, StringComparison.OrdinalIgnoreCase))
                    return;
            }

            Directory.CreateDirectory(Root);
            var versionFolder = "wv2-" + version + "-" + sha.Substring(0, 12);
            var target = Path.Combine(Root, versionFolder);
            if (!Directory.Exists(target))
            {
                var tempZip = Path.Combine(Root, versionFolder + ".zip.download");
                var tempExtract = Path.Combine(Root, versionFolder + ".extract");
                TryDelete(tempZip);
                TryDeleteDirectory(tempExtract);

                DownloadFile(AgentConfig.AgentBrowserBundleUrl, tempZip);
                var actual = Sha256(tempZip);
                if (!string.Equals(actual, sha, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Browser bundle SHA-256 không khớp.");

                Directory.CreateDirectory(tempExtract);
                ZipFile.ExtractToDirectory(tempZip, tempExtract);
                TryDelete(tempZip);

                var host = Path.Combine(tempExtract, "host", "SUPRA.Inventory.WebView2Host.exe");
                var runtime = Path.Combine(tempExtract, "runtime", "msedgewebview2.exe");
                if (!File.Exists(host) || !File.Exists(runtime))
                    throw new InvalidOperationException("Browser bundle thiếu host hoặc Fixed Runtime.");

                File.WriteAllText(Path.Combine(tempExtract, "bundle.sha256"), sha);
                if (Directory.Exists(target)) TryDeleteDirectory(target);
                Directory.Move(tempExtract, target);
            }

            File.WriteAllText(Path.Combine(Root, "active.txt"), versionFolder);
            if (log != null) log("SUPRA_BROWSER owned_bundle=READY version=" + version);
        }

        private static string RequestText(string url, bool manifest)
        {
            using (var response = OpenTrusted(url, manifest))
            using (var reader = new StreamReader(response.GetResponseStream()))
                return reader.ReadToEnd();
        }

        private static void DownloadFile(string url, string target)
        {
            using (var response = OpenTrusted(url, false))
            using (var input = response.GetResponseStream())
            using (var output = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                var buffer = new byte[1024 * 1024];
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                    output.Write(buffer, 0, read);
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
