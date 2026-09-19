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
        internal double Opacity = 0.78;
        internal bool Locked = true;
        internal bool Visible = true;
    }

    internal sealed class StatusOverlayForm : Form
    {
        private const int GwlExStyle = -20;
        private const int WsExTransparent = 0x00000020;
        private const int WsExLayered = 0x00080000;
        private const int WsExToolWindow = 0x00000080;
        private const int WsExNoActivate = 0x08000000;

        private readonly Label _text = new Label();
        private readonly OverlaySettings _settings;
        private readonly string _settingsPath;
        private bool _dragging;
        private Point _dragOrigin;
        private Point _windowOrigin;

        internal event Action SettingsChanged;

        internal StatusOverlayForm(OverlaySettings settings, string settingsPath)
        {
            _settings = settings ?? new OverlaySettings();
            _settingsPath = settingsPath;

            Text = "SUPRA Status Overlay";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Width = 365;
            Height = 42;
            BackColor = Color.FromArgb(28, 35, 43);
            Opacity = ClampOpacity(_settings.Opacity);
            Padding = new Padding(10, 6, 10, 6);

            _text.Dock = DockStyle.Fill;
            _text.TextAlign = ContentAlignment.MiddleLeft;
            _text.AutoEllipsis = true;
            _text.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            _text.ForeColor = Color.White;
            _text.Text = "SUPRA | đang đọc tài nguyên máy";
            Controls.Add(_text);

            MouseDown += BeginDrag;
            MouseMove += ContinueDrag;
            MouseUp += EndDrag;
            _text.MouseDown += BeginDrag;
            _text.MouseMove += ContinueDrag;
            _text.MouseUp += EndDrag;

            ApplySavedPosition();
            Shown += (s, e) =>
            {
                ApplyInteractionMode();
                if (_settings.Locked) SendToPinnedState();
            };
        }

        protected override bool ShowWithoutActivation
        {
            get { return _settings.Locked; }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WsExLayered | WsExToolWindow;
                if (_settings.Locked)
                    cp.ExStyle |= WsExTransparent | WsExNoActivate;
                return cp;
            }
        }

        protected override void WndProc(ref Message m)
        {
            const int WmNcHitTest = 0x0084;
            const int HtTransparent = -1;
            if (_settings.Locked && m.Msg == WmNcHitTest)
            {
                m.Result = new IntPtr(HtTransparent);
                return;
            }
            base.WndProc(ref m);
        }

        internal bool IsLocked
        {
            get { return _settings.Locked; }
        }

        internal bool OverlayVisible
        {
            get { return _settings.Visible; }
        }

        internal double OverlayOpacity
        {
            get { return _settings.Opacity; }
        }

        internal void UpdateText(string value)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(UpdateText), value);
                return;
            }
            _text.Text = string.IsNullOrWhiteSpace(value) ? "SUPRA" : value;
        }

        internal void SetLocked(bool locked)
        {
            if (_settings.Locked == locked) return;
            _settings.Locked = locked;
            _dragging = false;
            ApplyInteractionMode();
            Persist();
        }

        internal void SetOverlayOpacity(double value)
        {
            _settings.Opacity = ClampOpacity(value);
            Opacity = _settings.Opacity;
            Persist();
        }

        internal void SetOverlayVisible(bool visible)
        {
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
                if (map.TryGetValue("opacity", out value)) result.Opacity = ClampOpacity(Convert.ToDouble(value));
                if (map.TryGetValue("locked", out value)) result.Locked = Convert.ToBoolean(value);
                if (map.TryGetValue("visible", out value)) result.Visible = Convert.ToBoolean(value);
                return result;
            }
            catch
            {
                return new OverlaySettings();
            }
        }

        private void ApplySavedPosition()
        {
            if (_settings.Left != int.MinValue && _settings.Top != int.MinValue)
            {
                Location = ClampToScreens(new Point(_settings.Left, _settings.Top), Size);
                return;
            }

            var area = Screen.PrimaryScreen == null
                ? new Rectangle(0, 0, 1280, 720)
                : Screen.PrimaryScreen.WorkingArea;
            Location = new Point(
                Math.Max(area.Left, area.Right - Width - 12),
                Math.Max(area.Top, area.Bottom - Height - 12));
        }

        private void ApplyInteractionMode()
        {
            TopMost = true;
            _text.TextAlign = ContentAlignment.MiddleLeft;
            Cursor = _settings.Locked ? Cursors.Default : Cursors.SizeAll;
            BackColor = _settings.Locked ? Color.FromArgb(28, 35, 43) : Color.FromArgb(48, 63, 78);
            ApplyClickThroughStyle();
            SendToPinnedState();
        }

        private void ApplyClickThroughStyle()
        {
            if (!IsHandleCreated) return;
            try
            {
                var style = NativeMethods.GetWindowExStyle(Handle);
                style |= WsExLayered | WsExToolWindow;
                if (_settings.Locked)
                    style |= WsExTransparent | WsExNoActivate;
                else
                    style &= ~(WsExTransparent | WsExNoActivate);

                NativeMethods.SetWindowExStyle(Handle, style);
            }
            catch { }
        }

        private void SendToPinnedState()
        {
            if (!Visible) return;
            TopMost = true;
            if (_settings.Locked)
            {
                try
                {
                    NativeMethods.SetWindowPos(
                        Handle,
                        NativeMethods.HwndTopmost,
                        Left,
                        Top,
                        Width,
                        Height,
                        NativeMethods.SwpNoActivate | NativeMethods.SwpShowWindow);
                }
                catch { }
            }
        }

        private void BeginDrag(object sender, MouseEventArgs e)
        {
            if (_settings.Locked || e.Button != MouseButtons.Left) return;
            _dragging = true;
            _dragOrigin = Cursor.Position;
            _windowOrigin = Location;
        }

        private void ContinueDrag(object sender, MouseEventArgs e)
        {
            if (!_dragging || _settings.Locked) return;
            var now = Cursor.Position;
            var next = new Point(
                _windowOrigin.X + (now.X - _dragOrigin.X),
                _windowOrigin.Y + (now.Y - _dragOrigin.Y));
            Location = ClampToScreens(next, Size);
        }

        private void EndDrag(object sender, MouseEventArgs e)
        {
            if (!_dragging) return;
            _dragging = false;
            _settings.Left = Left;
            _settings.Top = Top;
            Persist();
        }

        private void Persist()
        {
            _settings.Left = Left;
            _settings.Top = Top;
            try
            {
                var dir = Path.GetDirectoryName(_settingsPath);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                var payload = new Dictionary<string, object>
                {
                    { "left", _settings.Left },
                    { "top", _settings.Top },
                    { "opacity", _settings.Opacity },
                    { "locked", _settings.Locked },
                    { "visible", _settings.Visible }
                };
                File.WriteAllText(_settingsPath, new JavaScriptSerializer().Serialize(payload));
            }
            catch { }

            var handler = SettingsChanged;
            if (handler != null) handler();
        }

        private static double ClampOpacity(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return 0.78;
            return Math.Max(0.35, Math.Min(1.0, value));
        }

        private static Point ClampToScreens(Point point, Size size)
        {
            foreach (var screen in Screen.AllScreens)
            {
                var area = screen.WorkingArea;
                var candidate = new Rectangle(point, size);
                if (area.IntersectsWith(candidate))
                {
                    return new Point(
                        Math.Max(area.Left, Math.Min(point.X, area.Right - size.Width)),
                        Math.Max(area.Top, Math.Min(point.Y, area.Bottom - size.Height)));
                }
            }

            var fallback = Screen.PrimaryScreen == null
                ? new Rectangle(0, 0, 1280, 720)
                : Screen.PrimaryScreen.WorkingArea;
            return new Point(
                Math.Max(fallback.Left, fallback.Right - size.Width - 12),
                Math.Max(fallback.Top, fallback.Bottom - size.Height - 12));
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

            internal static int GetWindowExStyle(IntPtr hWnd)
            {
                return IntPtr.Size == 8
                    ? unchecked((int)GetWindowLongPtr64(hWnd, GwlExStyle).ToInt64())
                    : GetWindowLong32(hWnd, GwlExStyle);
            }

            internal static void SetWindowExStyle(IntPtr hWnd, int style)
            {
                if (IntPtr.Size == 8)
                    SetWindowLongPtr64(hWnd, GwlExStyle, new IntPtr(style));
                else
                    SetWindowLong32(hWnd, GwlExStyle, style);
            }

            [DllImport("user32.dll", SetLastError = true)]
            internal static extern bool SetWindowPos(
                IntPtr hWnd,
                IntPtr hWndInsertAfter,
                int x,
                int y,
                int cx,
                int cy,
                uint flags);
        }
    }
}
