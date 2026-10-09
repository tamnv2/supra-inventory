using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SupraSkuRecorder
{
    internal sealed partial class RecorderForm
    {
        private async Task Hook(WebView2 view)
        {
            var core = view.CoreWebView2;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.NavigationStarting += (s, e) =>
            {
                Uri uri;
                if (!ScopedUrl(e.Uri, out uri))
                {
                    e.Cancel = true;
                    Log("NAVIGATION_BLOCKED", "unscoped", "non_allowlisted");
                    return;
                }
                Log("NAVIGATION_START", HostAlias(uri), RouteAlias(uri));
            };
            core.NavigationCompleted += (s, e) =>
                Log(e.IsSuccess ? "NAVIGATION_DONE" : "NAVIGATION_FAILED",
                    "page", e.IsSuccess ? "completed" : "webview_error",
                    e.IsSuccess ? 0 : (int)e.WebErrorStatus);

            core.WebMessageReceived += (s, e) => AcceptMessage(e);
            core.DownloadStarting += (s, e) =>
            {
                var op = e.DownloadOperation;
                var extension = SafeExtension(op.ResultFilePath);
                Log("DOWNLOAD_STARTED", extension, "webview2");
                op.StateChanged += (sender, args) =>
                {
                    if (op.State == CoreWebView2DownloadState.Completed)
                    {
                        Log("DOWNLOAD_COMPLETED", extension, "local_file_only",
                            Math.Max(0L, op.BytesReceived));
                        if (extension == "xlsx")
                            CaptureDownloadCompletion(op.ResultFilePath, true);
                    }
                    if (op.State == CoreWebView2DownloadState.Interrupted)
                    {
                        Log("DOWNLOAD_INTERRUPTED", extension, "browser_error",
                            Math.Max(0L, op.BytesReceived));
                        CaptureDownloadCompletion(op.ResultFilePath, false);
                    }
                };
            };
            core.NewWindowRequested += async (s, e) =>
            {
                var deferral = e.GetDeferral();
                try
                {
                    Uri destination;
                    if (!ScopedUrl(e.Uri, out destination))
                    {
                        e.Handled = true;
                        Log("POPUP_BLOCKED", "unscoped", "non_allowlisted");
                        return;
                    }
                    var popup = new Form
                    {
                        Text = "SKU Recorder — cửa sổ phụ",
                        Width = 1080, Height = 760
                    };
                    var child = new WebView2 { Dock = DockStyle.Fill };
                    popup.Controls.Add(child);
                    await child.EnsureCoreWebView2Async(environment);
                    await Hook(child);
                    e.NewWindow = child.CoreWebView2;
                    e.Handled = true;
                    popup.FormClosed += (sender, args) =>
                    {
                        popups.Remove(popup);
                        child.Dispose();
                    };
                    popups.Add(popup);
                    popup.Show(this);
                    Log("POPUP_OPEN", HostAlias(destination), "manual_browser");
                }
                catch
                {
                    e.Handled = true;
                    Log("POPUP_FAILED", "webview2", "unavailable");
                }
                finally { deferral.Complete(); }
            };
            core.ProcessFailed += (s, e) =>
                Log("WEBVIEW_PROCESS_FAILED", "webview2", "process_error");
            await core.AddScriptToExecuteOnDocumentCreatedAsync(RecorderScript.Value);
        }

        private void AcceptMessage(CoreWebView2WebMessageReceivedEventArgs args)
        {
            Uri source;
            if (!ScopedUrl(args.Source, out source)) return;
            try
            {
                var raw = args.TryGetWebMessageAsString();
                if (raw == null || raw.Length > 350) return;
                using (var json = JsonDocument.Parse(raw))
                {
                    var root = json.RootElement;
                    if (root.ValueKind != JsonValueKind.Object) return;
                    string kind = Property(root, "kind");
                    string code = Property(root, "code");
                    if (kind == "ui" && new[] { "SKU_SYNC", "DOWNLOAD", "EXPORT",
                        "UPLOAD", "IMPORT", "FILE_SELECT", "NEXT", "SUBMIT",
                        "SAVE", "REFRESH", "SEARCH" }.Contains(code))
                    {
                        Log("UI_ACTION", HostAlias(source), code);
                    }
                    else if (kind == "trace")
                    {
                        var signature = Property(root, "ext");
                        long index = -1;
                        JsonElement field;
                        if (root.TryGetProperty("size", out field) &&
                            field.ValueKind == JsonValueKind.Number)
                            field.TryGetInt64(out index);
                        if (index >= 0 && index < 160 &&
                            new[] { "sync", "excel", "download", "export",
                                "search", "confirm", "other" }.Contains(code) &&
                            System.Text.RegularExpressions.Regex.IsMatch(signature,
                                "^(button|a|div|span)_[0-9a-f]{8}$"))
                            Log("UI_CLICK_TRACE", code, signature, index);
                    }
                    else if (kind == "file" && code == "UPLOAD_SELECTED")
                    {
                        var ext = Property(root, "ext");
                        if (!new[] { "xlsx", "xls", "csv", "zip", "other" }.Contains(ext)) return;
                        long size = 0;
                        JsonElement field;
                        if (root.TryGetProperty("size", out field) &&
                            field.ValueKind == JsonValueKind.Number)
                            field.TryGetInt64(out size);
                        Log("UPLOAD_FILE_SELECTED", ext, "ui_only_unverified",
                            Math.Min(Math.Max(0L, size), 1000000000));
                    }
                }
            }
            catch { Log("UI_EVENT_REJECTED", "parser", "invalid"); }
        }

        private static string Property(JsonElement value, string key)
        {
            JsonElement element;
            return value.TryGetProperty(key, out element) &&
                element.ValueKind == JsonValueKind.String
                    ? (element.GetString() ?? "") : "";
        }

        private static bool ScopedUrl(string text, out Uri uri)
        {
            uri = null;
            if (string.Equals(text, "about:blank", StringComparison.OrdinalIgnoreCase)) return true;
            if (!Uri.TryCreate(text, UriKind.Absolute, out uri)) return false;
            if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                return false;
            return string.Equals(uri.Host, WmsHost, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(uri.Host, AuthHost, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(uri.Host, InventoryHost, StringComparison.OrdinalIgnoreCase);
        }

        private static string HostAlias(Uri uri)
        {
            if (uri == null) return "blank";
            if (string.Equals(uri.Host, WmsHost, StringComparison.OrdinalIgnoreCase))
                return "supra_wms";
            if (string.Equals(uri.Host, AuthHost, StringComparison.OrdinalIgnoreCase))
                return "supra_auth";
            if (string.Equals(uri.Host, InventoryHost, StringComparison.OrdinalIgnoreCase))
                return "inventory_beta";
            return "blank";
        }

        private static string RouteAlias(Uri uri)
        {
            if (uri == null) return "blank";
            var path = uri.AbsolutePath.Trim('/').ToLowerInvariant();
            if (path.Length == 0) return "root";
            if (path == "dashboard" || path == "sft3/app/dashboard") return "dashboard";
            if (path == "sft3/app/saleorder/auto-pickpack-confirm") return "confirm_ui";
            using (var sha = SHA256.Create())
            {
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(path));
                return "route_" + BitConverter.ToString(bytes, 0, 6)
                    .Replace("-", "").ToLowerInvariant();
            }
        }

        private static string SafeExtension(string path)
        {
            var ext = Path.GetExtension(path ?? "").TrimStart('.').ToLowerInvariant();
            return new[] { "xlsx", "xls", "csv", "zip" }.Contains(ext) ? ext : "other";
        }
    }
}
