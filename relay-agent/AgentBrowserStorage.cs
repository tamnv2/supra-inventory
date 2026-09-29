using System;
using System.Collections.Generic;
using System.IO;

namespace SupraInventoryRelayAgent
{
    internal static class AgentBrowserStorage
    {
        internal sealed class MigrationResult
        {
            internal bool Changed;
            internal string SourceRoot = "";
            internal string TargetRoot = "";
            internal long Bytes;
            internal long Files;
            internal bool TargetPrepared;
            internal bool ConfigSwitched;
        }

        private static readonly object Gate = new object();

        internal static string DefaultRoot
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SUPRA Inventory", "ConfirmBrowser");
            }
        }

        private static string ConfigDirectory
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SUPRA Inventory");
            }
        }

        private static string ConfigFile
        {
            get { return Path.Combine(ConfigDirectory, "browser-storage-root.txt"); }
        }

        internal static string CurrentRoot
        {
            get
            {
                lock (Gate)
                {
                    try
                    {
                        if (!File.Exists(ConfigFile)) return DefaultRoot;
                        var raw = File.ReadAllText(ConfigFile).Trim();
                        if (string.IsNullOrWhiteSpace(raw)) return DefaultRoot;
                        return NormalizeManagedRoot(raw, false);
                    }
                    catch
                    {
                        return DefaultRoot;
                    }
                }
            }
        }

        internal static string ResolveTargetRoot(string selectedFolder)
        {
            if (string.IsNullOrWhiteSpace(selectedFolder))
                throw new InvalidOperationException("Chưa chọn thư mục lưu Web Agent.");

            var full = Path.GetFullPath(selectedFolder.Trim());
            var leaf = new DirectoryInfo(full).Name;
            var parent = Directory.GetParent(full);
            if (string.Equals(leaf, "ConfirmBrowser", StringComparison.OrdinalIgnoreCase) &&
                parent != null &&
                string.Equals(parent.Name, "SUPRA Inventory", StringComparison.OrdinalIgnoreCase))
                return NormalizeManagedRoot(full, true);

            return NormalizeManagedRoot(
                Path.Combine(full, "SUPRA Inventory", "ConfirmBrowser"),
                true);
        }

        internal static MigrationResult MigrateClosedBrowserData(string selectedFolder)
        {
            lock (Gate)
            {
                var source = NormalizeManagedRoot(CurrentRoot, false);
                var target = ResolveTargetRoot(selectedFolder);
                if (SamePath(source, target))
                    return new MigrationResult
                    {
                        Changed = false,
                        SourceRoot = source,
                        TargetRoot = target,
                    };

                EnsureNotNested(source, target);
                var sourceStats = DirectoryStats(source);
                EnsureFreeSpace(target, sourceStats.Item1);

                if (Directory.Exists(target) && Directory.EnumerateFileSystemEntries(target).GetEnumerator().MoveNext())
                    throw new InvalidOperationException("Thư mục đích đã có dữ liệu. Hãy chọn thư mục trống khác để tránh trộn profile Web.");

                var targetParent = Directory.GetParent(target);
                if (targetParent == null) throw new InvalidOperationException("Thư mục đích không hợp lệ.");
                Directory.CreateDirectory(targetParent.FullName);

                var temp = target + ".d149-migrating";
                if (Directory.Exists(temp)) Directory.Delete(temp, true);
                if (Directory.Exists(target)) Directory.Delete(target, true);

                var targetCommitted = false;
                var configSwitched = false;
                try
                {
                    if (Directory.Exists(source))
                    {
                        CopyDirectory(source, temp);
                        var copied = DirectoryStats(temp);
                        if (copied.Item1 != sourceStats.Item1 || copied.Item2 != sourceStats.Item2)
                            throw new IOException("Kiểm tra dữ liệu sau sao chép không khớp.");
                    }
                    else
                    {
                        Directory.CreateDirectory(temp);
                    }

                    Directory.Move(temp, target);
                    targetCommitted = true;

                    WriteConfigRoot(target);
                    configSwitched = true;

                    // D149 two-phase migration: keep the source copy intact until the
                    // managed browser successfully reopens from the new root. Program
                    // then calls FinalizeMigration. If reopen fails, RollbackMigration
                    // restores the source root without data loss.
                    return new MigrationResult
                    {
                        Changed = true,
                        SourceRoot = source,
                        TargetRoot = target,
                        Bytes = sourceStats.Item1,
                        Files = sourceStats.Item2,
                        TargetPrepared = true,
                        ConfigSwitched = true,
                    };
                }
                catch
                {
                    if (configSwitched)
                    {
                        try { WriteConfigRoot(source); } catch { }
                    }
                    try
                    {
                        if (Directory.Exists(temp)) Directory.Delete(temp, true);
                    }
                    catch { }
                    try
                    {
                        if (targetCommitted && Directory.Exists(target)) Directory.Delete(target, true);
                    }
                    catch { }
                    throw;
                }
            }
        }


        internal static void FinalizeMigration(MigrationResult result)
        {
            if (result == null || !result.Changed || !result.ConfigSwitched) return;
            lock (Gate)
            {
                if (!SamePath(CurrentRoot, result.TargetRoot))
                    throw new InvalidOperationException("Không thể hoàn tất di chuyển vì thư mục Web hiện hành đã thay đổi.");

                // Best-effort cleanup happens only after successful browser reopen.
                // Failure here is non-destructive: the target remains authority and
                // the old source is merely a recoverable duplicate.
                if (Directory.Exists(result.SourceRoot))
                {
                    try { Directory.Delete(result.SourceRoot, true); }
                    catch { }
                }
            }
        }

        internal static void RollbackMigration(MigrationResult result)
        {
            if (result == null || !result.Changed) return;
            lock (Gate)
            {
                if (result.ConfigSwitched)
                {
                    WriteConfigRoot(result.SourceRoot);
                    result.ConfigSwitched = false;
                }

                if (result.TargetPrepared && Directory.Exists(result.TargetRoot))
                {
                    try { Directory.Delete(result.TargetRoot, true); }
                    catch { }
                }
            }
        }

        private static string NormalizeManagedRoot(string path, bool requireFixedDrive)
        {
            var full = Path.GetFullPath(path.Trim()).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (full.StartsWith(@"\\", StringComparison.Ordinal))
                throw new InvalidOperationException("Không hỗ trợ lưu Web Agent trên đường dẫn mạng/UNC.");

            var root = Path.GetPathRoot(full);
            if (string.IsNullOrWhiteSpace(root))
                throw new InvalidOperationException("Không xác định được ổ lưu dữ liệu Web Agent.");

            var drive = new DriveInfo(root);
            if (requireFixedDrive)
            {
                if (!drive.IsReady)
                    throw new InvalidOperationException("Ổ đĩa đích chưa sẵn sàng.");
                if (drive.DriveType != DriveType.Fixed)
                    throw new InvalidOperationException("Chỉ hỗ trợ ổ đĩa nội bộ Fixed; không dùng USB/removable/network.");
            }
            return full;
        }

        private static void EnsureFreeSpace(string target, long sourceBytes)
        {
            var root = Path.GetPathRoot(target);
            var drive = new DriveInfo(root);
            if (!drive.IsReady || drive.DriveType != DriveType.Fixed)
                throw new InvalidOperationException("Ổ đĩa đích phải là ổ nội bộ Fixed và đang sẵn sàng.");

            var required = Math.Max(256L * 1024L * 1024L, sourceBytes + Math.Max(128L * 1024L * 1024L, sourceBytes / 10L));
            if (drive.AvailableFreeSpace < required)
                throw new InvalidOperationException("Ổ đĩa đích không đủ dung lượng an toàn để di chuyển dữ liệu Web Agent.");
        }

        private static void EnsureNotNested(string source, string target)
        {
            var src = source.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            var dst = target.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (dst.StartsWith(src, StringComparison.OrdinalIgnoreCase) ||
                src.StartsWith(dst, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Thư mục mới không được nằm bên trong hoặc bao ngoài thư mục dữ liệu Web hiện tại.");
        }

        private static bool SamePath(string left, string right)
        {
            return string.Equals(
                Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                StringComparison.OrdinalIgnoreCase);
        }

        private static Tuple<long, long> DirectoryStats(string root)
        {
            long bytes = 0;
            long files = 0;
            if (!Directory.Exists(root)) return Tuple.Create(bytes, files);
            foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            {
                var info = new FileInfo(file);
                bytes += info.Length;
                files++;
            }
            return Tuple.Create(bytes, files);
        }

        private static void CopyDirectory(string source, string target)
        {
            Directory.CreateDirectory(target);
            var sourcePrefix = source.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

            foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            {
                var relative = directory.Substring(sourcePrefix.Length);
                Directory.CreateDirectory(Path.Combine(target, relative));
            }

            foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
            {
                var relative = file.Substring(sourcePrefix.Length);
                var destination = Path.Combine(target, relative);
                var parent = Path.GetDirectoryName(destination);
                if (!string.IsNullOrWhiteSpace(parent)) Directory.CreateDirectory(parent);
                File.Copy(file, destination, true);
            }
        }

        private static void WriteConfigRoot(string root)
        {
            Directory.CreateDirectory(ConfigDirectory);
            var temp = ConfigFile + ".tmp";
            File.WriteAllText(temp, Path.GetFullPath(root));
            if (File.Exists(ConfigFile)) File.Delete(ConfigFile);
            File.Move(temp, ConfigFile);
        }
    }
}
