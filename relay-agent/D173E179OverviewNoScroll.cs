using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D173-E179: source-native WinForms layout only. Reuses all existing
    // controls, event handlers, Firestore listeners, WebView2 host and RBAC.
    internal sealed partial class AgentForm
    {
        private readonly Label _d173E179FleetHint = new Label();
        private readonly Button _d173E179WebTools = new Button();
        private bool _d173E179WebToolsReady;
        private readonly Button _d173E179PickPrev = new Button();
        private readonly Button _d173E179PickNext = new Button();
        private readonly Label _d173E179PickPage = new Label();
        private bool _d173E179PickPagerReady;
        private int _d173E179PickPageNumber;
        private bool _d173E181RosterFitting;
        private bool _d173E181FleetFitting;


        private void InstallD173E179NoScrollTop(
            TableLayoutPanel overview, Panel viewport, TableLayoutPanel threeColumns,
            Control agent, TableLayoutPanel middle, Control supra,
            Control picklist, Control desktop)
        {
            // E181: 40% operations, 60% roster at all sizes.
            overview.RowStyles[0].SizeType = SizeType.Percent;
            overview.RowStyles[0].Height = 40F;
            overview.RowStyles[1].SizeType = SizeType.Percent;
            overview.RowStyles[1].Height = 60F;
            viewport.AutoScroll = false;
            threeColumns.AutoScroll = false;
            threeColumns.Dock = DockStyle.Fill;
            threeColumns.Margin = Padding.Empty;
            threeColumns.Padding = Padding.Empty;
            (agent as ScrollableControl).AutoScroll = false;
            (supra as ScrollableControl).AutoScroll = false;
            (picklist as ScrollableControl).AutoScroll = false;
            _agentFleetGrid.ScrollBars = ScrollBars.None;
            _manualPicklistGrid.ScrollBars = ScrollBars.None;

            // Below 1240px of CONTENT width, four native tabs replace the
            // impossible 725px-high two-column scroll layout. No controls are
            // duplicated, and the lower roster remains always visible.
            var compactTabs = new TabControl {
                Dock = DockStyle.Fill, Visible = false,
                Font = new Font("Segoe UI", 9F)
            };
            var agentTab = new TabPage("Agent") { AutoScroll = false };
            var webTab = new TabPage("Web") { AutoScroll = false };
            var pickTab = new TabPage("PickList") { AutoScroll = false };
            var desktopTab = new TabPage("Tài nguyên") { AutoScroll = false };
            compactTabs.TabPages.AddRange(new[] { agentTab, webTab, pickTab, desktopTab });
            viewport.Controls.Add(compactTabs);

            _d173E179FleetHint.Text = "Xem đủ Agent ở Danh sách phiên → Agent";
            _d173E179FleetHint.ForeColor = Color.FromArgb(92, 105, 119);
            _d173E179FleetHint.Font = new Font("Segoe UI", 8F);
            _d173E179FleetHint.AutoEllipsis = true;
            agent.Controls.Add(_d173E179FleetHint);
            _d173E179FleetHint.BringToFront();

            // E181: restore Agent177 Web actions in the card, not a replacement menu.
            InstallD173E179PickListPager(picklist);

            var mode = -1;
            var arranging = false;
            Action arrange = () => {
                if (arranging || viewport.IsDisposed || threeColumns.IsDisposed || compactTabs.IsDisposed) return;
                arranging = true;
                try {
                var useThree = viewport.ClientSize.Width >= 1240;
                var wanted = useThree ? 3 : 1;
                if (mode != wanted)
                {
                    viewport.SuspendLayout();
                    threeColumns.SuspendLayout();
                    try
                    {
                        if (useThree)
                        {
                            agentTab.Controls.Remove(agent);
                            webTab.Controls.Remove(supra);
                            pickTab.Controls.Remove(picklist);
                            desktopTab.Controls.Remove(desktop);
                            threeColumns.Controls.Clear();
                            threeColumns.ColumnStyles.Clear();
                            threeColumns.RowStyles.Clear();
                            threeColumns.ColumnCount = 3;
                            threeColumns.RowCount = 1;
                            threeColumns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 37F));
                            threeColumns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 37F));
                            threeColumns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 26F));
                            threeColumns.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
                            if (supra.Parent != middle) middle.Controls.Add(supra, 0, 0);
                            if (picklist.Parent != middle) middle.Controls.Add(picklist, 0, 1);
                            middle.ColumnStyles.Clear();
                            middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
                            middle.RowStyles.Clear();
                            middle.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
                            middle.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
                            threeColumns.Controls.Add(agent, 0, 0);
                            threeColumns.Controls.Add(middle, 1, 0);
                            threeColumns.Controls.Add(desktop, 2, 0);
                            threeColumns.Visible = true;
                            compactTabs.Visible = false;
                        }
                        else
                        {
                            threeColumns.Controls.Remove(agent);
                            threeColumns.Controls.Remove(middle);
                            threeColumns.Controls.Remove(desktop);
                            middle.Controls.Remove(supra);
                            middle.Controls.Remove(picklist);
                            agentTab.Controls.Add(agent);
                            webTab.Controls.Add(supra);
                            pickTab.Controls.Add(picklist);
                            desktopTab.Controls.Add(desktop);
                            threeColumns.Visible = false;
                            compactTabs.Visible = true;
                        }
                        agent.Dock = DockStyle.Fill;
                        supra.Dock = DockStyle.Fill;
                        picklist.Dock = DockStyle.Fill;
                        desktop.Dock = DockStyle.Fill;
                        mode = wanted;
                    }
                    finally
                    {
                        threeColumns.ResumeLayout(true);
                        viewport.ResumeLayout(true);
                    }
                }
                // No fixed minimum heights, out-of-window widths, or scrollable
                // container regardless of DPI, resize, theme or tray restore.
                viewport.AutoScroll = false;
                threeColumns.AutoScroll = false;
                threeColumns.Dock = DockStyle.Fill;
                compactTabs.Dock = DockStyle.Fill;
                D173E179FitAgentFleet(agent);
                D173E179FitRosterColumns();
                D173E179CompactWebLayout(supra);
                }
                finally { arranging = false; }
            };
            viewport.Resize += (s, e) => arrange();
            agent.Resize += (s, e) => D173E179FitAgentFleet(agent);
            supra.Resize += (s, e) => D173E179CompactWebLayout(supra);
            arrange();
        }

        // E182 FIELD repair: calculate all Y positions from the real measured
        // header and button rows, not unrelated legacy fixed 164/257px offsets.
        private void D173E179FitAgentFleet(Control host)
        {
            if (host == null || host.IsDisposed || _agentFleetGrid.IsDisposed ||
                _d173E181FleetFitting) return;
            _d173E181FleetFitting = true;
            try
            {
                var width = Math.Max(200, host.ClientSize.Width);
                var height = host.ClientSize.Height;
                _agentFleetGrid.ScrollBars = ScrollBars.None;
                _agentFleetGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
                var names = new[] { "Admin", "Machine", "Role", "Supra", "Version", "LastSeen" };
                var ratios = new[] { .17, .20, .13, .19, .12, .19 };
                var space = Math.Max(180, width - 28);
                var used = 0;
                for (var i = 0; i < names.Length; i++)
                {
                    var col = _agentFleetGrid.Columns[names[i]];
                    if (col == null) continue;
                    if (!col.Visible) col.Visible = true;
                    if (col.AutoSizeMode != DataGridViewAutoSizeColumnMode.None)
                        col.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                    if (col.MinimumWidth != 20) col.MinimumWidth = 20;
                    var w = i == names.Length - 1 ? Math.Max(20, space - used) :
                        Math.Max(20, (int)Math.Floor(space * ratios[i]));
                    if (col.Width != w) col.Width = w;
                    used += w;
                }
                var contentBottom = D173E182FitAgentHeader(host);
                if (_afterHoursPanel.Visible && _afterHoursPanel.Parent == host)
                    contentBottom = Math.Max(contentBottom, _afterHoursPanel.Bottom + 5);
                var gridTop = contentBottom + 5;
                var remaining = Math.Max(0, height - gridTop - 8);
                var minGridHeight = _agentFleetGrid.ColumnHeadersHeight +
                    _agentFleetGrid.RowTemplate.Height + 3;
                var showFleet = HasAgentSession() && remaining >= minGridHeight;
                if (_agentFleetGrid.Visible != showFleet)
                    _agentFleetGrid.Visible = showFleet;
                // Fit observed rows instead of drawing a giant blank grid that
                // looks like missing content in the 40% upper overview.
                var measuredGrid = _agentFleetGrid.ColumnHeadersHeight +
                    Math.Max(1, _agentFleetGrid.Rows.Count) *
                        _agentFleetGrid.RowTemplate.Height + 3;
                var gridHeight = Math.Min(remaining, measuredGrid);
                SetD173BoundsIfChanged(_agentFleetGrid, 12, gridTop,
                    Math.Max(160, width - 24), Math.Max(0, gridHeight));
                _d173E179FleetHint.Visible = false;
            }
            finally { _d173E181FleetFitting = false; }
        }

        // Sole signed-in Agent header geometry. Legacy handlers still own
        // business visibility/enabled state; they must not own final coordinates.
        private int D173E182FitAgentHeader(Control host)
        {
            if (!HasAgentSession() || host.ClientSize.Width < 220) return 158;
            const int left = 12;
            const int gap = 6;
            var width = Math.Max(120, host.ClientSize.Width - 24);
            var textFlags = TextFormatFlags.WordBreak | TextFormatFlags.NoPadding;
            var titleHeight = Math.Max(24, TextRenderer.MeasureText(
                _agentCardTitle.Text ?? "", _agentCardTitle.Font,
                new Size(width, int.MaxValue), textFlags).Height + 4);
            _agentCardTitle.AutoEllipsis = false;
            SetD173BoundsIfChanged(_agentCardTitle, left, 6, width, titleHeight);

            var relayTop = 9 + titleHeight;
            var relayHeight = Math.Max(20, TextRenderer.MeasureText(
                _relay.Text ?? "", _relay.Font, new Size(width, int.MaxValue),
                textFlags).Height + 2);
            _relay.AutoEllipsis = false;
            SetD173BoundsIfChanged(_relay, left, relayTop, width, relayHeight);

            var resourceTop = relayTop + relayHeight + 2;
            var resourceHeight = Math.Max(18, TextRenderer.MeasureText(
                _d128AgentResourceStatus.Text ?? "", _d128AgentResourceStatus.Font,
                new Size(width, int.MaxValue), textFlags).Height + 2);
            _d128AgentResourceStatus.AutoEllipsis = false;
            SetD173BoundsIfChanged(_d128AgentResourceStatus, left, resourceTop,
                width, resourceHeight);

            var actionTop = resourceTop + resourceHeight + 5;
            var actionX = left;
            var actions = new Control[] {
                _logout, _manualUpdate, _background, _d150PrimaryTakeoverButton, _agentExit
            }.Where(control => control.Visible).ToArray();
            foreach (var control in actions)
            {
                var measuredWidth = TextRenderer.MeasureText(control.Text ?? "",
                    control.Font, new Size(1000, 30),
                    TextFormatFlags.NoPadding | TextFormatFlags.SingleLine).Width + 20;
                var actionWidth = Math.Max(70, Math.Min(150, measuredWidth));
                if (actionX > left && actionX + actionWidth > host.ClientSize.Width - left)
                {
                    actionTop += 31;
                    actionX = left;
                }
                SetD173BoundsIfChanged(control, actionX, actionTop,
                    Math.Min(actionWidth, width), 27);
                actionX += actionWidth + gap;
            }
            var networkTop = actionTop + (actions.Length > 0 ? 31 : 3);
            var refreshWidth = _d173E175NetworkRefresh.Visible ? 152 : 0;
            var networkWidth = Math.Max(90, width - refreshWidth -
                (refreshWidth > 0 ? gap : 0));
            _d173E175NetworkStatus.AutoEllipsis = false;
            var networkHeight = Math.Max(27, TextRenderer.MeasureText(
                _d173E175NetworkStatus.Text ?? "", _d173E175NetworkStatus.Font,
                new Size(networkWidth, int.MaxValue), textFlags).Height + 3);
            SetD173BoundsIfChanged(_d173E175NetworkStatus, left, networkTop,
                networkWidth, networkHeight);
            if (refreshWidth > 0)
                SetD173BoundsIfChanged(_d173E175NetworkRefresh,
                    left + networkWidth + gap, networkTop, refreshWidth, 28);
            _d173E175NetworkStatus.TextAlign = ContentAlignment.TopLeft;
            return networkTop + Math.Max(networkHeight, refreshWidth > 0 ? 28 : 0);
        }

        private void InstallD173E179WebTools(Control host)
        {
            if (_d173E179WebToolsReady) return;
            _d173E179WebToolsReady = true;
            _d173E179WebTools.Text = "Công cụ Web";
            _d173E179WebTools.Font = new Font("Segoe UI", 8.2F);
            _d173E179WebTools.FlatStyle = FlatStyle.Flat;
            var menu = new ContextMenuStrip();
            menu.Items.Add("Kiểm tra Web Agent", null, (s, e) => TestSupraBrowser());
            menu.Items.Add("Tải trình duyệt Agent", null, (s, e) => StartAgentBrowserDownload());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Mở thư mục dữ liệu", null, (s, e) => OpenAgentDataFolder());
            menu.Items.Add("Đổi nơi lưu dữ liệu", null, (s, e) => ChooseAndMoveAgentBrowserData());
            _d173E179WebTools.Click += (s, e) =>
                menu.Show(_d173E179WebTools, new Point(0, _d173E179WebTools.Height));
            host.Controls.Add(_d173E179WebTools);
            D173E179CompactWebLayout(host);
        }

        // E182: keep every original Agent177 Web control. Status text wraps in
        // consecutive full-width rows; the upper panel never scrolls or clips.
        private void D173E179CompactWebLayout(Control host)
        {
            if (host == null || host.IsDisposed || _supraCard == null ||
                _supraCard.IsDisposed || host.ClientSize.Width < 180) return;
            var width = host.ClientSize.Width;
            var inner = Math.Max(120, width - 24);
            _supraCard.AutoScroll = false;
            _toggleWmsTab.Visible = false;
            _d173E179WebTools.Visible = false;
            _wmsStatus.Visible = false;
            _supraInfo.Visible = false;
            _supraCardTitle.AutoEllipsis = false;
            var headerHeight = Math.Max(22, TextRenderer.MeasureText(
                _supraCardTitle.Text ?? "", _supraCardTitle.Font,
                new Size(inner, int.MaxValue),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 4);
            SetD173BoundsIfChanged(_supraCardTitle, 12, 3, inner, headerHeight);
            var firstTop = 6 + headerHeight;
            var half = (inner - 6) / 2;
            SetD173BoundsIfChanged(_wmsCapture, 12, firstTop, half, 25);
            SetD173BoundsIfChanged(_wmsDesktop, 18 + half, firstTop,
                Math.Max(70, inner - half - 6), 25);
            var secondTop = firstTop + 28;
            var buttons = new Control[] {
                _wmsTest, _browserBundleDownload, _openAgentDataFolder, _moveAgentDataFolder
            };
            var weights = new[] { 0.17, 0.28, 0.30, 0.25 };
            var x = 12;
            var available = Math.Max(150, inner - 15);
            for (var i = 0; i < buttons.Length; i++)
            {
                var w = i == buttons.Length - 1 ? Math.Max(38, width - 12 - x)
                    : Math.Max(38, (int)Math.Floor(available * weights[i]));
                SetD173BoundsIfChanged(buttons[i], x, secondTop, w, 23);
                // The original Agent177 layout may intentionally hide the
                // diagnostic button. Keep other action visibility unchanged.
                if (i > 0 && !buttons[i].Visible) buttons[i].Visible = true;
                x += w + 5;
            }
            var progressTop = secondTop + 25;
            SetD173BoundsIfChanged(_browserBundleProgress, 12, progressTop,
                inner, 5);
            var lineTop = progressTop + 7;
            var statuses = new[] {
                _browserBundleStatus, _agentDataStorageStatus, _d128BrowserResourceStatus
            };
            var remaining = Math.Max(30, host.ClientSize.Height - lineTop - 5);
            for (var i = 0; i < statuses.Length; i++)
            {
                var label = statuses[i];
                label.AutoEllipsis = false;
                label.TextAlign = ContentAlignment.TopLeft;
                var measured = Math.Max(17, TextRenderer.MeasureText(
                    label.Text ?? "", label.Font, new Size(inner, int.MaxValue),
                    TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 2);
                // Preserve the actual text height; don't shrink or add scroll.
                var h = Math.Min(measured, Math.Max(17,
                    remaining - (statuses.Length - i - 1) * 17));
                SetD173BoundsIfChanged(label, 12, lineTop, inner, h);
                lineTop += h;
                remaining = Math.Max(0, host.ClientSize.Height - lineTop - 5);
            }
        }

        // Only the lower session grid may have a vertical scrollbar.
        // All column data remain in existing cells for RBAC and review.
        // E182 FIELD repair: measure actual visible-session text and headers.
        // Action columns stay compact; the remaining viewport goes to text-heavy
        // columns. Only the lower roster has a vertical scrollbar.
        private void D173E179FitRosterColumns()
        {
            if (_d173E181RosterFitting) return;
            _d173E181RosterFitting = true;
            try
            {
                var grid = _pickerOnlineGrid;
                if (grid == null || grid.IsDisposed || grid.Columns.Count < 15 ||
                    grid.ClientSize.Width < 220) return;
                grid.ScrollBars = ScrollBars.Vertical;
                grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
                var names = new[] {
                    "D173SummaryIdentity", "D173SummaryClient", "D173SummaryTime",
                    "D173SummaryActivity", "D173SummaryState", "D173SummaryTech",
                    "KickUser", "CallSpecialist", "ResolveContact"
                };
                var minimums = new[] { 128, 122, 97, 160, 148, 90, 78, 110, 68 };
                var maximums = new[] { 530, 295, 157, 620, 450, 190, 100, 137, 90 };
                var weights = new[] { 3, 2, 1, 5, 3, 1, 0, 0, 0 };
                var tech = _d173RosterTech.Checked;
                var active = new List<DataGridViewColumn>();
                var indexes = new List<int>();
                for (var i = 0; i < names.Length; i++)
                {
                    var column = grid.Columns[names[i]];
                    if (column == null) continue;
                    var show = i != 5 || tech;
                    if (column.Visible != show) column.Visible = show;
                    if (!show) continue;
                    if (column.AutoSizeMode != DataGridViewAutoSizeColumnMode.None)
                        column.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                    active.Add(column);
                    indexes.Add(i);
                }
                if (active.Count == 0) return;

                var available = Math.Max(1, grid.ClientSize.Width -
                    SystemInformation.VerticalScrollBarWidth - 5);
                var dpi = Math.Max(1d, grid.DeviceDpi / 96d);
                var min = new int[active.Count];
                var desired = new int[active.Count];
                var widths = new int[active.Count];
                var flags = TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix |
                    TextFormatFlags.SingleLine;
                var rowCount = grid.Rows.Count;
                var step = Math.Max(1, rowCount / 64);
                for (var i = 0; i < active.Count; i++)
                {
                    var col = active[i];
                    var spec = indexes[i];
                    var font = col.DefaultCellStyle.Font ?? grid.DefaultCellStyle.Font ?? grid.Font;
                    var isAction = col is DataGridViewButtonColumn;
                    min[i] = Math.Max(20, (int)Math.Round(minimums[spec] * dpi));
                    var max = Math.Max(min[i], (int)Math.Round(maximums[spec] * dpi));
                    var measured = TextRenderer.MeasureText(
                        col.HeaderText ?? "", font, new Size(4096, 32), flags).Width + 18;
                    for (var r = 0; r < rowCount; r += step)
                    {
                        var row = grid.Rows[r];
                        if (row.IsNewRow) continue;
                        // Button captions may be supplied by UseColumnTextForButtonValue.
                        var cell = row.Cells[col.Index];
                        var label = isAction && cell is DataGridViewButtonCell &&
                            ((DataGridViewButtonCell)cell).UseColumnTextForButtonValue
                                ? Convert.ToString(((DataGridViewButtonColumn)col).Text)
                                : Convert.ToString(cell.Value);
                        if (string.IsNullOrEmpty(label)) continue;
                        var needed = TextRenderer.MeasureText(
                            label, font, new Size(4096, 32), flags).Width + 18;
                        if (needed > measured) measured = needed;
                        if (measured >= max) break;
                    }
                    desired[i] = Math.Max(min[i], Math.Min(max, measured));
                    widths[i] = min[i];
                }

                var sumMin = widths.Sum();
                if (sumMin > available)
                {
                    // Impossible to show every full string on a very narrow RDP
                    // viewport. Fit without a horizontal scrollbar; full values
                    // remain available through native per-cell tooltips/details.
                    var scale = available / (double)sumMin;
                    var used = 0;
                    for (var i = 0; i < widths.Length; i++)
                    {
                        widths[i] = i == widths.Length - 1
                            ? Math.Max(20, available - used)
                            : Math.Max(20, (int)Math.Floor(widths[i] * scale));
                        used += widths[i];
                    }
                }
                else
                {
                    var remaining = available - sumMin;
                    // Consume room proportionally to measured unmet text, not
                    // fixed percentages unrelated to the current session values.
                    for (var pass = 0; pass < 6 && remaining > 0; pass++)
                    {
                        var weightedNeed = 0d;
                        for (var i = 0; i < widths.Length; i++)
                            weightedNeed += Math.Max(0, desired[i] - widths[i]) *
                                Math.Max(1, weights[indexes[i]]);
                        if (weightedNeed <= 0) break;
                        var startingBudget = remaining;
                        var moved = 0;
                        for (var i = 0; i < widths.Length && remaining > 0; i++)
                        {
                            var need = Math.Max(0, desired[i] - widths[i]);
                            if (need == 0) continue;
                            var weight = Math.Max(1, weights[indexes[i]]);
                            var grant = Math.Min(need, Math.Max(1,
                                (int)Math.Floor(startingBudget * need * weight / weightedNeed)));
                            grant = Math.Min(grant, remaining);
                            widths[i] += grant;
                            remaining -= grant;
                            moved += grant;
                        }
                        if (moved == 0) break;
                    }
                    // Any residual space is shared by readable text fields.
                    // Buttons never become oversized filler columns.
                    var preferred = new[] { 3, 0, 4, 1 };
                    for (var pass = 0; pass < 4 && remaining > 0; pass++)
                    {
                        var moved = 0;
                        foreach (var spec in preferred)
                        {
                            var index = indexes.IndexOf(spec);
                            if (index < 0) continue;
                            var limit = Math.Max(widths[index],
                                (int)Math.Round(maximums[spec] * dpi));
                            var room = Math.Max(0, limit - widths[index]);
                            var grant = Math.Min(room, Math.Max(1, remaining /
                                Math.Max(1, preferred.Length - pass)));
                            grant = Math.Min(grant, remaining);
                            widths[index] += grant;
                            remaining -= grant;
                            moved += grant;
                            if (remaining == 0) break;
                        }
                        if (moved == 0) break;
                    }
                }

                // Avoid intermediate repaints and discard old fixed/minimum Fill
                // constraints. Existing roles, actions, sort and selection remain.
                grid.SuspendLayout();
                try
                {
                    for (var i = 0; i < active.Count; i++)
                    {
                        var col = active[i];
                        if (col.MinimumWidth != 20) col.MinimumWidth = 20;
                        if (col.Width != widths[i]) col.Width = widths[i];
                    }
                }
                finally { grid.ResumeLayout(false); }
            }
            finally { _d173E181RosterFitting = false; }
        }

        // Multi-PickList search must retain access to all 10 results even
        // though the upper 50% is forbidden to scroll. Use native paging.
        private void InstallD173E179PickListPager(Control host)
        {
            if (_d173E179PickPagerReady || host == null) return;
            _d173E179PickPagerReady = true;
            _d173E179PickPrev.Text = "Trước";
            _d173E179PickNext.Text = "Tiếp";
            _d173E179PickPage.TextAlign = ContentAlignment.MiddleCenter;
            _d173E179PickPage.Font = new Font("Segoe UI", 8F);
            _d173E179PickPrev.Font = new Font("Segoe UI", 8F);
            _d173E179PickNext.Font = new Font("Segoe UI", 8F);
            _d173E179PickPrev.Click += (sender, e) => D173E179MovePickListPage(-1);
            _d173E179PickNext.Click += (sender, e) => D173E179MovePickListPage(1);
            host.Controls.Add(_d173E179PickPrev);
            host.Controls.Add(_d173E179PickNext);
            host.Controls.Add(_d173E179PickPage);
            _manualPicklistGrid.RowsAdded += (sender, e) => D173E179RefreshPickListPager();
            _manualPicklistGrid.RowsRemoved += (sender, e) => {
                _d173E179PickPageNumber = 0;
                D173E179RefreshPickListPager();
            };
            _manualPicklistGrid.Resize += (sender, e) => D173E179RefreshPickListPager();
            host.Resize += (sender, e) => {
                D173E179LayoutPickListPager(host);
                D173E179RefreshPickListPager();
            };
            D173E179LayoutPickListPager(host);
            D173E179RefreshPickListPager();
        }

        private void D173E179LayoutPickListPager(Control host)
        {
            if (host.IsDisposed) return;
            var width = Math.Max(220, host.ClientSize.Width);
            const int margin = 10;
            const int action = 52;
            const int page = 44;
            _d173E179PickNext.SetBounds(width - margin - action, 8, action, 24);
            _d173E179PickPage.SetBounds(width - margin - action - page - 3, 8, page, 24);
            _d173E179PickPrev.SetBounds(width - margin - 2 * action - page - 6, 8, action, 24);
            _picklistCardTitle.SetBounds(12, 8,
                Math.Max(100, width - (2 * action + page + 26)), 24);
        }

        private int D173E179VisiblePickListSlots()
        {
            var grid = _manualPicklistGrid;
            if (grid.IsDisposed || grid.ClientSize.Height <= grid.ColumnHeadersHeight)
                return 1;
            return Math.Max(1, (grid.ClientSize.Height -
                grid.ColumnHeadersHeight - 2) / Math.Max(20, grid.RowTemplate.Height));
        }

        private void D173E179RefreshPickListPager()
        {
            if (!_d173E179PickPagerReady || _manualPicklistGrid.IsDisposed) return;
            if (_manualPicklistGrid.InvokeRequired)
            {
                if (_manualPicklistGrid.IsHandleCreated)
                    _manualPicklistGrid.BeginInvoke(new Action(D173E179RefreshPickListPager));
                return;
            }
            var slots = D173E179VisiblePickListSlots();
            var pages = Math.Max(1, (_manualPicklistGrid.Rows.Count + slots - 1) / slots);
            _d173E179PickPageNumber = Math.Max(0, Math.Min(pages - 1, _d173E179PickPageNumber));
            var show = pages > 1;
            _d173E179PickPrev.Visible = show;
            _d173E179PickNext.Visible = show;
            _d173E179PickPage.Visible = show;
            if (!show) return;
            _d173E179PickPage.Text = (_d173E179PickPageNumber + 1) + "/" + pages;
            _d173E179PickPrev.Enabled = _d173E179PickPageNumber > 0;
            _d173E179PickNext.Enabled = _d173E179PickPageNumber + 1 < pages;
        }

        private void D173E179MovePickListPage(int direction)
        {
            var grid = _manualPicklistGrid;
            if (grid.IsDisposed || grid.Rows.Count < 1) return;
            var slots = D173E179VisiblePickListSlots();
            var pages = Math.Max(1, (grid.Rows.Count + slots - 1) / slots);
            var next = Math.Max(0, Math.Min(pages - 1, _d173E179PickPageNumber + direction));
            if (next == _d173E179PickPageNumber) return;
            var rowIndex = Math.Min(grid.Rows.Count - 1, next * slots);
            try
            {
                // Page jump, not a scrollbar. All existing bound rows and
                // per-row confirmation handlers remain the same objects.
                grid.FirstDisplayedScrollingRowIndex = rowIndex;
                _d173E179PickPageNumber = next;
            }
            catch (InvalidOperationException)
            {
                // Never pretend inaccessible results were displayed.
                MessageBox.Show(this, "Chưa chuyển được trang kết quả PickList.",
                    "PickList", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            D173E179RefreshPickListPager();
        }

    }
}
