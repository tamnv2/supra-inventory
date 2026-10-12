using System;
using System.Collections.Generic;

namespace SupraInventoryRelayAgent
{
    // D167: deterministic schedule decisions only; server owns random targets,
    // HA fencing and exact one DONE receipt per (VN date, slot).
    // This class NEVER polls Firebase/WMS or mutates Confirm Picklist state.
    internal enum D167SkuSlot { INITIAL_05, DELTA_12, DELTA_19 }

    internal sealed class D167SkuSlotDecision
    {
        internal D167SkuSlot Slot;
        internal bool Eligible;
        internal string Reason = "";
        internal bool RequiresInitialFull;
    }

    internal static class D167SkuSchedule
    {
        internal static DateTime VNNow()
        {
            // Avoid Windows-local clock ambiguity (Agent can run on non-VN timezone).
            return TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.UtcNow,
                TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"));
        }

        internal static DateTime VNLocalToUtc(DateTime vn)
        {
            var unspecified = DateTime.SpecifyKind(vn, DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(
                unspecified,
                TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"));
        }

        internal static DateTime WindowStart(D167SkuSlot slot, DateTime dayVn)
        {
            var date = dayVn.Date;
            switch (slot)
            {
                case D167SkuSlot.INITIAL_05: return date.AddHours(5);
                case D167SkuSlot.DELTA_12: return date.AddHours(12);
                case D167SkuSlot.DELTA_19: return date.AddHours(19);
                default: throw new ArgumentOutOfRangeException("slot");
            }
        }

        internal static bool IsValidServerTarget(
            D167SkuSlot slot, DateTime targetVn, DateTime businessDateVn)
        {
            var start = WindowStart(slot, businessDateVn);
            return slot == D167SkuSlot.INITIAL_05
                ? targetVn == start
                : targetVn >= start && targetVn < start.AddMinutes(15);
        }

        internal static D167SkuSlotDecision Decide(
            D167SkuSlot slot,
            DateTime nowVn,
            DateTime serverScheduledVn,
            bool primary,
            bool browserReady,
            bool alreadyDone,
            bool initialFullDone,
            bool confirmBusy)
        {
            var decision = new D167SkuSlotDecision { Slot = slot };
            if (!IsValidServerTarget(slot, serverScheduledVn, nowVn.Date))
                decision.Reason = "SERVER_SCHEDULE_INVALID";
            else if (alreadyDone) decision.Reason = "SLOT_DONE";
            else if (!primary) decision.Reason = "NOT_PRIMARY";
            else if (!browserReady) decision.Reason = "WMS_NOT_READY";
            else if (confirmBusy) decision.Reason = "CONFIRM_PRIORITY";
            else if (nowVn < serverScheduledVn) decision.Reason = "WAIT_TARGET";
            else if (slot != D167SkuSlot.INITIAL_05 && !initialFullDone)
            {
                decision.RequiresInitialFull = true;
                decision.Reason = "INITIAL_FULL_REQUIRED";
            }
            else { decision.Eligible = true; decision.Reason = "READY"; }
            return decision;
        }

        internal static bool SelfTest()
        {
            var day = new DateTime(2026, 10, 11);
            var a = WindowStart(D167SkuSlot.INITIAL_05, day);
            var b = WindowStart(D167SkuSlot.DELTA_12, day);
            var c = WindowStart(D167SkuSlot.DELTA_19, day);
            if (a.Hour != 5 || b.Hour != 12 || c.Hour != 19) return false;
            if (!IsValidServerTarget(D167SkuSlot.DELTA_12, b.AddMinutes(14).AddSeconds(59), day))
                return false;
            if (IsValidServerTarget(D167SkuSlot.DELTA_12, b.AddMinutes(15), day))
                return false;
            if (!Decide(D167SkuSlot.INITIAL_05, a, a, true, true, false, false, false).Eligible)
                return false;
            if (Decide(D167SkuSlot.DELTA_12, b, b, true, true, false, false, false).Eligible)
                return false;
            if (!Decide(D167SkuSlot.DELTA_12, b, b, true, true, false, false, false).RequiresInitialFull)
                return false;
            if (!Decide(D167SkuSlot.DELTA_12, b, b, true, true, false, true, false).Eligible)
                return false;
            if (Decide(D167SkuSlot.DELTA_19, c, c, true, true, false, true, true).Eligible)
                return false;
            if (Decide(D167SkuSlot.DELTA_19, c, c, false, true, false, true, false).Eligible)
                return false;
            if (Decide(D167SkuSlot.DELTA_19, c.AddMinutes(1), c, true, true, true, true, false).Eligible)
                return false;
            // VN 05:00 = 22:00 UTC prior date; Confirm relay regular start 05:45 is independent.
            if (VNLocalToUtc(a) != new DateTime(2026, 10, 10, 22, 0, 0, DateTimeKind.Utc))
                return false;
            return true;
        }
    }
}
