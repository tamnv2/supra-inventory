using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D173-E038: sidebar-only WinForms presentation; leaves all existing TabPages,
    // WebView2 instances, commands, Agent roles, WMS and HA lifecycles intact.
    internal sealed partial class AgentForm
    {
        private readonly FlowLayoutPanel _d173SidebarNav = new FlowLayoutPanel();
        private bool _d173SidebarUpdating;

        private void InstallD173E038Sidebar(TableLayoutPanel host, Control actionStrip)
        {
            host.ColumnCount = 2;
            host.ColumnStyles.Clear();
            host.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 178F));
            host.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            // Hidden controls are not returned by GetControlFromPosition in all WinForms versions.
            if (actionStrip == null || !host.Controls.Contains(actionStrip))
                throw new InvalidOperationException("D173_E038_SIDEBAR_ACTION_STRIP_MISSING");
            host.SetColumnSpan(actionStrip, 2);

            _d173SidebarNav.Name = "D173Sidebar";
            _d173SidebarNav.Dock = DockStyle.Fill;
            _d173SidebarNav.FlowDirection = FlowDirection.TopDown;
            _d173SidebarNav.WrapContents = false;
            _d173SidebarNav.AutoScroll = true;
            _d173SidebarNav.BackColor = D173Sample2Colors(D173IsDarkThemeActive()).Sidebar;
            _d173SidebarNav.Padding = new Padding(10, 12, 7, 10);
            _d173SidebarNav.SizeChanged += (s, e) => ResizeD173E038SidebarButtons();
            var shell=new Panel {Dock=DockStyle.Fill,
                Name="D173SidebarShell",Margin=Padding.Empty,Padding=Padding.Empty};
            shell.Controls.Add(_d173SidebarNav);
            D173AttachSidebarTheme(shell);
            host.Controls.Add(shell, 0, 1);

            // SelectedTab remains the single authority for navigation and RBAC.
            // The 1px native tab strip is kept for WinForms TabControl internals.
            _mainTabs.Appearance = TabAppearance.FlatButtons;
            _mainTabs.SizeMode = TabSizeMode.Fixed;
            _mainTabs.ItemSize = new Size(1, 1);
            host.Controls.Add(_mainTabs, 1, 1);
            _mainTabs.ControlAdded += (s, e) => BeginRefreshD173E038Sidebar();
            _mainTabs.ControlRemoved += (s, e) => BeginRefreshD173E038Sidebar();
            _mainTabs.SelectedIndexChanged += (s, e) => RefreshD173E038SidebarSelection();
            Shown += (s, e) => RefreshD173E038Sidebar();
            RefreshD173E038Sidebar();
        }

        private void BeginRefreshD173E038Sidebar()
        {
            if (IsDisposed || !_mainTabs.IsHandleCreated) return;
            BeginInvoke(new Action(RefreshD173E038Sidebar));
        }

        private void RefreshD173E038Sidebar()
        {
            if (_d173SidebarUpdating || _d173SidebarNav.IsDisposed) return;
            _d173SidebarUpdating = true;
            _d173SidebarNav.SuspendLayout();
            try
            {
                _d173SidebarNav.Controls.Clear();
                var heading = new Label {
                    Text = "SUPRA  /  AGENT",
                    Name = "D173SidebarHeading",
                    Height = 37, Width = 145,
                    Margin = new Padding(4, 0, 0, 10),
                    Font = new Font("Segoe UI Semibold", 10.5f, FontStyle.Bold),
                    ForeColor = D173Sample2Colors(D173IsDarkThemeActive()).Muted,
                    TextAlign = ContentAlignment.MiddleLeft
                };
                _d173SidebarNav.Controls.Add(heading);
                foreach (TabPage page in _mainTabs.TabPages)
                {
                    var captured = page;
                    var button = new Button {
                        Tag = captured,
                        Text = SidebarD173E038Text(page),
                        Height = 39,
                        Width = 148,
                        TextAlign = ContentAlignment.MiddleLeft,
                        Padding = new Padding(10, 0, 0, 0),
                        Margin = new Padding(0, 0, 0, 5),
                        FlatStyle = FlatStyle.Flat,
                        UseVisualStyleBackColor = false,
                        Cursor = Cursors.Hand
                    };
                    button.FlatAppearance.BorderSize = 0;
                    button.Click += (s, e) =>
                    {
                        if (_mainTabs.TabPages.Contains(captured))
                            _mainTabs.SelectedTab = captured;
                    };
                    _d173SidebarNav.Controls.Add(button);
                }
                ResizeD173E038SidebarButtons();
                RefreshD173E038SidebarSelection();
            }
            finally
            {
                _d173SidebarNav.ResumeLayout(true);
                _d173SidebarUpdating = false;
            }
        }

        private static string SidebarD173E038Text(TabPage page)
        {
            if (page == null) return "";
            if (page.Text == "Tổng quan") return "Tổng quan";
            if (page.Text == "Web Confirm") return "Web Confirm";
            if (page.Text == "Hiệu năng") return "Hiệu năng";
            return page.Text;
        }

        private void ResizeD173E038SidebarButtons()
        {
            if (_d173SidebarNav.IsDisposed) return;
            var width = Math.Max(95, _d173SidebarNav.ClientSize.Width -
                _d173SidebarNav.Padding.Horizontal - 17);
            foreach (Control control in _d173SidebarNav.Controls)
                if (control is Button) control.Width = width;
        }

        private void RefreshD173E038SidebarSelection()
        {
            if (_d173SidebarNav.IsDisposed) return;
            var palette = D173Sample2Colors(D173IsDarkThemeActive());
            _d173SidebarNav.BackColor = palette.Sidebar;
            foreach (Control control in _d173SidebarNav.Controls)
            {
                var button = control as Button;
                if (button == null) continue;
                var selected = ReferenceEquals(button.Tag, _mainTabs.SelectedTab);
                button.BackColor = selected ? palette.Accent : palette.Sidebar;
                button.ForeColor = selected ? Color.White : palette.Text;
                button.FlatAppearance.BorderSize = 0;
                button.Font = new Font("Segoe UI", 9.0f,
                    selected ? FontStyle.Bold : FontStyle.Regular);
            }
        }
    }
}
