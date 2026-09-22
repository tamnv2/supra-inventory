using System;
using System.IO;
using System.Text;

namespace SupraInventoryRelayAgent
{
    internal enum AfterHoursDecision
    {
        NONE = 0,
        CONTINUE = 1,
        STOP = 2
    }

    internal sealed class AgentBusinessSchedule
    {
        private static readonly TimeSpan PromptStart = new TimeSpan(21, 30, 0);
        private static readonly TimeSpan PauseStart = new TimeSpan(22, 0, 0);
        private static readonly TimeSpan ResumeAt = new TimeSpan(5, 0, 0);

        private readonly string _stateFile;
        private readonly object _gate = new object();
        private string _nightKey = "";
        private AfterHoursDecision _decision = AfterHoursDecision.NONE;

        internal AgentBusinessSchedule(string stateFile)
        {
            _stateFile = stateFile ?? "";
            Load();
        }

        internal DateTime NowOperational()
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
            catch
            {
                return DateTime.Now;
            }
        }

        internal bool NeedsConfirmation(DateTime now)
        {
            var time = now.TimeOfDay;
            if (!IsNightWindow(time) && time < PromptStart) return false;
            if (time >= ResumeAt && time < PromptStart) return false;
            return GetDecision(now) == AfterHoursDecision.NONE;
        }

        internal bool BusinessAllowed(DateTime now)
        {
            var time = now.TimeOfDay;
            if (time >= ResumeAt && time < PauseStart) return true;
            if (time >= PromptStart && time < PauseStart) return true;
            if (!IsNightWindow(time)) return true;
            return GetDecision(now) == AfterHoursDecision.CONTINUE;
        }

        internal AfterHoursDecision GetDecision(DateTime now)
        {
            var key = NightKey(now);
            lock (_gate)
            {
                if (!string.Equals(_nightKey, key, StringComparison.Ordinal))
                    return AfterHoursDecision.NONE;
                return _decision;
            }
        }

        internal void SetDecision(DateTime now, AfterHoursDecision decision)
        {
            if (decision != AfterHoursDecision.CONTINUE && decision != AfterHoursDecision.STOP)
                throw new ArgumentOutOfRangeException("decision");

            var key = NightKey(now);
            lock (_gate)
            {
                _nightKey = key;
                _decision = decision;
                Save();
            }
        }

        internal string StatusText(DateTime now)
        {
            var decision = GetDecision(now);
            if (decision == AfterHoursDecision.CONTINUE)
                return "Đã xác nhận tiếp tục vận hành sau 22:00 đến 05:00.";
            if (decision == AfterHoursDecision.STOP)
                return "Đã xác nhận ngừng xử lý từ 22:00 đến 05:00.";
            if (NeedsConfirmation(now))
                return now.TimeOfDay >= PauseStart || now.TimeOfDay < ResumeAt
                    ? "Chưa xác nhận tăng ca: nghiệp vụ đang tạm dừng đến khi xác nhận hoặc 05:00."
                    : "Cần xác nhận có tiếp tục vận hành sau 22:00.";
            return "Khung vận hành bình thường.";
        }

        private static bool IsNightWindow(TimeSpan time)
        {
            return time >= PauseStart || time < ResumeAt;
        }

        private static string NightKey(DateTime now)
        {
            var businessNight = now.TimeOfDay < ResumeAt ? now.Date.AddDays(-1) : now.Date;
            return businessNight.ToString("yyyyMMdd");
        }

        private void Load()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_stateFile) || !File.Exists(_stateFile)) return;
                var raw = File.ReadAllText(_stateFile, Encoding.UTF8).Trim();
                var parts = raw.Split('|');
                if (parts.Length != 2 || parts[0].Length != 8) return;
                AfterHoursDecision parsed;
                if (!Enum.TryParse(parts[1], true, out parsed)) return;
                if (parsed != AfterHoursDecision.CONTINUE && parsed != AfterHoursDecision.STOP) return;
                _nightKey = parts[0];
                _decision = parsed;
            }
            catch
            {
                _nightKey = "";
                _decision = AfterHoursDecision.NONE;
            }
        }

        private void Save()
        {
            if (string.IsNullOrWhiteSpace(_stateFile)) return;
            var dir = Path.GetDirectoryName(_stateFile);
            if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
            var temp = _stateFile + ".tmp";
            File.WriteAllText(temp, _nightKey + "|" + _decision, Encoding.UTF8);
            if (File.Exists(_stateFile)) File.Delete(_stateFile);
            File.Move(temp, _stateFile);
        }
    }
}
