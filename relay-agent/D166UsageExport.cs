using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Drawing;

namespace SupraInventoryRelayAgent
{
    // D166: Owner initiated, read-only evidence. No application/Firestore state writes.
    internal sealed class D166UsageExportClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
        internal Dictionary<string, object> Fetch(string token, string window)
        {
            var url = (AgentConfig.AgentLogGatewayUrl ?? "").Trim();
            Uri gateway;
            if (!Uri.TryCreate(url, UriKind.Absolute, out gateway) ||
                gateway.Scheme != Uri.UriSchemeHttps || url.Contains("__"))
                throw new InvalidOperationException("D166_GATEWAY_NOT_CONFIGURED");
            if (string.IsNullOrWhiteSpace(token)) throw new InvalidOperationException("D166_SESSION_REQUIRED");
            if (window != "today" && window != "rolling" && window != "shift")
                throw new InvalidOperationException("D166_WINDOW_INVALID");
            var bytes = Encoding.UTF8.GetBytes(_json.Serialize(new Dictionary<string, object> {
                { "action", "get_usage_export" }, { "id_token", token }, { "window", window }
            }));
            var request = (HttpWebRequest)WebRequest.Create(gateway);
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D166";
            request.Timeout = 90000;
            request.ReadWriteTimeout = 90000;
            request.AllowAutoRedirect = true;
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                {
                    var root = D160UsageJson.Map(_json.DeserializeObject(reader.ReadToEnd()));
                    if (!D160UsageJson.Bool(root, "ok")) throw new InvalidOperationException("D166_PROVIDER_NOT_READY");
                    if (!string.Equals(D160UsageJson.String(root, "service"), "SUPRA_AGENT_USAGE_EXPORT_D166", StringComparison.Ordinal) ||
                        !string.Equals(D160UsageJson.String(root, "project"), AgentConfig.FirebaseProjectId, StringComparison.Ordinal))
                        throw new InvalidOperationException("D166_PROVIDER_IDENTITY_MISMATCH");
                    return root;
                }
            }
            catch (WebException e)
            {
                var resp = e.Response as HttpWebResponse;
                var status = resp == null ? "NETWORK" : ((int)resp.StatusCode).ToString(CultureInfo.InvariantCulture);
                if (resp != null) resp.Dispose();
                throw new InvalidOperationException("D166_GATEWAY_" + status);
            }
        }
    }

    internal sealed partial class AgentForm
    {
        private readonly Button _d166ExportButton = new Button();
        private readonly ComboBox _d166ExportWindow = new ComboBox();
        private int _d166ExportBusy;
        private readonly JavaScriptSerializer _d166Json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };

        private void InitializeD166UsageExportUi(Panel header)
        {
            _d166ExportWindow.DropDownStyle = ComboBoxStyle.DropDownList;
            _d166ExportWindow.Items.AddRange(new object[] {
                "Hôm nay (giờ Việt Nam)", "24 giờ gần nhất", "Ca 06:00–22:00 (VN)"
            });
            _d166ExportWindow.SelectedIndex = 0;
            _d166ExportWindow.SetBounds(8, 74, 255, 30);
            _d166ExportButton.Text = "Tải số liệu Usage để phân tích";
            _d166ExportButton.SetBounds(273, 74, 270, 31);
            _d166ExportButton.Click += async (sender, e) => await ExportD166UsageAsync();
            header.Controls.Add(_d166ExportWindow);
            header.Controls.Add(_d166ExportButton);
        }

        private static void D166AddText(ZipArchive zip, string name, string value, List<string> checksums)
        {
            var data = new UTF8Encoding(false).GetBytes(value ?? "");
            var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
            using (var stream = entry.Open()) stream.Write(data, 0, data.Length);
            using (var sha = SHA256.Create())
                checksums.Add(BitConverter.ToString(sha.ComputeHash(data)).Replace("-", "").ToLowerInvariant() + "  " + name);
        }

        private static string D166Csv(object rows)
        {
            var sb = new StringBuilder("hour_start_utc,hour_label_vn,reads,writes,deletes,rtdb_sent_bytes,rtdb_payload_bytes,rtdb_api_hits,rtdb_https_requests,sheets_requests,drive_requests,cf_worker_requests,cf_worker_errors,cf_worker_subrequests,cf_do_account_rows_read,cf_do_account_rows_written\n");
            foreach (var value in D160UsageJson.List(rows))
            {
                var row = D160UsageJson.Map(value);
                string[] keys = { "hour_start", "hour_label_vn", "reads", "writes", "deletes",
                    "rtdb_sent_bytes", "rtdb_payload_bytes", "rtdb_api_hits", "rtdb_https_requests", "sheets_requests", "drive_requests",
                        "cf_worker_requests", "cf_worker_errors", "cf_worker_subrequests", "cf_do_account_rows_read", "cf_do_account_rows_written" };
                for (int i = 0; i < keys.Length; i++)
                {
                    if (i > 0) sb.Append(',');
                    var text = D160UsageJson.String(row, keys[i]).Replace("\r", "").Replace("\n", "");
                    sb.Append('"').Append(text.Replace("\"", "\"\"")).Append('"');
                }
                sb.Append('\n');
            }
            return sb.ToString();
        }

        private async Task ExportD166UsageAsync()
        {
            if (!D160UsageAllowedForCurrentSession()) return;
            if (Interlocked.Exchange(ref _d166ExportBusy, 1) != 0) return;
            _d166ExportButton.Enabled = false;
            var mode = _d166ExportWindow.SelectedIndex == 1 ? "rolling" :
                _d166ExportWindow.SelectedIndex == 2 ? "shift" : "today";
            try
            {
                var evidence = await Task.Run(() =>
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    if (session == null || string.IsNullOrWhiteSpace(session.IdToken) ||
                        !D160UsageAllowedForCurrentSession())
                        throw new InvalidOperationException("D166_SESSION_NOT_ALLOWED");
                    return new D166UsageExportClient().Fetch(session.IdToken, mode);
                });
                if (!D160UsageAllowedForCurrentSession())
                    throw new InvalidOperationException("D166_SESSION_CHANGED");
                var zone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
                var vietnamNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
                var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                if (string.IsNullOrWhiteSpace(desktop) || !Directory.Exists(desktop))
                    throw new InvalidOperationException("D166_DESKTOP_UNAVAILABLE");
                var stamp = vietnamNow.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture);
                var baseName = "SUPRA_Inventory_Usage_" + stamp + "_VN";
                var target = Path.Combine(desktop, baseName + ".zip");
                for (int i = 1; File.Exists(target) && i < 100; i++)
                    target = Path.Combine(desktop, baseName + "_" + i.ToString(CultureInfo.InvariantCulture) + ".zip");
                if (File.Exists(target)) throw new InvalidOperationException("D166_FILENAME_CONFLICT");
                var temporary = target + ".partial";
                if (File.Exists(temporary)) throw new InvalidOperationException("D166_PARTIAL_FILE_EXISTS");
                try
                {
                    using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                    using (var zip = new ZipArchive(file, ZipArchiveMode.Create, false))
                    {
                        var checksums = new List<string>();
                        var manifest = new Dictionary<string, object> {
                            { "schema", "supra-inventory-d166-usage-evidence-v1" },
                            { "app_build", AgentConfig.AgentBuild },
                            { "collected_at_utc", DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture) },
                            { "timezone", "Asia/Ho_Chi_Minh" },
                            { "selected_window", mode },
                            { "source_project", AgentConfig.FirebaseProjectId },
                            { "source", "existing Beta Agent Operations Gateway + Google Cloud Monitoring + optional Cloudflare Analytics/Billable Usage" },
                            { "window", D160UsageJson.Value(evidence, "window") },
                            { "scope", "Inventory Beta only; shared account totals are never attributed to Inventory" },
                            { "billing", "Not an invoice; provider Monitoring metrics can be delayed or incomplete" }
                        };
                        D166AddText(zip, "manifest.json", _d166Json.Serialize(manifest), checksums);
                        D166AddText(zip, "summary.json", _d166Json.Serialize(D160UsageJson.Value(evidence, "summary")), checksums);
                        D166AddText(zip, "providers/monitoring.json", _d166Json.Serialize(D160UsageJson.Value(evidence, "metrics")), checksums);
                        // D167: exactly one Owner-click scoped Worker -> DO in-RAM snapshot.
                        // No new timer, Firebase read/write or provider account metric query.
                        D166AddText(zip, "providers/inventorycore_d167_local.json",
                            _d166Json.Serialize(D160UsageJson.Value(evidence, "d167_inventorycore_diagnostics")), checksums);
                        D166AddText(zip, "providers/google_drive_account.json", _d166Json.Serialize(D160UsageJson.Value(evidence, "google_drive_account")), checksums);
                        var cloudflare = D160UsageJson.Child(evidence, "cloudflare");
                        D166AddText(zip, "providers/cloudflare_workers.json", _d166Json.Serialize(D160UsageJson.Value(cloudflare, "workers")), checksums);
                        D166AddText(zip, "providers/cloudflare_do_account.json", _d166Json.Serialize(D160UsageJson.Value(cloudflare, "durable_objects_account")), checksums);
                        D166AddText(zip, "providers/cloudflare_billing_account.json", _d166Json.Serialize(D160UsageJson.Value(cloudflare, "billing_account")), checksums);
                        D166AddText(zip, "usage_hourly.csv", D166Csv(D160UsageJson.Value(evidence, "hourly")), checksums);
                        D166AddText(zip, "collection_status.json", _d166Json.Serialize(D160UsageJson.Value(evidence, "status")), checksums);
                        D166AddText(zip, "manual_dashboard_links.txt",
                            "Cloudflare Analytics: https://dash.cloudflare.com/\n" +
                            "Cloudflare Billing: https://dash.cloudflare.com/\n" +
                            "Firebase project usage: https://console.firebase.google.com/project/supra-inventory-beta/usage\n" +
                            "Google Cloud Metrics: https://console.cloud.google.com/monitoring?project=supra-inventory-beta\n" +
                            "Google Cloud Billing: https://console.cloud.google.com/billing\n" +
                            "Google Drive space: https://one.google.com/storage\n" +
                            "GitHub Actions: https://github.com/tamnv2/supra-inventory/actions\n" +
                            "Missing/unsupported providers require screenshots. Do not upload credentials.\n", checksums);
                        D166AddText(zip, "README.txt",
                            "SUPRA Inventory D166 Usage Evidence\n" +
                            "Only scoped Beta usage; no WMS logs, passwords, ID tokens, Picker data or API keys.\n" +
                            "Match with separate Agent/Android/Web log bundle by event time, not upload time.\n" +
                            "D167 InventoryCore evidence is a process-local diagnostic snapshot, not billed DO requests or SQL rows.\n" +
                            "Today's Vietnam window is distinct from the Firestore provider quota day (Pacific).\n" +
                            "N/A and errors in collection_status.json do not mean usage zero.\n" +
                            "Use screenshots/CSV for Cloudflare and actual provider invoices when API data is unavailable.\n" +
                            "Do not treat summary metrics as exact billed USD.\n" +
                            "Cloudflare Workers metrics are script-scoped; Durable Objects and billable usage are SHARED account totals, not Inventory attribution.\n" +
                            "Unavailable or delayed Cloudflare metrics are N/A, never zero. No secrets are exported.\n", checksums);
                        D166AddText(zip, "checksums.sha256", string.Join("\n", checksums) + "\n", new List<string>());
                    }
                    File.Move(temporary, target);
                }
                finally
                {
                    if (File.Exists(temporary)) try { File.Delete(temporary); } catch { }
                }
                Log("D166 USAGE ZIP export=PASS local_only=true mode=" + mode);
                MessageBox.Show(this, "Đã xuất ZIP Usage ra Desktop:\n" + Path.GetFileName(target),
                    "SUPRA Usage", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                Log("D166 USAGE ZIP export=DEFER reason=" + AgentDiagnostics.Sanitize(ex.Message));
                MessageBox.Show(this, "Chưa thể xuất Usage: " + AgentDiagnostics.Sanitize(ex.Message),
                    "SUPRA Usage", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            finally
            {
                _d166ExportButton.Enabled = true;
                Interlocked.Exchange(ref _d166ExportBusy, 0);
            }
        }
    }
}
