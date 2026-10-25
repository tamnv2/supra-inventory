using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
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
            _d173ThemeClock.Tick += (sender, args) => ApplyD173AppWideTheme();
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

        private void ApplyD173AppWideTheme(bool force = false)
        {
            if (!_d173ThemeInitialized || IsDisposed) return;
            var dark = _d173ThemeChoice == "DARK" ||
                (_d173ThemeChoice == "AUTO" && D173VietnamNight());
            if (!force && _d173LastDark == dark && Application.OpenForms.Cast<Form>()
                .All(form => _d173OriginalThemeColors.ContainsKey(form))) return;
            _d173LastDark = dark;
            SuspendLayout();
            try {
                // Main window AND every currently open Agent dialog use one palette.
                // WebView2/WMS is a separately hosted authenticated browser.
                foreach (Form form in Application.OpenForms) {
                    if (form != null && !form.IsDisposed)
                        ApplyD173ColorsRecursively(form, dark);
                }
            }
            finally { ResumeLayout(true); }
        }

        private void ApplyD173ColorsRecursively(Control control, bool dark)
        {
            if (control == null || control.IsDisposed) return;
            D173OriginalControlColors original;
            if (!_d173OriginalThemeColors.TryGetValue(control, out original))
            {
                original = new D173OriginalControlColors {
                    Background = control.BackColor, Foreground = control.ForeColor
                };
                _d173OriginalThemeColors[control] = original;
            }
            // Custom 60-point performance sparkline controls must follow the
            // exact same palette on both Overview and Hiệu năng pages.
            var trend = control as D173ResourceSparkline;
            if (trend != null)
            {
                trend.BackColor = dark ? Color.FromArgb(30, 45, 64) :
                    Color.FromArgb(248, 250, 252);
                trend.Invalidate();
            }
            var table = control as DataGridView;
            if (table != null)
            {
                table.EnableHeadersVisualStyles = false;
                table.BackgroundColor = dark ? Color.FromArgb(20, 31, 48) : Color.White;
                table.GridColor = dark ? Color.FromArgb(48, 64, 83) : Color.FromArgb(228, 235, 241);
                table.ColumnHeadersDefaultCellStyle.BackColor =
                    dark ? Color.FromArgb(35, 50, 69) : Color.FromArgb(239, 244, 249);
                table.ColumnHeadersDefaultCellStyle.ForeColor =
                    dark ? Color.FromArgb(235, 242, 249) : Color.FromArgb(34, 52, 70);
                table.DefaultCellStyle.BackColor = dark ? Color.FromArgb(23, 36, 53) : Color.White;
                table.DefaultCellStyle.ForeColor = dark ? Color.FromArgb(227, 235, 245) : Color.FromArgb(32, 48, 68);
                table.DefaultCellStyle.SelectionBackColor =
                    dark ? Color.FromArgb(48, 83, 120) : Color.FromArgb(225, 239, 254);
                table.DefaultCellStyle.SelectionForeColor =
                    dark ? Color.White : Color.FromArgb(25, 47, 77);
                table.RowsDefaultCellStyle.ForeColor = dark ? Color.FromArgb(232, 242, 252) : Color.FromArgb(32, 48, 68);
                table.RowsDefaultCellStyle.BackColor = dark ? Color.FromArgb(23, 36, 53) : Color.White;
                table.AlternatingRowsDefaultCellStyle.BackColor = dark ? Color.FromArgb(27, 42, 61) : Color.FromArgb(248, 250, 253);
                table.AlternatingRowsDefaultCellStyle.ForeColor = dark ? Color.FromArgb(232, 242, 252) : Color.FromArgb(32, 48, 68);
                foreach (DataGridViewColumn column in table.Columns)
                {
                    column.HeaderCell.Style.BackColor = dark ? Color.FromArgb(36, 55, 76) : Color.FromArgb(239, 244, 249);
                    column.HeaderCell.Style.ForeColor = dark ? Color.White : Color.FromArgb(32, 48, 68);
                    if (column is DataGridViewButtonColumn)
                    {
                        column.DefaultCellStyle.BackColor = dark ? Color.FromArgb(45, 67, 94) : Color.FromArgb(232, 240, 250);
                        column.DefaultCellStyle.ForeColor = dark ? Color.White : Color.FromArgb(25, 55, 90);
                    }
                }
                foreach (DataGridViewRow row in table.Rows)
                {
                    row.DefaultCellStyle.ForeColor = dark ? Color.FromArgb(227, 238, 250) : Color.FromArgb(34, 51, 70);
                    row.DefaultCellStyle.BackColor = dark ? Color.FromArgb(23, 36, 53) : Color.White;
                    foreach (DataGridViewCell cell in row.Cells)
                    {
                        if (cell.ReadOnly && cell is DataGridViewButtonCell)
                        {
                            cell.Style.BackColor = dark ? Color.FromArgb(40, 54, 70) : Color.FromArgb(234, 237, 242);
                            cell.Style.ForeColor = dark ? Color.FromArgb(180, 195, 212) : Color.FromArgb(101, 111, 126);
                        }
                        else if (cell is DataGridViewButtonCell)
                        {
                            cell.Style.BackColor = dark ? Color.FromArgb(47, 91, 141) : Color.FromArgb(231, 241, 254);
                            cell.Style.ForeColor = dark ? Color.White : Color.FromArgb(25, 55, 90);
                        }
                    }
                }
            }
            else if (control is TextBox || control is ComboBox || control is NumericUpDown)
            {
                control.BackColor = dark ? Color.FromArgb(30, 45, 64) : Color.White;
                control.ForeColor = dark ? Color.FromArgb(238, 244, 250) : Color.FromArgb(32, 48, 68);
            }
            else if (control is Label)
            {
                // State-colored alerts remain distinct after changing theme.
                // Dark theme must not preserve navy/near-black labels on a dark card.
                // Alerts retain distinct high-contrast red/green/blue semantics.
                control.ForeColor = dark ? D173E038ReadableDarkForeground(original.Foreground) :
                    (D173E038IsDark(original.Background) ? Color.FromArgb(32, 48, 68) : original.Foreground);
                if (original.Background.A == 255 && D173NearNeutral(original.Background))
                    control.BackColor = dark ? Color.FromArgb(23, 36, 53) : original.Background;
            }
            else if (control is TabPage || control is TableLayoutPanel ||
                control is Panel || control is GroupBox || control == this)
            {
                if (control == this || D173NearNeutral(original.Background))
                    control.BackColor = dark ? Color.FromArgb(23, 36, 53) : original.Background;
                control.ForeColor = dark ? Color.FromArgb(224, 233, 245) : original.Foreground;
            }
            else if (control is Button)
            {
                var button = (Button)control;
                button.FlatStyle = FlatStyle.Flat;
                button.FlatAppearance.BorderSize = 0;
                button.UseVisualStyleBackColor = false;
                if (D173NearNeutral(original.Background))
                    button.BackColor = dark ? Color.FromArgb(42, 61, 83) : original.Background;
                button.ForeColor = dark ? Color.White :
                    (D173E038IsDark(button.BackColor) ? Color.White : Color.FromArgb(30, 49, 68));
            }
            else if (D173NearNeutral(original.Background))
            {
                // AntdUI custom surfaces and other child controls which are not
                // System.Windows.Forms.Panel still inherit the same neutral canvas.
                control.BackColor = dark ? Color.FromArgb(23, 36, 53) : original.Background;
                control.ForeColor = dark ? Color.FromArgb(224, 233, 245) : original.Foreground;
            }
            foreach (Control child in control.Controls)
                ApplyD173ColorsRecursively(child, dark);
        }

        private static bool D173E038IsDark(Color color)
        {
            return color.GetBrightness() < 0.43f;
        }

        private static Color D173E038ReadableDarkForeground(Color color)
        {
            if (color.G > color.R * 1.25 && color.G > color.B * 0.82)
                return Color.FromArgb(88, 222, 150);
            if (color.R > color.G * 1.28 && color.R > color.B * 1.10)
                return Color.FromArgb(255, 154, 154);
            if (color.B > color.R * 1.30 && color.B > color.G * 1.10)
                return Color.FromArgb(148, 202, 255);
            return Color.FromArgb(231, 239, 249);
        }

        private static bool D173NearNeutral(Color color)
        {
            if (color.IsEmpty || color.A < 255) return false;
            return Math.Abs(color.R - color.G) < 22 &&
                   Math.Abs(color.G - color.B) < 22;
        }
    }
}
