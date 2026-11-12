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
        private bool _d173E182AdaptiveTopReady;
        private string _d173E195AgentActionsGeometry = "";


        private void InstallD173E179NoScrollTop(
            TableLayoutPanel overview, Panel viewport, TableLayoutPanel twoColumns,
            Control agent, TableLayoutPanel middle, Control supra,
            Control picklist, Control desktop)
        {
            // E207: preserve the 40/60 overview/roster boundary. Only its upper
            // area changes to 60% Agent+PickList and 40% Desktop resources.
            overview.RowStyles[0].SizeType = SizeType.Percent;
            overview.RowStyles[0].Height = 40F;
            overview.RowStyles[1].SizeType = SizeType.Percent;
            overview.RowStyles[1].Height = 60F;
            viewport.AutoScroll = false;
            twoColumns.Dock = DockStyle.Fill;
            twoColumns.AutoScroll = false;
            twoColumns.Margin = Padding.Empty;
            twoColumns.Padding = Padding.Empty;
            middle.Margin = new Padding(4);
            agent.Margin = new Padding(0, 0, 0, 3);
            picklist.Margin = new Padding(0, 3, 0, 0);
            desktop.Margin = new Padding(4);
            (agent as ScrollableControl).AutoScroll = false;
            (picklist as ScrollableControl).AutoScroll = false;
            _agentFleetGrid.ScrollBars = ScrollBars.None;
            _manualPicklistGrid.ScrollBars = ScrollBars.None;

            // The old Supra summary is no longer displayed. Reuse the actual
            // Web-data buttons and their existing click handlers in Agent.
            middle.Controls.Remove(supra);
            supra.Visible = false;
            _wmsDesktop.Visible = false;
            foreach (var button in new Control[] {
                _browserBundleDownload, _openAgentDataFolder, _moveAgentDataFolder
            })
            {
                button.Anchor = AnchorStyles.Top | AnchorStyles.Left;
                agent.Controls.Add(button);
                button.Visible = HasAgentSession();
            }
            _openAgentDataFolder.Text = "Mở thư mục dữ liệu";
            _moveAgentDataFolder.Text = "Đổi nơi lưu trữ";
            foreach (var button in new Button[] {
                _browserBundleDownload, _openAgentDataFolder, _moveAgentDataFolder
            })
            {
                button.UseVisualStyleBackColor = false;
                button.FlatStyle = FlatStyle.Flat;
                button.BackColor = Color.FromArgb(226, 237, 248);
                button.ForeColor = Color.FromArgb(40, 74, 108);
            }

            middle.ColumnStyles.Clear();
            middle.ColumnCount = 1;
            middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            middle.RowStyles.Clear();
            middle.RowCount = 2;
            middle.RowStyles.Add(new RowStyle(SizeType.Percent, 65F));
            middle.RowStyles.Add(new RowStyle(SizeType.Percent, 35F));

            // On small physical viewports, keep full access using native tabs.
            // No WMS session, business handler or desktop resource is duplicated.
            var compactTabs = new TabControl {
                Dock = DockStyle.Fill, Visible = false,
                Font = new Font("Segoe UI", 9F)
            };
            var agentTab = new TabPage("Agent") { AutoScroll = false };
            var pickTab = new TabPage("PickList") { AutoScroll = false };
            var desktopTab = new TabPage("Tài nguyên") { AutoScroll = false };
            compactTabs.TabPages.AddRange(new[] { agentTab, pickTab, desktopTab });
            viewport.Controls.Add(compactTabs);

            _d173E179FleetHint.Text = "Xem đủ Agent ở Danh sách phiên → Agent";
            _d173E179FleetHint.ForeColor = Color.FromArgb(92, 105, 119);
            _d173E179FleetHint.Font = new Font("Segoe UI", 8F);
            _d173E179FleetHint.AutoEllipsis = true;
            agent.Controls.Add(_d173E179FleetHint);
            _d173E179FleetHint.BringToFront();
            InstallD173E179PickListPager(picklist);
            _d173E182AdaptiveTopReady = true;

            var mode = -1;
            var arranging = false;
            Action arrange = () => {
                if (arranging || viewport.IsDisposed || twoColumns.IsDisposed ||
                    compactTabs.IsDisposed) return;
                arranging = true;
                try
                {
                    // The 65/35 left stack must fit the full toolbar and PickList
                    // input; at HD short viewports use tabs instead of clipping.
                    var useTwo = viewport.ClientSize.Width >= 1024 &&
                        viewport.ClientSize.Height >= 375;
                    var wanted = useTwo ? 2 : 1;
                    if (mode != wanted)
                    {
                        viewport.SuspendLayout();
                        twoColumns.SuspendLayout();
                        middle.SuspendLayout();
                        try
                        {
                            if (useTwo)
                            {
                                agentTab.Controls.Remove(agent);
                                pickTab.Controls.Remove(picklist);
                                desktopTab.Controls.Remove(desktop);
                                twoColumns.Controls.Clear();
                                twoColumns.ColumnStyles.Clear();
                                twoColumns.RowStyles.Clear();
                                twoColumns.ColumnCount = 2;
                                twoColumns.RowCount = 1;
                                twoColumns.ColumnStyles.Add(
                                    new ColumnStyle(SizeType.Percent, 60F));
                                twoColumns.ColumnStyles.Add(
                                    new ColumnStyle(SizeType.Percent, 40F));
                                twoColumns.RowStyles.Add(
                                    new RowStyle(SizeType.Percent, 100F));
                                if (agent.Parent != middle)
                                    middle.Controls.Add(agent, 0, 0);
                                if (picklist.Parent != middle)
                                    middle.Controls.Add(picklist, 0, 1);
                                twoColumns.Controls.Add(middle, 0, 0);
                                twoColumns.Controls.Add(desktop, 1, 0);
                                twoColumns.Visible = true;
                                compactTabs.Visible = false;
                            }
                            else
                            {
                                twoColumns.Controls.Remove(middle);
                                twoColumns.Controls.Remove(desktop);
                                middle.Controls.Remove(agent);
                                middle.Controls.Remove(picklist);
                                agentTab.Controls.Add(agent);
                                pickTab.Controls.Add(picklist);
                                desktopTab.Controls.Add(desktop);
                                twoColumns.Visible = false;
                                compactTabs.Visible = true;
                            }
                            agent.Dock = DockStyle.Fill;
                            picklist.Dock = DockStyle.Fill;
                            desktop.Dock = DockStyle.Fill;
                            mode = wanted;
                        }
                        finally
                        {
                            middle.ResumeLayout(true);
                            twoColumns.ResumeLayout(true);
                            viewport.ResumeLayout(true);
                        }
                    }
                    D173E179FitAgentFleet(agent);
                    D173E179FitRosterColumns();
                }
                finally { arranging = false; }
            };
            viewport.Resize += (s, e) => arrange();
            agent.Resize += (s, e) => D173E179FitAgentFleet(agent);
            foreach (var label in new Control[] {
                _agentCardTitle, _relay, _d173E175NetworkStatus
            })
            {
                var previousHeight = -1;
                label.TextChanged += (s, e) =>
                {
                    var availableWidth = Math.Max(80, agent.ClientSize.Width - 24);
                    if (label == _d173E175NetworkStatus && _d173E175NetworkRefresh.Visible)
                        availableWidth = Math.Max(80, availableWidth - 158);
                    var height = TextRenderer.MeasureText(
                        label.Text ?? "", label.Font,
                        new Size(availableWidth, int.MaxValue),
                        TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height;
                    if (height == previousHeight) return;
                    previousHeight = height;
                    D173E179FitAgentFleet(agent);
                };
            }
            arrange();
        }

        // E182 FIELD FAIL: the middle stack remains exactly 50/50. A prior
        // status-driven resize introduced uneven panels and layout storms.

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
            // Reserve space for normal high-watermark metrics so CPU/RAM/clock
            // refreshes cannot make the entire Agent card jump each second.
            var resourceSample = "CPU: 100,0% | RAM: 99999 MB | Thời gian chạy: 99999:59:59";
            var resourceHeight = Math.Max(18, Math.Max(
                TextRenderer.MeasureText(resourceSample, _d128AgentResourceStatus.Font,
                    new Size(width, int.MaxValue), textFlags).Height + 2,
                TextRenderer.MeasureText(_d128AgentResourceStatus.Text ?? "",
                    _d128AgentResourceStatus.Font,
                    new Size(width, int.MaxValue), textFlags).Height + 2));
            _d128AgentResourceStatus.AutoEllipsis = false;
            SetD173BoundsIfChanged(_d128AgentResourceStatus, left, resourceTop,
                width, resourceHeight);

            // One measured toolbar owns both Agent and Web-data actions.
            // These are the original handlers; visual placement never changes RBAC.
            _d150PrimaryTakeoverButton.Text = "Chuyển Agent chính";
            _manualUpdate.Text = "Cập nhật";
            _background.Text = "Xuống nền";
            _logout.Text = "Đăng xuất";
            var actionTop = resourceTop + resourceHeight + 5;
            var actionX = left;
            var actions = new Control[] {
                _d150PrimaryTakeoverButton, _manualUpdate, _background, _logout, _agentExit,
                _browserBundleDownload, _openAgentDataFolder, _moveAgentDataFolder
            }.Where(control => control.Visible && control.Parent == host).ToArray();
            foreach (var control in actions)
            {
                var measuredWidth = TextRenderer.MeasureText(control.Text ?? "",
                    control.Font, new Size(1000, 30),
                    TextFormatFlags.NoPadding | TextFormatFlags.SingleLine).Width + 24;
                var actionWidth = Math.Max(72, Math.Min(172, measuredWidth));
                if (actionX > left && actionX + actionWidth > host.ClientSize.Width - left)
                {
                    actionTop += 31;
                    actionX = left;
                }
                SetD173BoundsIfChanged(control, actionX, actionTop,
                    Math.Min(actionWidth, width), 27);
                actionX += actionWidth + gap;
            }
            var overlapping = 0;
            var clipped = 0;
            for (var i = 0; i < actions.Length; i++)
            {
                if (actions[i].Right > host.ClientSize.Width || actions[i].Left < 0) clipped++;
                for (var j = 0; j < i; j++)
                    if (actions[i].Bounds.IntersectsWith(actions[j].Bounds)) overlapping++;
            }
            var geometry = host.ClientSize.Width + "|" + host.ClientSize.Height +
                "|" + actions.Length + "|" + overlapping + "|" + clipped +
                "|" + string.Join(",", actions.Select(c => c.Bounds.ToString()));
            if (_d173E195AgentActionsGeometry != geometry)
            {
                _d173E195AgentActionsGeometry = geometry;
                Log("D173_E195_AGENT_ACTION_LAYOUT width=" + host.ClientSize.Width +
                    " height=" + host.ClientSize.Height + " count=" + actions.Length +
                    " overlap=" + overlapping + " clipped=" + clipped +
                    " dpi=" + DeviceDpi + " geometry=MEASURED privacy=NO_USER_DATA");
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
                _supraCard.IsDisposed || host.Parent == null ||
                host.ClientSize.Width < 180) return;
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
            var buttonFlags = TextFormatFlags.SingleLine | TextFormatFlags.NoPadding;
            var firstMin = TextRenderer.MeasureText(_wmsCapture.Text ?? "",
                _wmsCapture.Font, new Size(1000, 40), buttonFlags).Width + 22;
            var secondMin = TextRenderer.MeasureText(_wmsDesktop.Text ?? "",
                _wmsDesktop.Font, new Size(1000, 40), buttonFlags).Width + 22;
            var half = Math.Max(firstMin, Math.Min(inner - secondMin - 6, (inner - 6) / 2));
            SetD173BoundsIfChanged(_wmsCapture, 12, firstTop, Math.Max(70, half), 27);
            SetD173BoundsIfChanged(_wmsDesktop, 18 + half, firstTop,
                Math.Max(70, inner - half - 6), 27);
            var secondTop = firstTop + 32;
            var buttons = new Control[] {
                _wmsTest, _browserBundleDownload, _openAgentDataFolder, _moveAgentDataFolder
            };
            var gap = 6;
            var desired = buttons.Select(button => Math.Max(72,
                TextRenderer.MeasureText(button.Text ?? "", button.Font,
                    new Size(1000, 40), buttonFlags).Width + 22)).ToArray();
            var needsWrap = desired.Sum() + gap * (buttons.Length - 1) > inner;
            var x = 12;
            var y = secondTop;
            var room = inner;
            var extra = needsWrap ? 0 : Math.Max(0,
                (inner - desired.Sum() - gap * (buttons.Length - 1)) / buttons.Length);
            for (var i = 0; i < buttons.Length; i++)
            {
                var w = desired[i] + extra;
                if (needsWrap && x > 12 && w > room)
                {
                    y += 31;
                    x = 12;
                    room = inner;
                }
                w = Math.Min(room, w);
                SetD173BoundsIfChanged(buttons[i], x, y, Math.Max(45, w), 27);
                if (i > 0 && !buttons[i].Visible) buttons[i].Visible = true;
                x += w + gap;
                room = Math.Max(0, width - 12 - x);
            }
            var progressTop = y + 36;
            SetD173BoundsIfChanged(_browserBundleProgress, 12, progressTop,
                inner, 5);
            var lineTop = progressTop + 10;
            var statuses = new[] {
                _browserBundleStatus, _agentDataStorageStatus, _d128BrowserResourceStatus
            };
            var remaining = Math.Max(30, host.ClientSize.Height - lineTop - 5);
            for (var i = 0; i < statuses.Length; i++)
            {
                var label = statuses[i];
                label.AutoEllipsis = false;
                label.TextAlign = ContentAlignment.TopLeft;
                var measuredText = label.Text ?? "";
                if (i == statuses.Length - 1)
                    measuredText = "CPU: 100,0% | RAM: 99999 MB | Tiến trình: 999 | Thời gian chạy: 99999:59:59";
                var measured = Math.Max(17, Math.Max(TextRenderer.MeasureText(
                    label.Text ?? "", label.Font, new Size(inner, int.MaxValue),
                    TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 2,
                    TextRenderer.MeasureText(measuredText, label.Font,
                        new Size(inner, int.MaxValue),
                        TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 2));
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
                    "D173SummaryContractor", "D173SummaryEmployee",
                    "D173SummaryName", "D173SummaryRole",
                    "D173SummaryClient", "D173SummaryTime",
                    "D173SummaryActivity", "D173SummaryState",
                    "KickUser", "CallSpecialist", "ResolveContact"
                };
                var minimums = new[] { 65, 100, 90, 63, 105, 85, 130, 130, 75, 100, 65 };
                var maximums = new[] { 210, 255, 330, 170, 275, 140, 590, 385, 105, 140, 95 };
                var weights = new[] { 1, 2, 3, 1, 2, 1, 5, 3, 0, 0, 0 };
                var active = new List<DataGridViewColumn>();
                var indexes = new List<int>();
                for (var i = 0; i < names.Length; i++)
                {
                    var column = grid.Columns[names[i]];
                    if (column == null) continue;
                    if (!column.Visible) column.Visible = true;
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
                    var preferred = new[] { 6, 2, 7, 1, 4 };
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
