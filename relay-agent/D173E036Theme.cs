using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D173-E036: application-wide display preference. Presentation-only:
    // never changes Agent HA, WMS, network routing, auth, or provider usage.
    internal sealed partial class AgentForm
    {
        private sealed class D173OriginalControlColors
        {
            public Color Background;
            public Color Foreground;
        }
        private readonly Dictionary<Control, D173OriginalControlColors> _d173OriginalThemeColors =
            new Dictionary<Control, D173OriginalControlColors>();
        private readonly System.Windows.Forms.Timer _d173ThemeClock = new System.Windows.Forms.Timer();
        private bool _d173ThemeInitialized;
        private string _d173ThemeChoice = "AUTO";
        private bool? _d173LastDark;
        private static readonly string D173ThemeFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Agent Auto Confirm Pick Pack", "theme-choice.txt");

        // Follow the chosen palette for the native Windows title bar as well.
        // This is optional: unsupported Windows builds retain their normal chrome.
        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(
            IntPtr window, int attribute, ref int value, int size);

        private static void D173SetNativeTitleBarTheme(Form form, bool dark)
        {
            if (form == null || form.IsDisposed || !form.IsHandleCreated) return;
            try
            {
                var enable = dark ? 1 : 0;
                // Windows 10/11: newer 20, older builds 19.
                if (DwmSetWindowAttribute(form.Handle, 20, ref enable, sizeof(int)) != 0)
                    DwmSetWindowAttribute(form.Handle, 19, ref enable, sizeof(int));
            }
            catch (DllNotFoundException) { }
            catch (EntryPointNotFoundException) { }
        }

        private static bool D173VietnamNight()
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
                var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                return now.Hour >= 18 || now.Hour < 6;
            }
            catch
            {
                var now = DateTime.UtcNow.AddHours(7);
                return now.Hour >= 18 || now.Hour < 6;
            }
        }

        private void InitializeD173ThemeControlsOnce()
        {
            if (_d173ThemeInitialized || _mainTabs == null) return;
            _d173ThemeInitialized = true;
            try
            {
                if (File.Exists(D173ThemeFile))
                {
                    var saved = File.ReadAllText(D173ThemeFile).Trim().ToUpperInvariant();
                    if (saved == "AUTO" || saved == "LIGHT" || saved == "DARK")
                        _d173ThemeChoice = saved;
                }
            }
            catch { /* an unreadable preference never blocks Agent login */ }

            var settingsPage = _mainTabs.TabPages.Cast<TabPage>().FirstOrDefault(page =>
                page.Text.IndexOf("Cài đặt", StringComparison.CurrentCultureIgnoreCase) >= 0);
            if (settingsPage != null)
            {
                var footer = new Panel {
                    Dock = DockStyle.Bottom,
                    Height = 46,
                    Padding = new Padding(12, 6, 12, 6),
                    BackColor = Color.FromArgb(245, 248, 251)
                };
                var prompt = new Label {
                    Text = "Giao diện",
                    TextAlign = ContentAlignment.MiddleLeft,
                    Dock = DockStyle.Fill,
                    Font = new Font("Segoe UI", 9f, FontStyle.Bold)
                };
                var selector = new ComboBox {
                    Dock = DockStyle.Right,
                    Width = 178,
                    DropDownStyle = ComboBoxStyle.DropDownList,
                    Font = new Font("Segoe UI", 9f)
                };
                selector.Items.AddRange(new object[] { "Sáng", "Tối", "Tự động theo giờ" });
                selector.SelectedIndex = _d173ThemeChoice == "LIGHT" ? 0 :
                    _d173ThemeChoice == "DARK" ? 1 : 2;
                selector.SelectedIndexChanged += (sender, args) =>
                {
                    _d173ThemeChoice = selector.SelectedIndex == 0 ? "LIGHT" :
                        selector.SelectedIndex == 1 ? "DARK" : "AUTO";
                    try
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(D173ThemeFile));
                        File.WriteAllText(D173ThemeFile, _d173ThemeChoice);
                    }
                    catch { /* UI preference is best effort only */ }
                    ApplyD173AppWideTheme(force: true);
                };
                footer.Controls.Add(prompt);
                footer.Controls.Add(selector);
                settingsPage.Controls.Add(footer);
                footer.BringToFront();
            }
            _d173ThemeClock.Interval = 60_000;
            _d173ThemeClock.Tick += (sender, args) => ApplyD173AppWideTheme(); // repaint only on actual AUTO theme transition
            _d173ThemeClock.Start();
            _mainTabs.SelectedIndexChanged += (sender, args) => ApplyD173AppWideTheme(force: true);
            FormClosed += (sender, args) =>
            {
                _d173ThemeClock.Stop();
                _d173ThemeClock.Dispose();
                _d173OriginalThemeColors.Clear();
            };
            ApplyD173AppWideTheme(force: true);
        }

        // D173-E043: Mẫu 2 is the sole source of UI colors. The palette values
        // are sampled from the Owner-approved light/dark reference screenshots.
        // No business/network/WMS/HA state is read or changed by this renderer.
        private struct D173Sample2Palette
        {
            public Color Window, Sidebar, Card, Surface, Input, Text, Muted, Border;
            public Color Header, Row, AlternateRow, Selection, Accent;
            public Color Disabled, DisabledText, Success, Error, Chart;
        }

        private static D173Sample2Palette D173Sample2Colors(bool dark)
        {
            if (dark)
                return new D173Sample2Palette {
                    Window = Color.FromArgb(14, 23, 38),
                    Sidebar = Color.FromArgb(16, 30, 48),
                    Card = Color.FromArgb(25, 39, 58),
                    Surface = Color.FromArgb(20, 34, 54),
                    Input = Color.FromArgb(27, 44, 65),
                    Text = Color.FromArgb(228, 236, 247),
                    Muted = Color.FromArgb(155, 173, 194),
                    Border = Color.FromArgb(52, 68, 90),
                    Header = Color.FromArgb(34, 53, 77),
                    Row = Color.FromArgb(25, 39, 58),
                    AlternateRow = Color.FromArgb(20, 34, 54),
                    Selection = Color.FromArgb(24, 48, 76),
                    Accent = Color.FromArgb(0, 142, 136),
                    Disabled = Color.FromArgb(27, 44, 65),
                    DisabledText = Color.FromArgb(123, 140, 160),
                    Success = Color.FromArgb(76, 211, 168),
                    Error = Color.FromArgb(255, 154, 154),
                    Chart = Color.FromArgb(25, 39, 58)
                };
            return new D173Sample2Palette {
                Window = Color.FromArgb(247, 249, 252),
                Sidebar = Color.FromArgb(254, 254, 254),
                Card = Color.White,
                Surface = Color.FromArgb(237, 243, 249),
                Input = Color.White,
                Text = Color.FromArgb(37, 56, 80),
                Muted = Color.FromArgb(101, 119, 141),
                Border = Color.FromArgb(220, 229, 238),
                Header = Color.FromArgb(237, 242, 248),
                Row = Color.White,
                AlternateRow = Color.FromArgb(247, 249, 252),
                Selection = Color.FromArgb(237, 244, 255),
                Accent = Color.FromArgb(0, 142, 136),
                Disabled = Color.FromArgb(237, 242, 248),
                DisabledText = Color.FromArgb(136, 150, 167),
                Success = Color.FromArgb(18, 130, 103),
                Error = Color.FromArgb(176, 62, 69),
                Chart = Color.White
            };
        }

        private bool D173IsDarkThemeActive()
        {
            return _d173ThemeChoice == "DARK" ||
                   (_d173ThemeChoice == "AUTO" && D173VietnamNight());
        }

        private void ApplyD173AppWideTheme(bool force = false)
        {
            if (!_d173ThemeInitialized || IsDisposed) return;
            var dark = D173IsDarkThemeActive();
            if (!force && _d173LastDark == dark &&
                Application.OpenForms.Cast<Form>().All(form =>
                    _d173OriginalThemeColors.ContainsKey(form))) return;
            _d173LastDark = dark;
            var palette = D173Sample2Colors(dark);
            SuspendLayout();
            try
            {
                foreach (Form form in Application.OpenForms)
                    if (form != null && !form.IsDisposed)
                    {
                        D173SetNativeTitleBarTheme(form, dark);
                        ApplyD173ColorsRecursively(form, dark);
                    }
                // Sidebar selection is redrawn after the general pass: never
                // let the recursive Button rule override its teal selected state.
                RefreshD173E038SidebarSelection();
                ApplyD173ApprovedUsageTheme(dark);
            }
            finally { ResumeLayout(true); }
        }

        private static bool D173Sample2IsCard(Control control)
        {
            return string.Equals(control.Tag as string, "D173Sample2Card",
                StringComparison.Ordinal);
        }

        private static bool D173Sample2InsideCard(Control control)
        {
            for (var parent = control.Parent; parent != null; parent = parent.Parent)
                if (D173Sample2IsCard(parent)) return true;
            return false;
        }

        private static bool D173Sample2IsPrimaryButton(Button button)
        {
            var text = (button.Text ?? "").Trim();
            return text == "Tìm kiếm" ||
                text.StartsWith("Chuyển Agent chính", StringComparison.OrdinalIgnoreCase) ||
                text.StartsWith("Liên hệ nhóm", StringComparison.OrdinalIgnoreCase);
        }

        private static bool D173Sample2IsSemanticGreen(string value)
        {
            var text = (value ?? "").Trim();
            return text.StartsWith("ONLINE", StringComparison.OrdinalIgnoreCase) ||
                text.Equals("Sẵn sàng", StringComparison.CurrentCultureIgnoreCase) ||
                text.StartsWith("Đã sẵn sàng", StringComparison.CurrentCultureIgnoreCase);
        }

        private void ApplyD173GridTheme(DataGridView grid, D173Sample2Palette palette)
        {
            grid.EnableHeadersVisualStyles = false;
            grid.BackgroundColor = palette.Card;
            grid.BackColor = palette.Card;
            grid.BorderStyle = BorderStyle.None;
            grid.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
            grid.ForeColor = palette.Text;
            grid.GridColor = palette.Border;
            grid.ColumnHeadersDefaultCellStyle.BackColor = palette.Header;
            grid.ColumnHeadersDefaultCellStyle.ForeColor = palette.Muted;
            grid.ColumnHeadersDefaultCellStyle.SelectionBackColor = palette.Header;
            grid.ColumnHeadersDefaultCellStyle.SelectionForeColor = palette.Text;
            grid.RowHeadersDefaultCellStyle.BackColor = palette.Header;
            grid.RowHeadersDefaultCellStyle.ForeColor = palette.Text;
            grid.DefaultCellStyle.BackColor = palette.Row;
            grid.DefaultCellStyle.ForeColor = palette.Text;
            grid.DefaultCellStyle.SelectionBackColor = palette.Selection;
            grid.DefaultCellStyle.SelectionForeColor = palette.Text;
            grid.RowsDefaultCellStyle.BackColor = palette.Row;
            grid.RowsDefaultCellStyle.ForeColor = palette.Text;
            grid.RowsDefaultCellStyle.SelectionBackColor = palette.Selection;
            grid.RowsDefaultCellStyle.SelectionForeColor = palette.Text;
            grid.AlternatingRowsDefaultCellStyle.BackColor = palette.AlternateRow;
            grid.AlternatingRowsDefaultCellStyle.ForeColor = palette.Text;
            grid.AlternatingRowsDefaultCellStyle.SelectionBackColor = palette.Selection;
            grid.AlternatingRowsDefaultCellStyle.SelectionForeColor = palette.Text;
            foreach (DataGridViewColumn column in grid.Columns)
            {
                column.HeaderCell.Style.BackColor = palette.Header;
                column.HeaderCell.Style.ForeColor = palette.Muted;
                column.HeaderCell.Style.SelectionBackColor = palette.Header;
                column.HeaderCell.Style.SelectionForeColor = palette.Text;
                if (column is DataGridViewButtonColumn)
                {
                    // WinForms Standard-style cells repaint with OS colors,
                    // ignoring BackColor/ForeColor after switching the theme.
                    ((DataGridViewButtonColumn)column).FlatStyle = FlatStyle.Flat;
                    column.DefaultCellStyle.BackColor = palette.Surface;
                    column.DefaultCellStyle.ForeColor = palette.Accent;
                }
            }
            foreach (DataGridViewRow row in grid.Rows)
            {
                row.DefaultCellStyle.BackColor =
                    row.Index % 2 == 0 ? palette.Row : palette.AlternateRow;
                row.DefaultCellStyle.ForeColor = palette.Text;
                row.DefaultCellStyle.SelectionBackColor = palette.Selection;
                row.DefaultCellStyle.SelectionForeColor = palette.Text;
                foreach (DataGridViewCell cell in row.Cells)
                {
                    if (!(cell is DataGridViewButtonCell)) continue;
                    var inactive = cell.ReadOnly || (cell.Value != null &&
                        string.Equals(Convert.ToString(cell.Value), "—",
                            StringComparison.Ordinal));
                    cell.Style.BackColor = inactive ? palette.Disabled : palette.Surface;
                    cell.Style.ForeColor = inactive ? palette.DisabledText : palette.Accent;
                    cell.Style.SelectionBackColor = inactive ? palette.Disabled : palette.Selection;
                    cell.Style.SelectionForeColor = inactive ? palette.DisabledText : palette.Accent;
                }
            }
            grid.Invalidate();
        }

        private void ApplyD173ColorsRecursively(Control control, bool dark)
        {
            ApplyD173ColorsRecursively(control, D173Sample2Colors(dark), dark);
        }

        private void ApplyD173ColorsRecursively(
            Control control, D173Sample2Palette palette, bool dark)
        {
            if (control == null || control.IsDisposed) return;
            // WMS/WebView2 owns its authenticated page's pixels. Never recolor
            // or traverse its browser HWND: only native Agent controls are themed.
            if (control == _wmsWebViewport ||
                control.GetType().FullName.IndexOf("WebView2", StringComparison.OrdinalIgnoreCase) >= 0)
                return;

            D173OriginalControlColors original;
            if (!_d173OriginalThemeColors.TryGetValue(control, out original))
            {
                original = new D173OriginalControlColors {
                    Background = control.BackColor, Foreground = control.ForeColor
                };
                _d173OriginalThemeColors[control] = original;
            }

            var sidebar = ReferenceEquals(control, _d173SidebarNav);
            var insideCard = D173Sample2InsideCard(control);
            var card = D173Sample2IsCard(control);
            if (control is D173ResourceSparkline)
            {
                control.BackColor = palette.Chart;
                control.Invalidate();
            }
            else if (control is DataGridView)
            {
                ApplyD173GridTheme((DataGridView)control, palette);
            }
            else if (control is TextBox || control is ComboBox ||
                     control is NumericUpDown || control is ListBox)
            {
                control.BackColor = palette.Input;
                control.ForeColor = palette.Text;
            }
            else if (control is Label)
            {
                var label = (Label)control;
                label.BackColor = Color.Transparent;
                label.ForeColor = label.Name == "D173SidebarHeading" ?
                    palette.Muted :
                    (ReferenceEquals(label, _afterHoursStatus) ?
                        (dark ? Color.FromArgb(255, 220, 164) : Color.FromArgb(111, 78, 15)) :
                        (D173Sample2IsSemanticGreen(label.Text) ? palette.Success :
                            (original.Foreground == Color.DimGray ||
                             original.Foreground.GetBrightness() >= 0.35f &&
                             original.Foreground.GetSaturation() < 0.16f
                                ? palette.Muted : palette.Text)));
            }
            else if (control is Button)
            {
                var button = (Button)control;
                button.FlatStyle = FlatStyle.Flat;
                button.UseVisualStyleBackColor = false;
                var selectedSide = button.Parent == _d173SidebarNav &&
                    ReferenceEquals(button.Tag, _mainTabs.SelectedTab);
                var isSide = button.Parent == _d173SidebarNav;
                var primary = !isSide && D173Sample2IsPrimaryButton(button);
                button.BackColor = selectedSide || primary ? palette.Accent :
                    (isSide ? palette.Sidebar : palette.Surface);
                button.ForeColor = selectedSide || primary ? Color.White :
                    (isSide ? palette.Text :
                        (button.Enabled ? palette.Text : palette.DisabledText));
                button.FlatAppearance.BorderSize = isSide || selectedSide || primary ? 0 : 1;
                button.FlatAppearance.BorderColor = palette.Border;
            }
            else if (ReferenceEquals(control, _afterHoursPanel))
            {
                control.BackColor = dark ? Color.FromArgb(74, 59, 33) :
                    Color.FromArgb(255, 247, 226);
                control.ForeColor = dark ? Color.FromArgb(255, 220, 164) :
                    Color.FromArgb(111, 78, 15);
            }
            else if (control is TabPage || control is Form || control is
                     TableLayoutPanel || control is FlowLayoutPanel || control is Panel ||
                     control is GroupBox ||
                     control.GetType().FullName.StartsWith("AntdUI.", StringComparison.Ordinal))
            {
                control.BackColor = sidebar ? palette.Sidebar : card ? palette.Card :
                    (control is Form || control is TabPage ? palette.Window :
                        insideCard ? palette.Card : palette.Window);
                control.ForeColor = palette.Text;
                control.Invalidate();
            }
            else
            {
                control.ForeColor = palette.Text;
                if (D173NearNeutral(original.Background))
                    control.BackColor = insideCard ? palette.Card : palette.Window;
            }

            foreach (Control child in control.Controls)
                ApplyD173ColorsRecursively(child, palette, dark);
        }

        private static bool D173NearNeutral(Color color)
        {
            if (color.IsEmpty || color.A < 255) return false;
            return Math.Abs(color.R - color.G) < 22 &&
                   Math.Abs(color.G - color.B) < 22;
        }
    }
}
