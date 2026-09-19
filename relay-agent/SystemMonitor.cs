using System;
using System.Runtime.InteropServices;

namespace SupraInventoryRelayAgent
{
    internal sealed class SystemMetrics
    {
        internal double CpuPercent;
        internal int CurrentMhz;
        internal ulong RamUsedBytes;
        internal ulong RamTotalBytes;

        internal string Compact()
        {
            var cpu = CpuPercent < 0 ? "--" : Math.Round(CpuPercent).ToString("0");
            var mhz = CurrentMhz <= 0 ? "----" : CurrentMhz.ToString();
            var used = RamUsedBytes / 1073741824.0;
            var total = RamTotalBytes / 1073741824.0;
            return "SUPRA | CPU " + cpu + "% " + mhz + "MHz | RAM " +
                   used.ToString("0.0") + "/" + total.ToString("0.0") + "GB";
        }

        internal string MenuText()
        {
            return "Máy: " + Compact().Replace("SUPRA | ", "");
        }
    }

    internal sealed class SystemMonitor
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

        private readonly object _gate = new object();
        private ulong _previousIdle;
        private ulong _previousKernel;
        private ulong _previousUser;
        private bool _hasPrevious;

        internal SystemMetrics Sample()
        {
            lock (_gate)
            {
                var result = new SystemMetrics
                {
                    CpuPercent = SampleCpu(),
                    CurrentMhz = SampleCurrentMhz()
                };

                var memory = new MEMORYSTATUSEX();
                memory.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
                if (GlobalMemoryStatusEx(ref memory))
                {
                    result.RamTotalBytes = memory.ullTotalPhys;
                    result.RamUsedBytes = memory.ullTotalPhys >= memory.ullAvailPhys
                        ? memory.ullTotalPhys - memory.ullAvailPhys
                        : 0;
                }
                return result;
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
            var percent = busy * 100.0 / total;
            if (percent < 0) return 0;
            if (percent > 100) return 100;
            return percent;
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
                    if (info.CurrentMhz > 0)
                    {
                        sum += info.CurrentMhz;
                        valid++;
                    }
                }
                return valid == 0 ? 0 : (int)(sum / valid);
            }
            catch
            {
                return 0;
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }

        private static ulong ToUInt64(FILETIME value)
        {
            return ((ulong)(uint)value.dwHighDateTime << 32) | (uint)value.dwLowDateTime;
        }
    }
}
