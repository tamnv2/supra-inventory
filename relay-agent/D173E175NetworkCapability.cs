using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Button _d173E175NetworkRefresh = new Button();
        private readonly Label _d173E175NetworkStatus = new Label();
        private volatile string _d173E175Capability = "UNKNOWN";
        private int _d173E175NetworkProbeInFlight;
        private int _d173E175NetworkGeneration;
        private readonly object _d173E175NetworkCacheGate = new object();
        private static readonly string D173E175NetworkCacheFile =
            Path.Combine(RelayDataDir, "network-capability.dpapi");
        private NetworkAddressChangedEventHandler _d173E175NetworkChanged;

        private void InitializeD173E175NetworkCapability(Control host)
        {
            _d173E175NetworkStatus.Name = "D173E175NetworkCapabilityStatus";
            _d173E175NetworkStatus.Text = "Mạng: Chưa xác định";
            _d173E175NetworkStatus.TextAlign = ContentAlignment.MiddleLeft;
            _d173E175NetworkStatus.AutoEllipsis = true;
            _d173E175NetworkStatus.Font = new Font("Segoe UI", 8.3F);
            host.Controls.Add(_d173E175NetworkStatus);

            _d173E175NetworkRefresh.Name = "D173E175RefreshNetworkClassification";
            _d173E175NetworkRefresh.Text = "Làm mới phân loại mạng";
            _d173E175NetworkRefresh.FlatStyle = FlatStyle.Flat;
            _d173E175NetworkRefresh.Font = new Font("Segoe UI", 8F);
            _d173E175NetworkRefresh.Enabled = HasAgentSession();
            _d173E175NetworkRefresh.Click += (s, e) => QueueD173E175NetworkProbe(true);
            host.Controls.Add(_d173E175NetworkRefresh);
            LayoutD173E175NetworkCapability(host);
        }

        private void LayoutD173E175NetworkCapability(Control host)
        {
            if (host == null || host.IsDisposed || _d173E175NetworkStatus.Parent != host) return;
            var width = Math.Max(310, host.ClientSize.Width);
            var rightWidth = Math.Max(122, Math.Min(190, (width - 30) / 2));
            SetD173BoundsIfChanged(_d173E175NetworkStatus, 12, 127,
                Math.Max(100, width - 36 - rightWidth), 29);
            SetD173BoundsIfChanged(_d173E175NetworkRefresh,
                width - 12 - rightWidth, 127, rightWidth, 29);
            _d173E175NetworkRefresh.Text = width < 470
                ? "Làm mới mạng" : "Làm mới phân loại mạng";
        }

        private void StartD173E175NetworkWatch()
        {
            _d173E175NetworkChanged = (s, e) =>
            {
                // Only re-probe after an OS network transition, never on a periodic tick.
                D168NetworkRoute.NotifyNetworkChange();
                Interlocked.Increment(ref _d173E175NetworkGeneration);
                _d173E175Capability = "UNKNOWN";
                try
                {
                    if (!IsDisposed && IsHandleCreated)
                        BeginInvoke(new Action(() => QueueD173E175NetworkProbe(false)));
                }
                catch { }
            };
            NetworkChange.NetworkAddressChanged += _d173E175NetworkChanged;
            FormClosed += (s, e) => {
                try { NetworkChange.NetworkAddressChanged -= _d173E175NetworkChanged; }
                catch { }
            };
            Shown += (s, e) => QueueD173E175NetworkProbe(false);
        }

        private static string D173E175NetworkFingerprint()
        {
            try
            {
                // No raw Wi-Fi name, gateway, adapter identifier or IP is persisted/logged.
                var parts = new List<string> { D168NetworkRoute.CurrentProfileForCapability() };
                foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces()
                             .Where(a => a.OperationalStatus == OperationalStatus.Up &&
                                         a.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                             .OrderBy(a => a.Id, StringComparer.Ordinal))
                {
                    parts.Add(adapter.Id);
                    foreach (var gateway in adapter.GetIPProperties().GatewayAddresses)
                        parts.Add(gateway.Address.ToString());
                }
                if (parts.Count == 1 && string.IsNullOrWhiteSpace(parts[0])) return "";
                using (var sha = SHA256.Create())
                    return BitConverter.ToString(sha.ComputeHash(
                        Encoding.UTF8.GetBytes(string.Join("|", parts)))).Replace("-", "").ToLowerInvariant();
            }
            catch { return ""; }
        }

        private static Dictionary<string, string> ReadD173E175Cache()
        {
            try
            {
                if (!File.Exists(D173E175NetworkCacheFile)) return new Dictionary<string, string>();
                var bytes = ProtectedData.Unprotect(File.ReadAllBytes(D173E175NetworkCacheFile),
                    null, DataProtectionScope.CurrentUser);
                var json = Encoding.UTF8.GetString(bytes);
                return new JavaScriptSerializer().Deserialize<Dictionary<string, string>>(json)
                       ?? new Dictionary<string, string>();
            }
            catch { return new Dictionary<string, string>(); }
        }

        private static void WriteD173E175Cache(string fingerprint, string mode)
        {
            if (string.IsNullOrWhiteSpace(fingerprint)) return;
            if (mode != "FULL" && mode != "OFFICE" && mode != "RESTRICTED" && mode != "UNAVAILABLE")
                return;
            try
            {
                var saved = ReadD173E175Cache();
                saved[fingerprint] = mode + "|" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                // Bound local metadata. Do not accumulate old networks forever.
                while (saved.Count > 8) saved.Remove(saved.Keys.First());
                var json = new JavaScriptSerializer().Serialize(saved);
                var raw = ProtectedData.Protect(Encoding.UTF8.GetBytes(json), null,
                    DataProtectionScope.CurrentUser);
                Directory.CreateDirectory(RelayDataDir);
                var temp = D173E175NetworkCacheFile + ".tmp";
                File.WriteAllBytes(temp, raw);
                if (File.Exists(D173E175NetworkCacheFile))
                    File.Replace(temp, D173E175NetworkCacheFile, null);
                else File.Move(temp, D173E175NetworkCacheFile);
            }
            catch { } // Cache is an optimization, never authority for business or HA.
        }

        private void ApplyD173E175Capability(string mode, bool cached)
        {
            if (IsDisposed) return;
            _d173E175Capability = mode;
            var label = mode == "FULL" ? "Mạng đầy đủ" :
                        mode == "OFFICE" ? "Mạng nội bộ tương thích" :
                        mode == "RESTRICTED" ? "Mạng hạn chế" :
                        mode == "UNAVAILABLE" ? "Không khả dụng" : "Chưa xác định";
            _d173E175NetworkStatus.Text = "Mạng: " + label + (cached ? " · đã lưu, đang kiểm tra" : "");
            // A stored classification never authorizes a blocked network operation.
            if (!cached) D168NetworkRoute.ObserveNetworkCapability(mode);
            _d173E175NetworkRefresh.Enabled = HasAgentSession() &&
                Interlocked.CompareExchange(ref _d173E175NetworkProbeInFlight, 0, 0) == 0;
            D173E159ApplyOfficeCapabilityUi();
        }

        private void QueueD173E175NetworkProbe(bool force)
        {
            if (IsDisposed || !HasAgentSession()) return;
            var fingerprint = D173E175NetworkFingerprint();
            if (!force && !string.IsNullOrWhiteSpace(fingerprint))
            {
                var cache = ReadD173E175Cache();
                string item;
                if (cache.TryGetValue(fingerprint, out item))
                {
                    var mode = item.Split('|')[0];
                    if (mode == "FULL" || mode == "OFFICE" || mode == "RESTRICTED" || mode == "UNAVAILABLE")
                        ApplyD173E175Capability(mode, true);
                }
            }
            if (Interlocked.CompareExchange(ref _d173E175NetworkProbeInFlight, 1, 0) != 0) return;
            var generation = Interlocked.Increment(ref _d173E175NetworkGeneration);
            _d173E175NetworkRefresh.Enabled = false;
            Task.Run(() =>
            {
                string firestore = "UNKNOWN", worker = "UNKNOWN";
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    if (session == null || string.IsNullOrWhiteSpace(session.IdToken)) return;
                    var fireTask = Task.Run(() =>
                    {
                        try
                        {
                            FirestoreHttpTransport.SendJson("GET", AgentConfig.FirestoreAgentSyncUrl,
                                session.IdToken, null, "SUPRA-Agent/NetworkCapability", 5000,
                                false, Log, "NETWORK_CAPABILITY", 1);
                            return "READY";
                        }
                        catch (WebException ex)
                        {
                            using (var response = ex.Response as HttpWebResponse)
                            {
                                if (response != null)
                                {
                                    var status = (int)response.StatusCode;
                                    if (status == 401 || status == 403 || status == 429 || status >= 500)
                                        return "UNKNOWN";
                                }
                            }
                            return ex.Status == WebExceptionStatus.Timeout ||
                                   ex.Status == WebExceptionStatus.ConnectFailure ||
                                   ex.Status == WebExceptionStatus.NameResolutionFailure ||
                                   ex.Status == WebExceptionStatus.ProxyNameResolutionFailure
                                ? "UNREACHABLE" : "UNKNOWN";
                        }
                        catch { return "UNKNOWN"; }
                    });
                    var workerTask = Task.Run(() => D168NetworkRoute.ProbeWorker(session.IdToken));
                    Task.WaitAll(fireTask, workerTask);
                    firestore = fireTask.Result;
                    worker = workerTask.Result;
                }
                catch { }
                finally
                {
                    Interlocked.Exchange(ref _d173E175NetworkProbeInFlight, 0);
                    var nowFingerprint = D173E175NetworkFingerprint();
                    if (IsDisposed || generation != Volatile.Read(ref _d173E175NetworkGeneration) ||
                        !string.Equals(fingerprint, nowFingerprint, StringComparison.Ordinal)) return;
                    var mode = firestore == "READY" && worker == "READY" ? "FULL" :
                        firestore == "READY" && worker == "NETWORK_UNREACHABLE" ? "OFFICE" :
                        firestore == "UNREACHABLE" && worker == "READY" ? "RESTRICTED" :
                        firestore == "UNREACHABLE" && worker == "NETWORK_UNREACHABLE" ? "UNAVAILABLE" : "UNKNOWN";
                    WriteD173E175Cache(fingerprint, mode);
                    try
                    {
                        BeginInvoke(new Action(() => ApplyD173E175Capability(mode, false)));
                    }
                    catch { }
                    Log("D173_E175 NETWORK_CAPABILITY mode=" + mode +
                        " firestore=" + firestore + " worker=" + worker + " cached=false");
                }
            });
        }
    }
}
