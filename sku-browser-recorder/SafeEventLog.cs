using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SupraSkuRecorder
{
    internal sealed class SafeEventLog : IDisposable
    {
        private readonly object gate = new object();
        private readonly StreamWriter writer;
        private readonly Stopwatch clock = Stopwatch.StartNew();
        private readonly TimeZoneInfo vn = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        private int events;
        private bool closed;
        internal readonly string RunId = Guid.NewGuid().ToString("N").Substring(0, 16);
        internal readonly string FilePath;

        internal SafeEventLog()
        {
            var folder = Path.Combine(Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData), "SUPRA", "SKU-Recorder", "Logs");
            Directory.CreateDirectory(folder);
            FilePath = Path.Combine(folder, "sku-recorder-" + RunId + ".jsonl");
            writer = new StreamWriter(new FileStream(FilePath, FileMode.CreateNew,
                FileAccess.Write, FileShare.Read), new UTF8Encoding(false)) { AutoFlush = true };
            Write("RECORDER_OPEN", "read_only", "none");
        }

        internal void Write(string evt, string category, string detail, long value = 0)
        {
            if (!Regex.IsMatch(evt ?? "", "^[A-Z_]{2,40}$") ||
                !Regex.IsMatch(category ?? "", "^[a-z0-9_]{2,45}$") ||
                !Regex.IsMatch(detail ?? "", "^[a-zA-Z0-9_]{1,60}$")) return;
            lock (gate)
            {
                if (closed || events >= 5000) return;
                var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vn);
                writer.WriteLine(JsonSerializer.Serialize(new
                {
                    schema = "D166_SKU_RECORDER_1", run = RunId,
                    time_vn = local.ToString("yyyy-MM-ddTHH:mm:ss.fff") + "+07:00",
                    elapsed_ms = clock.ElapsedMilliseconds,
                    @event = evt, category, detail, value = Math.Max(0L, value)
                }));
                events++;
            }
        }

        // Each export is immutable and uniquely named, including repeated exports
        // in the same recording session. A failed attempt cannot corrupt a prior ZIP.
        internal string ExportZip(string folder)
        {
            if (string.IsNullOrWhiteSpace(folder))
                throw new ArgumentException("Missing export folder.", nameof(folder));
            Directory.CreateDirectory(folder);
            var name = "SUPRA_SKU_Recorder_" + RunId + "_" +
                DateTime.UtcNow.ToString("yyyyMMdd_HHmmss_fff") + "_" +
                Guid.NewGuid().ToString("N").Substring(0, 8) + ".zip";
            var destination = Path.Combine(folder, name);
            var staging = Path.Combine(folder, "." + name + ".partial");
            lock (gate)
            {
                if (closed) throw new ObjectDisposedException(nameof(SafeEventLog));
                writer.Flush();
                try
                {
                    // CreateNew prevents an accidental overwrite or stale-file reuse.
                    using (var stream = new FileStream(staging, FileMode.CreateNew,
                        FileAccess.ReadWrite, FileShare.None))
                    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create))
                    {
                        // The JSONL writer still holds FileAccess.Write. On Windows
                        // ZipFile.CreateEntryFromFile opens its source with FileShare.Read,
                        // which rejects the already-open writer (sharing violation).
                        // Explicit FileShare.ReadWrite permits a consistent, lock-held
                        // read snapshot without stopping/reopening the live logger.
                        var events = archive.CreateEntry("events.jsonl");
                        using (var source = new FileStream(FilePath, FileMode.Open,
                            FileAccess.Read, FileShare.ReadWrite))
                        using (var target = events.Open())
                            source.CopyTo(target);
                        var entry = archive.CreateEntry("manifest.json");
                        using (var output = new StreamWriter(entry.Open(), new UTF8Encoding(false)))
                            output.Write(JsonSerializer.Serialize(new
                            {
                                schema = "D166_SKU_RECORDER_1", run = RunId,
                                mode = "manual_observation_only",
                                credential_read = false, agent_mutation = false,
                                service_import_verified = false,
                                note = "UI events and local download outcomes only; no server import proof"
                            }));
                    }
                    // Do not overwrite any successful ZIP created earlier.
                    File.Move(staging, destination);
                    return destination;
                }
                finally
                {
                    try { if (File.Exists(staging)) File.Delete(staging); }
                    catch { /* Keep prior exports intact; no sensitive diagnostics. */ }
                }
            }
        }

        public void Dispose()
        {
            lock (gate)
            {
                if (closed) return;
                writer.WriteLine(JsonSerializer.Serialize(new
                {
                    schema = "D166_SKU_RECORDER_1", run = RunId,
                    @event = "RECORDER_CLOSED", elapsed_ms = clock.ElapsedMilliseconds
                }));
                closed = true;
                writer.Dispose();
            }
        }
    }
}
