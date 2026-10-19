using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Supra.FirebaseNetworkDiagnostic;

internal static class Entry
{
    [STAThread]
    private static void Main(string[] args)
    {
        // Pure local identity contract test; no login, network or provider operations.
        if (args.Length == 1 && args[0] == "--identity-selftest")
        {
            Environment.ExitCode = AgentIdentityBinding.SelfTest() ? 0 : 1;
            return;
        }
        ApplicationConfiguration.Initialize();
        // D169 independent TEST process: login once, then the peer test window.
        using var login = new LoginDialog();
        if (login.ShowDialog() != DialogResult.OK) return;
        var report = new DiagnosticReport();
        var session = FirebaseDiagnostic.TryLoginAsync(login.Login, login.Password, report).GetAwaiter().GetResult();
        if (session == null) { MessageBox.Show("Không đăng nhập được Agent Admin/Pick Pack Admin.", "D171 Test"); return; }
        Application.Run(new PeerForm(session, login.Login));
    }
}

internal sealed class AgentTokens
{
    internal string IdToken = "";
    internal string RefreshToken = "";
    internal string Role = "";
    internal string VerifiedLogin = "";
    internal string VerifiedUserId = "";
    internal string VerifiedFirebaseUid = "";
    internal DateTimeOffset Expires = DateTimeOffset.MinValue;
}

// D171 binds the login alias to the Worker-resolved business user and its Firebase identity.
// app_user_id is an internal key, NOT necessarily the login or employee code.
internal static class AgentIdentityBinding
{
    internal static string JwtClaim(string jwt, string claim)
    {
        try
        {
            var part=jwt.Split('.')[1].Replace('-', '+').Replace('_', '/');
            part=part.PadRight(((part.Length+3)/4)*4, '=');
            using var doc=JsonDocument.Parse(Convert.FromBase64String(part));
            return doc.RootElement.TryGetProperty(claim, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString() ?? "" : "";
        }
        catch { return ""; }
    }

    internal static bool MatchesLogin(string login, string userId, string employeeCode,
        string firebaseUid, string role, string baseRole, string claimUserId, string claimUid, string claimRole)
    {
        var requested=login.Trim().ToLowerInvariant();
        return (requested == "admin" || requested == "tamnv2")
            && !string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(firebaseUid)
            && (string.Equals(requested, userId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(requested, employeeCode, StringComparison.OrdinalIgnoreCase))
            && string.Equals(userId, claimUserId, StringComparison.Ordinal)
            && string.Equals(firebaseUid, claimUid, StringComparison.Ordinal)
            && (role == "ADMIN" || role == "PICKPACK_ADMIN")
            && role == baseRole && role == claimRole;
    }

    internal static bool MatchesRuntime(string login, AgentTokens token, string initialUid)
    {
        return !string.IsNullOrWhiteSpace(token.VerifiedUserId)
            && !string.IsNullOrWhiteSpace(token.VerifiedFirebaseUid)
            && string.Equals(login.Trim(), token.VerifiedLogin, StringComparison.OrdinalIgnoreCase)
            && string.Equals(initialUid, token.VerifiedFirebaseUid, StringComparison.Ordinal)
            && string.Equals(JwtClaim(token.IdToken, "app_user_id"), token.VerifiedUserId, StringComparison.Ordinal)
            && string.Equals(JwtClaim(token.IdToken, "sub"), token.VerifiedFirebaseUid, StringComparison.Ordinal)
            && (token.Role == "ADMIN" || token.Role == "PICKPACK_ADMIN");
    }

    internal static bool SelfTest()
    {
        const string id="internal-opaque-107", uid="firebase-synthetic-107";
        var good=MatchesLogin("admin",id,"admin",uid,"ADMIN","ADMIN",id,uid,"ADMIN")
            && MatchesLogin("tamnv2","internal-opaque-208","tamnv2","firebase-synthetic-208",
                "PICKPACK_ADMIN","PICKPACK_ADMIN","internal-opaque-208","firebase-synthetic-208","PICKPACK_ADMIN");
        var bad=!MatchesLogin("admin",id,"tamnv2",uid,"ADMIN","ADMIN",id,uid,"ADMIN")
            && !MatchesLogin("admin",id,"admin",uid,"ADMIN","ADMIN","admin",uid,"ADMIN")
            && !MatchesLogin("admin",id,"admin",uid,"ADMIN","ADMIN",id,"wrong-uid","ADMIN")
            && !MatchesLogin("admin",id,"admin",uid,"ADMIN","PICKPACK_ADMIN",id,uid,"ADMIN")
            && !MatchesLogin("admin",id,"admin",uid,"ADMIN","ADMIN",id,uid,"PICKER")
            && !MatchesLogin("admin","","admin",uid,"ADMIN","ADMIN","",uid,"ADMIN");
        return good && bad;
    }
}

internal sealed record ProbeResult(string Category, string Name, string Route, string Result,
                                   int DurationMs, int? HttpStatus, string Detail);
internal sealed class DiagnosticReport
{
    public string Format { get; set; } = "SUPRA_FIREBASE_NETWORK_DIAGNOSTIC_V1";
    public string Version { get; set; } = "1.0.0";
    public string NetworkLabel { get; set; } = "";
    public string StartedAtUtc { get; set; } = "";
    public string FinishedAtUtc { get; set; } = "";
    public string LocalUtcOffset { get; set; } = "";
    public bool AgentAuthenticated { get; set; }
    public string AgentRole { get; set; } = "UNAUTHENTICATED";
    public string SecretPolicy { get; set; } = "NO_PASSWORD_TOKEN_SSID_IP_BSSID_OR_RAW_HTTP_BODY_IN_REPORT";
    public List<ProbeResult> Probes { get; set; } = new();
    public List<string> Limitations { get; set; } = new()
    {
        "Probe is read-only. No RTDB or Firestore write, HA takeover, live WMS, PickList, or FCM send.",
        "TCP/TLS/HTTP reachability does not establish app permissions or a working listener.",
        "Firestore REST GET is not a Firestore gRPC Listen subscription; a listener pilot requires explicit scoped canary.",
        "No provider-side quotas, billing counters, connection cap or backend usage can be measured authoritatively by a local probe.",
        "RTDB SSE result verifies response framing; without a fresh heartbeat it cannot prove ongoing event delivery.",
        "A permission denial after authentication may reflect Firebase Rules/claims rather than Office firewall.",
        "Network label is operator selection, not an automatically verified SSID classification."
    };
}

internal sealed class LoginDialog : Form
{
    private readonly TextBox _login = new() { Width = 300 };
    private readonly TextBox _password = new() { Width = 300, UseSystemPasswordChar = true };
    internal string Login => _login.Text.Trim();
    internal string Password => _password.Text;
    internal LoginDialog()
    {
        Text = "Xác thực Agent (chỉ giữ phiên trong RAM)";
        ClientSize = new Size(385, 224);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        MaximizeBox = false;
        MinimizeBox = false;
        Controls.Add(new Label { Text = "Tài khoản Agent", Left = 20, Top = 16, Width = 340 });
        _login.SetBounds(20, 38, 345, 26);
        Controls.Add(_login);
        Controls.Add(new Label { Text = "Mật khẩu", Left = 20, Top = 76, Width = 340 });
        _password.SetBounds(20, 99, 345, 26);
        Controls.Add(_password);
        Controls.Add(new Label { Text = "Không lưu mật khẩu, token hoặc phiên vào đĩa.", Left = 20, Top = 135, Width = 345, Height = 28 });
        var ok = new Button { Text = "Đăng nhập", DialogResult = DialogResult.OK };
        ok.SetBounds(176, 177, 100, 29);
        Controls.Add(ok);
        var skip = new Button { Text = "Bỏ qua", DialogResult = DialogResult.Cancel };
        skip.SetBounds(281, 177, 84, 29);
        Controls.Add(skip);
        AcceptButton = ok;
        CancelButton = skip;
    }
}

internal sealed class DiagnosticForm : Form
{
    private readonly Button _normal = new() { Text = "MẠNG THƯỜNG" };
    private readonly Button _office = new() { Text = "MẠNG NỘI BỘ" };
    private readonly Button _test = new() { Text = "TEST KẾT NỐI", BackColor = Color.FromArgb(40, 94, 165), ForeColor = Color.White };
    private readonly Button _peer = new() { Text = "TEST EXE ⇄ PDA ⇄ EXE", BackColor = Color.FromArgb(50, 132, 110), ForeColor = Color.White };
    private readonly Label _status = new() { AutoSize = false };
    private readonly TextBox _output = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical };
    private readonly Label _hint = new() { AutoSize = false };
    private string _mode = "NORMAL";
    private AgentTokens? _session;
    private string _operatorLogin="";
    private readonly AgentLogMirror _mirror = new();
    private bool _running;

    internal DiagnosticForm()
    {
        Text = "SUPRA Firebase Network Diagnostics 1.0";
        ClientSize = new Size(760, 515);
        MinimumSize = new Size(710, 515);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);
        BackColor = Color.FromArgb(247, 249, 252);
        var title = new Label { Text = "Chẩn đoán mạng Firebase · SUPRA", Font = new Font("Segoe UI", 15, FontStyle.Bold) };
        title.SetBounds(22, 18, 695, 42);
        Controls.Add(title);
        _normal.SetBounds(22, 70, 220, 43);
        _office.SetBounds(253, 70, 220, 43);
        _test.SetBounds(485, 70, 247, 43);
        Controls.AddRange(new Control[] { _normal, _office, _test });
        _normal.Click += (_, _) => SelectMode("NORMAL");
        _office.Click += (_, _) => SelectMode("OFFICE");
        _test.Click += async (_, _) => await RunTest();
        _hint.Text = "Đăng nhập Agent trong lần TEST đầu · dùng cùng phiên khi đổi Wi-Fi · chỉ đo, không sửa dữ liệu.";
        _hint.SetBounds(22, 127, 445, 36);
        _peer.SetBounds(485, 125, 247, 36);
        Controls.Add(_peer);
        _peer.Click += (_, _) => {
            if (_session == null) { MessageBox.Show("Nhấn TEST KẾT NỐI để đăng nhập Admin/Pick Pack Admin một lần, sau đó mở TEST EXE ⇄ PDA ⇄ EXE.", "Cần đăng nhập"); return; }
            using var form = new PeerForm(_session,_operatorLogin);
            form.ShowDialog(this);
        };
        Controls.Add(_hint);
        _status.Text = "Chưa chạy";
        _status.SetBounds(22, 164, 710, 30);
        Controls.Add(_status);
        _output.Font = new Font("Consolas", 9);
        _output.SetBounds(22, 202, 710, 280);
        _output.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        Controls.Add(_output);
        SelectMode("NORMAL");
        _mirror.Start();
        FormClosed += (_, _) => _mirror.Dispose();
        _hint.Text = "Đăng nhập Admin; đo mạng và tự sao chép log Agent thực ra Desktop.";
    }

    private void SelectMode(string mode)
    {
        if (_running) return;
        _mode = mode;
        _normal.BackColor = mode == "NORMAL" ? Color.FromArgb(163, 211, 253) : Color.White;
        _office.BackColor = mode == "OFFICE" ? Color.FromArgb(163, 211, 253) : Color.White;
        _status.Text = "Đã chọn " + (mode == "NORMAL" ? "MẠNG THƯỜNG" : "MẠNG NỘI BỘ") + ".";
    }

    private async Task RunTest()
    {
        if (_running) return;
        _running = true;
        _normal.Enabled = _office.Enabled = _test.Enabled = false;
        _output.Clear();
        var report = new DiagnosticReport
        {
            NetworkLabel = _mode,
            StartedAtUtc = DateTimeOffset.UtcNow.ToString("O"),
            LocalUtcOffset = DateTimeOffset.Now.ToString("zzz")
        };
        var progress = new Progress<string>(msg =>
        {
            _status.Text = msg;
            _output.AppendText(msg + Environment.NewLine);
        });
        var stamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrWhiteSpace(desktop) || !Directory.Exists(desktop))
            desktop = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        try
        {
            if (_session == null)
            {
                using var dialog = new LoginDialog();
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    var identifier = dialog.Login;
                    _operatorLogin=identifier;
                    var password = dialog.Password;
                    try
                    {
                        ((IProgress<string>)progress).Report("Đang xác thực quyền Agent...");
                        _session = await FirebaseDiagnostic.TryLoginAsync(identifier, password, report);
                    }
                    finally { dialog.Dispose(); password = ""; }
                }
            }
            report.AgentAuthenticated = _session != null;
            report.AgentRole = _session?.Role ?? "UNAUTHENTICATED";
            await FirebaseDiagnostic.RunAsync(report, _session, progress);
        }
        catch (Exception ex)
        {
            report.Probes.Add(new ProbeResult("SYSTEM", "Unhandled", "LOCAL", "FAILED",
                0, null, FirebaseDiagnostic.SafeFailure(ex)));
        }
        finally
        {
            report.FinishedAtUtc = DateTimeOffset.UtcNow.ToString("O");
            try
            {
                var prefix = Path.Combine(desktop, "SUPRA_NETWORK_" + _mode + "_" + stamp);
                File.WriteAllText(prefix + ".json", JsonSerializer.Serialize(report,
                    new JsonSerializerOptions { WriteIndented = true }), new UTF8Encoding(false));
                var sb = new StringBuilder();
                sb.AppendLine("SUPRA FIREBASE NETWORK DIAGNOSTICS V1");
                sb.AppendLine("Mode: " + report.NetworkLabel + " | Agent: " + report.AgentRole);
                sb.AppendLine("Started UTC: " + report.StartedAtUtc);
                sb.AppendLine("Finished UTC: " + report.FinishedAtUtc);
                sb.AppendLine("PROBES:");
                foreach (var p in report.Probes)
                    sb.AppendLine(string.Join(" | ", p.Category, p.Name, p.Route, p.Result,
                        p.DurationMs + "ms", "HTTP " + (p.HttpStatus?.ToString() ?? "-"), p.Detail));
                sb.AppendLine("LIMITATIONS:");
                foreach (var limitation in report.Limitations) sb.AppendLine("- " + limitation);
                File.WriteAllText(prefix + ".txt", sb.ToString(), new UTF8Encoding(false));
                _output.AppendText(Environment.NewLine + "ĐÃ XUẤT LOG: " + prefix + ".json / .txt" + Environment.NewLine);
                _output.AppendText("LOG AGENT THỰC: " + _mirror.Target + Environment.NewLine);
                _status.Text = "HOÀN TẤT — log đã xuất trên Desktop.";
            }
            catch (Exception ex)
            {
                _status.Text = "LỖI XUẤT LOG: " + FirebaseDiagnostic.SafeFailure(ex);
            }
            _running = false;
            _normal.Enabled = _office.Enabled = _test.Enabled = true;
        }
    }
}

internal static class FirebaseDiagnostic
{
    private const string Project = "supra-inventory-beta";
    private const string RtdbHost = "supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app";
    private const string FirestoreUrl = "https://firestore.googleapis.com/v1/projects/" + Project + "/databases/(default)/documents";
    private const string Worker = "https://inventory.supra.cc.cd";
    private const int TimeoutMs = 5500;
    private static readonly (string Category, string Host)[] Hosts =
    {
        ("AUTH", "identitytoolkit.googleapis.com"),
        ("AUTH_REFRESH", "securetoken.googleapis.com"),
        ("RTDB", RtdbHost),
        ("FIRESTORE", "firestore.googleapis.com"),
        ("STORAGE", "firebasestorage.googleapis.com"),
        ("FCM", "fcm.googleapis.com"),
        ("INSTALLATIONS", "firebaseinstallations.googleapis.com"),
        ("REMOTE_CONFIG", "firebaseremoteconfig.googleapis.com"),
        ("APP_CHECK", "firebaseappcheck.googleapis.com"),
        ("CLOUD_FUNCTIONS", "cloudfunctions.googleapis.com"),
        ("HOSTING", "firebasehosting.googleapis.com"),
        ("GCS", "storage.googleapis.com"),
        ("INVENTORY_WORKER", "inventory.supra.cc.cd")
    };
    private static HttpClient Client(bool useProxy, int timeout = TimeoutMs)
    {
        return new HttpClient(new HttpClientHandler
        {
            AllowAutoRedirect = false,
            UseProxy = useProxy,
            Proxy = useProxy ? HttpClient.DefaultProxy : null,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        }) { Timeout = TimeSpan.FromMilliseconds(timeout) };
    }
    internal static string SafeFailure(Exception ex)
    {
        Exception e = ex;
        while (e.InnerException != null) e = e.InnerException;
        if (e is SocketException se) return "SOCKET_" + se.SocketErrorCode;
        if (e is AuthenticationException) return "TLS_AUTH_ERROR";
        if (e is TaskCanceledException || e is OperationCanceledException) return "TIMEOUT_OR_CANCEL";
        if (e is HttpRequestException hre)
        {
            if (hre.HttpRequestError != HttpRequestError.Unknown)
                return "HTTP_TRANSPORT_" + hre.HttpRequestError;
            return "HTTP_TRANSPORT_ERROR";
        }
        return Regex.Replace(e.GetType().Name, "[^A-Za-z0-9_]", "");
    }
    private static string StatusText(int status)
    {
        if (status == 401) return "REACHED_AUTH_REQUIRED";
        if (status == 403) return "REACHED_FORBIDDEN_UNCLASSIFIED";
        if (status == 404) return "REACHED_PATH_NOT_FOUND";
        if (status == 429) return "REACHED_RATE_LIMIT";
        if (status >= 500) return "REACHED_SERVER_ERROR";
        if (status >= 200 && status < 300) return "HTTP_SUCCESS";
        return "REACHED_HTTP_" + status;
    }
    private static void Record(DiagnosticReport report, string category, string name,
        string route, string result, Stopwatch sw, int? status = null, string detail = "")
    {
        lock (report.Probes)
            report.Probes.Add(new ProbeResult(category, name, route, result,
                (int)Math.Min(int.MaxValue, sw.ElapsedMilliseconds), status, detail));
    }

    internal static async Task<AgentTokens?> TryLoginAsync(string login, string password, DiagnosticReport report)
    {
        if (string.IsNullOrWhiteSpace(login) || string.IsNullOrWhiteSpace(password)) return null;
        var sw = Stopwatch.StartNew();
        try
        {
            string json;
            if (string.Equals(login, "admin", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(login, "tamnv2", StringComparison.OrdinalIgnoreCase))
            {
                using var c = Client(true, 12000);
                var payload = JsonSerializer.Serialize(new { username = login.Trim().ToLowerInvariant(), password });
                using var r = await c.PostAsync(Worker + "/api/auth/privileged-agent-login",
                    new StringContent(payload, Encoding.UTF8, "application/json"));
                if (!r.IsSuccessStatusCode)
                {
                    Record(report, "AUTH", "Agent privileged login", "SYSTEM_PROXY",
                        StatusText((int)r.StatusCode), sw, (int)r.StatusCode);
                    return null;
                }
                json = await r.Content.ReadAsStringAsync();
                using var document = JsonDocument.Parse(json);
                var obj = document.RootElement;
                var result = new AgentTokens
                {
                    IdToken = GetString(obj, "id_token"),
                    RefreshToken = GetString(obj, "refresh_token"),
                    Expires = DateTimeOffset.UtcNow.AddMinutes(55)
                };
                if (!ValidateRole(result)) return null;
                if (!obj.TryGetProperty("user", out var resolvedUser) || resolvedUser.ValueKind != JsonValueKind.Object)
                    return null;
                var userId=GetString(resolvedUser, "user_id");
                var firebaseUid=GetString(resolvedUser, "firebase_uid");
                if (!AgentIdentityBinding.MatchesLogin(login, userId,
                    GetString(resolvedUser, "employee_code"), firebaseUid,
                    GetString(resolvedUser, "role"), GetString(resolvedUser, "base_role"),
                    AgentIdentityBinding.JwtClaim(result.IdToken, "app_user_id"),
                    AgentIdentityBinding.JwtClaim(result.IdToken, "sub"), result.Role)) return null;
                result.VerifiedLogin=login.Trim().ToLowerInvariant();
                result.VerifiedUserId=userId;
                result.VerifiedFirebaseUid=firebaseUid;
                Record(report, "AUTH", "Agent privileged login", "SYSTEM_PROXY", "AUTH_SUCCESS", sw, (int)r.StatusCode);
                return result;
            }
            if (string.IsNullOrWhiteSpace(BuildConfig.FirebaseApiKey))
            {
                Record(report, "AUTH", "Firebase Agent login", "SYSTEM_PROXY",
                    "UNAVAILABLE_BUILD_API_KEY", sw);
                return null;
            }
            foreach (var role in new[] { "PICKPACK_ADMIN", "ADMIN" })
            {
                var local = login.Trim().ToLowerInvariant();
                if (!Regex.IsMatch(local, "^[a-z0-9._-]{1,64}$")) break;
                var prefix = role == "PICKPACK_ADMIN" ? "pickpack_admin." : "admin.";
                var email = prefix + local + "@auth.supra.invalid";
                using var c = Client(true, 9000);
                var body = JsonSerializer.Serialize(new { email, password, returnSecureToken = true });
                using var r = await c.PostAsync(
                    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
                    Uri.EscapeDataString(BuildConfig.FirebaseApiKey),
                    new StringContent(body, Encoding.UTF8, "application/json"));
                if (!r.IsSuccessStatusCode) continue;
                using var doc = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
                var root = doc.RootElement;
                var result = new AgentTokens
                {
                    IdToken = GetString(root, "idToken"),
                    RefreshToken = GetString(root, "refreshToken"),
                    Expires = DateTimeOffset.UtcNow.AddMinutes(55)
                };
                if (ValidateRole(result))
                {
                    Record(report, "AUTH", "Firebase Agent login", "SYSTEM_PROXY", "AUTH_SUCCESS", sw, (int)r.StatusCode);
                    return result;
                }
            }
            Record(report, "AUTH", "Firebase Agent login", "SYSTEM_PROXY", "AUTH_REJECTED", sw);
        }
        catch (Exception ex)
        {
            Record(report, "AUTH", "Agent login", "SYSTEM_PROXY", "FAILED", sw, null, SafeFailure(ex));
        }
        return null;
    }
    private static string GetString(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var x) && x.ValueKind == JsonValueKind.String
            ? x.GetString() ?? "" : "";
    private static bool ValidateRole(AgentTokens token)
    {
        try
        {
            var pieces = token.IdToken.Split('.');
            if (pieces.Length < 2 || string.IsNullOrWhiteSpace(token.RefreshToken)) return false;
            var padded = pieces[1].Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(((padded.Length + 3) / 4) * 4, '=');
            using var doc = JsonDocument.Parse(Convert.FromBase64String(padded));
            var root = doc.RootElement;
            var role = GetString(root, "app_role");
            var baseRole = GetString(root, "app_base_role");
            var audience = GetString(root, "aud");
            if (audience != Project || role != baseRole ||
                (role != "ADMIN" && role != "PICKPACK_ADMIN")) return false;
            token.Role = role;
            return true;
        }
        catch { return false; }
    }

    internal static async Task RunAsync(DiagnosticReport report, AgentTokens? session, IProgress<string> progress)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var active = NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == OperationalStatus.Up
                    && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .Select(n => n.NetworkInterfaceType.ToString())
                .Distinct().OrderBy(x => x).ToArray();
            Record(report, "LOCAL", "Active interface types", "LOCAL",
                active.Length > 0 ? "OBSERVED" : "NO_NETWORK_INTERFACE", sw, null,
                string.Join(",", active));
        }
        catch (Exception ex) { Record(report, "LOCAL", "Interfaces", "LOCAL", "FAILED", sw, null, SafeFailure(ex)); }
        progress.Report("Kiểm tra 13 nhóm dịch vụ: DNS / TCP / TLS / HTTP trực tiếp và proxy...");
        using var throttle = new SemaphoreSlim(3);
        var tasks = Hosts.Select(async entry =>
        {
            await throttle.WaitAsync();
            try { await ProbeHost(report, entry.Category, entry.Host); }
            finally { throttle.Release(); }
        });
        await Task.WhenAll(tasks);
        progress.Report("Kiểm tra Firebase authentication / REST / RTDB SSE...");
        if (session != null)
        {
            await TestAuthenticated(report, session);
        }
        else
        {
            sw.Restart();
            Record(report, "AUTH", "Authenticated Firebase tests", "AUTH", "NOT_TESTED_NO_AGENT_SESSION", sw);
        }
        sw.Restart();
        Record(report, "QUOTA", "Real provider usage/free-tier limits", "LOCAL", "NOT_MEASURABLE_LOCALLY", sw,
            null, "Use Firebase Console billing/quota measurements; do not infer usage from HTTP probe counts.");
        sw.Restart();
        Record(report, "WRITE", "RTDB+Firestore canary writes / event-to-event ACK", "LOCAL",
            "NOT_TESTED_NO_APPROVED_ISOLATED_CANARY", sw, null, "No business document mutation.");
        sw.Restart();
        Record(report, "FCM", "PDA real push delivery", "LOCAL", "NOT_TESTED_REQUIRES_ANDROID_DEVICE", sw);
        progress.Report("Đã hoàn tất các phép thử; đang ghi báo cáo.");
    }

    private static async Task ProbeHost(DiagnosticReport report, string category, string host)
    {
        var sw = Stopwatch.StartNew();
        using var cancel = new CancellationTokenSource(4000);
        try
        {
            var addresses = await Dns.GetHostAddressesAsync(host, cancel.Token);
            Record(report, category, "DNS " + host, "SYSTEM_DNS",
                addresses.Length > 0 ? "RESOLVED" : "NO_DNS_ANSWER", sw, null,
                "addresses=" + addresses.Length);
        }
        catch (Exception ex) { Record(report, category, "DNS " + host, "SYSTEM_DNS", "FAILED", sw, null, SafeFailure(ex)); }
        sw.Restart();
        try
        {
            using var tcp = new TcpClient();
            using var cancel2 = new CancellationTokenSource(4000);
            await tcp.ConnectAsync(host, 443, cancel2.Token);
            Record(report, category, "TCP443 " + host, "DIRECT", "CONNECTED", sw);
            sw.Restart();
            using var ssl = new SslStream(tcp.GetStream(), false);
            await ssl.AuthenticateAsClientAsync(new SslClientAuthenticationOptions
            { TargetHost = host, EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13 }, cancel2.Token);
            Record(report, category, "TLS " + host, "DIRECT", "VERIFIED", sw, null,
                ssl.SslProtocol.ToString());
        }
        catch (Exception ex)
        { Record(report, category, "TCP_TLS " + host, "DIRECT", "FAILED", sw, null, SafeFailure(ex)); }
        foreach (var useProxy in new[] { false, true })
        {
            sw.Restart();
            try
            {
                using var http = Client(useProxy);
                using var resp = await http.GetAsync("https://" + host + "/",
                    HttpCompletionOption.ResponseHeadersRead);
                Record(report, category, "HTTPS " + host, useProxy ? "SYSTEM_PROXY" : "DIRECT",
                    StatusText((int)resp.StatusCode), sw, (int)resp.StatusCode);
            }
            catch (Exception ex)
            {
                Record(report, category, "HTTPS " + host, useProxy ? "SYSTEM_PROXY" : "DIRECT",
                    "FAILED", sw, null, SafeFailure(ex));
            }
        }
    }

    private static async Task TestAuthenticated(DiagnosticReport report, AgentTokens session)
    {
        await TestAuthRefresh(report, session);
        foreach (var proxy in new[] { false, true })
        {
            var route = proxy ? "SYSTEM_PROXY" : "DIRECT";
            await AuthGet(report, "FIRESTORE", "Firestore exact roles",
                FirestoreUrl + "/relay_poc_coordination/roles", proxy, session.IdToken);
            await AuthGet(report, "FIRESTORE", "Firestore exact agent_sync",
                FirestoreUrl + "/relay_poc_coordination/agent_sync", proxy, session.IdToken);
            await RtdbGet(report, proxy, session.IdToken);
            await RtdbSse(report, proxy, session.IdToken);
            await FirestoreHttp2(report, proxy, session.IdToken);
        }
    }

    private static async Task TestAuthRefresh(DiagnosticReport report, AgentTokens session)
    {
        var sw = Stopwatch.StartNew();
        if (string.IsNullOrWhiteSpace(BuildConfig.FirebaseApiKey))
        {
            Record(report, "AUTH", "Refresh ID token", "SYSTEM_PROXY", "NOT_TESTED_MISSING_API_KEY", sw);
            return;
        }
        try
        {
            using var http = Client(true, 10000);
            var form = new FormUrlEncodedContent(new Dictionary<string, string> {
                ["grant_type"] = "refresh_token", ["refresh_token"] = session.RefreshToken
            });
            using var resp = await http.PostAsync(
                "https://securetoken.googleapis.com/v1/token?key=" + Uri.EscapeDataString(BuildConfig.FirebaseApiKey), form);
            if (!resp.IsSuccessStatusCode)
            {
                Record(report, "AUTH", "Refresh ID token", "SYSTEM_PROXY",
                    StatusText((int)resp.StatusCode), sw, (int)resp.StatusCode);
                return;
            }
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            var refresh = new AgentTokens
            {
                IdToken = GetString(doc.RootElement, "id_token"),
                RefreshToken = GetString(doc.RootElement, "refresh_token"),
                Expires = DateTimeOffset.UtcNow.AddMinutes(55)
            };
            if (ValidateRole(refresh))
            {
                session.IdToken = refresh.IdToken;
                if (!string.IsNullOrWhiteSpace(refresh.RefreshToken))
                    session.RefreshToken = refresh.RefreshToken;
                session.Expires = refresh.Expires;
                Record(report, "AUTH", "Refresh ID token", "SYSTEM_PROXY",
                    "REFRESH_SUCCESS", sw, (int)resp.StatusCode);
            }
            else Record(report, "AUTH", "Refresh ID token", "SYSTEM_PROXY", "INVALID_AGENT_CLAIMS", sw);
        }
        catch (Exception ex)
        { Record(report, "AUTH", "Refresh ID token", "SYSTEM_PROXY", "FAILED", sw, null, SafeFailure(ex)); }
    }
    private static async Task AuthGet(DiagnosticReport report, string category,
        string name, string url, bool proxy, string token)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var http = Client(proxy);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + token);
            using var resp = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            Record(report, category, name, proxy ? "SYSTEM_PROXY" : "DIRECT",
                StatusText((int)resp.StatusCode), sw, (int)resp.StatusCode,
                "READ_ONLY_EXACT_DOC");
        }
        catch (Exception ex)
        { Record(report, category, name, proxy ? "SYSTEM_PROXY" : "DIRECT", "FAILED", sw, null, SafeFailure(ex)); }
    }
    private static async Task RtdbGet(DiagnosticReport report, bool proxy, string token)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var http = Client(proxy, 9000);
            var url = "https://" + RtdbHost + "/relay_poc/coordination/ha_liveness.json?auth=" +
                      Uri.EscapeDataString(token);
            using var resp = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
            Record(report, "RTDB", "Authenticated HA read", proxy ? "SYSTEM_PROXY" : "DIRECT",
                StatusText((int)resp.StatusCode), sw, (int)resp.StatusCode, "NO_VALUES_EXPORTED");
        }
        catch (Exception ex)
        { Record(report, "RTDB", "Authenticated HA read", proxy ? "SYSTEM_PROXY" : "DIRECT",
            "FAILED", sw, null, SafeFailure(ex)); }
    }
    private static async Task RtdbSse(DiagnosticReport report, bool proxy, string token)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var http = Client(proxy, 19000);
            using var req = new HttpRequestMessage(HttpMethod.Get,
                "https://" + RtdbHost + "/relay_poc/coordination/ha_liveness.json?auth=" +
                Uri.EscapeDataString(token));
            req.Headers.TryAddWithoutValidation("Accept", "text/event-stream");
            using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
            if (!resp.IsSuccessStatusCode)
            {
                Record(report, "RTDB", "SSE HA stream", proxy ? "SYSTEM_PROXY" : "DIRECT",
                    StatusText((int)resp.StatusCode), sw, (int)resp.StatusCode);
                return;
            }
            var ct = resp.Content.Headers.ContentType?.MediaType ?? "";
            if (!ct.Equals("text/event-stream", StringComparison.OrdinalIgnoreCase))
            {
                Record(report, "RTDB", "SSE HA stream", proxy ? "SYSTEM_PROXY" : "DIRECT",
                    "UNEXPECTED_CONTENT_TYPE", sw, (int)resp.StatusCode);
                return;
            }
            using var stream = await resp.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
            bool eventLine = false, dataLine = false;
            while (!timeout.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(timeout.Token);
                if (line == null) break;
                if (line.StartsWith("event:", StringComparison.Ordinal)) eventLine = true;
                if (line.StartsWith("data:", StringComparison.Ordinal)) dataLine = true;
                if (eventLine && dataLine) break;
            }
            Record(report, "RTDB", "SSE HA stream", proxy ? "SYSTEM_PROXY" : "DIRECT",
                eventLine && dataLine ? "SSE_FRAME_RECEIVED" : "SSE_CONNECTED_NO_FRAME",
                sw, (int)resp.StatusCode, "RAW_FRAME_NOT_EXPORTED");
        }
        catch (Exception ex)
        {
            Record(report, "RTDB", "SSE HA stream", proxy ? "SYSTEM_PROXY" : "DIRECT",
                SafeFailure(ex) == "TIMEOUT_OR_CANCEL" ? "SSE_NO_EVENT_12S" : "FAILED", sw,
                null, SafeFailure(ex));
        }
    }
    private static async Task FirestoreHttp2(DiagnosticReport report, bool proxy, string token)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var http = Client(proxy, 9000);
            using var req = new HttpRequestMessage(HttpMethod.Get, FirestoreUrl + "/relay_poc_coordination/roles")
            {
                Version = HttpVersion.Version20,
                VersionPolicy = HttpVersionPolicy.RequestVersionExact
            };
            req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + token);
            using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
            Record(report, "FIRESTORE", "HTTP2 preflight for gRPC", proxy ? "SYSTEM_PROXY" : "DIRECT",
                resp.Version.Major >= 2 ? "HTTP2_NEGOTIATED" : "HTTP2_NOT_NEGOTIATED",
                sw, (int)resp.StatusCode, "NOT_AN_ACTUAL_GRPC_LISTEN_SUBSCRIPTION");
        }
        catch (Exception ex)
        { Record(report, "FIRESTORE", "HTTP2 preflight for gRPC", proxy ? "SYSTEM_PROXY" : "DIRECT",
            "FAILED", sw, null, SafeFailure(ex)); }
    }
}
