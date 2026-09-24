using System;

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
        internal static readonly TimeSpan RegularStart = new TimeSpan(6, 0, 0);
        internal static readonly TimeSpan RegularEnd = new TimeSpan(22, 0, 0);
        internal static readonly TimeSpan PromptLead = TimeSpan.FromMinutes(30);

        internal AgentBusinessSchedule(string stateFile)
        {
            // D117: cross-machine operating decisions are canonical in Firestore coordination.
            // The legacy local file path remains accepted for constructor compatibility only.
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

        internal bool DefaultRelayAllowed(DateTime now)
        {
            var time = now.TimeOfDay;
            return time >= RegularStart && time < RegularEnd;
        }

        internal bool BusinessAllowed(DateTime now)
        {
            return DefaultRelayAllowed(now);
        }

        internal bool NeedsConfirmation(DateTime now)
        {
            DateTime boundary;
            return TryGetPromptBoundary(now, out boundary) && DefaultRelayAllowed(now);
        }

        internal bool TryGetPromptBoundary(DateTime now, out DateTime boundary)
        {
            boundary = DateTime.MinValue;
            var time = now.TimeOfDay;

            // 21:30-21:59 asks whether the relay may continue after 22:00.
            if (time >= RegularEnd.Subtract(PromptLead) && time < RegularEnd)
            {
                boundary = now.Date.Add(RegularEnd);
                return true;
            }

            // After 22:00, only an already-extended relay asks again.
            // Each next-hour decision starts at HH:30. 05:30 has no prompt because 06:00
            // automatically returns to the regular operating window.
            if (time >= RegularEnd || time < RegularStart)
            {
                var hourStart = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Unspecified);
                var nextHour = hourStart.AddHours(1);
                var nextRegular = NextRegularStart(now);
                if (nextHour >= nextRegular) return false;
                if (now < nextHour.Subtract(PromptLead)) return false;
                boundary = nextHour;
                return true;
            }

            return false;
        }

        internal DateTime NextRegularStart(DateTime now)
        {
            var today = now.Date.Add(RegularStart);
            if (now < today) return today;
            if (now.TimeOfDay >= RegularEnd) return today.AddDays(1);
            return today;
        }

        internal DateTime ExtensionUntil(DateTime boundary)
        {
            var nextRegular = NextRegularStart(boundary.AddSeconds(1));
            var proposed = boundary.AddHours(1);
            return proposed > nextRegular ? nextRegular : proposed;
        }

        internal string ScheduleKey(DateTime now)
        {
            var businessNight = now.TimeOfDay < RegularStart ? now.Date.AddDays(-1) : now.Date;
            return businessNight.ToString("yyyyMMdd");
        }

        internal string StatusText(DateTime now)
        {
            if (DefaultRelayAllowed(now))
                return "Relay PDA hoạt động theo khung 06:00–22:00.";
            return "Relay PDA đang ngủ; xác nhận trực tiếp tại Agent vẫn dùng được.";
        }

        internal static bool SelfTestTransitions()
        {
            var schedule = new AgentBusinessSchedule("");
            var day = new DateTime(2026, 9, 24, 0, 0, 0, DateTimeKind.Unspecified);
            DateTime boundary;

            if (schedule.DefaultRelayAllowed(day.AddHours(5).AddMinutes(59))) return false;
            if (!schedule.DefaultRelayAllowed(day.AddHours(6))) return false;
            if (!schedule.DefaultRelayAllowed(day.AddHours(21).AddMinutes(59))) return false;
            if (schedule.DefaultRelayAllowed(day.AddHours(22))) return false;

            if (schedule.TryGetPromptBoundary(day.AddHours(21).AddMinutes(29), out boundary)) return false;
            if (!schedule.TryGetPromptBoundary(day.AddHours(21).AddMinutes(30), out boundary)) return false;
            if (boundary != day.AddHours(22)) return false;

            if (schedule.TryGetPromptBoundary(day.AddHours(22).AddMinutes(29), out boundary)) return false;
            if (!schedule.TryGetPromptBoundary(day.AddHours(22).AddMinutes(30), out boundary)) return false;
            if (boundary != day.AddHours(23)) return false;

            if (!schedule.TryGetPromptBoundary(day.AddDays(1).AddHours(4).AddMinutes(30), out boundary)) return false;
            if (boundary != day.AddDays(1).AddHours(5)) return false;
            if (schedule.TryGetPromptBoundary(day.AddDays(1).AddHours(5).AddMinutes(30), out boundary)) return false;
            if (schedule.NextRegularStart(day.AddDays(1).AddHours(5)) != day.AddDays(1).AddHours(6)) return false;

            return true;
        }
    }
}
