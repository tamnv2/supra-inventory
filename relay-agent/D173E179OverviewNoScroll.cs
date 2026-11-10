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


        private void InstallD173E179NoScrollTop(
            TableLayoutPanel overview, Panel viewport, TableLayoutPanel threeColumns,
            Control agent, TableLayoutPanel middle, Control supra,
            Control picklist, Control desktop)
        {
            // The 50/50 rows are the single authority at all window sizes.
            overview.RowStyles[0].SizeType = SizeType.Percent;
            overview.RowStyles[0].Height = 50F;
            overview.RowStyles[1].SizeType = SizeType.Percent;
            overview.RowStyles[1].Height = 50F;
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

            // Below 980px of CONTENT width, four native tabs replace the
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

            InstallD173E179WebTools(supra);
            InstallD173E179PickListPager(picklist);

            var mode = -1;
            Action arrange = () => {
                if (viewport.IsDisposed || threeColumns.IsDisposed || compactTabs.IsDisposed) return;
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
                            threeColumns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40F));
                            threeColumns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 37F));
                            threeColumns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 23F));
                            threeColumns.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
                            if (supra.Parent != middle) middle.Controls.Add(supra, 0, 0);
                            if (picklist.Parent != middle) middle.Controls.Add(picklist, 0, 1);
                            middle.ColumnStyles.Clear();
                            middle.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
                            middle.RowStyles.Clear();
                            middle.RowStyles.Add(new RowStyle(SizeType.Percent, 44F));
                            middle.RowStyles.Add(new RowStyle(SizeType.Percent, 56F));
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
            };
            viewport.Resize += (s, e) => arrange();
            agent.Resize += (s, e) => D173E179FitAgentFleet(agent);
            supra.Resize += (s, e) => D173E179CompactWebLayout(supra);
            arrange();
        }

        private void D173E179FitAgentFleet(Control host)
        {
            if (host == null || host.IsDisposed || _agentFleetGrid.IsDisposed) return;
            var width = Math.Max(200, host.ClientSize.Width);
            var height = host.ClientSize.Height;
            _agentFleetGrid.ScrollBars = ScrollBars.None;
            _agentFleetGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
            var columns = _agentFleetGrid.Columns;
            if (columns.Count >= 6)
            {
                foreach (DataGridViewColumn col in columns)
                {
                    col.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                    col.Visible = col.Name == "Admin" || col.Name == "Machine" ||
                        col.Name == "Supra" || col.Name == "LastSeen";
                    col.MinimumWidth = 30;
                }
                var space = Math.Max(180, width - 29);
                columns["Admin"].Width = Math.Max(45, (int)(space * .23));
                columns["Machine"].Width = Math.Max(50, (int)(space * .30));
                columns["Supra"].Width = Math.Max(53, (int)(space * .29));
                columns["LastSeen"].Width = Math.Max(42,
                    space - columns["Admin"].Width - columns["Machine"].Width -
                    columns["Supra"].Width);
            }
            var afterHours = _afterHoursPanel.Visible;
            var gridTop = afterHours ? 257 : 164;
            var hintHeight = 19;
            var gridHeight = height - gridTop - hintHeight - 7;
            // On very short/DPI-scaled panes the full Agent roster is in the
            // lower list. Hiding the small duplicate grid avoids clipping.
            var gridVisible = HasAgentSession() && gridHeight >= 52;
            _agentFleetGrid.Visible = gridVisible;
            _agentFleetGrid.SetBounds(12, gridTop, Math.Max(160, width - 24),
                Math.Max(35, gridHeight));
            _d173E179FleetHint.SetBounds(12, Math.Max(147, height - 23),
                Math.Max(120, width - 24), 19);
            _d173E179FleetHint.Visible = HasAgentSession();
            if (gridVisible && _agentFleetGrid.Rows.Count > 0)
            {
                try { _agentFleetGrid.FirstDisplayedScrollingRowIndex = 0; }
                catch { }
            }
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

        private void D173E179CompactWebLayout(Control host)
        {
            if (host == null || host.IsDisposed || _supraCard == null ||
                _supraCard.IsDisposed) return;
            var width = Math.Max(220, host.ClientSize.Width);
            var height = host.ClientSize.Height;
            // Visible actions and status fit in 110-145px; secondary actions
            // remain available via the same native WinForms menu.
            _supraCard.AutoScroll = false;
            _toggleWmsTab.Visible = false;
            _wmsTest.Visible = false;
            _browserBundleDownload.Visible = false;
            _browserBundleProgress.Visible = false;
            _openAgentDataFolder.Visible = false;
            _moveAgentDataFolder.Visible = false;
            _supraCardTitle.SetBounds(12, 7, Math.Max(150, width - 24), 24);
            _d128BrowserResourceStatus.SetBounds(12, 33, Math.Max(150, width - 24), 20);
            var gap = 6;
            var half = Math.Max(65, (width - 30) / 2);
            _wmsCapture.SetBounds(12, 56, half, 29);
            _wmsDesktop.SetBounds(18 + half, 56, Math.Max(65, width - half - 30), 29);
            _d173E179WebTools.SetBounds(12, 91, Math.Min(112, width / 3), 27);
            _agentDataStorageStatus.SetBounds(130, 94, Math.Max(80, width - 142), 21);
            _browserBundleStatus.SetBounds(12, Math.Min(Math.Max(120, height - 26), 127),
                Math.Max(120, width - 24), 21);
            _d173E179WebTools.Visible = true;
            _d173E179WebTools.Enabled = host.Enabled;
        }

        // Only the lower session grid may have a vertical scrollbar.
        // All column data remain in existing cells for RBAC and review.
        private void D173E179FitRosterColumns()
        {
            var grid = _pickerOnlineGrid;
            if (grid == null || grid.IsDisposed || grid.Columns.Count < 15) return;
            var width = grid.ClientSize.Width;
            if (width < 250) return;
            grid.ScrollBars = ScrollBars.Vertical;
            var full = width >= 1300;
            var medium = width >= 900;
            var visible = new[] {
                "D173SummaryIdentity", "D173SummaryClient", "D173SummaryTime",
                "D173SummaryActivity", "D173SummaryState", "D173SummaryTech",
                "KickUser", "CallSpecialist", "ResolveContact"
            };
            foreach (var name in visible)
            {
                var col = grid.Columns[name];
                if (col == null) continue;
                col.AutoSizeMode = DataGridViewAutoSizeColumnMode.None;
                col.Visible = name == "D173SummaryIdentity" ||
                    name == "D173SummaryState" ||
                    name == "KickUser" || name == "CallSpecialist" ||
                    name == "ResolveContact" ||
                    (name == "D173SummaryActivity" && medium) ||
                    (name == "D173SummaryClient" && full) ||
                    (name == "D173SummaryTime" && full) ||
                    (name == "D173SummaryTech" && full && _d173RosterTech.Checked);
            }
            var active = visible.Select(n => grid.Columns[n])
                .Where(c => c != null && c.Visible).ToArray();
            var desired = new Dictionary<string, int> {
                { "D173SummaryIdentity", 235 }, { "D173SummaryClient", 160 },
                { "D173SummaryTime", 114 }, { "D173SummaryActivity", 170 },
                { "D173SummaryState", 210 }, { "D173SummaryTech", 140 },
                { "KickUser", 82 }, { "CallSpecialist", 110 },
                { "ResolveContact", 77 }
            };
            var mins = new Dictionary<string, int> {
                { "D173SummaryIdentity", 156 }, { "D173SummaryClient", 115 },
                { "D173SummaryTime", 92 }, { "D173SummaryActivity", 110 },
                { "D173SummaryState", 134 }, { "D173SummaryTech", 115 },
                { "KickUser", 69 }, { "CallSpecialist", 78 },
                { "ResolveContact", 60 }
            };
            var available = Math.Max(250, width - SystemInformation.VerticalScrollBarWidth - 4);
            foreach (var col in active) col.MinimumWidth = mins[col.Name];
            var minimumTotal = active.Sum(c => mins[c.Name]);
            var extra = Math.Max(0, available - minimumTotal);
            var weight = Math.Max(1, active.Sum(c => desired[c.Name] - mins[c.Name]));
            var assigned = 0;
            for (var i = 0; i < active.Length; i++)
            {
                var col = active[i];
                var share = i == active.Length - 1
                    ? Math.Max(0, extra - assigned)
                    : (int)Math.Floor(extra *
                        (desired[col.Name] - mins[col.Name]) / (double)weight);
                assigned += share;
                col.Width = mins[col.Name] + share;
            }
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
