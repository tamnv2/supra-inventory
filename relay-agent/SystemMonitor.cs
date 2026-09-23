using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;

namespace SupraInventoryRelayAgent
{
    internal sealed class SystemMetrics
    {
        internal double CpuPercent = -1;
        internal int CurrentMhz;
        internal ulong RamUsedBytes;
        internal ulong RamTotalBytes;
        internal double DiskPercent = -1;
        internal double GpuPercent = -1;
        internal string NetworkKind = "--";
        internal double NetworkDownMbps = -1;
        internal double NetworkUpMbps = -1;
        internal bool InternetKnown;
        internal bool InternetConnected;
        internal double ProcessCpuPercent = -1;
        internal long ProcessWorkingSetBytes;
        internal TimeSpan ProcessUptime;

        internal string Compact()
        {
            var cpu = CpuPercent < 0 ? "--" : Math.Round(CpuPercent).ToString("0");
            var used = RamUsedBytes / 1073741824.0;
            var total = RamTotalBytes / 1073741824.0;
            var disk = DiskPercent < 0 ? "--" : Math.Round(DiskPercent).ToString("0");
            return "SUPRA | CPU " + cpu + "% | RAM " + used.ToString("0.0") + "/" + total.ToString("0.0") +
                   "GB | Disk " + disk + "%";
        }

        internal string MenuText()
        {
            return "Máy: " + Compact().Replace("SUPRA | ", "");
        }

        internal string LaptopLine()
        {
            var cpu = CpuPercent < 0 ? "--" : Math.Round(CpuPercent).ToString("0") + "%";
            var ram = RamTotalBytes == 0 ? "--" :
                (RamUsedBytes / 1073741824.0).ToString("0.0") + "/" +
                (RamTotalBytes / 1073741824.0).ToString("0.0") + "GB";
            var disk = DiskPercent < 0 ? "--" : Math.Round(DiskPercent).ToString("0") + "%";
            var gpu = GpuPercent < 0 ? "--" : Math.Round(GpuPercent).ToString("0") + "%";
            var down = NetworkDownMbps < 0 ? "--" : NetworkDownMbps.ToString("0.0");
            var up = NetworkUpMbps < 0 ? "--" : NetworkUpMbps.ToString("0.0");
            var internet = !InternetKnown ? "--" : (InternetConnected ? "ON" : "OFF");
            return "Laptop | CPU " + cpu + " | Memory " + ram + " | Disk " + disk +
                   " | " + NetworkKind + " ↓" + down + " ↑" + up + "Mbps · Internet " + internet +
                   " | GPU " + gpu;
        }
    }

    internal sealed class SystemMonitor : IDisposable
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct MEMORYSTATUSEX
        {
            internal uint dwLength;
            internal uint dwMemoryLoad;
            internal ulong ullTotalPhys;
            internal ulong ullAvailPhys;
            internal ulong ullTotalPageFile;
            internal ulong ullAvailPageFile;
            internal ulong ullTotalVirtual;
            internal ulong ullAvailVirtual;
            internal ulong ullAvailExtendedVirtual;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct PROCESSOR_POWER_INFORMATION
        {
            internal uint Number;
            internal uint MaxMhz;
            internal uint CurrentMhz;
            internal uint MhzLimit;
            internal uint MaxIdleState;
            internal uint CurrentIdleState;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX buffer);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetSystemTimes(out FILETIME idleTime, out FILETIME kernelTime, out FILETIME userTime);

        [DllImport("powrprof.dll")]
        private static extern uint CallNtPowerInformation(
            int informationLevel,
            IntPtr inputBuffer,
            uint inputBufferSize,
            IntPtr outputBuffer,
            uint outputBufferSize);

        [DllImport("wininet.dll", SetLastError = true)]
        private static extern bool InternetGetConnectedState(out int description, int reservedValue);

        private readonly object _gate = new object();
        private ulong _previousIdle;
        private ulong _previousKernel;
        private ulong _previousUser;
        private bool _hasPrevious;
        private string _networkId = "";
        private long _networkRx;
        private long _networkTx;
        private DateTime _networkSampleUtc = DateTime.MinValue;
        private PerformanceCounter _diskCounter;
        private readonly List<PerformanceCounter> _gpuCounters = new List<PerformanceCounter>();
        private DateTime _gpuLastSampleUtc = DateTime.MinValue;
        private double _gpuLastValue = -1;
        private bool _gpuInitialized;
        private TimeSpan _previousProcessCpu = TimeSpan.Zero;
        private DateTime _previousProcessSampleUtc = DateTime.MinValue;

        internal SystemMetrics Sample()
        {
            lock (_gate)
            {
                var result = new SystemMetrics
                {
                    CpuPercent = SampleCpu(),
                    CurrentMhz = SampleCurrentMhz(),
                    DiskPercent = SampleDisk(),
                    GpuPercent = SampleGpu()
                };
                SampleProcess(result);

                var memory = new MEMORYSTATUSEX();
                memory.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
                if (GlobalMemoryStatusEx(ref memory))
                {
                    result.RamTotalBytes = memory.ullTotalPhys;
                    result.RamUsedBytes = memory.ullTotalPhys >= memory.ullAvailPhys
                        ? memory.ullTotalPhys - memory.ullAvailPhys
                        : 0;
                }

                SampleNetwork(result);
                try
                {
                    int flags;
                    result.InternetConnected = InternetGetConnectedState(out flags, 0);
                    result.InternetKnown = true;
                }
                catch
                {
                    result.InternetKnown = false;
                }

                return result;
            }
        }

        private void SampleProcess(SystemMetrics result)
        {
            try
            {
                using (var process = Process.GetCurrentProcess())
                {
                    process.Refresh();
                    result.ProcessWorkingSetBytes = Math.Max(0L, process.WorkingSet64);
                    result.ProcessUptime = DateTime.Now - process.StartTime;
                    var now = DateTime.UtcNow;
                    var cpu = process.TotalProcessorTime;
                    if (_previousProcessSampleUtc != DateTime.MinValue)
                    {
                        var elapsedMs = Math.Max(1.0, (now - _previousProcessSampleUtc).TotalMilliseconds);
                        var cpuMs = Math.Max(0.0, (cpu - _previousProcessCpu).TotalMilliseconds);
                        result.ProcessCpuPercent = Math.Max(0, Math.Min(100, cpuMs / elapsedMs * 100.0 / Math.Max(1, Environment.ProcessorCount)));
                    }
                    _previousProcessCpu = cpu;
                    _previousProcessSampleUtc = now;
                }
            }
            catch
            {
                result.ProcessCpuPercent = -1;
            }
        }

        private double SampleCpu()
        {
            FILETIME idle, kernel, user;
            if (!GetSystemTimes(out idle, out kernel, out user)) return -1;

            var idleNow = ToUInt64(idle);
            var kernelNow = ToUInt64(kernel);
            var userNow = ToUInt64(user);

            if (!_hasPrevious)
            {
                _previousIdle = idleNow;
                _previousKernel = kernelNow;
                _previousUser = userNow;
                _hasPrevious = true;
                return -1;
            }

            var idleDelta = idleNow - _previousIdle;
            var kernelDelta = kernelNow - _previousKernel;
            var userDelta = userNow - _previousUser;
            _previousIdle = idleNow;
            _previousKernel = kernelNow;
            _previousUser = userNow;

            var total = kernelDelta + userDelta;
            if (total == 0) return 0;
            var busy = total > idleDelta ? total - idleDelta : 0;
            return Math.Max(0, Math.Min(100, busy * 100.0 / total));
        }

        private static int SampleCurrentMhz()
        {
            var count = Math.Max(1, Environment.ProcessorCount);
            var size = Marshal.SizeOf(typeof(PROCESSOR_POWER_INFORMATION));
            var bytes = checked(size * count);
            var buffer = Marshal.AllocHGlobal(bytes);
            try
            {
                var status = CallNtPowerInformation(11, IntPtr.Zero, 0, buffer, (uint)bytes);
                if (status != 0) return 0;
                long sum = 0;
                var valid = 0;
                for (var i = 0; i < count; i++)
                {
                    var ptr = IntPtr.Add(buffer, i * size);
                    var info = (PROCESSOR_POWER_INFORMATION)Marshal.PtrToStructure(ptr, typeof(PROCESSOR_POWER_INFORMATION));
                    if (info.CurrentMhz > 0) { sum += info.CurrentMhz; valid++; }
                }
                return valid == 0 ? 0 : (int)(sum / valid);
            }
            catch { return 0; }
            finally { Marshal.FreeHGlobal(buffer); }
        }

        private double SampleDisk()
        {
            try
            {
                if (_diskCounter == null)
                {
                    _diskCounter = new PerformanceCounter("PhysicalDisk", "% Disk Time", "_Total", true);
                    _diskCounter.NextValue();
                    return -1;
                }
                return Math.Max(0, Math.Min(100, _diskCounter.NextValue()));
            }
            catch { return -1; }
        }

        private double SampleGpu()
        {
            var now = DateTime.UtcNow;
            if ((now - _gpuLastSampleUtc).TotalSeconds < 15 && _gpuLastSampleUtc != DateTime.MinValue)
                return _gpuLastValue;

            _gpuLastSampleUtc = now;
            try
            {
                if (!_gpuInitialized)
                {
                    _gpuInitialized = true;
                    var category = new PerformanceCounterCategory("GPU Engine");
                    foreach (var name in category.GetInstanceNames()
                        .Where(x => x.IndexOf("engtype_3D", StringComparison.OrdinalIgnoreCase) >= 0)
                        .Take(32))
                    {
                        try
                        {
                            var counter = new PerformanceCounter("GPU Engine", "Utilization Percentage", name, true);
                            counter.NextValue();
                            _gpuCounters.Add(counter);
                        }
                        catch { }
                    }
                    _gpuLastValue = _gpuCounters.Count == 0 ? -1 : 0;
                    return _gpuLastValue;
                }

                if (_gpuCounters.Count == 0) return -1;
                double total = 0;
                foreach (var counter in _gpuCounters)
                {
                    try { total += Math.Max(0, counter.NextValue()); } catch { }
                }
                _gpuLastValue = Math.Max(0, Math.Min(100, total));
                return _gpuLastValue;
            }
            catch
            {
                _gpuLastValue = -1;
                return -1;
            }
        }

        private void SampleNetwork(SystemMetrics result)
        {
            try
            {
                var nic = NetworkInterface.GetAllNetworkInterfaces()
                    .Where(x => x.OperationalStatus == OperationalStatus.Up &&
                                (x.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ||
                                 x.NetworkInterfaceType == NetworkInterfaceType.Ethernet ||
                                 x.NetworkInterfaceType == NetworkInterfaceType.GigabitEthernet))
                    .OrderByDescending(x => x.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                    .FirstOrDefault();

                if (nic == null)
                {
                    result.NetworkKind = "Network --";
                    return;
                }

                result.NetworkKind = nic.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ? "WiFi" : "Ethernet";
                var stats = nic.GetIPv4Statistics();
                var now = DateTime.UtcNow;
                var id = nic.Id ?? nic.Name ?? "";
                if (!string.Equals(_networkId, id, StringComparison.Ordinal) || _networkSampleUtc == DateTime.MinValue)
                {
                    _networkId = id;
                    _networkRx = stats.BytesReceived;
                    _networkTx = stats.BytesSent;
                    _networkSampleUtc = now;
                    return;
                }

                var seconds = Math.Max(0.001, (now - _networkSampleUtc).TotalSeconds);
                result.NetworkDownMbps = Math.Max(0, (stats.BytesReceived - _networkRx) * 8.0 / seconds / 1000000.0);
                result.NetworkUpMbps = Math.Max(0, (stats.BytesSent - _networkTx) * 8.0 / seconds / 1000000.0);
                _networkRx = stats.BytesReceived;
                _networkTx = stats.BytesSent;
                _networkSampleUtc = now;
            }
            catch { }
        }

        public void Dispose()
        {
            try { if (_diskCounter != null) _diskCounter.Dispose(); } catch { }
            foreach (var counter in _gpuCounters)
            {
                try { counter.Dispose(); } catch { }
            }
            _gpuCounters.Clear();
        }

        private static ulong ToUInt64(FILETIME value)
        {
            return ((ulong)(uint)value.dwHighDateTime << 32) | (uint)value.dwLowDateTime;
        }
    }
}
