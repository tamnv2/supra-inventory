using System;
using System.Drawing;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // Mouse-wheel events in WinForms are normally delivered to the focused control.
    // Route them to the smallest scrollable control under the actual pointer, and
    // pass unconsumed movement up to its scrollable ancestors.
    internal sealed class D173E075UsageWheelRouter : IMessageFilter
    {
        private readonly Control _page;
        private readonly ScrollableControl _outer;
        private readonly Func<bool> _enabled;
        internal D173E075UsageWheelRouter(Control page, ScrollableControl outer,
            Func<bool> enabled)
        {
            _page = page; _outer = outer; _enabled = enabled;
        }

        public bool PreFilterMessage(ref Message message)
        {
            if (message.Msg != 0x020A || _page.IsDisposed ||
                _outer.IsDisposed || !_enabled()) return false;
            Point screen = Cursor.Position;
            if (!_outer.RectangleToScreen(_outer.ClientRectangle).Contains(screen))
                return false;
            int delta = unchecked((short)((message.WParam.ToInt64() >> 16) & 0xffff));
            if (delta == 0) return false;
            Control hovered = FindDeepest(_outer, screen);
            // Do not spin an unopened combo's selection as the user scrolls the page.
            for (Control cur = hovered; cur != null; cur = cur.Parent)
            {
                if (cur is ComboBox && ((ComboBox)cur).DroppedDown)
                    return false;
                if (cur is DataGridView)
                {
                    if (ScrollGrid((DataGridView)cur, delta)) return true;
                }
                else if (cur is ScrollableControl &&
                         ScrollPanel((ScrollableControl)cur, delta)) return true;
                if (ReferenceEquals(cur, _outer)) break;
            }
            // Consume wheel while pointer is over Usage to prevent background
            // tabs, combo selections or charts from accidentally changing.
            return true;
        }

        private static Control FindDeepest(Control root, Point screen)
        {
            Control current = root;
            while (true)
            {
                var local = current.PointToClient(screen);
                Control child = current.GetChildAtPoint(local,
                    GetChildAtPointSkip.Invisible | GetChildAtPointSkip.Disabled);
                if (child == null) return current;
                current = child;
            }
        }

        private static bool ScrollGrid(DataGridView grid, int delta)
        {
            if (grid.IsDisposed || grid.RowCount == 0) return false;
            if (grid.VerticalScrollingOffset < 0) return false;
            int current;
            try { current = grid.FirstDisplayedScrollingRowIndex; }
            catch (InvalidOperationException) { return false; }
            if (current < 0) return false;
            var step = Math.Max(1, SystemInformation.MouseWheelScrollLines);
            var visible = Math.Max(1, grid.DisplayedRowCount(false));
            var last = Math.Max(0, grid.RowCount - visible);
            int next = Math.Max(0, Math.Min(last, current + (delta < 0 ? step : -step)));
            if (next == current) return false;
            try { grid.FirstDisplayedScrollingRowIndex = next; return true; }
            catch (InvalidOperationException) { return false; }
        }

        private static bool ScrollPanel(ScrollableControl panel, int delta)
        {
            if (!panel.AutoScroll || !panel.VerticalScroll.Visible) return false;
            int current = -panel.AutoScrollPosition.Y;
            int max = Math.Max(0,
                panel.VerticalScroll.Maximum - panel.VerticalScroll.LargeChange + 1);
            int step = Math.Max(16, SystemInformation.MouseWheelScrollLines * 18);
            int next = Math.Max(0, Math.Min(max, current + (delta < 0 ? step : -step)));
            if (next == current) return false;
            panel.AutoScrollPosition = new Point(-panel.AutoScrollPosition.X, next);
            return true;
        }
    }
}
