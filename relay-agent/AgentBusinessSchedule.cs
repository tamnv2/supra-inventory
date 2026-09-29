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
        internal static readonly TimeSpan RegularStart = new TimeSpan(5, 45, 0);
        internal static readonly TimeSpan OvertimeCutoff = new TimeSpan(5, 0, 0);
        internal static readonly TimeSpan RegularEnd = new TimeSpan(22, 30, 0);
        internal static readonly TimeSpan PromptLead = TimeSpan.FromMinutes(30);

        internal AgentBusinessSchedule(string stateFile)
        {
            // Cross-machine operating decisions are canonical in Firestore coordination.
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

            // D154: 22:00-22:29 asks whether relay may continue after the
            // widened regular end at 22:30.
            if (time >= RegularEnd.Subtract(PromptLead) && time < RegularEnd)
            {
                boundary = now.Date.Add(RegularEnd);
                return true;
            }

            // D154 overtime cadence is anchored to 22:30 -> 23:30 -> 00:30...
            // A prompt becomes eligible 30 minutes before the next boundary.
            // Overtime never extends beyond 05:00.
            if (time >= RegularEnd || time < OvertimeCutoff)
            {
                var nextBoundary = NextOvertimeBoundary(now);
                var cutoff = NextOvertimeCutoff(now);
                if (nextBoundary > cutoff) return false;
                if (now < nextBoundary.Subtract(PromptLead)) return false;
                boundary = nextBoundary;
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

        internal DateTime NextOvertimeCutoff(DateTime now)
        {
            var today = now.Date.Add(OvertimeCutoff);
            return now.TimeOfDay < OvertimeCutoff ? today : today.AddDays(1);
        }

        internal DateTime ExtensionUntil(DateTime boundary)
        {
            var cutoff = NextOvertimeCutoff(boundary.AddSeconds(1));
            var proposed = boundary.AddHours(1);
            return proposed > cutoff ? cutoff : proposed;
        }

        internal bool IsEarlyStartWindow(DateTime now)
        {
            return now.TimeOfDay >= OvertimeCutoff && now.TimeOfDay < RegularStart;
        }

        internal bool IsOvertimeSleepWindow(DateTime now)
        {
            return now.TimeOfDay >= RegularEnd || now.TimeOfDay < OvertimeCutoff;
        }

        internal DateTime ManualAdjustmentUntil(DateTime now)
        {
            if (!IsOvertimeSleepWindow(now)) return DateTime.MinValue;
            var target = NextOvertimeBoundary(now);
            var cutoff = NextOvertimeCutoff(now);
            return target > cutoff ? cutoff : target;
        }

        internal string ScheduleKey(DateTime now)
        {
            // Business night rolls at 05:00. 05:00-05:44 early-start belongs
            // to the new business day while 00:00-04:59 remains the prior night.
            var businessDay = now.TimeOfDay < OvertimeCutoff ? now.Date.AddDays(-1) : now.Date;
            return businessDay.ToString("yyyyMMdd");
        }

        internal string StatusText(DateTime now)
        {
            if (DefaultRelayAllowed(now))
                return "Replay PDA hoạt động theo khung 05:45–22:30.";
            return "Relay PDA đang ngủ; xác nhận trực tiếp tại Agent vẫn dùng được.";
        }

        private DateTime NextOvertimeBoundary(DateTime now)
        {
            var anchorDate = now.TimeOfDay < OvertimeCutoff ? now.Date.AddDays(-1) : now.Date;
            var anchor = anchorDate.Add(RegularEnd);
            if (now < anchor) return anchor;

            var elapsed = now - anchor;
            var completedHours = Math.Floor(elapsed.TotalHours);
            return anchor.AddHours(completedHours + 1d);
        }

        internal static bool SelfTestTransitions()
        {
            var schedule = new AgentBusinessSchedule("");
            var day = new DateTime(2026, 9, 24, 0, 0, 0, DateTimeKind.Unspecified);
            DateTime boundary;

            if (schedule.DefaultRelayAllowed(day.AddHours(4).AddMinutes(59))) return false;
            if (schedule.DefaultRelayAllowed(day.AddHours(5))) return false;
            if (!schedule.IsEarlyStartWindow(day.AddHours(5))) return false;
            if (schedule.DefaultRelayAllowed(day.AddHours(5).AddMinutes(44))) return false;
            if (!schedule.DefaultRelayAllowed(day.AddHours(5).AddMinutes(45))) return false;
            if (!schedule.DefaultRelayAllowed(day.AddHours(22).AddMinutes(29))) return false;
            if (schedule.DefaultRelayAllowed(day.AddHours(22).AddMinutes(30))) return false;

            if (schedule.TryGetPromptBoundary(day.AddHours(21).AddMinutes(59), out boundary)) return false;
            if (!schedule.TryGetPromptBoundary(day.AddHours(22), out boundary)) return false;
            if (boundary != day.AddHours(22).AddMinutes(30)) return false;

            if (schedule.TryGetPromptBoundary(day.AddHours(22).AddMinutes(59), out boundary)) return false;
            if (!schedule.TryGetPromptBoundary(day.AddHours(23), out boundary)) return false;
            if (boundary != day.AddHours(23).AddMinutes(30)) return false;

            if (!schedule.TryGetPromptBoundary(day.AddDays(1), out boundary)) return false;
            if (boundary != day.AddDays(1).AddMinutes(30)) return false;

            if (!schedule.TryGetPromptBoundary(day.AddDays(1).AddHours(4), out boundary)) return false;
            if (boundary != day.AddDays(1).AddHours(4).AddMinutes(30)) return false;
            if (schedule.TryGetPromptBoundary(day.AddDays(1).AddHours(4).AddMinutes(30), out boundary)) return false;
            if (schedule.ExtensionUntil(day.AddDays(1).AddHours(4).AddMinutes(30)) != day.AddDays(1).AddHours(5)) return false;

            if (schedule.NextRegularStart(day.AddDays(1).AddHours(5)) != day.AddDays(1).AddHours(5).AddMinutes(45)) return false;
            if (schedule.ScheduleKey(day.AddDays(1).AddHours(4).AddMinutes(59)) != day.ToString("yyyyMMdd")) return false;
            if (schedule.ScheduleKey(day.AddDays(1).AddHours(5)) != day.AddDays(1).ToString("yyyyMMdd")) return false;

            if (schedule.ManualAdjustmentUntil(day.AddHours(22).AddMinutes(40)) != day.AddHours(23).AddMinutes(30)) return false;
            if (schedule.ManualAdjustmentUntil(day.AddDays(1).AddHours(4).AddMinutes(10)) != day.AddDays(1).AddHours(4).AddMinutes(30)) return false;
            if (schedule.ManualAdjustmentUntil(day.AddDays(1).AddHours(5).AddMinutes(10)) != DateTime.MinValue) return false;

            return true;
        }
    }
}
