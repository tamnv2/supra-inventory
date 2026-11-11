using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Panel _e199NoticePanel = new Panel { Visible = false, TabStop = false };
        private readonly List<Tuple<Label, DateTime>> _e199Notices =
            new List<Tuple<Label, DateTime>>();
        private readonly System.Windows.Forms.Timer _e199NoticeTimer =
            new System.Windows.Forms.Timer { Interval = 250 };

        private void InitE199RosterNotices(Control rosterCard)
        {
            rosterCard.Controls.Add(_e199NoticePanel);
            _e199NoticePanel.BringToFront();
            _pickerOnlineGrid.SizeChanged += (sender, args) => LayoutE199RosterNotices();
            _e199NoticeTimer.Tick += (sender, args) => RefreshE199RosterNotices();
        }

        private void NotifyD173RosterResult(string text)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(NotifyD173RosterResult), text);
                return;
            }
            _pickerOnlineStatus.Text = text ?? "";
            if (string.IsNullOrWhiteSpace(text)) return;
            var label = new Label {
                Text = text, TextAlign = ContentAlignment.MiddleLeft,
                AutoEllipsis = true, Height = 36,
                Font = new Font("Segoe UI", 9F),
                Padding = new Padding(9, 2, 9, 2),
                Margin = Padding.Empty
            };
            if (_e199Notices.Count == 5)
            {
                var oldest = _e199Notices[0].Item1;
                _e199NoticePanel.Controls.Remove(oldest);
                oldest.Dispose();
                _e199Notices.RemoveAt(0);
            }
            _e199Notices.Add(Tuple.Create(label, DateTime.UtcNow.AddSeconds(5)));
            _e199NoticePanel.Controls.Add(label);
            RefreshE199RosterNotices();
            LayoutE199RosterNotices();
            _e199NoticeTimer.Start();
        }

        private void RefreshE199RosterNotices()
        {
            if (_e199NoticePanel.IsDisposed) return;
            var now = DateTime.UtcNow;
            var expired = false;
            for (var i = _e199Notices.Count - 1; i >= 0; i--)
            {
                if (_e199Notices[i].Item2 > now) continue;
                var label = _e199Notices[i].Item1;
                _e199NoticePanel.Controls.Remove(label);
                label.Dispose();
                _e199Notices.RemoveAt(i);
                expired = true;
            }
            if (_e199Notices.Count == 0) _e199NoticeTimer.Stop();
            var visible = _e199Notices.Count > 0;
            var visibilityChanged = _e199NoticePanel.Visible != visible;
            _e199NoticePanel.Visible = visible;
            // The timer only expires notifications; never relayout at 4 Hz.
            if (expired || visibilityChanged) LayoutE199RosterNotices();
            if (!_e199NoticePanel.Visible) return;
            var dark = D173IsDarkThemeActive();
            var background = dark ? Color.FromArgb(41, 73, 99) :
                Color.FromArgb(218, 236, 246);
            var foreground = dark ? Color.FromArgb(235, 244, 253) :
                Color.FromArgb(26, 52, 75);
            foreach (var notice in _e199Notices)
            {
                var label = notice.Item1;
                if (label.BackColor != background) label.BackColor = background;
                if (label.ForeColor != foreground) label.ForeColor = foreground;
            }
        }

        private void LayoutE199RosterNotices()
        {
            if (_e199NoticePanel.IsDisposed || _e199NoticePanel.Parent == null ||
                _e199Notices.Count == 0) return;
            var width = Math.Max(180, Math.Min(390, _pickerOnlineGrid.Width - 16));
            var height = _e199Notices.Count * 40;
            var bounds = new Rectangle(
                Math.Max(0, _pickerOnlineGrid.Right - width - 8),
                Math.Max(0, _pickerOnlineGrid.Bottom - height - 8),
                width, height);
            if (_e199NoticePanel.Bounds != bounds) _e199NoticePanel.Bounds = bounds;
            for (var i = 0; i < _e199Notices.Count; i++)
            {
                var label = _e199Notices[i].Item1;
                var line = new Rectangle(0, i * 40, width, 36);
                if (label.Bounds != line) label.Bounds = line;
            }
            _e199NoticePanel.BringToFront();
        }
    }
}
