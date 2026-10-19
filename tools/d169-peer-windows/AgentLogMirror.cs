using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
namespace Supra.FirebaseNetworkDiagnostic;

// Observes existing local Agent logs only; never touches runtime state or HA.
internal sealed class AgentLogMirror : IDisposable
{
    private readonly CancellationTokenSource _stop = new();
    private Task? _task;
    private readonly string _source = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Agent Auto Confirm Pick Pack","RelayPoc","Logs","agent-complete.log");
    private readonly string _target;
    private long _position;
    private DateTime _createdUtc;

    internal AgentLogMirror()
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrWhiteSpace(desktop) || !Directory.Exists(desktop))
            desktop = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        _target = Path.Combine(desktop,
            "SUPRA_AGENT_LIVE_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".log");
    }
    internal string Target => _target;
    internal void Start()
    {
        if (_task != null) return;
        try
        {
            var meta = new FileInfo(_source);
            if (meta.Exists) { _position = meta.Length; _createdUtc = meta.CreationTimeUtc; }
            File.AppendAllText(_target,
                DateTimeOffset.Now.ToString("O") + " DIAGNOSTIC_MONITOR_START (new events only)" + Environment.NewLine,
                Encoding.UTF8);
            _task = Task.Run(Loop);
        }
        catch { /* Never impact the real Agent. */ }
    }
    private async Task Loop()
    {
        while (!_stop.IsCancellationRequested)
        {
            try
            {
                var meta = new FileInfo(_source);
                if (meta.Exists)
                {
                    if (meta.Length < _position || (_createdUtc != default && meta.CreationTimeUtc != _createdUtc))
                    {
                        _position = 0;
                        File.AppendAllText(_target,
                            DateTimeOffset.Now.ToString("O") + " AGENT_LOG_ROTATED" + Environment.NewLine,
                            Encoding.UTF8);
                    }
                    _createdUtc = meta.CreationTimeUtc;
                    using var input = new FileStream(_source, FileMode.Open, FileAccess.Read,
                        FileShare.ReadWrite | FileShare.Delete);
                    if (_position <= input.Length)
                    {
                        input.Position = _position;
                        using var output = new FileStream(_target, FileMode.Append, FileAccess.Write, FileShare.Read);
                        var buffer = new byte[32768];
                        var budget = 2 * 1024 * 1024;
                        while (budget > 0)
                        {
                            var count = await input.ReadAsync(buffer.AsMemory(0, Math.Min(buffer.Length,budget)), _stop.Token);
                            if (count == 0) break;
                            await output.WriteAsync(buffer.AsMemory(0,count), _stop.Token);
                            _position += count; budget -= count;
                        }
                    }
                }
            }
            catch (OperationCanceledException) { break; }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            try { await Task.Delay(750, _stop.Token); }
            catch (OperationCanceledException) { break; }
        }
    }
    public void Dispose()
    {
        _stop.Cancel();
        try { _task?.Wait(TimeSpan.FromSeconds(2)); } catch { }
        _stop.Dispose();
    }
}
