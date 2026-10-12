using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SupraInventoryRelayAgent
{
    // D167 one-shot SKU scheduler: accepts existing HA/ready events and parks
    // a single local timer at the next Service-owned date-slot target.
    // No new Firebase listener, heartbeat, frequent provider poll or WMS API.
    internal sealed class D167SkuCoordinator : IDisposable
    {
        private readonly SupraConfirmBrowser browser;
        private readonly D167SkuServiceClient service;
        private readonly Func<bool> isPrimaryReady;
        private readonly Func<bool> confirmBusy;
        private readonly Func<string> generation;
        private readonly Func<string,bool> confirmConflicts;
        private readonly Action<string> log;
        private readonly string instanceId;
        private readonly object gate=new object();
        private readonly Timer timer;
        private DateTime lastAttemptAtUtc = DateTime.MinValue;
        private string lastAttemptKey="";
        private string activeKey="";
        private int running;
        private bool disposed;

        internal D167SkuCoordinator(SupraConfirmBrowser managedBrowser,
            Func<AgentSession> currentSession,Action ensureFreshToken,
            Func<bool> primaryReady,Func<bool> confirmationBusy,
            Func<string> primaryGeneration,string currentInstanceId,
            Func<string,bool> approveConflicts,Action<string> logger)
        {
            browser=managedBrowser;
            isPrimaryReady=primaryReady;
            confirmBusy=confirmationBusy;
            generation=primaryGeneration;
            instanceId=currentInstanceId ?? "";
            confirmConflicts=approveConflicts;
            log=logger ?? delegate {};
            service=new D167SkuServiceClient(currentSession,ensureFreshToken,primaryReady);
            timer=new Timer(_=>Queue(),null,Timeout.Infinite,Timeout.Infinite);
        }

        internal void OnPrimaryOrWmsReady()
        {
            if (!isPrimaryReady()) return;
            Queue();
        }

        private void Queue()
        {
            lock(gate) if(disposed)return;
            if (Interlocked.CompareExchange(ref running,1,0)!=0)return;
            Task.Run(()=>{
                try { EvaluateOnce(); }
                catch(Exception e)
                {
                    // Error categories only: no credentials, source rows or WMS
                    // locations are logged. Retry only via a bounded local timer.
                    log("D167_SKU sync=DEFER error_type="+e.GetType().Name);
                    Arm(TimeSpan.FromMinutes(15));
                }
                finally { Interlocked.Exchange(ref running,0); }
            });
        }

        private void EvaluateOnce()
        {
            if(!isPrimaryReady() || confirmBusy()) {Arm(TimeSpan.FromMinutes(5));return;}
            var local=D167SkuSchedule.VNNow();
            if(local.Hour < 5) {Arm(TimeSpan.FromHours(Math.Max(0.1,5-local.TimeOfDay.TotalHours)));return;}
            var day=local.ToString("yyyy-MM-dd");
            var slots=service.Schedule(day);
            // Service owns one randomized persisted scheduled_at_ms per slot.
            // Only the newest scheduled eligible DELTA is acted on. If the
            // morning FULL is still undone, that FULL always takes precedence.
            var doneFull=slots.Any(s=>s.Slot=="INITIAL_05"&&s.State=="DONE");
            var nowMs=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var eveningDue=slots.Any(s=>s.Slot=="DELTA_19" && s.ScheduledAtMs<=nowMs);
            var due=slots.Where(s=>s.ScheduledAtMs<=nowMs &&
                s.State!="DONE" && s.State!="SKIPPED" &&
                // The service durably coalesces an unfinished noon slot once
                // evening is due. Ignore stale cached noon state as well.
                (s.Slot!="DELTA_12" || !eveningDue))
                .OrderBy(s=>s.ScheduledAtMs).ToList();
            var eligible=!doneFull
                ? due.FirstOrDefault(s=>s.Slot=="INITIAL_05")
                : due.OrderByDescending(s=>s.ScheduledAtMs).FirstOrDefault();
            if(eligible==null)
            {
                var next=slots.Where(s=>s.State!="DONE"&&s.State!="SKIPPED"&&s.ScheduledAtMs>nowMs)
                    .OrderBy(s=>s.ScheduledAtMs).FirstOrDefault();
                if(next!=null)
                    Arm(TimeSpan.FromMilliseconds(Math.Max(5000,next.ScheduledAtMs-nowMs)));
                else
                {
                    // Exact next date boundary at 05:00 VN, not one minute polling.
                    var nextDay=local.Date.AddDays(1).AddHours(5);
                    Arm(nextDay-local);
                }
                return;
            }
            var key=day+"/"+eligible.Slot+"/"+generation();
            lock(gate)
            {
                if(disposed)return;
                if(string.Equals(lastAttemptKey,key,StringComparison.Ordinal) &&
                    DateTime.UtcNow-lastAttemptAtUtc<TimeSpan.FromMinutes(15))
                {Arm(TimeSpan.FromMinutes(15));return;}
                lastAttemptKey=key;
                lastAttemptAtUtc=DateTime.UtcNow;
                activeKey=key;
            }
            if(!isPrimaryReady()||confirmBusy()){Arm(TimeSpan.FromMinutes(5));return;}
            log("D167_SKU slot="+eligible.Slot+" stage=EXPORT_BEGIN");
            var workbook=D167SkuBrowserExport.Export(browser,()=>isPrimaryReady()&&!confirmBusy());
            if(!isPrimaryReady())throw new InvalidOperationException("D167_PRIMARY_LOST_AFTER_EXPORT");
            // Conditional Service CAS/HA authority checks happen again on each
            // upload stage and publish, independently from this UI process.
            var success=service.UploadAndPublish(day,eligible.Slot,instanceId,generation(),
                workbook,confirmConflicts);
            if(!success)throw new InvalidOperationException("D167_DONE_NOT_VERIFIED");
            log("D167_SKU slot="+eligible.Slot+" stage=DONE count="+workbook.Items.Count);
            // Schedule remaining slots once, not on every WMS/HA event.
            Arm(TimeSpan.FromSeconds(2));
        }

        private void Arm(TimeSpan delay)
        {
            var ms=Math.Min((double)int.MaxValue-1,
                Math.Max(1000,delay.TotalMilliseconds));
            lock(gate) if(!disposed) timer.Change((int)ms,Timeout.Infinite);
        }

        internal void OnLostPrimary()
        {
            lock(gate) if(!disposed)timer.Change(Timeout.Infinite,Timeout.Infinite);
        }

        public void Dispose()
        {
            lock(gate)
            {
                if(disposed)return;
                disposed=true;
                timer.Dispose();
            }
        }
    }
}
