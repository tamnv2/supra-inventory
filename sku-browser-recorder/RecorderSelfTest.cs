using System;
using System.IO;
using System.IO.Compression;

namespace SupraSkuRecorder
{
    internal static class RecorderSelfTest
    {
        internal static int Run()
        {
            var root = Path.Combine(Path.GetTempPath(),
                "d166-sku-recorder-test-" + Guid.NewGuid().ToString("N"));
            try
            {
                Directory.CreateDirectory(root);
                string first, second, runId;
                using (var log = new SafeEventLog())
                {
                    runId = log.RunId;
                    log.Write("UI_ACTION", "supra_wms", "DOWNLOAD");
                    first = log.ExportZip(root);
                    log.Write("DOWNLOAD_COMPLETED", "xlsx", "local_file_only", 71234);
                    second = log.ExportZip(root);
                }
                if (first == second || !File.Exists(first) || !File.Exists(second))
                    throw new IOException("Repeat export did not preserve unique ZIP files.");
                using (var zip = ZipFile.OpenRead(second))
                {
                    if (zip.GetEntry("events.jsonl") == null ||
                        zip.GetEntry("manifest.json") == null)
                        throw new InvalidDataException("Export missing required evidence entries.");
                    using (var reader = new StreamReader(zip.GetEntry("events.jsonl").Open()))
                    {
                        var body = reader.ReadToEnd();
                        if (!body.Contains("DOWNLOAD_COMPLETED") ||
                            !body.Contains(runId))
                            throw new InvalidDataException("Export missed new events after first ZIP.");
                    }
                }
                Console.WriteLine("D166_ZIP_EXPORT_REPEAT_AND_CONTENT=PASS");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("D166_ZIP_EXPORT=FAIL type=" + ex.GetType().Name);
                return 1;
            }
            finally
            {
                try { Directory.Delete(root, true); } catch { }
            }
        }
    }
}
