using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly TabPage _d173E140UnlockTab = new TabPage("Mở khóa Picker");
        private readonly DataGridView _d173E140UnlockGrid = new DataGridView();
        private readonly Label _d173E140UnlockStatus = new Label();
        private readonly Button _d173E140UnlockButton = new Button();
        private FirestoreD173E140PickerLocks _d173E140LockListener;
        private readonly List<D173E140LockedPicker> _d173E140KnownLocks =
            new List<D173E140LockedPicker>();
        private Timer _d173E140UnlockUiTimer;
        private bool _d173E140UnlockUiReady;
        private bool _d173E140UnlockRunning;

        private void D173E140InitializeUnlockUi()
        {
            if (_d173E140UnlockUiReady || IsDisposed) return;
            _d173E140UnlockUiReady = true;
            var palette = D173Sample2Colors(D173IsDarkThemeActive());
            _d173E140UnlockTab.BackColor = palette.Window;
            var root = new TableLayoutPanel {
                Dock = DockStyle.Fill, Padding = new Padding(18, 14, 18, 14),
                ColumnCount = 1, RowCount = 3, BackColor = palette.Window
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 88F));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 65F));
            var heading = new Panel { Dock = DockStyle.Fill, BackColor = palette.Window };
            heading.Controls.Add(new Label {
                Text = "PICKER ĐANG BỊ KHÓA", Dock = DockStyle.Top,
                Font = new Font("Segoe UI", 16F, FontStyle.Bold), Height = 39,
                ForeColor = palette.Text
            });
            heading.Controls.Add(new Label {
                Text = "Chỉ hiển thị Picker còn thời hạn khóa. Chọn một người dùng để mở khóa ngay.",
                Dock = DockStyle.Bottom, Height = 28,
                Font = new Font("Segoe UI", 10F), ForeColor = palette.Muted
            });
            root.Controls.Add(heading, 0, 0);

            _d173E140UnlockGrid.Name = "D173E140LockedPickerGrid";
            _d173E140UnlockGrid.Dock = DockStyle.Fill;
            _d173E140UnlockGrid.ReadOnly = true;
            _d173E140UnlockGrid.MultiSelect = false;
            _d173E140UnlockGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            _d173E140UnlockGrid.AllowUserToAddRows = false;
            _d173E140UnlockGrid.AllowUserToDeleteRows = false;
            _d173E140UnlockGrid.AllowUserToResizeRows = false;
            _d173E140UnlockGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            _d173E140UnlockGrid.RowHeadersVisible = false;
            _d173E140UnlockGrid.RowTemplate.Height = 41;
            _d173E140UnlockGrid.BackgroundColor = palette.Card;
            _d173E140UnlockGrid.GridColor = palette.Border;
            _d173E140UnlockGrid.ColumnHeadersHeight = 40;
            _d173E140UnlockGrid.EnableHeadersVisualStyles = false;
            _d173E140UnlockGrid.ColumnHeadersDefaultCellStyle.BackColor = palette.Surface;
            _d173E140UnlockGrid.ColumnHeadersDefaultCellStyle.ForeColor = palette.Text;
            _d173E140UnlockGrid.DefaultCellStyle.BackColor = palette.Card;
            _d173E140UnlockGrid.DefaultCellStyle.ForeColor = palette.Text;
            _d173E140UnlockGrid.DefaultCellStyle.SelectionBackColor = palette.Selection;
            _d173E140UnlockGrid.DefaultCellStyle.SelectionForeColor = palette.Text;
            _d173E140UnlockGrid.Columns.Add(new DataGridViewTextBoxColumn {
                Name = "Picker", HeaderText = "Tài khoản Picker", FillWeight = 34
            });
            _d173E140UnlockGrid.Columns.Add(new DataGridViewTextBoxColumn {
                Name = "Level", HeaderText = "Mức khóa", FillWeight = 15
            });
            _d173E140UnlockGrid.Columns.Add(new DataGridViewTextBoxColumn {
                Name = "Until", HeaderText = "Tự mở khóa lúc", FillWeight = 27
            });
            _d173E140UnlockGrid.Columns.Add(new DataGridViewTextBoxColumn {
                Name = "Remaining", HeaderText = "Thời gian còn lại", FillWeight = 24
            });
            _d173E140UnlockGrid.SelectionChanged += (s, e) =>
                _d173E140UnlockButton.Enabled =
                    !_d173E140UnlockRunning && _d173E140UnlockGrid.SelectedRows.Count == 1;
            root.Controls.Add(_d173E140UnlockGrid, 0, 1);

            var footer = new Panel { Dock = DockStyle.Fill, BackColor = palette.Window };
            _d173E140UnlockButton.Text = "Mở khóa Picker đã chọn";
            _d173E140UnlockButton.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            _d173E140UnlockButton.BackColor = palette.Accent;
            _d173E140UnlockButton.ForeColor = Color.White;
            _d173E140UnlockButton.FlatStyle = FlatStyle.Flat;
            _d173E140UnlockButton.FlatAppearance.BorderSize = 0;
            _d173E140UnlockButton.Width = 240;
            _d173E140UnlockButton.Height = 40;
            _d173E140UnlockButton.Left = 0;
            _d173E140UnlockButton.Top = 12;
            _d173E140UnlockButton.Enabled = false;
            _d173E140UnlockButton.Click += (s, e) => D173E140UnlockSelected();
            _d173E140UnlockStatus.Left = 255;
            _d173E140UnlockStatus.Top = 18;
            _d173E140UnlockStatus.AutoSize = true;
            _d173E140UnlockStatus.ForeColor = palette.Muted;
            _d173E140UnlockStatus.Text = "Cập nhật theo Firestore Realtime";
            footer.Controls.Add(_d173E140UnlockButton);
            footer.Controls.Add(_d173E140UnlockStatus);
            root.Controls.Add(footer, 0, 2);
            _d173E140UnlockTab.Controls.Add(root);

            // Local countdown only: no provider reads or queries.
            _d173E140UnlockUiTimer = new Timer { Interval = 8000 };
            _d173E140UnlockUiTimer.Tick += (s, e) => D173E140RenderLocks();
            _d173E140UnlockUiTimer.Start();
        }

        private void D173E140StartPickerUnlockRealtime()
        {
            if (_d173E140LockListener != null) return;
            Ui(() => D173E140InitializeUnlockUi());
            _d173E140LockListener = new FirestoreD173E140PickerLocks(
                SnapshotSession, EnsureFreshToken, HasAgentSession,
                views => {
                    // A remote unlock invalidates stale rate-check caches on
                    // every connected Agent before its next Picker request.
                    _firestoreRateLimiter.ClearCache();
                    Ui(() => {
                        _d173E140KnownLocks.Clear();
                        _d173E140KnownLocks.AddRange(views);
                        D173E140RenderLocks();
                    });
                }, Log);
            _d173E140LockListener.Start();
        }

        private void D173E140StopPickerUnlockRealtime()
        {
            var listener = _d173E140LockListener;
            _d173E140LockListener = null;
            if (listener != null) listener.Stop();
            Ui(() => {
                _d173E140KnownLocks.Clear();
                D173E140RenderLocks();
            });
        }

        private void D173E140RenderLocks()
        {
            if (!_d173E140UnlockUiReady || IsDisposed) return;
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var live = _d173E140KnownLocks.Where(x => x.LockedUntilMs > now)
                .OrderBy(x => x.LockedUntilMs).ToList();
            var selected = _d173E140UnlockGrid.SelectedRows.Count == 1
                ? Convert.ToString(_d173E140UnlockGrid.SelectedRows[0].Tag) ?? ""
                : "";
            _d173E140UnlockGrid.SuspendLayout();
            try
            {
                _d173E140UnlockGrid.Rows.Clear();
                foreach (var p in live)
                {
                    var minutes = Math.Max(1L, (p.LockedUntilMs - now + 59999L) / 60000L);
                    var until = DateTimeOffset.FromUnixTimeMilliseconds(p.LockedUntilMs)
                        .ToLocalTime().ToString("dd/MM/yyyy HH:mm");
                    var row = _d173E140UnlockGrid.Rows.Add(
                        p.UserId, p.LockLevel, until, minutes + " phút");
                    _d173E140UnlockGrid.Rows[row].Tag = p.Key;
                    if (p.Key == selected)
                        _d173E140UnlockGrid.Rows[row].Selected = true;
                }
            }
            finally { _d173E140UnlockGrid.ResumeLayout(); }

            var visible = live.Count > 0;
            if (visible && !_mainTabs.TabPages.Contains(_d173E140UnlockTab))
                _mainTabs.TabPages.Add(_d173E140UnlockTab);
            else if (!visible && _mainTabs.TabPages.Contains(_d173E140UnlockTab))
            {
                if (ReferenceEquals(_mainTabs.SelectedTab, _d173E140UnlockTab))
                    _mainTabs.SelectedTab = _overviewPage;
                _mainTabs.TabPages.Remove(_d173E140UnlockTab);
            }
            _d173E140UnlockTab.Text = "Mở khóa Picker (" + live.Count + ")";
            _d173E140UnlockStatus.Text = live.Count + " Picker đang bị khóa";
            _d173E140UnlockButton.Enabled = !_d173E140UnlockRunning &&
                _d173E140UnlockGrid.SelectedRows.Count == 1;
        }

        private void D173E140UnlockSelected()
        {
            if (_d173E140UnlockRunning || !HasAgentSession() ||
                _d173E140UnlockGrid.SelectedRows.Count != 1) return;
            var row = _d173E140UnlockGrid.SelectedRows[0];
            var key = Convert.ToString(row.Tag) ?? "";
            var pickerUser = Convert.ToString(row.Cells["Picker"].Value) ?? "";
            if (string.IsNullOrWhiteSpace(key)) return;
            if (MessageBox.Show(this,
                    "Mở khóa ngay cho Picker " + pickerUser +
                    "?\nPicker có thể tiếp tục xác nhận PickList mà không chờ hết hạn.",
                    "Xác nhận mở khóa Picker",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
                return;
            _d173E140UnlockRunning = true;
            _d173E140UnlockButton.Enabled = false;
            _d173E140UnlockStatus.Text = "Đang mở khóa trên hệ thống...";
            Task.Run(() => {
                bool ok = false;
                string failure = "";
                try
                {
                    EnsureFreshToken();
                    ok = _firestoreRateLimiter.UnlockPickerByKey(SnapshotSession(), key);
                }
                catch (Exception ex) { failure = ex.GetType().Name; }
                Ui(() => {
                    _d173E140UnlockRunning = false;
                    if (ok)
                        _d173E140UnlockStatus.Text = "Đã gửi mở khóa. Đang đồng bộ realtime...";
                    else
                        MessageBox.Show(this, "Không thể mở khóa Picker. " + failure,
                            "Lỗi mở khóa", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    D173E140RenderLocks();
                });
            });
        }
    }
}
