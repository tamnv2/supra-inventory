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

        private void D173E179FitAgentFleet(Control host)
        {
            if (host == null || host.IsDisposed || _agentFleetGrid.IsDisposed || _d173E181FleetFitting) return;
            _d173E181FleetFitting = true;
            try {
            var width = Math.Max(200, host.ClientSize.Width);
            var height = host.ClientSize.Height;
            _agentFleetGrid.ScrollBars = ScrollBars.None;
            _agentFleetGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
            var cols = _agentFleetGrid.Columns;
            // Agent177's six operational fields must stay visible, unlike v178.
            var names = new[] { "Admin", "Machine", "Role", "Supra", "Version", "LastSeen" };
            var ratios = new[] { 0.17, 0.20, 0.13, 0.19, 0.12, 0.19 };
            var space = Math.Max(180, width - 28);
            var used = 0;
            for (var i = 0; i < names.Length; i++)
            {
                var col = cols[names[i]];
                if (col == null) continue;
                if (!col.Visible) col.Visible = true;
                if (col.AutoSizeMode != DataGridViewAutoSizeColumnMode.None)
                    col.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                if (col.MinimumWidth != 20) col.MinimumWidth = 20;
                var colWidth = i == names.Length - 1 ? Math.Max(20, space - used)
                    : Math.Max(20, (int)Math.Floor(space * ratios[i]));
                if (col.Width != colWidth) col.Width = colWidth;
                used += colWidth;
            }
            var headerBottom = D173E182FitAgentHeader(host);
            var fleetTop = _afterHoursPanel.Visible ? Math.Max(257, headerBottom + 6) :
                Math.Max(164, headerBottom + 6);
            var available = height - fleetTop - 7;
            var showFleet = HasAgentSession() && available >= 40;
            if (_agentFleetGrid.Visible != showFleet) _agentFleetGrid.Visible = showFleet;
            SetD173BoundsIfChanged(_agentFleetGrid, 12, fleetTop, Math.Max(160, width - 24),
                Math.Max(35, available));
            // Never substitute a "see lower roster" placeholder for Agent177 data.
            _d173E179FleetHint.Visible = false;
            }
            finally { _d173E181FleetFitting = false; }
        }

        // E182: Do not rely on one-line 24px titles. The labels are the same
        // WinForms controls and keep their original text and business handlers.
        private int D173E182FitAgentHeader(Control host)
        {
            if (!HasAgentSession() || host.ClientSize.Width < 220) return 158;
            var width = Math.Max(220, host.ClientSize.Width - 24);
            var titleHeight = Math.Max(24, TextRenderer.MeasureText(
                _agentCardTitle.Text ?? "", _agentCardTitle.Font,
                new Size(width, int.MaxValue),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 4);
            _agentCardTitle.AutoEllipsis = false;
            SetD173BoundsIfChanged(_agentCardTitle, 12, 6, width, titleHeight);
            var relayTop = 9 + titleHeight;
            var relayHeight = Math.Max(21, TextRenderer.MeasureText(
                _relay.Text ?? "", _relay.Font, new Size(width, int.MaxValue),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 3);
            _relay.AutoEllipsis = false;
            SetD173BoundsIfChanged(_relay, 12, relayTop, width, relayHeight);
            var resourceTop = relayTop + relayHeight + 2;
            var resourceHeight = Math.Max(18, TextRenderer.MeasureText(
                _d128AgentResourceStatus.Text ?? "", _d128AgentResourceStatus.Font,
                new Size(width, int.MaxValue),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 2);
            _d128AgentResourceStatus.AutoEllipsis = false;
            SetD173BoundsIfChanged(_d128AgentResourceStatus, 12, resourceTop,
                width, resourceHeight);
            var actionTop = resourceTop + resourceHeight + 4;
            foreach (var control in new Control[] {
                _logout, _manualUpdate, _background, _d150PrimaryTakeoverButton, _agentExit
            })
            {
                if (control.Visible && control.Top != actionTop) control.Top = actionTop;
            }
            var networkTop = actionTop + 31;
            var networkWidth = Math.Max(110, width - 164);
            _d173E175NetworkStatus.AutoEllipsis = false;
            var networkHeight = Math.Max(27, TextRenderer.MeasureText(
                _d173E175NetworkStatus.Text ?? "", _d173E175NetworkStatus.Font,
                new Size(networkWidth, int.MaxValue),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + 3);
            SetD173BoundsIfChanged(_d173E175NetworkStatus, 12, networkTop,
                networkWidth, networkHeight);
            SetD173BoundsIfChanged(_d173E175NetworkRefresh,
                Math.Max(124, host.ClientSize.Width - 164), networkTop, 152, 28);
            _d173E175NetworkStatus.TextAlign = ContentAlignment.TopLeft;
            return networkTop + networkHeight;
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
        private void D173E179FitRosterColumns()
        {
            if (_d173E181RosterFitting) return;
            _d173E181RosterFitting = true;
            try {
            var grid = _pickerOnlineGrid;
            if (grid == null || grid.IsDisposed || grid.Columns.Count < 15) return;
            var width = grid.ClientSize.Width;
            if (width < 220) return;
            grid.ScrollBars = ScrollBars.Vertical;
            // Keep Agent177's identity, client, login, activity, status and
            // three RBAC action columns at every supported viewport width.
            var names = new[] {
                "D173SummaryIdentity", "D173SummaryClient", "D173SummaryTime",
                "D173SummaryActivity", "D173SummaryState", "D173SummaryTech",
                "KickUser", "CallSpecialist", "ResolveContact"
            };
            var tech = _d173RosterTech.Checked;
            foreach (var name in names)
            {
                var col = grid.Columns[name];
                if (col == null) continue;
                if (col.AutoSizeMode != DataGridViewAutoSizeColumnMode.None)
                    col.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                var showColumn = name != "D173SummaryTech" || tech;
                if (col.Visible != showColumn) col.Visible = showColumn;
            }
            var active = names.Select(name => grid.Columns[name])
                .Where(col => col != null && col.Visible).ToArray();
            var compact = width < 850;
            var small = new[] { 112, 67, 62, 80, 85, 64, 48, 54, 47 };
            var normal = new[] { 150, 85, 75, 116, 120, 70, 63, 76, 61 };
            var preferred = new[] { 245, 162, 108, 185, 205, 130, 83, 113, 80 };
            var specs = names.Select((name, i) => new {
                name, minimum = compact ? small[i] : normal[i],
                preferred = preferred[i]
            }).ToDictionary(x => x.name, x => x);
            var available = Math.Max(220, width - SystemInformation.VerticalScrollBarWidth - 6);
            var baseSum = active.Sum(col => specs[col.Name].minimum);
            var scale = baseSum > available ? available / (double)baseSum : 1.0;
            var used = 0;
            var extra = Math.Max(0, available - baseSum);
            var weight = Math.Max(1, active.Sum(col =>
                specs[col.Name].preferred - specs[col.Name].minimum));
            for (var i = 0; i < active.Length; i++)
            {
                var col = active[i];
                var spec = specs[col.Name];
                var w = scale < 1 ? Math.Max(20, (int)Math.Floor(spec.minimum * scale))
                    : spec.minimum + (int)Math.Floor(extra *
                        (spec.preferred - spec.minimum) / (double)weight);
                if (i == active.Length - 1) w = Math.Max(20, available - used);
                if (col.MinimumWidth != 20) col.MinimumWidth = 20;
                if (col.Width != w) col.Width = w;
                used += w;
            }
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
