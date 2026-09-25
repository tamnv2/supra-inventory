using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal static class ExitAuthorization
    {
        private const int Iterations = 120000;
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("SUPRA.Inventory.AgentExit.v1");

        internal static void SaveVerifier(string path, string appUserId, string password)
        {
            if (string.IsNullOrWhiteSpace(appUserId) || string.IsNullOrEmpty(password)) return;

            var salt = new byte[16];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(salt);
            byte[] hash = null;
            byte[] plain = null;
            byte[] encrypted = null;
            try
            {
                using (var derive = new Rfc2898DeriveBytes(password, salt, Iterations))
                    hash = derive.GetBytes(32);

                var payload = new Dictionary<string, object>
                {
                    { "schema_version", 1 },
                    { "app_user_id", appUserId },
                    { "iterations", Iterations },
                    { "salt", Convert.ToBase64String(salt) },
                    { "hash", Convert.ToBase64String(hash) }
                };
                plain = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(payload));
                encrypted = ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser);

                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                File.WriteAllBytes(path, encrypted);
            }
            finally
            {
                Array.Clear(salt, 0, salt.Length);
                if (hash != null) Array.Clear(hash, 0, hash.Length);
                if (plain != null) Array.Clear(plain, 0, plain.Length);
                if (encrypted != null) Array.Clear(encrypted, 0, encrypted.Length);
            }
        }

        internal static bool Verify(string path, string appUserId, string password)
        {
            if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(appUserId) ||
                string.IsNullOrEmpty(password) || !File.Exists(path))
                return false;

            byte[] encrypted = null;
            byte[] plain = null;
            byte[] salt = null;
            byte[] expected = null;
            byte[] actual = null;
            try
            {
                encrypted = File.ReadAllBytes(path);
                plain = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
                var map = new JavaScriptSerializer().DeserializeObject(Encoding.UTF8.GetString(plain)) as Dictionary<string, object>;
                if (map == null) return false;

                object value;
                var storedUser = map.TryGetValue("app_user_id", out value) ? Convert.ToString(value) : "";
                if (!string.Equals(storedUser, appUserId, StringComparison.Ordinal)) return false;

                var iterations = map.TryGetValue("iterations", out value) ? Convert.ToInt32(value) : Iterations;
                salt = Convert.FromBase64String(map.TryGetValue("salt", out value) ? Convert.ToString(value) : "");
                expected = Convert.FromBase64String(map.TryGetValue("hash", out value) ? Convert.ToString(value) : "");
                using (var derive = new Rfc2898DeriveBytes(password, salt, iterations))
                    actual = derive.GetBytes(expected.Length);
                return FixedTimeEquals(expected, actual);
            }
            catch
            {
                return false;
            }
            finally
            {
                if (encrypted != null) Array.Clear(encrypted, 0, encrypted.Length);
                if (plain != null) Array.Clear(plain, 0, plain.Length);
                if (salt != null) Array.Clear(salt, 0, salt.Length);
                if (expected != null) Array.Clear(expected, 0, expected.Length);
                if (actual != null) Array.Clear(actual, 0, actual.Length);
            }
        }

        private static bool FixedTimeEquals(byte[] left, byte[] right)
        {
            if (left == null || right == null || left.Length != right.Length) return false;
            var diff = 0;
            for (var i = 0; i < left.Length; i++) diff |= left[i] ^ right[i];
            return diff == 0;
        }
    }


    internal sealed class AgentPasswordVerificationDialog : Form
    {
        private readonly TextBox _password = new TextBox();
        internal string PasswordValue { get { return _password.Text; } }

        internal AgentPasswordVerificationDialog(string agentUser, string title, string message, string confirmText)
        {
            Text = string.IsNullOrWhiteSpace(title) ? "Xác minh Agent" : title;
            ClientSize = new Size(440, 186);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            Font = new Font("Segoe UI", 9F);

            Controls.Add(new Label
            {
                Left = 18,
                Top = 18,
                Width = 400,
                Height = 42,
                Text = string.IsNullOrWhiteSpace(message) ? "Nhập mật khẩu xác minh Agent hiện tại." : message
            });
            Controls.Add(new Label
            {
                Left = 18,
                Top = 66,
                Width = 400,
                Height = 20,
                Text = "Tài khoản Agent: " + (string.IsNullOrWhiteSpace(agentUser) ? "chưa đăng nhập" : agentUser)
            });
            _password.SetBounds(18, 90, 400, 27);
            _password.UseSystemPasswordChar = true;
            Controls.Add(_password);

            var cancel = new Button { Left = 232, Top = 136, Width = 88, Height = 32, Text = "Hủy", DialogResult = DialogResult.Cancel };
            var ok = new Button { Left = 330, Top = 136, Width = 88, Height = 32, Text = string.IsNullOrWhiteSpace(confirmText) ? "Xác nhận" : confirmText, DialogResult = DialogResult.OK };
            Controls.Add(cancel);
            Controls.Add(ok);
            AcceptButton = ok;
            CancelButton = cancel;
            Shown += (s, e) => _password.Focus();
        }
    }

    internal sealed class ExitPasswordDialog : Form
    {
        private readonly TextBox _password = new TextBox();
        internal string PasswordValue { get { return _password.Text; } }

        internal ExitPasswordDialog(string adminUser)
        {
            Text = "Tắt SUPRA Inventory Agent";
            ClientSize = new Size(420, 176);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            Font = new Font("Segoe UI", 9F);

            Controls.Add(new Label
            {
                Left = 18,
                Top = 18,
                Width = 380,
                Height = 42,
                Text = "Agent được thiết kế chạy xuyên suốt ca. Nhập mật khẩu ADMIN hiện tại để tắt có chủ đích."
            });
            Controls.Add(new Label
            {
                Left = 18,
                Top = 64,
                Width = 380,
                Height = 20,
                Text = "ADMIN: " + (string.IsNullOrWhiteSpace(adminUser) ? "chưa đăng nhập" : adminUser)
            });
            _password.SetBounds(18, 88, 380, 26);
            _password.UseSystemPasswordChar = true;
            Controls.Add(_password);

            var cancel = new Button { Left = 220, Top = 128, Width = 84, Height = 30, Text = "Hủy", DialogResult = DialogResult.Cancel };
            var ok = new Button { Left = 314, Top = 128, Width = 84, Height = 30, Text = "Tắt Agent", DialogResult = DialogResult.OK };
            Controls.Add(cancel);
            Controls.Add(ok);
            AcceptButton = ok;
            CancelButton = cancel;
            Shown += (s, e) => _password.Focus();
        }
    }
}
