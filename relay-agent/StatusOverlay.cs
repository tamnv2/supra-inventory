using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed class OverlaySettings
    {
        internal int Left = int.MinValue;
        internal int Top = int.MinValue;
        internal int Width = 720;
        internal int Height = 70;
        internal int BackgroundArgb = Color.FromArgb(28, 35, 43).ToArgb();
        internal int TextArgb = Color.White.ToArgb();
        internal double Opacity = 0.78;
        internal bool Locked = true;
        internal bool Visible = true;
        internal bool ShowLaptopGroup = true;
        internal bool ShowCpu = true;
        internal bool ShowMemory = true;
        internal bool ShowDisk = true;
        internal bool ShowNetwork = true;
        internal bool ShowInternet = true;
        internal bool ShowGpu = true;
        internal bool ShowAgentGroup = true;
        internal bool ShowAgentOnline = true;
        internal bool ShowAgentState = true;
        internal bool ShowPdaRequests = true;
        internal bool ShowAgentResponses = true;
        internal bool ShowWmsSession = true;
    }

    internal sealed class StatusOverlayForm : Form
    {
        private const int WsExLayered = 0x80000;
        private const int WsExTransparent = 0x00000020;
        private const int WsExToolWindow = 0x80;
        private const int WsExNoActivate = 0x08000000;
        private const int GwlExStyle = -20;
        private const int WmNcHitTest = 0x0084;
        private const int HtTransparent = -1;
        private const int HtLeft = 10;
        private const int HtRight = 11;
        private const int HtTop = 12;
        private const int HtTopLeft = 13;
        private const int HtTopRight = 14;
        private const int HtBottom = 15;
        private const int HtBottomLeft = 16;
        private const int HtBottomRight = 17;
        private const int ResizeGrip = 9;

        private readonly Label _laptopText = new Label();
        private readonly Label _agentText = new Label();
        private static readonly Color TransparencyColor = Color.FromArgb(1, 2, 3);
        private readonly FlowLayoutPanel _metricFlow = new FlowLayoutPanel();
        private readonly Form _backgroundLayer = new Form();
        private OverlaySettings _settings;
        private string _settingsPath;
        private bool _dragging;
        private Point _dragOrigin;
        private Point _windowOrigin;

        internal event Action SettingsChanged;

        internal StatusOverlayForm(OverlaySettings settings, string settingsPath)
        {
            _settings = settings ?? new OverlaySettings();
            _settingsPath = settingsPath ?? "";

            Text = "Agent Auto Confirm Pick Pack - Overlay";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            MinimumSize = new Size(120, 32);
            MaximumSize = Size.Empty;
            Width = ClampWidth(_settings.Width);
            Height = ClampHeight(_settings.Height);
            BackColor = TransparencyColor;
            TransparencyKey = TransparencyColor;
            Opacity = 1.0;

            _backgroundLayer.FormBorderStyle = FormBorderStyle.None;
            _backgroundLayer.ShowInTaskbar = false;
            _backgroundLayer.TopMost = true;
            _backgroundLayer.StartPosition = FormStartPosition.Manual;
            _backgroundLayer.BackColor = OverlayBackgroundColor;
            _backgroundLayer.Opacity = ClampOpacity(_settings.Opacity);
            Padding = new Padding(10, 6, 10, 6);

            _laptopText.TextAlign = ContentAlignment.MiddleLeft;
            _laptopText.AutoEllipsis = true;
            _laptopText.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            _laptopText.Text = "Vận hành | đang đọc trạng thái";
            Controls.Add(_laptopText);

            _agentText.TextAlign = ContentAlignment.MiddleLeft;
            _agentText.AutoEllipsis = true;
            _agentText.Font = new Font("Segoe UI", 9F);
            _agentText.Text = "Agent | đang đọc tải tiến trình";
            Controls.Add(_agentText);
            _laptopText.Visible = false;
            _agentText.Visible = false;

            _metricFlow.FlowDirection = FlowDirection.LeftToRight;
            _metricFlow.WrapContents = true;
            _metricFlow.AutoScroll = true;
            _metricFlow.BackColor = TransparencyColor;
            _metricFlow.Margin = Padding.Empty;
            _metricFlow.Padding = Padding.Empty;
            Controls.Add(_metricFlow);

            foreach (Control control in new Control[] { this, _metricFlow })
            {
                control.MouseDown += BeginDrag;
                control.MouseMove += ContinueDrag;
                control.MouseUp += EndDrag;
            }

            Resize += (s, e) => LayoutLabels();
            ResizeEnd += (s, e) =>
            {
                if (IsLocked) return;
                if (_settings == null) _settings = new OverlaySettings();
                _settings.Width = Width;
                _settings.Height = Height;
                Persist();
            };

            LayoutLabels();
            ApplySavedPosition();
            ApplyVisualSettings();
            Shown += (s, e) =>
            {
                ApplyInteractionMode();
                if (IsLocked) SendToPinnedState();
            };
        }

        protected override bool ShowWithoutActivation
        {
            get { return _settings != null && _settings.Locked; }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WsExLayered | WsExToolWindow | WsExNoActivate;
                if (_settings != null && _settings.Locked) cp.ExStyle |= WsExTransparent;
                return cp;
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (_settings != null && m.Msg == WmNcHitTest)
            {
                if (_settings.Locked)
                {
                    m.Result = new IntPtr(HtTransparent);
                    return;
                }

                var point = PointToClient(Cursor.Position);
                var left = point.X <= ResizeGrip;
                var right = point.X >= ClientSize.Width - ResizeGrip;
                var top = point.Y <= ResizeGrip;
                var bottom = point.Y >= ClientSize.Height - ResizeGrip;

                if (left && top) { m.Result = new IntPtr(HtTopLeft); return; }
                if (right && top) { m.Result = new IntPtr(HtTopRight); return; }
                if (left && bottom) { m.Result = new IntPtr(HtBottomLeft); return; }
                if (right && bottom) { m.Result = new IntPtr(HtBottomRight); return; }
                if (left) { m.Result = new IntPtr(HtLeft); return; }
                if (right) { m.Result = new IntPtr(HtRight); return; }
                if (top) { m.Result = new IntPtr(HtTop); return; }
                if (bottom) { m.Result = new IntPtr(HtBottom); return; }
            }
            base.WndProc(ref m);
        }

        internal bool IsLocked { get { return _settings != null && _settings.Locked; } }
        internal bool OverlayVisible { get { return _settings == null || _settings.Visible; } }
        internal double OverlayOpacity { get { return _settings == null ? 0.78 : _settings.Opacity; } }
        internal int OverlayWidth { get { return Width; } }
        internal int OverlayHeight { get { return Height; } }
        internal Color OverlayBackgroundColor { get { return SafeColor(_settings == null ? 0 : _settings.BackgroundArgb, Color.FromArgb(28, 35, 43)); } }
        internal Color OverlayTextColor { get { return SafeColor(_settings == null ? 0 : _settings.TextArgb, Color.White); } }
        internal OverlaySettings DisplaySettings { get { return _settings ?? (_settings = new OverlaySettings()); } }

        internal void SaveDisplaySettings()
        {
            Persist();
        }

        internal void UpdateMetrics(string laptopLine, string agentLine)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string, string>(UpdateMetrics), laptopLine, agentLine);
                return;
            }
            _laptopText.Text = laptopLine ?? "";
            _agentText.Text = agentLine ?? "";
            RenderMetricTiles(laptopLine, agentLine);
            LayoutLabels();
        }

        internal void UpdateText(string value)
        {
            UpdateMetrics(value, _agentText == null ? "Agent | --" : _agentText.Text);
        }

        internal void SetLocked(bool locked)
        {
            if (_settings == null) _settings = new OverlaySettings();
            if (_settings.Locked == locked) return;
            _settings.Locked = locked;
            _dragging = false;
            ApplyInteractionMode();
            Persist();
        }

        internal void SetOverlayOpacity(double value)
        {
            if (_settings == null) _settings = new OverlaySettings();
            _settings.Opacity = ClampOpacity(value);
            Opacity = _settings.Opacity;
            Persist();
        }

        internal void SetOverlaySize(int width, int height)
        {
            if (IsLocked) return;
            Width = ClampWidth(width);
            Height = ClampHeight(height);
            if (_settings == null) _settings = new OverlaySettings();
            _settings.Width = Width;
            _settings.Height = Height;
            LayoutLabels();
            Persist();
        }

        internal void SetBackgroundColor(Color color)
        {
            if (_settings == null) _settings = new OverlaySettings();
            _settings.BackgroundArgb = color.ToArgb();
            ApplyVisualSettings();
            Persist();
        }

        internal void SetTextColor(Color color)
        {
            if (_settings == null) _settings = new OverlaySettings();
            _settings.TextArgb = color.ToArgb();
            ApplyVisualSettings();
            Persist();
        }

        internal void SetOverlayVisible(bool visible)
        {
            if (_settings == null) _settings = new OverlaySettings();
            _settings.Visible = visible;
            if (visible)
            {
                if (!Visible) Show();
                TopMost = true;
                SendToPinnedState();
            }
            else
            {
                Hide();
            }
            Persist();
        }

        internal static OverlaySettings LoadSettings(string path)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return new OverlaySettings();
                var raw = File.ReadAllText(path);
                var map = new JavaScriptSerializer().DeserializeObject(raw) as Dictionary<string, object>;
                if (map == null) return new OverlaySettings();

                var result = new OverlaySettings();
                object value;
                if (map.TryGetValue("left", out value)) result.Left = Convert.ToInt32(value);
                if (map.TryGetValue("top", out value)) result.Top = Convert.ToInt32(value);
                if (map.TryGetValue("width", out value)) result.Width = ClampWidth(Convert.ToInt32(value));
                if (map.TryGetValue("height", out value)) result.Height = ClampHeight(Convert.ToInt32(value));
                if (map.TryGetValue("background_argb", out value)) result.BackgroundArgb = Convert.ToInt32(value);
                if (map.TryGetValue("text_argb", out value)) result.TextArgb = Convert.ToInt32(value);
                if (map.TryGetValue("opacity", out value)) result.Opacity = ClampOpacity(Convert.ToDouble(value));
                if (map.TryGetValue("locked", out value)) result.Locked = Convert.ToBoolean(value);
                if (map.TryGetValue("visible", out value)) result.Visible = Convert.ToBoolean(value);
                if (map.TryGetValue("show_laptop_group", out value)) result.ShowLaptopGroup = Convert.ToBoolean(value);
                if (map.TryGetValue("show_cpu", out value)) result.ShowCpu = Convert.ToBoolean(value);
                if (map.TryGetValue("show_memory", out value)) result.ShowMemory = Convert.ToBoolean(value);
                if (map.TryGetValue("show_disk", out value)) result.ShowDisk = Convert.ToBoolean(value);
                if (map.TryGetValue("show_network", out value)) result.ShowNetwork = Convert.ToBoolean(value);
                if (map.TryGetValue("show_internet", out value)) result.ShowInternet = Convert.ToBoolean(value);
                if (map.TryGetValue("show_gpu", out value)) result.ShowGpu = Convert.ToBoolean(value);
                if (map.TryGetValue("show_agent_group", out value)) result.ShowAgentGroup = Convert.ToBoolean(value);
                if (map.TryGetValue("show_agent_online", out value)) result.ShowAgentOnline = Convert.ToBoolean(value);
                if (map.TryGetValue("show_agent_state", out value)) result.ShowAgentState = Convert.ToBoolean(value);
                if (map.TryGetValue("show_pda_requests", out value)) result.ShowPdaRequests = Convert.ToBoolean(value);
                if (map.TryGetValue("show_agent_responses", out value)) result.ShowAgentResponses = Convert.ToBoolean(value);
                if (map.TryGetValue("show_wms_session", out value)) result.ShowWmsSession = Convert.ToBoolean(value);
                return result;
            }
            catch
            {
                return new OverlaySettings();
            }
        }

        private void LayoutLabels()
        {
            _metricFlow.SetBounds(8, 6, Math.Max(100, ClientSize.Width - 16), Math.Max(32, ClientSize.Height - 12));
        }

        private void RenderMetricTiles(string laptopLine, string agentLine)
        {
            var values = new List<string>();
            AppendMetricParts(values, laptopLine);
            AppendMetricParts(values, agentLine);
            _metricFlow.SuspendLayout();
            try
            {
                _metricFlow.Controls.Clear();
                foreach (var value in values)
                {
                    var tile = new Label
                    {
                        AutoSize = true,
                        MinimumSize = new Size(108, 27),
                        MaximumSize = new Size(300, 54),
                        Margin = new Padding(3),
                        Padding = new Padding(8, 5, 8, 5),
                        Text = value,
                        TextAlign = ContentAlignment.MiddleCenter,
                        BorderStyle = BorderStyle.FixedSingle,
                        BackColor = Blend(OverlayBackgroundColor, Color.White, 0.12),
                        ForeColor = OverlayTextColor,
                        Font = new Font("Segoe UI", 8.5F, FontStyle.Bold)
                    };
                    _metricFlow.Controls.Add(tile);
                }
            }
            finally
            {
                _metricFlow.ResumeLayout(true);
            }
        }

        private static void AppendMetricParts(List<string> target, string line)
        {
            if (target == null || string.IsNullOrWhiteSpace(line)) return;
            var parts = line.Split('|');
            for (var i = 0; i < parts.Length; i++)
            {
                var value = (parts[i] ?? "").Trim();
                if (value.Length == 0) continue;
                if (i == 0 && (string.Equals(value, "Vận hành", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(value, "Agent", StringComparison.OrdinalIgnoreCase)))
                    continue;
                target.Add(value);
            }
        }

        private static Color Blend(Color background, Color foreground, double foregroundRatio)
        {
            foregroundRatio = Math.Max(0.0, Math.Min(1.0, foregroundRatio));
            return Color.FromArgb(
                255,
                (int)Math.Round(background.R * (1.0 - foregroundRatio) + foreground.R * foregroundRatio),
                (int)Math.Round(background.G * (1.0 - foregroundRatio) + foreground.G * foregroundRatio),
                (int)Math.Round(background.B * (1.0 - foregroundRatio) + foreground.B * foregroundRatio));
        }

        private void ApplySavedPosition()
        {
            if (_settings != null && _settings.Left != int.MinValue && _settings.Top != int.MinValue)
            {
                Location = ClampToScreens(new Point(_settings.Left, _settings.Top), Size);
                return;
            }
            var area = Screen.PrimaryScreen == null ? new Rectangle(0, 0, 1280, 720) : Screen.PrimaryScreen.WorkingArea;
            Location = new Point(Math.Max(area.Left, area.Right - Width - 12), Math.Max(area.Top, area.Bottom - Height - 12));
        }

        private void ApplyVisualSettings()
        {
            BackColor = OverlayBackgroundColor;
            var text = OverlayTextColor;
            _laptopText.ForeColor = text;
            _agentText.ForeColor = text;
            foreach (Control control in _metricFlow.Controls)
            {
                control.ForeColor = text;
                control.BackColor = Blend(OverlayBackgroundColor, Color.White, 0.12);
            }
        }

        private void ApplyInteractionMode()
        {
            TopMost = true;
            Cursor = IsLocked ? Cursors.Default : Cursors.SizeAll;
            ApplyVisualSettings();
            ApplyExtendedClickThrough();
            SendToPinnedState();
        }

        private void ApplyExtendedClickThrough()
        {
            if (!IsHandleCreated) return;
            try
            {
                var style = NativeMethods.GetExtendedStyle(Handle);
                var next = IsLocked ? style | WsExTransparent | WsExNoActivate : style & ~WsExTransparent;
                if (next != style) NativeMethods.SetExtendedStyle(Handle, next);
            }
            catch { }
        }

        private void SendToPinnedState()
        {
            if (!Visible) return;
            TopMost = true;
            if (!IsLocked) return;
            try
            {
                NativeMethods.SetWindowPos(
                    Handle, NativeMethods.HwndTopmost, Left, Top, Width, Height,
                    NativeMethods.SwpNoActivate | NativeMethods.SwpShowWindow);
            }
            catch { }
        }

        private void BeginDrag(object sender, MouseEventArgs e)
        {
            if (IsLocked || e.Button != MouseButtons.Left) return;
            var p = PointToClient(Cursor.Position);
            if (p.X <= ResizeGrip || p.X >= ClientSize.Width - ResizeGrip || p.Y <= ResizeGrip || p.Y >= ClientSize.Height - ResizeGrip) return;
            _dragging = true;
            _dragOrigin = Cursor.Position;
            _windowOrigin = Location;
        }

        private void ContinueDrag(object sender, MouseEventArgs e)
        {
            if (!_dragging || IsLocked) return;
            var now = Cursor.Position;
            Location = ClampToScreens(new Point(_windowOrigin.X + now.X - _dragOrigin.X, _windowOrigin.Y + now.Y - _dragOrigin.Y), Size);
        }

        private void EndDrag(object sender, MouseEventArgs e)
        {
            if (!_dragging) return;
            _dragging = false;
            Persist();
        }

        private void Persist()
        {
            if (_settings == null) _settings = new OverlaySettings();
            _settings.Left = Left;
            _settings.Top = Top;
            _settings.Width = Width;
            _settings.Height = Height;
            try
            {
                var dir = Path.GetDirectoryName(_settingsPath);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                var payload = new Dictionary<string, object>
                {
                    { "left", _settings.Left },
                    { "top", _settings.Top },
                    { "width", _settings.Width },
                    { "height", _settings.Height },
                    { "background_argb", _settings.BackgroundArgb },
                    { "text_argb", _settings.TextArgb },
                    { "opacity", _settings.Opacity },
                    { "locked", _settings.Locked },
                    { "visible", _settings.Visible },
                    { "show_laptop_group", _settings.ShowLaptopGroup },
                    { "show_cpu", _settings.ShowCpu },
                    { "show_memory", _settings.ShowMemory },
                    { "show_disk", _settings.ShowDisk },
                    { "show_network", _settings.ShowNetwork },
                    { "show_internet", _settings.ShowInternet },
                    { "show_gpu", _settings.ShowGpu },
                    { "show_agent_group", _settings.ShowAgentGroup },
                    { "show_agent_online", _settings.ShowAgentOnline },
                    { "show_agent_state", _settings.ShowAgentState },
                    { "show_pda_requests", _settings.ShowPdaRequests },
                    { "show_agent_responses", _settings.ShowAgentResponses },
                    { "show_wms_session", _settings.ShowWmsSession }
                };
                File.WriteAllText(_settingsPath, new JavaScriptSerializer().Serialize(payload));
            }
            catch { }
            var handler = SettingsChanged;
            if (handler != null) handler();
        }

        private static int ClampWidth(int value) { return Math.Max(120, Math.Min(7680, value <= 0 ? 720 : value)); }
        private static int ClampHeight(int value) { return Math.Max(32, Math.Min(4320, value <= 0 ? 70 : value)); }
        private static double ClampOpacity(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return 0.78;
            return Math.Max(0.35, Math.Min(1.0, value));
        }
        private static Color SafeColor(int argb, Color fallback)
        {
            try { return argb == 0 ? fallback : Color.FromArgb(argb); } catch { return fallback; }
        }

        private static Point ClampToScreens(Point point, Size size)
        {
            foreach (var screen in Screen.AllScreens)
            {
                var area = screen.WorkingArea;
                var candidate = new Rectangle(point, size);
                if (area.IntersectsWith(candidate))
                    return new Point(Math.Max(area.Left, Math.Min(point.X, area.Right - size.Width)), Math.Max(area.Top, Math.Min(point.Y, area.Bottom - size.Height)));
            }
            var fallback = Screen.PrimaryScreen == null ? new Rectangle(0, 0, 1280, 720) : Screen.PrimaryScreen.WorkingArea;
            return new Point(Math.Max(fallback.Left, fallback.Right - size.Width - 12), Math.Max(fallback.Top, fallback.Bottom - size.Height - 12));
        }

        private static class NativeMethods
        {
            internal static readonly IntPtr HwndTopmost = new IntPtr(-1);
            internal const uint SwpNoActivate = 0x0010;
            internal const uint SwpShowWindow = 0x0040;

            [DllImport("user32.dll", EntryPoint = "GetWindowLong", SetLastError = true)]
            private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);
            [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr", SetLastError = true)]
            private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);
            [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
            private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);
            [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
            private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

            internal static int GetExtendedStyle(IntPtr hWnd)
            {
                return IntPtr.Size == 8 ? unchecked((int)GetWindowLongPtr64(hWnd, GwlExStyle).ToInt64()) : GetWindowLong32(hWnd, GwlExStyle);
            }
            internal static void SetExtendedStyle(IntPtr hWnd, int style)
            {
                if (IntPtr.Size == 8) SetWindowLongPtr64(hWnd, GwlExStyle, new IntPtr(style));
                else SetWindowLong32(hWnd, GwlExStyle, style);
            }

            [DllImport("user32.dll", SetLastError = true)]
            internal static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
        }
    }
}
