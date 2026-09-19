using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class AgentUpdateResult
    {
        internal bool InstallStarted;
        internal int LatestBuild;
        internal string Message;
    }

    internal sealed class AgentReleaseInfo
    {
        internal int Build;
        internal string Tag;
        internal string ExeUrl;
        internal string ChecksumUrl;
    }

    internal static class AgentUpdater
    {
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static readonly Regex TagPattern = new Regex("^relay-agent-v(\\d+)$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        internal static AgentUpdateResult CheckAndInstallIfNeeded()
        {
            var latest = FindLatestRelease();
            if (latest == null)
            {
                return new AgentUpdateResult
                {
                    LatestBuild = AgentConfig.AgentBuild,
                    Message = "Không có Agent prerelease hợp lệ."
                };
            }

            if (latest.Build <= AgentConfig.AgentBuild)
            {
                return new AgentUpdateResult
                {
                    LatestBuild = latest.Build,
                    Message = "Agent đang ở bản mới nhất v" + AgentConfig.AgentBuild + "."
                };
            }

            var currentExe = Assembly.GetExecutingAssembly().Location;
            var currentDir = Path.GetDirectoryName(currentExe);
            if (string.IsNullOrWhiteSpace(currentDir))
                throw new InvalidOperationException("Không xác định được thư mục EXE hiện tại.");
            EnsureDirectoryWritable(currentDir);

            var updateDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SUPRA Inventory", "RelayPoc", "Updates", latest.Tag);
            Directory.CreateDirectory(updateDir);

            var tempExe = Path.Combine(updateDir, AgentConfig.AgentExeAsset + ".download");
            var checksumText = DownloadText(latest.ChecksumUrl, latest.Tag);
            var expected = ParseChecksum(checksumText);
            DownloadFile(latest.ExeUrl, latest.Tag, tempExe);
            var actual = Sha256(tempExe);
            if (!string.Equals(expected, actual, StringComparison.OrdinalIgnoreCase))
            {
                TryDelete(tempExe);
                throw new InvalidOperationException("SHA-256 Agent cập nhật không khớp.");
            }

            var script = CreateApplyScript(currentExe, tempExe, latest.Build);
            var start = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/d /c \"" + script + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = updateDir
            };
            var process = Process.Start(start);
            if (process == null)
                throw new InvalidOperationException("Không khởi chạy được tiến trình cập nhật Agent.");

            AgentDiagnostics.Write(
                "UPDATE install-started current=v" + AgentConfig.AgentBuild +
                " target=v" + latest.Build +
                " tag=" + latest.Tag +
                " sha256=" + actual.Substring(0, 12));

            return new AgentUpdateResult
            {
                InstallStarted = true,
                LatestBuild = latest.Build,
                Message = "Đang tự cập nhật Agent lên v" + latest.Build + "..."
            };
        }

        private static AgentReleaseInfo FindLatestRelease()
        {
            var raw = RequestText(AgentConfig.GitHubReleasesApi, true, null);
            var releases = Json.DeserializeObject(raw) as object[];
            if (releases == null) return null;

            AgentReleaseInfo best = null;
            foreach (var item in releases)
            {
                var release = item as Dictionary<string, object>;
                if (release == null) continue;

                object draftValue;
                if (release.TryGetValue("draft", out draftValue) && Convert.ToBoolean(draftValue)) continue;

                object prereleaseValue;
                if (!release.TryGetValue("prerelease", out prereleaseValue) || !Convert.ToBoolean(prereleaseValue)) continue;

                object tagValue;
                var tag = release.TryGetValue("tag_name", out tagValue) ? Convert.ToString(tagValue) : "";
                var match = TagPattern.Match(tag ?? "");
                int build;
                if (!match.Success || !int.TryParse(match.Groups[1].Value, out build)) continue;
                if (best != null && build <= best.Build) continue;

                object assetsValue;
                var assets = release.TryGetValue("assets", out assetsValue) ? assetsValue as object[] : null;
                if (assets == null) continue;

                string exeUrl = null;
                string checksumUrl = null;
                foreach (var assetItem in assets)
                {
                    var asset = assetItem as Dictionary<string, object>;
                    if (asset == null) continue;
                    object nameValue;
                    object urlValue;
                    var name = asset.TryGetValue("name", out nameValue) ? Convert.ToString(nameValue) : "";
                    var url = asset.TryGetValue("browser_download_url", out urlValue) ? Convert.ToString(urlValue) : "";
                    if (name == AgentConfig.AgentExeAsset) exeUrl = url;
                    if (name == AgentConfig.AgentChecksumAsset) checksumUrl = url;
                }

                if (string.IsNullOrWhiteSpace(exeUrl) || string.IsNullOrWhiteSpace(checksumUrl)) continue;
                best = new AgentReleaseInfo { Build = build, Tag = tag, ExeUrl = exeUrl, ChecksumUrl = checksumUrl };
            }

            return best;
        }

        private static string DownloadText(string url, string tag)
        {
            return RequestText(url, false, tag);
        }

        private static string RequestText(string url, bool api, string tag)
        {
            using (var response = OpenTrusted(url, api, tag))
            using (var reader = new StreamReader(response.GetResponseStream()))
                return reader.ReadToEnd();
        }

        private static void DownloadFile(string url, string tag, string target)
        {
            using (var response = OpenTrusted(url, false, tag))
            using (var input = response.GetResponseStream())
            using (var output = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                var buffer = new byte[64 * 1024];
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                    output.Write(buffer, 0, read);
            }
        }

        private static HttpWebResponse OpenTrusted(string url, bool api, string tag)
        {
            var current = new Uri(url);
            for (var redirect = 0; redirect < 6; redirect++)
            {
                ValidateUrl(current, api, tag, redirect > 0);
                var request = (HttpWebRequest)WebRequest.Create(current);
                request.Method = "GET";
                request.AllowAutoRedirect = false;
                request.Timeout = 10000;
                request.ReadWriteTimeout = 60000;
                request.UserAgent = "SUPRA-Inventory-Relay-Agent/v" + AgentConfig.AgentBuild;
                request.Accept = api ? "application/vnd.github+json" : "*/*";

                HttpWebResponse response;
                try
                {
                    response = (HttpWebResponse)request.GetResponse();
                }
                catch (WebException ex)
                {
                    var failed = ex.Response as HttpWebResponse;
                    if (failed != null)
                    {
                        var status = (int)failed.StatusCode;
                        failed.Dispose();
                        throw new InvalidOperationException("GitHub update HTTP " + status + ".");
                    }
                    throw new InvalidOperationException("Không kết nối được GitHub update: " + ex.Status + ".", ex);
                }

                var statusCode = (int)response.StatusCode;
                if (statusCode == 301 || statusCode == 302 || statusCode == 303 || statusCode == 307 || statusCode == 308)
                {
                    var location = response.Headers["Location"];
                    response.Dispose();
                    if (string.IsNullOrWhiteSpace(location))
                        throw new InvalidOperationException("GitHub update redirect thiếu Location.");
                    current = new Uri(current, location);
                    continue;
                }

                if (statusCode < 200 || statusCode > 299)
                {
                    response.Dispose();
                    throw new InvalidOperationException("GitHub update HTTP " + statusCode + ".");
                }
                return response;
            }
            throw new InvalidOperationException("GitHub update redirect vượt giới hạn.");
        }

        private static void ValidateUrl(Uri uri, bool api, string tag, bool redirected)
        {
            if (!string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Update Agent chỉ cho phép HTTPS.");

            if (api)
            {
                if (redirected ||
                    !string.Equals(uri.Host, "api.github.com", StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(uri.AbsolutePath, "/repos/tamnv2/supra-inventory/releases", StringComparison.Ordinal))
                    throw new InvalidOperationException("Update API không thuộc repo tin cậy.");
                return;
            }

            if (!redirected)
            {
                if (string.IsNullOrWhiteSpace(tag) || !TagPattern.IsMatch(tag))
                    throw new InvalidOperationException("Agent release tag không hợp lệ.");
                var prefix = "/tamnv2/supra-inventory/releases/download/" + tag + "/";
                if (!string.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase) ||
                    !uri.AbsolutePath.StartsWith(prefix, StringComparison.Ordinal))
                    throw new InvalidOperationException("Agent asset không thuộc repo tin cậy.");
                return;
            }

            var host = uri.Host.ToLowerInvariant();
            if (host != "release-assets.githubusercontent.com" &&
                host != "objects.githubusercontent.com" &&
                !host.EndsWith(".githubusercontent.com", StringComparison.Ordinal))
                throw new InvalidOperationException("Agent update redirect không thuộc CDN GitHub tin cậy.");
        }

        private static string ParseChecksum(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException("Agent checksum trống.");
            var first = value.Trim().Split((char[])null, StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant();
            if (!Regex.IsMatch(first, "^[0-9a-f]{64}$"))
                throw new InvalidOperationException("Agent checksum không hợp lệ.");
            return first;
        }

        private static string Sha256(string path)
        {
            using (var sha = SHA256.Create())
            using (var stream = File.OpenRead(path))
            {
                var hash = sha.ComputeHash(stream);
                var builder = new StringBuilder();
                foreach (var b in hash) builder.Append(b.ToString("x2"));
                return builder.ToString();
            }
        }

        private static void EnsureDirectoryWritable(string directory)
        {
            var probe = Path.Combine(directory, ".supra-relay-update-" + Guid.NewGuid().ToString("N") + ".tmp");
            try
            {
                File.WriteAllText(probe, "ok", Encoding.ASCII);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Thư mục EXE không cho phép tự cập nhật. Chuyển EXE sang thư mục user có quyền ghi.", ex);
            }
            finally
            {
                TryDelete(probe);
            }
        }

        private static string CreateApplyScript(string currentExe, string downloadedExe, int build)
        {
            var dir = Path.GetDirectoryName(downloadedExe);
            var script = Path.Combine(dir, "apply-relay-agent-v" + build + "-" + Guid.NewGuid().ToString("N") + ".cmd");
            var pid = Process.GetCurrentProcess().Id;
            var lines = new[]
            {
                "@echo off",
                "setlocal",
                ":wait",
                "tasklist /FI \"PID eq " + pid + "\" 2>NUL | find \"" + pid + "\" >NUL",
                "if not errorlevel 1 (",
                "  timeout /t 1 /nobreak >NUL",
                "  goto wait",
                ")",
                "copy /Y \"" + EscapeCmd(currentExe) + "\" \"" + EscapeCmd(currentExe) + ".bak\" >NUL 2>NUL",
                "copy /Y \"" + EscapeCmd(downloadedExe) + "\" \"" + EscapeCmd(currentExe) + "\" >NUL",
                "if errorlevel 1 exit /b 1",
                "start \"\" \"" + EscapeCmd(currentExe) + "\" --updated",
                "del /Q \"" + EscapeCmd(downloadedExe) + "\" >NUL 2>NUL",
                "del /Q \"%~f0\" >NUL 2>NUL"
            };
            File.WriteAllLines(script, lines, Encoding.ASCII);
            return script;
        }

        private static string EscapeCmd(string value)
        {
            return (value ?? "").Replace("%", "%%");
        }

        private static void TryDelete(string path)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(path) && File.Exists(path)) File.Delete(path);
            }
            catch { }
        }
    }
}
