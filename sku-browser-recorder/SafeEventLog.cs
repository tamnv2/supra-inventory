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

        internal void ExportZip(string destination)
        {
            lock (gate) { if (!closed) writer.Flush(); }
            if (File.Exists(destination)) throw new IOException("ZIP đã tồn tại.");
            var temp = destination + ".tmp";
            if (File.Exists(temp)) File.Delete(temp);
            try
            {
                using (var archive = ZipFile.Open(temp, ZipArchiveMode.Create))
                {
                    archive.CreateEntryFromFile(FilePath, "events.jsonl");
                    var entry = archive.CreateEntry("manifest.json");
                    using (var output = new StreamWriter(entry.Open(), new UTF8Encoding(false)))
                        output.Write(JsonSerializer.Serialize(new
                        {
                            schema = "D166_SKU_RECORDER_1", run = RunId,
                            mode = "manual_observation_only",
                            credential_read = false, agent_mutation = false,
                            service_import_verified = false,
                            note = "UI metadata and local download events; server commit is unverified"
                        }));
                }
                File.Move(temp, destination);
            }
            finally { if (File.Exists(temp)) File.Delete(temp); }
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
