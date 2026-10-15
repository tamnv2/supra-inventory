using System;
using System.Linq;
using System.Collections.Generic;
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
        private readonly Func<IDisposable> openWorkerNetwork;
        private readonly Action<string> log;
        private readonly string instanceId;
        private readonly object gate=new object();
        private readonly Timer timer;
        private DateTime lastAttemptAtUtc = DateTime.MinValue;
        private DateTime nextWakeAtUtc = DateTime.MinValue;
        private string lastAttemptKey="";
        private string activeKey="";
        private int running;
        private bool disposed;
        private D167SkuWorkbook lastVerifiedWorkbook;
        internal event Action<List<D167SkuSlotStatus>,List<D167SkuSlotStatus>,D167SkuWorkbook,string> StatusChanged;

        internal D167SkuCoordinator(SupraConfirmBrowser managedBrowser,
            Func<AgentSession> currentSession,Action ensureFreshToken,
            Func<bool> primaryReady,Func<bool> confirmationBusy,
            Func<string> primaryGeneration,string currentInstanceId,
            Action<string> ensureSkuLease,Func<IDisposable> workerNetwork,
            Func<string,bool> approveConflicts,Action<string> logger)
        {
            browser=managedBrowser;
            isPrimaryReady=primaryReady;
            confirmBusy=confirmationBusy;
            generation=primaryGeneration;
            instanceId=currentInstanceId ?? "";
            confirmConflicts=approveConflicts;
            openWorkerNetwork=workerNetwork ?? throw new ArgumentNullException("workerNetwork");
            log=logger ?? delegate {};
            service=new D167SkuServiceClient(currentSession,ensureFreshToken,primaryReady,ensureSkuLease);
            timer=new Timer(_=>Queue(),null,Timeout.Infinite,Timeout.Infinite);
        }

        private void NotifyStatus(List<D167SkuSlotStatus> slots,string message)
        {
            var handler=StatusChanged;
            if(handler!=null)
            {
                try { handler(slots==null?new List<D167SkuSlotStatus>():slots.ToList(),
                    service.RecentManual.ToList(),lastVerifiedWorkbook,message); }
                catch(Exception e) { log("D167_SKU_UI error_type="+e.GetType().Name); }
            }
        }

        // Only a fixed, code-owned D167 failure code is safe for support logs.
        // Never print raw provider messages, WMS payloads or credentials.
        internal static string SafeErrorCode(Exception error)
        {
            var message=error==null ? "" : error.Message ?? "";
            if(message.Length<6 || message.Length>100 ||
                !message.StartsWith("D167_",StringComparison.Ordinal)) return "UNKNOWN";
            foreach(var c in message)
                if(!((c>='A'&&c<='Z') || (c>='0'&&c<='9') || c=='_'))
                    return "UNKNOWN";
            return message;
        }

        internal void RequestStatus()
        {
            if (Interlocked.CompareExchange(ref running,0,0)!=0) return;
            Task.Run(()=>{
                try { NotifyStatus(service.Schedule(D167SkuSchedule.VNNow().ToString("yyyy-MM-dd")),""); }
                catch(Exception e) { NotifyStatus(null,"Chưa kiểm tra được trạng thái cập nhật SKU trên máy chủ. Hãy kiểm tra mạng và thử lại."); }
            });
        }

        // Manual operation is serialized with the existing scheduled workflow.
        // The server validates current-account password/OTP AND current HA lease.
        internal void RunManual(string credential)
        {
            if (Interlocked.CompareExchange(ref running,1,0)!=0)
                throw new InvalidOperationException("D167_SKU_JOB_ALREADY_RUNNING");
            var manualTrace=System.Diagnostics.Stopwatch.StartNew();
            var manualPhase="PRIMARY_CHECK";
            string activeSlot=null,activeGrant=null,activeGeneration=null,activeDay=null;
            IDisposable workerNetworkScope=null;
            D167SkuWorkbook officeWorkbook=null;
            var verifiedSkuUploadDone=false;
            try
            {
                if(!isPrimaryReady() || confirmBusy())
                    throw new InvalidOperationException("D167_MANUAL_PRIMARY_OR_CONFIRM_NOT_READY");
                var day=D167SkuSchedule.VNNow().ToString("yyyy-MM-dd");
                activeDay=day; // Keep the original reservation day across midnight.
                var runId=Guid.NewGuid().ToString("N");
                manualPhase="AUTHORIZE_BEGIN";
                log("D167_SKU manual=STAGE step=AUTHORIZE_BEGIN elapsed_ms="+manualTrace.ElapsedMilliseconds);
                // Office must export read-only WMS data before any WLAN switch.
                // Password/OTP is still verified by Worker BEFORE any staging
                // or catalog change. Discard the snapshot on failed proof.
                if(service.WorkerRouteStatus()=="NETWORK_UNREACHABLE")
                {
                    if(!D168NetworkRoute.HasApprovedFallback())
                        throw new InvalidOperationException("D167_NETWORK_PROFILES_NOT_APPROVED");
                    manualPhase="OFFICE_WMS_EXPORT";
                    officeWorkbook=D167SkuBrowserExport.Export(browser,
                        ()=>isPrimaryReady()&&!confirmBusy(),
                        stage=>log("D168_SKU manual_office_export="+stage));
                    manualPhase="AUTHORIZE_BEGIN";
                }
                workerNetworkScope=openWorkerNetwork();
                var slot=service.ManualStart(day,instanceId,generation(),runId,credential);
                activeSlot=slot;
                activeGeneration=generation();
                activeGrant=service.Reserve(day,slot,instanceId,activeGeneration);
                manualPhase="AUTHORIZE_DONE";
                log("D167_SKU manual=STAGE step=AUTHORIZE_DONE elapsed_ms="+manualTrace.ElapsedMilliseconds);
                NotifyStatus(null,"Đã xác minh tài khoản. Đang tải danh sách SKU từ hệ thống kho...");
                log("D167_SKU manual=STAGE step=WMS_EXPORT_BEGIN");
                var workbook=officeWorkbook ?? D167SkuBrowserExport.Export(browser,()=>!confirmBusy(),
                    stage=>{
                        manualPhase="EXPORT_"+stage;
                        log("D167_SKU manual=TRACE export_stage="+stage+
                            " elapsed_ms="+manualTrace.ElapsedMilliseconds);
                    });
                manualPhase="WMS_EXPORT_DONE";
                log("D167_SKU manual=STAGE step=WMS_EXPORT_DONE sku_count="+workbook.Items.Count+
                    " elapsed_ms="+manualTrace.ElapsedMilliseconds);
                if(confirmBusy())
                    throw new InvalidOperationException("D167_MANUAL_CONFIRM_PRIORITY");
                manualPhase="SERVICE_UPLOAD_BEGIN";
                log("D167_SKU manual=STAGE step=SERVICE_UPLOAD_BEGIN elapsed_ms="+manualTrace.ElapsedMilliseconds);
                NotifyStatus(null,"Đã tải "+workbook.Items.Count+" SKU. Đang lưu lên hệ thống...");
                if(!service.UploadAndPublish(day,slot,instanceId,activeGeneration,activeGrant,workbook,confirmConflicts))
                    throw new InvalidOperationException("D167_MANUAL_RECEIPT_UNVERIFIED");
                lastVerifiedWorkbook=workbook;
                verifiedSkuUploadDone=true;
                NotifyStatus(service.Schedule(day),"Đã cập nhật SKU thành công; hệ thống đã xác nhận lưu dữ liệu.");
                log("D167_SKU manual=DONE area_snapshot_count="+workbook.Items.Count+
                    " elapsed_ms="+manualTrace.ElapsedMilliseconds);
            }
            catch(Exception e)
            {
                if(activeGrant!=null)
                    service.Abort(activeDay,activeSlot,
                        instanceId,activeGeneration,activeGrant);
                NotifyStatus(null,"Chưa cập nhật được SKU: "+D167SkuVietnamese.Error(SafeErrorCode(e)));
                log("D167_SKU manual=FAILED error_type="+e.GetType().Name+
                    " error_code="+SafeErrorCode(e)+" phase="+manualPhase+
                    " elapsed_ms="+manualTrace.ElapsedMilliseconds);
                throw;
            }
            finally
            {
                try { if(workerNetworkScope!=null)workerNetworkScope.Dispose(); }
                catch(Exception e)
                {
                    log("D168_NETWORK restore=FAILED type="+e.GetType().Name+
                        " sku_upload_verified="+(verifiedSkuUploadDone?"true":"false"));
                    NotifyStatus(null,verifiedSkuUploadDone
                        ? "SKU đã cập nhật thành công nhưng CHƯA khôi phục được mạng ban đầu. Vui lòng kiểm tra Wi-Fi để tiếp tục xác nhận PickList."
                        : "Không khôi phục được mạng ban đầu sau khi thử cập nhật SKU. Vui lòng kiểm tra Wi-Fi trước khi tiếp tục nghiệp vụ.");
                }
                Interlocked.Exchange(ref running,0);
                // Re-evaluate the unchanged three-slot schedule once after manual.
                Queue();
            }
        }

        internal void OnPrimaryOrWmsReady()
        {
            if (!isPrimaryReady()) return;
            lock(gate)
                if(disposed || DateTime.UtcNow<nextWakeAtUtc) return;
            Queue();
        }

        private void Queue()
        {
            // Guard *all* entry paths (timer/manual/HA callbacks) against
            // running again before the bounded retry wake; no extra service poll.
            // Timer callbacks can arrive a few milliseconds before their due time.
            lock(gate)
                if (disposed || nextWakeAtUtc > DateTime.UtcNow.AddMilliseconds(250)) return;
            if (Interlocked.CompareExchange(ref running,1,0)!=0)return;
            Task.Run(()=>{
                try { EvaluateOnce(); }
                catch(Exception e)
                {
                    // Error categories only: no credentials, source rows or WMS
                    // locations are logged. Retry only via a bounded local timer.
                    // Existing local diagnostic only: no new provider request or log upload.
                    log("D168_SKU_SUMMARY result=DEFER day_vn="+D167SkuSchedule.VNNow().ToString("yyyy-MM-dd")+
                        " active_key="+activeKey+" error_type="+e.GetType().Name+
                        " error_code="+SafeErrorCode(e)+" next_event=BOUNDED_15M");
                    log("D167_SKU sync=DEFER error_type="+e.GetType().Name+
                        " error_code="+SafeErrorCode(e));
                    NotifyStatus(null,"Cập nhật SKU tự động chưa thành công: "+
                        D167SkuVietnamese.Error(SafeErrorCode(e)));
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
            D167SkuWorkbook officeWorkbook=null;
            // D168 E016: when Office cannot reach Worker, export the existing
            // authenticated read-only WMS workbook BEFORE a WLAN transition.
            // The Worker still owns the schedule and verifies the current
            // PRIMARY at reserve; a speculative export never implies DONE.
            if(service.WorkerRouteStatus()=="NETWORK_UNREACHABLE")
            {
                if(!D168NetworkRoute.HasApprovedFallback())
                    throw new InvalidOperationException("D167_NETWORK_PROFILES_NOT_APPROVED");
                if(!isPrimaryReady() || confirmBusy()) {Arm(TimeSpan.FromMinutes(5));return;}
                officeWorkbook=D167SkuBrowserExport.Export(browser,
                    ()=>isPrimaryReady()&&!confirmBusy(),
                    stage=>log("D168_SKU office_export="+stage));
            }
            using(var workerNetworkScope=openWorkerNetwork())
            {
            var slots=service.Schedule(day);
            NotifyStatus(slots,"");
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
            // HA generation changes do not reset the anti-storm cooldown.
            var key=day+"/"+eligible.Slot;
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
            var slotTrace=System.Diagnostics.Stopwatch.StartNew();
            var activeGeneration=generation();
            var grant=service.Reserve(day,eligible.Slot,instanceId,activeGeneration);
            try
            {
            log("D167_SKU slot="+eligible.Slot+" stage=EXPORT_BEGIN");
            NotifyStatus(slots,"Đang tự tải danh sách SKU từ hệ thống kho...");
            var workbook=officeWorkbook ?? D167SkuBrowserExport.Export(browser,()=>!confirmBusy(),
                    stage=>log("D167_SKU slot="+eligible.Slot+" export_stage="+stage+
                        " elapsed_ms="+slotTrace.ElapsedMilliseconds));
            // A reserved job continues even when HA elects a new PRIMARY.
            log("D167_SKU slot="+eligible.Slot+" stage=WMS_EXPORT_DONE sku_count="+workbook.Items.Count+
                " elapsed_ms="+slotTrace.ElapsedMilliseconds);
            // Conditional Service CAS/HA authority checks happen again on each
            // upload stage and publish, independently from this UI process.
            log("D167_SKU slot="+eligible.Slot+" stage=SERVICE_UPLOAD_BEGIN elapsed_ms="+
                slotTrace.ElapsedMilliseconds);
            NotifyStatus(slots,"Đã tải "+workbook.Items.Count+" SKU. Đang lưu lên hệ thống...");
            var success=service.UploadAndPublish(day,eligible.Slot,instanceId,activeGeneration,grant,
                workbook,confirmConflicts);
            if(!success)throw new InvalidOperationException("D167_DONE_NOT_VERIFIED");
            lastVerifiedWorkbook=workbook;
            log("D167_SKU slot="+eligible.Slot+" stage=DONE count="+workbook.Items.Count+
                " elapsed_ms="+slotTrace.ElapsedMilliseconds);
            log("D168_SKU_SUMMARY result=DONE day_vn="+day+" slot="+eligible.Slot+
                " sku_count="+workbook.Items.Count+" receipt_verified=true elapsed_ms="+
                slotTrace.ElapsedMilliseconds+" provider_poll_added=false");
            NotifyStatus(service.Schedule(day),"Đã cập nhật SKU và xác minh dữ liệu lưu trên hệ thống.");
            // Schedule remaining slots once, not on every WMS/HA event.
            Arm(TimeSpan.FromSeconds(2));
            }
            catch
            {
                service.Abort(day,eligible.Slot,instanceId,activeGeneration,grant);
                throw;
            }
            }
        }

        private void Arm(TimeSpan delay)
        {
            var ms=Math.Min((double)int.MaxValue-1,
                Math.Max(1000,delay.TotalMilliseconds));
            lock(gate) if(!disposed)
            {
                nextWakeAtUtc=DateTime.UtcNow.AddMilliseconds(ms);
                timer.Change((int)ms,Timeout.Infinite);
            }
        }

        internal void OnLostPrimary()
        {
            lock(gate) if(!disposed)
            {
                nextWakeAtUtc=DateTime.MinValue;
                timer.Change(Timeout.Infinite,Timeout.Infinite);
            }
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
