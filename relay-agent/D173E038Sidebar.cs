using System;
using System.Drawing;
using System.Drawing.Drawing2D;
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
                        Padding = new Padding(34, 0, 0, 0),
                        Margin = new Padding(0, 0, 0, 5),
                        FlatStyle = FlatStyle.Flat,
                        UseVisualStyleBackColor = false,
                        Cursor = Cursors.Hand
                    };
                    button.FlatAppearance.BorderSize = 0;
                    button.Paint += (sender, args) =>
                        D173E079DrawNavGlyph(args.Graphics,
                            captured == null ? "" : captured.Text,
                            ReferenceEquals(captured, _mainTabs.SelectedTab),
                            new Rectangle(10, 10, 20, 20));
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
        // Native 20px vector icons: no font/image dependency or bitmap files.
        private static void D173E079DrawNavGlyph(Graphics graphics,string section,
            bool selected,Rectangle r)
        {
            var c=selected?Color.White:Color.FromArgb(185,212,243);
            var state=graphics.Save();
            graphics.SmoothingMode=SmoothingMode.AntiAlias;
            using(var pen=new Pen(c,2f))
            using(var brush=new SolidBrush(c))
            {
                var x=r.X;var y=r.Y;
                if(section=="Tổng quan")
                {
                    graphics.DrawLines(pen,new[]{new Point(x+1,y+9),new Point(x+10,y+2),
                        new Point(x+19,y+9)});
                    graphics.DrawRectangle(pen,x+4,y+9,12,10);
                    graphics.DrawRectangle(pen,x+9,y+14,3,5);
                }
                else if(section=="Cài đặt")
                {
                    graphics.DrawEllipse(pen,x+4,y+4,12,12);
                    graphics.DrawEllipse(pen,x+8,y+8,4,4);
                    for(var i=0;i<8;i++)
                    {
                        var a=i*Math.PI/4d;
                        var x1=x+10+(int)(8*Math.Cos(a));
                        var y1=y+10+(int)(8*Math.Sin(a));
                        var x2=x+10+(int)(10*Math.Cos(a));
                        var y2=y+10+(int)(10*Math.Sin(a));
                        graphics.DrawLine(pen,x1,y1,x2,y2);
                    }
                }
                else if(section=="Cập nhật SKU")
                {
                    graphics.DrawPolygon(pen,new[]{new Point(x+10,y+1),new Point(x+18,y+5),
                        new Point(x+18,y+15),new Point(x+10,y+19),
                        new Point(x+2,y+15),new Point(x+2,y+5)});
                    graphics.DrawLine(pen,x+2,y+5,x+10,y+10);
                    graphics.DrawLine(pen,x+18,y+5,x+10,y+10);
                    graphics.DrawLine(pen,x+10,y+10,x+10,y+19);
                }
                else if(section=="Web Confirm")
                {
                    graphics.DrawEllipse(pen,x+1,y+1,18,18);
                    graphics.DrawEllipse(pen,x+6,y+1,8,18);
                    graphics.DrawLine(pen,x+1,y+10,x+19,y+10);
                }
                else if(section=="Hiệu năng")
                {
                    graphics.DrawArc(pen,x+1,y+3,18,18,190,160);
                    graphics.DrawLine(pen,x+10,y+13,x+16,y+5);
                    graphics.FillEllipse(brush,x+8,y+11,4,4);
                }
                else if(section=="Giám sát Usage")
                {
                    graphics.FillRectangle(brush,x+2,y+11,4,8);
                    graphics.FillRectangle(brush,x+8,y+5,4,14);
                    graphics.FillRectangle(brush,x+14,y+8,4,11);
                }
                else
                {
                    graphics.DrawRectangle(pen,x+4,y+2,12,16);
                    graphics.DrawLine(pen,x+7,y+7,x+14,y+7);
                    graphics.DrawLine(pen,x+7,y+11,x+14,y+11);
                    graphics.DrawLine(pen,x+7,y+15,x+12,y+15);
                }
            }
            graphics.Restore(state);
        }

    }
}
