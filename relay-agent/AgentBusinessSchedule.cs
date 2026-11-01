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
        internal static readonly TimeSpan RegularEnd = new TimeSpan(22, 15, 0);
        internal static readonly TimeSpan PromptLead = TimeSpan.FromMinutes(15);
        internal static readonly TimeSpan FirstPromptAt = new TimeSpan(21, 45, 0);

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

        // E111: local one-time decisions; no extra schedule reads or provider polling.
        internal bool NeedsConfirmation(DateTime now)
        {
            DateTime boundary;
            return TryGetPromptBoundary(now, DateTime.MinValue, out boundary);
        }

        internal bool TryGetPromptBoundary(DateTime now, DateTime activeUntil, out DateTime boundary)
        {
            boundary = DateTime.MinValue;
            if (now.TimeOfDay >= FirstPromptAt && now.TimeOfDay < RegularEnd)
            {
                boundary = now.Date.Add(RegularEnd);
                return true;
            }
            // The next prompt follows the actual approved expiry, not 22:15.
            if (activeUntil > now && activeUntil <= NextOvertimeCutoff(now) &&
                now >= activeUntil.Subtract(PromptLead))
            {
                boundary = activeUntil;
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
            // First accepted decision bridges 22:15 to midnight uninterrupted.
            // Later decisions extend each exact hour boundary until 05:00.
            var proposed = boundary.TimeOfDay == RegularEnd
                ? boundary.Date.AddDays(1)
                : boundary.AddHours(1);
            return proposed > cutoff ? cutoff : proposed;
        }

        internal DateTime ExtendOvertimeUntil(DateTime now, DateTime currentOverrideUntil)
        {
            if (!IsOvertimeSleepWindow(now)) return DateTime.MinValue;
            var cutoff = NextOvertimeCutoff(now);
            var basis = currentOverrideUntil > now ? currentOverrideUntil : now;
            var proposed = basis.AddHours(1);
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
            return ExtendOvertimeUntil(now, DateTime.MinValue);
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
                return "Replay PDA hoạt động theo khung kỹ thuật 05:45–22:15.";
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
            var day = new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Unspecified);
            DateTime boundary;

            if (schedule.DefaultRelayAllowed(day.AddHours(4).AddMinutes(59))) return false;
            if (!schedule.IsEarlyStartWindow(day.AddHours(5))) return false;
            if (!schedule.DefaultRelayAllowed(day.AddHours(5).AddMinutes(45))) return false;
            if (!schedule.DefaultRelayAllowed(day.AddHours(22).AddMinutes(14))) return false;
            if (schedule.DefaultRelayAllowed(day.AddHours(22).AddMinutes(15))) return false;
            if (schedule.TryGetPromptBoundary(day.AddHours(21).AddMinutes(44), DateTime.MinValue, out boundary)) return false;
            if (!schedule.TryGetPromptBoundary(day.AddHours(21).AddMinutes(45), DateTime.MinValue, out boundary)) return false;
            if (boundary != day.AddHours(22).AddMinutes(15)) return false;
            if (!schedule.NeedsConfirmation(day.AddHours(22))) return false;
            if (schedule.ExtensionUntil(boundary) != day.AddDays(1)) return false;
            if (!schedule.TryGetPromptBoundary(day.AddHours(23).AddMinutes(45), day.AddDays(1), out boundary)) return false;
            if (boundary != day.AddDays(1)) return false;
            if (schedule.ExtensionUntil(boundary) != day.AddDays(1).AddHours(1)) return false;
            if (schedule.TryGetPromptBoundary(day.AddDays(1).AddHours(1), DateTime.MinValue, out boundary)) return false;

            if (schedule.ManualAdjustmentUntil(day.AddHours(22).AddMinutes(15)) != day.AddHours(23).AddMinutes(15)) return false;
            if (schedule.ExtendOvertimeUntil(day.AddHours(22).AddMinutes(30), day.AddHours(23).AddMinutes(15)) != day.AddDays(1).AddMinutes(15)) return false;
            if (schedule.ExtendOvertimeUntil(day.AddDays(1).AddHours(4).AddMinutes(30), DateTime.MinValue) != day.AddDays(1).AddHours(5)) return false;
            if (schedule.ManualAdjustmentUntil(day.AddDays(1).AddHours(5)) != DateTime.MinValue) return false;

            if (schedule.NextRegularStart(day.AddDays(1).AddHours(5)) != day.AddDays(1).AddHours(5).AddMinutes(45)) return false;
            if (schedule.ScheduleKey(day.AddDays(1).AddHours(4).AddMinutes(59)) != day.ToString("yyyyMMdd")) return false;
            if (schedule.ScheduleKey(day.AddDays(1).AddHours(5)) != day.AddDays(1).ToString("yyyyMMdd")) return false;
            return true;
        }
    }
}
