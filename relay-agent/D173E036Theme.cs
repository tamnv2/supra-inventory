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
            if (!force && _d173LastDark == dark) return;
            _d173LastDark = dark;
            SuspendLayout();
            try { ApplyD173ColorsRecursively(this, dark); }
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
            }
            else if (control is TextBox || control is ComboBox || control is NumericUpDown)
            {
                control.BackColor = dark ? Color.FromArgb(30, 45, 64) : Color.White;
                control.ForeColor = dark ? Color.FromArgb(238, 244, 250) : Color.FromArgb(32, 48, 68);
            }
            else if (control is Label)
            {
                control.ForeColor = dark ? Color.FromArgb(220, 232, 245) : original.Foreground;
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
                button.ForeColor = dark && D173NearNeutral(original.Background)
                    ? Color.White : original.Foreground;
            }
            foreach (Control child in control.Controls)
                ApplyD173ColorsRecursively(child, dark);
        }

        private static bool D173NearNeutral(Color color)
        {
            if (color.IsEmpty || color.A < 255) return false;
            return Math.Abs(color.R - color.G) < 22 &&
                   Math.Abs(color.G - color.B) < 22;
        }
    }
}
