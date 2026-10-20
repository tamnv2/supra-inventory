using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.NetworkInformation;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Supra.FirebaseNetworkDiagnostic;

// Separate 128-bit session and Firestore-only simulated messages.
// This class NEVER touches relay_poc_jobs, production primary, WMS or user sessions.
internal sealed class PeerForm : Form
{
    private const string RootUrl = "https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents";
    private const string CommitUrl = "https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents:commit";
    private readonly AgentTokens _token;
    private readonly string _uid;
    private readonly string _sessionId=AutomaticSessionId();
    private string _networkMode="NORMAL";
    private readonly string _nodeId=Guid.NewGuid().ToString("N");
    private readonly ConcurrentDictionary<string,long> _sentTicks=new();
    private readonly ConcurrentDictionary<string,string> _sentExpected=new();
    private int _picklistSequence;
    private readonly ConcurrentDictionary<string,int> _receiptCounts=new();
    // E026 measures HA3 only (phase index 2), then runs link rounds 4-5. Old 1-3 link PASS stays external evidence.
    private const int ResumeStartPhase=2;
    private int _phase=ResumeStartPhase;
    private string _agentLabel="?";
    private readonly string _operatorLogin;
    private readonly ConcurrentDictionary<string,int> _pdaAcks=new();
    private readonly ConcurrentDictionary<string,int> _agentAcks=new();
    private readonly ConcurrentDictionary<string,string> _roles=new();
    private readonly ConcurrentDictionary<int,bool> _peerComplete=new();
    private long _lastLeaderProbe=0;
    private DateTimeOffset _pollSince=DateTimeOffset.MinValue;
    private readonly Button _testAll=new(){Text="BẮT ĐẦU TEST TỰ ĐỘNG"};
    private readonly Button _confirmSwitch=new(){Text="ĐÃ CHUYỂN MẠNG · TEST TIẾP"};
    private static readonly string[] Phases={"PDA NORMAL / A NORMAL / B NORMAL","PDA NORMAL / A OFFICE / B NORMAL","PDA NORMAL / A NORMAL / B OFFICE","PDA NORMAL / A OFFICE / B OFFICE","PDA NORMAL / A NORMAL / B NORMAL (RESTORE)"};
    private readonly string _logPath;
    private readonly string _probeLogPath;
    private readonly TextBox _session = new() { Width = 320 };
    private readonly TextBox _payload = new() { Width = 300, Text = "1234" };
    private readonly TextBox _output = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical };
    private readonly ComboBox _kind = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 170 };
    private readonly ComboBox _mode = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 155 };
    private readonly Button _create = new() { Text = "Tạo phiên test" };
    private readonly Button _join = new() { Text = "Tham gia" };
    private readonly Button _send = new() { Text = "Gửi mô phỏng" };
    private readonly Button _takeover = new() { Text = "Chuyển PRIMARY mô phỏng" };
    private readonly Button _start = new() { Text = "Bắt đầu nghe" };
    private readonly Button _stop = new() { Text = "Dừng nghe" };
    private readonly CancellationTokenSource _closed = new();
    private CancellationTokenSource? _polling;
    private readonly HashSet<string> _seen = new();
    private readonly object _gate = new();
    private readonly HttpClient _http;
    private int _epoch = 1;
    private int _writeCount;
    private int _readCount;
    private DateTimeOffset _oneShotStart = DateTimeOffset.MinValue;
    private const int MaxOneShotReadCalls = 550;
    private const int MaxOneShotWriteCalls = 350;
    private static readonly TimeSpan MaxOneShotDuration = TimeSpan.FromMinutes(40);
    private DateTimeOffset _suspendLeaderUntil=DateTimeOffset.MinValue;
    private bool _awaitInitialVpsClaim=true;
    private long _ha3InitialGeneration;
    private int _ha3ObservedBtoASlaMiss;
    private int _ha3ObservedAtoBSlaMiss;
    private bool _busy;
    private string _activeStep="CHUA_BAT_DAU";

    internal PeerForm(AgentTokens token, string operatorLogin)
    {
        _operatorLogin=operatorLogin;
        _token=token;
        _uid=GetJwtClaim(token.IdToken,"sub");
        if(string.IsNullOrWhiteSpace(_uid)) throw new InvalidOperationException("Missing Firebase uid");
        var desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if(string.IsNullOrWhiteSpace(desktop)||!Directory.Exists(desktop))desktop=Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        _logPath=Path.Combine(desktop,"SUPRA_D171_AGENT_PEER_"+DateTime.Now.ToString("yyyyMMdd_HHmmss")+".jsonl");
        _probeLogPath=Path.Combine(desktop,"SUPRA_D171_NETWORK_PROBES_"+DateTime.Now.ToString("yyyyMMdd_HHmmss")+".jsonl");
        _http=new HttpClient(new HttpClientHandler { UseProxy=true, DefaultProxyCredentials=CredentialCache.DefaultNetworkCredentials })
        {Timeout=TimeSpan.FromSeconds(12)};
        Text="SUPRA D171 E026 — HA3 + vòng 4, 5"; ClientSize=new Size(960,620);MinimumSize=new Size(850,560);
        Font=new Font("Segoe UI",10);
        var title=new Label{Text="D171 E026 — CHẨN ĐOÁN HA3 + VÒNG 4/5, 5/5",Left=16,Top=13,Width=900,Height=30,Font=new Font("Segoe UI",14,FontStyle.Bold)};
        Controls.Add(title);
        var sub=new Label{Text="Chỉ mô phỏng, KHÔNG gửi Picklist/WMS/call/kick thật. Truyền qua Firestore Beta.",Left=16,Top=45,Width=920,Height=22}; Controls.Add(sub);
        var lab=new Label{Text="Mã phiên:",Left=16,Top=85,Width=92};Controls.Add(lab);
        _session.SetBounds(100,80,320,28);Controls.Add(_session);
        _create.SetBounds(435,78,155,33);Controls.Add(_create);_join.SetBounds(600,78,145,33);Controls.Add(_join);
        _mode.Items.AddRange(new object[]{"NORMAL","OFFICE"});_mode.SelectedIndex=0;_mode.SetBounds(758,80,168,30);Controls.Add(_mode);
        _kind.Items.AddRange(new object[]{"PING","PICKLIST_SIM","CALL_SIM","CHAT_SIM","KICK_SIM","LEADER_PROBE","RETRY_SIM","FAILOVER_SIM"});
        _kind.SelectedIndex=0;_kind.SetBounds(16,132,170,30);Controls.Add(_kind);
        _payload.SetBounds(200,132,260,30);Controls.Add(_payload);
        _send.SetBounds(473,128,148,37);Controls.Add(_send);
        _takeover.SetBounds(636,128,289,37);Controls.Add(_takeover);
        _start.SetBounds(16,184,175,38);_stop.SetBounds(204,184,175,38);Controls.AddRange(new Control[]{_start,_stop});
        var info=new Label{Text="Agent này có Firebase role hợp lệ; chỉ EXE Test mới cập nhật lease mô phỏng.\nCùng một SID 32 hex dùng trên PDA và mọi PC.",Left=405,Top=181,Width=515,Height=52};
        Controls.Add(info);
        _output.SetBounds(16,246,909,345);_output.Anchor=AnchorStyles.Top|AnchorStyles.Bottom|AnchorStyles.Left|AnchorStyles.Right;Controls.Add(_output);
        _session.Text=_sessionId;
        _session.ReadOnly=true;_session.Visible=false;_create.Visible=false;_join.Visible=false;
        _kind.Visible=false;_send.Visible=false;_takeover.Visible=false;_payload.Visible=false;
        _start.Visible=false;_stop.Visible=false;
        _testAll.Text="BẮT ĐẦU HA3 (A NORMAL/B OFFICE)";
        _testAll.SetBounds(16,130,305,42);_confirmSwitch.SetBounds(335,130,335,42);
        Controls.AddRange(new Control[]{_testAll,_confirmSwitch});
        _confirmSwitch.Enabled=false;
        _testAll.Click += async (_,_)=>await Run(StartAutomaticTests);
        _confirmSwitch.Click += async (_,_)=>await Run(AdvancePhase);
        info.Text="E026: giữ log E023 vòng 1-3. Login hai PC trên NORMAL rồi đưa tamnv2(B) sang OFFICE để đo HA3. Sau đó admin(A) sang OFFICE vòng 4, cả hai NORMAL vòng 5. PDA=100 luôn NORMAL.";
        info.SetBounds(16,181,900,50);
        // The Agent role is assigned after authenticated session joining, not before.

        _create.Click += async (_,_) => await Run( async()=>{await CreateSession(); await JoinSession(); StartPoll();});
        _join.Click += async (_,_) => await Run( async()=>{await JoinSession(); StartPoll();});
        _send.Click += async (_,_) => await Run(Send);
        _takeover.Click += async (_,_) => await Run(Takeover);
        _start.Click += (_,_) => StartPoll();
        _stop.Click += (_,_) => StopPoll();
        _mode.SelectedIndexChanged += (_,_) => {_networkMode=_mode.Text;Interlocked.Increment(ref _epoch);Log("NETWORK_MODE","CHANGED",new{mode=_networkMode,epoch=_epoch});};
        NetworkChange.NetworkAddressChanged += OnNetworkChanged;
        FormClosed += (_,_) => {NetworkChange.NetworkAddressChanged -= OnNetworkChanged;StopPoll();_closed.Cancel();_http.Dispose();_closed.Dispose();};
        Log("EXE_TEST_START","READY",new{uid=Fingerprint(_uid),file=Path.GetFileName(_logPath)});
    }
    private static string AutomaticSessionId()
    {
        var date=DateTimeOffset.UtcNow.AddHours(7).ToString("yyyyMMdd");
        var bytes=SHA256.HashData(Encoding.UTF8.GetBytes("SUPRA-D171-E026-HA3-P4-P5-V10|"+date));
        return Convert.ToHexString(bytes)[..32].ToLowerInvariant();
    }
    private string ExpectedLocalNetwork(int phase)=>RequiredNetwork(_agentLabel,phase);
    private static string RequiredNetwork(string role,int phase)=>
        ((role=="A" && (phase==1||phase==3))||(role=="B"&&(phase==2||phase==3)))?"OFFICE":"NORMAL";
    private static bool ExpectedDiscovery404(HttpStatusCode status,bool notFoundOkay)=>notFoundOkay&&status==HttpStatusCode.NotFound;
    internal static bool PairingSelfTest()
    {
        var a=new[]{"NORMAL","OFFICE","NORMAL","OFFICE","NORMAL"};
        var b=new[]{"NORMAL","NORMAL","OFFICE","OFFICE","NORMAL"};
        return Enumerable.Range(0,5).All(i=>RequiredNetwork("A",i)==a[i] && RequiredNetwork("B",i)==b[i])
            && ExpectedDiscovery404(HttpStatusCode.NotFound,true)
            && !ExpectedDiscovery404(HttpStatusCode.NotFound,false)
            && !ExpectedDiscovery404(HttpStatusCode.Forbidden,true);
    }
    private void ShowNetworkPhase()
    {
        var message=_phase<Phases.Length?Phases[_phase]:"ĐÃ HOÀN TẤT CÁC KỊCH BẢN";
        var recommended=ExpectedLocalNetwork(_phase);
        Log("NEXT_NETWORK_SETUP","OPERATOR_SWITCH_REQUIRED",new{step=_phase+1,total=Phases.Length,scenario=message});
        _confirmSwitch.Enabled=_phase>0&&_phase<Phases.Length;
        _testAll.Enabled=_phase==ResumeStartPhase;
        if(_phase>=Phases.Length){
            StopPoll();
            var haMiss=Volatile.Read(ref _haSlaMissCount);
            var haNever=Volatile.Read(ref _haNoTakeoverCount);
            Log("AUTO_TEST","HA3_AND_ONLY_MISSING_NETWORK_ROUNDS_4_5_FINISHED",new{actual_link_tested_phases=new[]{4,5},ha3_retested=true,historical_link_pass_phases=new[]{1,2,3},historical_ha_sla_miss=true,ha3_b_to_a_misses=_ha3ObservedBtoASlaMiss,ha3_a_to_b_misses=_ha3ObservedAtoBSlaMiss,local_ha_sla_misses=haMiss,local_no_takeover=haNever,owner_field_pass=false});
            MessageBox.Show("Đã thu thập HA3 và vòng đường truyền 4-5.\nHA3 B->A trễ: "+_ha3ObservedBtoASlaMiss+"; A->B trễ: "+_ha3ObservedAtoBSlaMiss+".\nĐối chiếu log E023 cũ. HA E023 vòng 3 vẫn FAIL lịch sử.\nChưa tự nghiệm thu; lưu 2 EXE + PDA log.","SUPRA D171 · Đã thu thập E026",MessageBoxButtons.OK,MessageBoxIcon.Information);
            return;
        }
        if(_phase>0 && _phase<Phases.Length && ExpectedLocalNetwork(_phase)==RequiredNetwork(_agentLabel,_phase-1))
        {
            _confirmSwitch.Enabled=false;
            Log("NETWORK_SWITCH","NO_CHANGE_AUTO_CONTINUE",new{role=_agentLabel,phase=_phase});
            _=Task.Run(async()=>{
                await Task.Delay(400);
                if(!_closed.IsCancellationRequested && !IsDisposed)
                    try{BeginInvoke(new Action(async()=>await Run(AdvancePhase)));}catch(InvalidOperationException){}
            });
            return;
        }
        MessageBox.Show("Tài khoản "+_operatorLogin+" · Test Agent "+_agentLabel+": Kịch bản "+(_phase+1)+"/"+Phases.Length+": "+message+".\nWi-Fi Agent máy này cần: "+recommended+".\nĐổi mạng rồi bấm ĐÃ CHUYỂN MẠNG (trừ lượt đầu, bấm BẮT ĐẦU TEST).","SUPRA D171 · Test mạng",MessageBoxButtons.OK,MessageBoxIcon.Information);
    }
    private async Task StartAutomaticTests()
    {
        _testAll.Enabled=false;
        _oneShotStart=DateTimeOffset.UtcNow;
        Log("ONE_SHOT_BUDGET","ENABLED",new{read_calls=MaxOneShotReadCalls,write_calls=MaxOneShotWriteCalls,minutes=40,physical_roles="A=admin local; B=tamnv2 simulated VPS"});
        _activeStep="01_XAC_THUC_NHOM_AGENT_VA_TAO_PHIEN";
        Log("AUTO_TEST","HA3_ONLY_THEN_4_5__PREVIOUS_1_3_LINK_PROOF_EXTERNAL",new{required="Agent A NORMAL + Agent B OFFICE + PDA NORMAL",start_phase_index=ResumeStartPhase,historical_field_evidence="E023 link rounds 1-3; HA 3 SLA missed",owner_field_pass=false});
        await EnsureAutomaticSession();
        Text="SUPRA D171 E026 · HA3 + vòng 4-5 — "+_operatorLogin+" (Agent "+_agentLabel+")";
        _mode.SelectedItem=ExpectedLocalNetwork(_phase);
        StartPoll();
        _activeStep="02_DANG_KY_AGENT_READY";
        await RunReadOnlyNetworkProbes(Phases[_phase]);
        await VerifyDiagnosticRoute();
        await PublishReady();
        _activeStep="02B_BAO_PDA_CHUYEN_PHA_TEST";
        await AnnouncePhaseToPicker();
        _activeStep="03_DOI_2_AGENT_VA_PDA_DU_3";
        await WaitForThreeReady();
        await VerifyInitialVpsPrimary();
        _activeStep="04_GUI_TEST_VA_CHO_ACK";
        await TestPhase();
        await WaitForPeerPhaseCompletion();
        _phase=ResumeStartPhase+1;
        ShowNetworkPhase();
    }
    private async Task AdvancePhase()
    {
        if(_phase>=Phases.Length)return;
        var phase=Phases[_phase];
        Log("NETWORK_SWITCH","OPERATOR_CONFIRMED",new{phase,epoch=Interlocked.Increment(ref _epoch)});
        _mode.SelectedItem=ExpectedLocalNetwork(_phase);
        _activeStep="05_CAP_NHAT_MANG_AGENT";
        await RunReadOnlyNetworkProbes(phase);
        await VerifyDiagnosticRoute();
        await PublishReady();
        _activeStep="05B_BAO_PDA_CHUYEN_PHA_TEST";
        await AnnouncePhaseToPicker();
        _activeStep="06_DOI_3_THIET_BI_READY";
        await WaitForThreeReady();
        _activeStep="07_GUI_TEST_VA_CHO_ACK";
        await TestPhase();
        await WaitForPeerPhaseCompletion();
        _phase++;
        ShowNetworkPhase();
    }
    private async Task VerifyDiagnosticRoute()
    {
        _activeStep="D171_XAC_MINH_FIRESTORE_SAU_CHUYEN_MANG";
        using var proof=await Http("GET",Url("/members/"+Uri.EscapeDataString(_uid)));
        if(proof==null || GetString(proof.RootElement,"uid")!=_uid)
            throw new InvalidOperationException("D171_FIRESTORE_AUTH_ROUTE_NOT_READY");
        Log("NETWORK_MEASURED","AUTHENTICATED_FIRESTORE_PASS",new{phase=_phase,expected=ExpectedLocalNetwork(_phase)});
    }
    private async Task WaitForPeerPhaseCompletion()
    {
        _activeStep="D171_CHO_AGENT_KIA_HOAN_THANH";
        var id=Guid.NewGuid().ToString("N");
        var fields=new Dictionary<string,object>{
            ["request_id"]=S(id),["sender_uid"]=S(_uid),["sender_node"]=S(_nodeId),
            ["sender_role"]=S(_token.Role),["target_uid"]=S("ALL"),["kind"]=S("PING"),
            ["payload"]=S("D171-PHASE-DONE-P"+_phase),
            ["expires_at"]=T(DateTimeOffset.UtcNow.AddMinutes(4))
        };
        await CreateDoc("d169_diag_sessions/"+Sid()+"/messages/"+id,fields,"created_at");
        Log("PHASE_COMPLETE","LOCAL_PASS_PEER_PENDING",new{phase=_phase});
        for(var i=0;i<30;i++){
            if(_peerComplete.ContainsKey(_phase)){
                Log("PHASE_COMPLETE","BOTH_AGENT_PASS",new{phase=_phase});
                return;
            }
            await Task.Delay(4000,_closed.Token);
        }
        throw new InvalidOperationException("D171_PEER_PHASE_COMPLETE_TIMEOUT");
    }
    private async Task EnsureAutomaticSession()
    {
        // Operator identities are validated at runtime and never written to public logs.
        // A is fixed to the privileged Admin; B is fixed to the second Owner operator.
        _activeStep="01A_KIEM_TRA_TAI_KHOAN_AGENT";
        var account=_operatorLogin.Trim().ToLowerInvariant();
        _agentLabel=account=="admin"?"A":account=="tamnv2"?"B":
            throw new InvalidOperationException("D171_AGENT_ACCOUNT_NOT_AUTHORIZED");
        // The verified Worker user_id is an opaque internal key; never compare it to login alias.
        // Recheck that the Firebase token still belongs to the same Worker-authenticated identity.
        if(!AgentIdentityBinding.MatchesRuntime(account,_token,_uid))
            throw new InvalidOperationException("D171_AUTH_IDENTITY_MISMATCH");
        _activeStep="01B_DOC_PHIEN_FIRESTORE";
        if(_agentLabel=="A"){
            Log("PAIR_DISCOVERY","ADMIN_A_CREATING_OR_REUSING_SESSION");
            using var existing=await Http("GET",Url(),null,true);
            if(existing==null) {
                _activeStep="01C_TAO_PHIEN_FIRESTORE";
                try { await CreateSession(); }
                catch(HttpRequestException e) when(e.Message=="HTTP_409"||e.Message=="HTTP_400") { }
            }
        }
        _activeStep="01D_CHINH_XAC_PHIEN_TEST";
        JsonDocument? root=null;
        for(var attempt=0;attempt<120;attempt++){
            root=await Http("GET",Url(),null,true);
            if(root!=null)break;
            if(attempt%4==0)Log("PAIR_DISCOVERY","WAIT_FOR_ADMIN_A_TO_PRESS_START",new{wait_seconds=attempt*2,role=_agentLabel});
            await Task.Delay(2000,_closed.Token);
        }
        if(root==null)throw new InvalidOperationException("D171_WAIT_ADMIN_A_START_TIMEOUT");
        using(root){
            var ownerUid=GetString(root.RootElement,"owner_uid");
            var until=GetString(root.RootElement,"expires_at");
            if(!DateTimeOffset.TryParse(until,out var expiry)||expiry<=DateTimeOffset.UtcNow)
                throw new InvalidOperationException("D171_EXISTING_TEST_SESSION_EXPIRED_REQUIRE_APPROVED_CLEANUP");
            if(_agentLabel=="A"&&ownerUid!=_uid)
                throw new InvalidOperationException("D171_SESSION_OWNER_CONFLICT_REQUIRE_ARCHIVE_AND_CLEANUP");
            if(_agentLabel=="B"&&ownerUid==_uid)
                throw new InvalidOperationException("D171_DUPLICATE_AGENT_AUTH_UID");
        }
        _activeStep="01E_THAM_GIA_PHIEN_FIRESTORE";
        await JoinSession();
        Log("PAIRING","ROLE_BOUND_JOINED",new{role=_agentLabel,node=_nodeId[..8],phase=_phase+1});
    }
    private async Task PublishReady()
    {
        var name="projects/supra-inventory-beta/databases/(default)/documents/d169_diag_sessions/"+Sid()+"/members/"+_uid;
        var fields=new Dictionary<string,object>{{"ready_phase",I(_phase)},{"ready_network",S(ExpectedLocalNetwork(_phase))}};
        var req=new{writes=new[]{new{update=new{name,fields},updateMask=new{fieldPaths=new[]{"ready_phase","ready_network"}},updateTransforms=new[]{Transform("ready_at")}}}};
        using var result=await Http("POST",CommitUrl,req);
        Log("NETWORK_READY","OPERATOR_CONFIRMED_NOT_SSID_PROOF",new{phase=_phase,required=ExpectedLocalNetwork(_phase),agent=_agentLabel});
    }
    private async Task AnnouncePhaseToPicker()
    {
        // The PDA remains NORMAL. A synthetic PING wakes its phase listener before
        // the three-member READY barrier; otherwise later phases deadlock or pass stale PDA readiness.
        await SendTest("PING");
        Log("PHASE_ANNOUNCE","SENT_PDA_WAKE",new{phase=_phase,required_pda_network="NORMAL"});
    }
    private async Task WaitForThreeReady()
    {
        // Allow the operator to physically change Office Wi-Fi without a premature timeout.
        for(var attempt=0;attempt<50;attempt++){
            using var d=await Http("GET",Url("/members")+"?pageSize=40",null,true);
            if(d!=null&&d.RootElement.TryGetProperty("documents",out var docs)){
                var agentCount=0;var pickerCount=0;
                foreach(var item in docs.EnumerateArray()){
                    var role=GetString(item,"role");
                    if(role=="PICKER"){
                        var timeText=GetString(item,"ready_at");
                        var window=_phase==0?TimeSpan.FromMinutes(3):TimeSpan.FromMinutes(30);
                        if(GetString(item,"ready_phase")==_phase.ToString() && GetString(item,"ready_network")=="NORMAL"&&DateTimeOffset.TryParse(timeText,out var pickerReadyAt)&&pickerReadyAt>DateTimeOffset.UtcNow-window)pickerCount++;
                    }
                    if(role=="ADMIN"||role=="PICKPACK_ADMIN"){
                        var stamp=GetString(item,"ready_at");
                        if(GetString(item,"ready_phase")==_phase.ToString()&&DateTimeOffset.TryParse(stamp,out var when)&&when>DateTimeOffset.UtcNow.AddMinutes(-3))agentCount++;
                    }
                }
                if(agentCount==2&&pickerCount==1){Log("THREE_PARTY_READY","PASS",new{phase=_phase,agents=agentCount,pda=pickerCount});return;}
                if(attempt%4==0)Log("THREE_PARTY_WAIT","WAITING_FOR_MISSING_PARTICIPANTS",new{phase=_phase,agent_ready=agentCount,pda_ready=pickerCount,required_agents=2,required_pda=1});
            }
            else if(attempt%4==0)Log("THREE_PARTY_WAIT","WAITING_FOR_MEMBERS_COLLECTION",new{phase=_phase});
            await Task.Delay(6000,_closed.Token);
        }
        throw new InvalidOperationException("D171_THREE_PARTY_READY_TIMEOUT");
    }
    private async Task VerifyInitialVpsPrimary()
    {
        _activeStep="D171_XAC_MINH_VPS_MO_PHONG_LA_PRIMARY";
        for(var i=0;i<25;i++){
            using var d=await Http("GET",Url());
            if(d!=null){
                var root=d.RootElement;
                var owner=GetString(root,"owner_uid");
                var leader=GetString(root,"leader_uid");
                var generation=long.TryParse(GetString(root,"leader_epoch"),out var n)?n:0;
                if(!string.IsNullOrEmpty(leader)&&leader!=owner&&generation>=2){
                    _awaitInitialVpsClaim=false;
                    _ha3InitialGeneration=generation;
                    Log("SIM_VPS_PRIMARY","PASS",new{generation,role="tamnv2",phase=_phase});
                    return;
                }
            }
            await Task.Delay(2000,_closed.Token);
        }
        throw new InvalidOperationException("D171_SIM_VPS_NOT_PRIMARY");
    }
    private async Task WaitForPicker()
    {
        // Agent may press TEST before the Picker has authenticated; never record false failures.
        for(var t=0;t<30;t++){
            using var peers=await Http("GET",Url("/members")+"?pageSize=30",null,true);
            if(peers!=null&&peers.RootElement.TryGetProperty("documents",out var docs)
               &&docs.EnumerateArray().Any(d=>d.TryGetProperty("fields",out var f)
                &&f.TryGetProperty("role",out var role)
                &&role.TryGetProperty("stringValue",out var v)
                &&v.GetString()=="PICKER")){
                Log("AUTO_PAIR","PICKER_ONLINE",new{node=_nodeId[..8]});
                return;
            }
            await Task.Delay(2000);
        }
        Log("AUTO_PAIR","PICKER_NOT_SEEN",new{wait_seconds=60});
        throw new InvalidOperationException("Chưa phát hiện PDA Test đăng nhập cùng phiên; không thể xác nhận kết nối.");
    }
    private async Task TestPhase()
    {
        var phase=Phases[_phase];
        Log("PHASE","BEGIN",new{phase,expected_operator_network=phase,node=_nodeId[..8]});
        var sent=new List<string>();
        var cases=_phase==ResumeStartPhase?new[]{"PING","LEADER_PROBE"}:new[]{"PING","PICKLIST_SIM","PICKLIST_SIM","CALL_SIM","CHAT_SIM","KICK_SIM","LEADER_PROBE","RETRY_SIM","FAILOVER_SIM"};
        Log("PHASE_CASES",_phase==ResumeStartPhase?"HA3_DIAGNOSTIC_TWO_PROBES_NOT_LINK_RETEST":"NINE_LINK_SCENARIOS",new{phase_index=_phase,count=cases.Length});
        foreach(var type in cases){
          sent.Add(await SendTest(type));
        }
        for(var t=0;t<90;t++){
           if(sent.All(id=>_pdaAcks.TryGetValue(id,out var p)&&p>0&&_agentAcks.TryGetValue(id,out var a)&&a>0))break;
          await Task.Delay(1000);
        }
        foreach(var id in sent){
          _pdaAcks.TryGetValue(id,out var p);_agentAcks.TryGetValue(id,out var a);
          Log("TEST_TERMINAL",p>0&&a>0?"ACK_PASS":"ACK_TIMEOUT",new{request_id=id,pda_receipts=p,peer_agent_receipts=a,required_role="PICKER_AND_AGENT",phase});
        }
        var passed=sent.Count(id=>_pdaAcks.TryGetValue(id,out var p)&&p>0&&_agentAcks.TryGetValue(id,out var a)&&a>0);
        Log("PHASE",_phase==ResumeStartPhase?
            (passed==sent.Count?"HA3_TWO_PROBE_ACK_PASS_NOT_LINK_ROUND3_PASS":"HA3_PROBE_INCOMPLETE_NOT_LINK_PASS")
            :(passed==sent.Count?"LINK_ACK_PASS":"LINK_ACK_INCOMPLETE"),
            new{phase_index=_phase,passed,total=sent.Count,link_rounds_1_3_unchanged=true});
        var terminalBoundMs=sent.Where(id=>_sentTicks.TryGetValue(id,out var t)&&
            _pdaAcks.TryGetValue(id,out var p)&&p>0&&_agentAcks.TryGetValue(id,out var a)&&a>0)
            .Select(id=>Environment.TickCount64-_sentTicks[id]).OrderBy(t=>t).ToArray();
        if(terminalBoundMs.Length>0)Log("PHASE_LINK_METRICS","TERMINAL_OBSERVATION_UPPER_BOUNDS_NOT_NETWORK_RTT",
            new{phase_index=_phase,sample_count=terminalBoundMs.Length,terminal_p50_bound_ms=terminalBoundMs[(int)Math.Ceiling(terminalBoundMs.Length*0.50)-1],
                terminal_p95_bound_ms=terminalBoundMs[(int)Math.Ceiling(terminalBoundMs.Length*0.95)-1],
                terminal_p99_bound_ms=terminalBoundMs[(int)Math.Ceiling(terminalBoundMs.Length*0.99)-1],
                note="Terminal checks follow the final ACK; per-message RX receipt rtt_ms is more precise",
                http_read_calls=_readCount,http_write_calls=_writeCount});
        if(_phase==ResumeStartPhase){
            if(passed!=sent.Count)Log("HA3_PDA_PEER_PROBE","ACK_INCOMPLETE_DIAG_CONTINUES_NOT_PASS",new{passed,total=sent.Count});
            await VerifyHa3Bidirectional();
        }else{
            if(passed!=sent.Count)throw new InvalidOperationException("D171_PHASE_ACK_INCOMPLETE");
            if(_phase==Phases.Length-1)await VerifySimulatedVpsReturn();
        }
    }
    private async Task VerifyHa3Bidirectional()
    {
        // Round 3 historical 9/9 ACK remains valid. This is a targeted HA re-measurement,
        // NOT a replay of round 3's link PASS and NOT a real production PRIMARY.
        _activeStep="D171_HA3_BOTH_DIRECTIONS_CAPTURE";
        var start=Environment.TickCount64;
        var baseline=_ha3InitialGeneration;
        if(baseline<2){
            Log("HA3","UNVERIFIED_INITIAL_GENERATION_SKIP",new{baseline});
            return;
        }
        if(_agentLabel=="B"){
            using var existing=await Http("GET",Url());
            if(existing==null || GetString(existing.RootElement,"leader_uid")!=_uid ||
                GetString(existing.RootElement,"leader_epoch")!=baseline.ToString()){
                Log("HA3","B_INITIAL_PRIMARY_NOT_HELD__NO_VALID_PAUSE",new{baseline});
                return;
            }
            _suspendLeaderUntil=DateTimeOffset.UtcNow.AddSeconds(110);
            var lease=GetString(existing.RootElement,"lease_until");
            var remaining=DateTimeOffset.TryParse(lease,out var expiry)?(long)(expiry-DateTimeOffset.UtcNow).TotalMilliseconds:-1;
            Log("HA3","B_INITIAL_LEASE_RENEWAL_PAUSED",new{baseline,lease_remaining_ms=remaining,utc=DateTimeOffset.UtcNow.ToString("O"),monotonic=Environment.TickCount64,
                lease_seconds=16,leader_probe_threshold_ms=16000,listener_interval_ms=8000,sla_ms=20000});
            start=Environment.TickCount64;
        }else{
            Log("HA3","A_STANDBY_WATCHING_B_OFFICE_PAUSE",new{baseline,network=_networkMode});
        }
        var firstObserved=false;
        var secondObserved=false;
        var firstTick=0L;
        var observedFirstMs=0L;
        var observedSecondMs=0L;
        var previousGeneration=baseline;
        var lastSample=-3000L;
        var readErrors=0;
        for(var i=0;i<100;i++){
            await Task.Delay(1000,_closed.Token);
            var tick=Environment.TickCount64;
            try {
                var beforeRead=Environment.TickCount64;
                using var doc=await Http("GET",Url());
                if(doc==null){readErrors++;continue;}
                var root=doc.RootElement;
                var generation=long.TryParse(GetString(root,"leader_epoch"),out var n)?n:0;
                var owner=GetString(root,"owner_uid");
                var holder=GetString(root,"leader_uid");
                var holderRole=holder==owner?"A":string.IsNullOrEmpty(holder)?"UNKNOWN":"B";
                var leaseText=GetString(root,"lease_until");
                var leaseRemaining=DateTimeOffset.TryParse(leaseText,out var until)?(long)(until-DateTimeOffset.UtcNow).TotalMilliseconds:-1;
                var ms=tick-start;
                if(ms-lastSample>=3000 || generation!=previousGeneration){
                    Log("HA3_LEASE_TIMELINE","SAMPLE",new{from_role=_agentLabel,phase_index=2,elapsed_ms=ms,
                        leader_role=holderRole,generation,lease_remaining_ms=leaseRemaining,
                        firestore_get_ms=Environment.TickCount64-beforeRead,network=_networkMode,
                        read_errors=readErrors,local_poll_threshold_ms=16000,local_listener_poll_interval_ms=8000,
                        local_pause_active=DateTimeOffset.UtcNow<_suspendLeaderUntil});
                    lastSample=ms;
                    previousGeneration=generation;
                }
                if(!firstObserved && generation==baseline+1 && holderRole=="A"){
                    firstObserved=true;
                    firstTick=Environment.TickCount64;
                    observedFirstMs=firstTick-start;
                    Log("HA3","B_TO_A_TAKEOVER_OBSERVED",new{elapsed_from_local_monitor_ms=observedFirstMs,generation,lease_remaining_ms=leaseRemaining,reader_role=_agentLabel});
                    if(_agentLabel=="A"){
                        // Arm stage 2: admin (NORMAL) stops renewing; tamnv2 (OFFICE) must reclaim.
                        _suspendLeaderUntil=DateTimeOffset.UtcNow.AddSeconds(55);
                        Log("HA3","A_LEASE_RENEWAL_PAUSED_FOR_A_TO_B",new{generation,lease_remaining_ms=leaseRemaining,
                            utc=DateTimeOffset.UtcNow.ToString("O"),monotonic=firstTick,sla_ms=20000});
                    }else{
                        // B's first pause no longer blocks B's second-stage takeover attempt.
                        _suspendLeaderUntil=DateTimeOffset.MinValue;
                        var late=observedFirstMs>20000;
                        if(late)Interlocked.Increment(ref _ha3ObservedBtoASlaMiss);
                        Log("HA3",late?"B_TO_A_SLA_MISS":"B_TO_A_WITHIN_20S",new{elapsed_ms=observedFirstMs,sla_ms=20000,originating_role="B"});
                    }
                }
                if(firstObserved && !secondObserved && generation==baseline+2 && holderRole=="B"){
                    secondObserved=true;
                    observedSecondMs=Environment.TickCount64-firstTick;
                    if(_agentLabel=="A" && observedSecondMs>20000)Interlocked.Increment(ref _ha3ObservedAtoBSlaMiss);
                    Log("HA3",_agentLabel=="A"?(observedSecondMs<=20000?"A_TO_B_WITHIN_20S":"A_TO_B_SLA_MISS"):"A_TO_B_OBSERVED_OTHER_CLOCK",
                        new{elapsed_since_local_A_takeover_observation_ms=observedSecondMs,generation,lease_remaining_ms=leaseRemaining,
                            sla_ms=20000,originating_role=_agentLabel});
                    break;
                }
                if(generation>baseline+2){
                    Log("HA3","UNEXPECTED_GENERATION_SKIP_FENCING_ANOMALY",new{baseline,generation});
                    break;
                }
                if(!firstObserved && ms>=45000){
                    if(_agentLabel=="B")Interlocked.Increment(ref _ha3ObservedBtoASlaMiss);
                    Interlocked.Increment(ref _haNoTakeoverCount);
                    Log("HA3","B_TO_A_NO_TAKEOVER_45S_NOT_PASS",new{baseline,elapsed_ms=ms,read_errors=readErrors});
                    _suspendLeaderUntil=DateTimeOffset.MinValue;
                    break;
                }
                if(firstObserved && Environment.TickCount64-firstTick>=45000){
                    if(_agentLabel=="A")Interlocked.Increment(ref _ha3ObservedAtoBSlaMiss);
                    Interlocked.Increment(ref _haNoTakeoverCount);
                    Log("HA3","A_TO_B_NO_TAKEOVER_45S_NOT_PASS",new{baseline,elapsed_ms=Environment.TickCount64-firstTick,read_errors=readErrors});
                    break;
                }
            }catch(HttpRequestException e){
                readErrors++;
                Log("HA3","FIRESTORE_MONITOR_ERROR",new{code=PublicFailureCode(e),read_errors=readErrors,role=_agentLabel});
                if(e.Message=="HTTP_401"||e.Message=="HTTP_403")break;
            }catch(TaskCanceledException){
                readErrors++;
                Log("HA3","HTTP_TIMEOUT",new{read_errors=readErrors,role=_agentLabel});
            }
        }
        // Never silently declare the HA scenario PASS just because both channel phases can complete.
        Log("HA3","FINISHED_INDEPENDENT_FROM_NETWORK_ROUNDS_4_5",
            new{first_takeover_observed=firstObserved,second_takeover_observed=secondObserved,read_errors=readErrors,
                b_to_a_observed_ms=observedFirstMs,a_to_b_local_observed_ms=observedSecondMs,
                verified_owner_pass=false,network_rounds_4_5_can_proceed=true});
        _suspendLeaderUntil=DateTimeOffset.MinValue;
    }

    private async Task RunReadOnlyNetworkProbes(string phase)
    {
        // Compare the existing Firebase routes separately from the direct authenticated peer ACKs.
        // Do not assume endpoint HTTP success means a business ACK or working listener.
        var report=new DiagnosticReport {
            NetworkLabel=_networkMode,
            StartedAtUtc=DateTimeOffset.UtcNow.ToString("O")
        };
        try {
            await FirebaseDiagnostic.RunAsync(report,_token,new Progress<string>(
              s=>Log("NETWORK_PROBE_PROGRESS","RUNNING",new{phase,step=s})));
            report.FinishedAtUtc=DateTimeOffset.UtcNow.ToString("O");
            var line=JsonSerializer.Serialize(new{test_session=_sessionId,agent_node=_nodeId[..8],phase,report});
            lock(_gate)File.AppendAllText(_probeLogPath,line+Environment.NewLine,Encoding.UTF8);
            Log("NETWORK_PROBE","EXPORTED",new{phase,count=report.Probes.Count,file=Path.GetFileName(_probeLogPath)});
        }catch(Exception ex){
            Log("NETWORK_PROBE","ERROR",new{phase,reason=ex.GetType().Name});
        }
    }
    private int _haSlaMissCount;
    private int _haNoTakeoverCount;
    private async Task VerifyAutomaticLeaderFailover()
    {
        // A delayed failover is a real SLA failure, but it must not destroy the
        // remaining Office/Internet field evidence. Always retain both verdicts.
        using var before=await Http("GET",Url());
        if(before==null)throw new InvalidOperationException("MISSING_TEST_SESSION");
        var oldNode=GetString(before.RootElement,"leader_node");
        var oldEpoch=long.TryParse(GetString(before.RootElement,"leader_epoch"),out var e)?e:0;
        if(oldNode!=_nodeId){
            Log("FAILOVER_SUITE","STANDBY_MONITOR",new{phase=_phase,leader=oldNode[..Math.Min(8,oldNode.Length)],generation=oldEpoch});
            return;
        }
        _suspendLeaderUntil=DateTimeOffset.UtcNow.AddSeconds(48);
        Log("FAILOVER_SUITE","PRIMARY_HEARTBEAT_PAUSED",new{phase=_phase,generation=oldEpoch,ha_sla_ms=20000,observation_window_ms=45000});
        var started=Environment.TickCount64;
        var recordedSlaMiss=false;
        while(Environment.TickCount64-started<45000){
            await Task.Delay(1000,_closed.Token);
            using var current=await Http("GET",Url());
            if(current!=null){
                var newNode=GetString(current.RootElement,"leader_node");
                var newEpoch=long.TryParse(GetString(current.RootElement,"leader_epoch"),out var n)?n:0;
                if(newNode!=_nodeId && newEpoch==oldEpoch+1){
                    var elapsed=Environment.TickCount64-started;
                    var metSla=elapsed<=20000;
                    if(!metSla && !recordedSlaMiss){
                        Interlocked.Increment(ref _haSlaMissCount);
                        recordedSlaMiss=true;
                    }
                    Log("FAILOVER_SUITE",metSla?"PASS_WITHIN_20S":"LATE_TAKEOVER_OUTSIDE_20S_SLA",
                        new{phase=_phase,new_epoch=newEpoch,elapsed_ms=elapsed,sla_ms=20000,transport_testing_may_continue=true});
                    return;
                }
            }
            if(!recordedSlaMiss && Environment.TickCount64-started>=20000){
                recordedSlaMiss=true;
                Interlocked.Increment(ref _haSlaMissCount);
                Log("FAILOVER_SUITE","SLA_MISS_20S_CONTINUE_OBSERVATION",
                    new{phase=_phase,generation=oldEpoch,sla_ms=20000,field_network_rounds_must_not_abort=true});
            }
        }
        Interlocked.Increment(ref _haNoTakeoverCount);
        Log("FAILOVER_SUITE","NO_TAKEOVER_WITHIN_45S_HA_FAIL_NETWORK_CONTINUES",
            new{phase=_phase,generation=oldEpoch,sla_ms=20000,window_ms=45000});
        // HA remains FAILED, never treat this as PASS. The 5/5 transport round
        // barrier is independent and continues with safe synthetic operations.
    }
    private async Task VerifySimulatedVpsReturn()
    {
        _activeStep="D171_VPS_MO_PHONG_NHAN_LAI_PRIMARY";
        using(var before=await Http("GET",Url())){
            if(before==null)throw new InvalidOperationException("D171_TEST_SESSION_MISSING");
            var root=before.RootElement;
            if(_agentLabel=="A" && GetString(root,"leader_node")==_nodeId){
                _suspendLeaderUntil=DateTimeOffset.UtcNow.AddSeconds(45);
                Log("SIM_VPS_RETURN","CURRENT_AGENT_YIELDING_LEASE");
            }
        }
        for(var i=0;i<25;i++){
            using var current=await Http("GET",Url());
            if(current!=null){
                var root=current.RootElement;
                var leader=GetString(root,"leader_uid");
                var owner=GetString(root,"owner_uid");
                if(!string.IsNullOrEmpty(leader)&&leader!=owner){
                    Log("SIM_VPS_RETURN","PASS",new{phase=_phase+1,role="tamnv2"});
                    return;
                }
            }
            await Task.Delay(2000,_closed.Token);
        }
        throw new InvalidOperationException("D171_SIM_VPS_RETURN_TIMEOUT");
    }
    private async Task<string> SendTest(string type)
    {
        var id=Guid.NewGuid().ToString("N");
        var simulatedPayload="D169-SIM-P"+_phase+
            (type=="PICKLIST_SIM" ? ((Interlocked.Increment(ref _picklistSequence)%2)==0?"|1234":"|123"):"");
        _sentExpected[id]=simulatedPayload;
        var fields=new Dictionary<string,object>{
          ["request_id"]=S(id),["sender_uid"]=S(_uid),["sender_node"]=S(_nodeId),["sender_role"]=S(_token.Role),
          ["target_uid"]=S("ALL"),["kind"]=S(type),["payload"]=S(simulatedPayload),
          ["expires_at"]=T(DateTimeOffset.UtcNow.AddMinutes(4))
        };
        _sentTicks[id]=Environment.TickCount64;
        await CreateDoc("d169_diag_sessions/"+Sid()+"/messages/"+id,fields,"created_at");
        Log("SIM_TEST","SERVER_ACCEPTED_NOT_ACK",new{request_id=id,type,phase=_phase+1,synthetic_payload=simulatedPayload});
        return id;
    }
    private void OnNetworkChanged(object? sender,EventArgs e)
    {
        Interlocked.Increment(ref _epoch);
        Log("NETWORK_EPOCH","SYSTEM_CHANGED",new{epoch=_epoch,network=_networkMode});
    }
    private static string Fingerprint(string value) => value.Length<8?"UID":"uid:"+value[..4]+"…";
    private void Log(string stage,string result,object? detail=null)
    {
        var s=JsonSerializer.Serialize(new { at_utc=DateTimeOffset.UtcNow.ToString("O"),mono_ticks=Environment.TickCount64,
            session_id=_sessionId,network_epoch=_epoch,network_mode=_networkMode,stage,result,detail,reads=_readCount,writes=_writeCount });
        lock(_gate)File.AppendAllText(_logPath,s+Environment.NewLine,Encoding.UTF8);
        if(!IsDisposed)try{BeginInvoke(new Action(()=>{_output.AppendText(DateTime.Now.ToString("HH:mm:ss")+" "+stage+" "+result+Environment.NewLine); }));}catch{}
    }
    private async Task Run(Func<Task> action)
    {
        if(_busy)return;_busy=true;
        try{await action();}
        catch(Exception e){
            // Print actionable diagnostics without logging passwords, tokens or raw HTTP bodies.
            var code=PublicFailureCode(e);
            Log("ACTION","FAILED",new{stage=_activeStep,code,type=e.GetType().Name});
             _confirmSwitch.Enabled=false;
             StopPoll();
            if(!IsDisposed){
                _output.AppendText(DateTime.Now.ToString("HH:mm:ss")+" LOI ["+_activeStep+"] "+code+Environment.NewLine);
                MessageBox.Show("D171 khong the tiep tuc tai buoc: "+_activeStep+Environment.NewLine+
                    "Ma loi: "+code+Environment.NewLine+
                    "Log chi tiet: "+_logPath+Environment.NewLine+
                    "Gui file JSONL (khong gui mat khau hay token) de kiem tra.",
                    "SUPRA D171 - Loi can xu ly",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                _testAll.Enabled=false; // Faulted run must not replay stale data.
            }
        }
        finally{_busy=false;}
    }
    private static string PublicFailureCode(Exception e){
        if(e is HttpRequestException){
            var message=e.Message;
            return Regex.IsMatch(message,@"^HTTP_[0-9]{3}$")?message:"NETWORK_HTTP_FAILURE";
        }
        if(e is OperationCanceledException)return "NETWORK_TIMEOUT";
        if(e is InvalidOperationException && Regex.IsMatch(e.Message,@"^[A-Z0-9_]{5,100}$"))return e.Message;
        if(e is System.Net.Sockets.SocketException)return "NETWORK_SOCKET_UNAVAILABLE";
        return e.GetType().Name.ToUpperInvariant();
    }
    private string Sid()
    {
        var id=_sessionId;
        if(!Regex.IsMatch(id,"^[a-f0-9]{32}$"))throw new InvalidOperationException("SID must be 32 hex");
        return id;
    }
    private string Url(string suffix="")=>RootUrl+"/d169_diag_sessions/"+Sid()+suffix;
    private static object S(string x)=>new{stringValue=x};
    private static object I(long x)=>new{integerValue=x.ToString()};
    private static object T(DateTimeOffset x)=>new{timestampValue=x.ToUniversalTime().ToString("O")};
    private static object Transform(string field)=>new{fieldPath=field,setToServerValue="REQUEST_TIME"};
    private static string GetJwtClaim(string jwt,string name)
    {
        try{
            var p=jwt.Split('.')[1].Replace('-','+').Replace('_','/');
            p=p.PadRight(((p.Length+3)/4)*4,'=');
            using var d=JsonDocument.Parse(Convert.FromBase64String(p));
            return d.RootElement.TryGetProperty(name,out var x)?x.GetString()??"":"";
        }catch{return "";}
    }
    private async Task RefreshToken()
    {
        if(_token.Expires>DateTimeOffset.UtcNow.AddMinutes(2))return;
        using var c=new HttpClient(new HttpClientHandler{UseProxy=true,DefaultProxyCredentials=CredentialCache.DefaultNetworkCredentials});
        var form=new FormUrlEncodedContent(new Dictionary<string,string>{{"grant_type","refresh_token"},{"refresh_token",_token.RefreshToken}});
        using var r=await c.PostAsync("https://securetoken.googleapis.com/v1/token?key="+Uri.EscapeDataString(BuildConfig.FirebaseApiKey),form);
        if(!r.IsSuccessStatusCode)throw new InvalidOperationException("AUTH_REFRESH_"+(int)r.StatusCode);
        using var d=JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        _token.IdToken=d.RootElement.GetProperty("id_token").GetString()??"";
        _token.RefreshToken=d.RootElement.GetProperty("refresh_token").GetString()??"";
        _token.Expires=DateTimeOffset.UtcNow.AddMinutes(55);
        Log("AUTH_REFRESH","PASS");
    }
    private async Task<JsonDocument?> Http(string method,string url,object? data=null,bool notFoundOkay=false)
    {
        if(_oneShotStart!=DateTimeOffset.MinValue && DateTimeOffset.UtcNow-_oneShotStart>MaxOneShotDuration)
            throw new InvalidOperationException("D171_TEST_DEADLINE_STOP");
        var isRead=method=="GET"||url.EndsWith(":runQuery",StringComparison.Ordinal);
        if(!isRead && Volatile.Read(ref _writeCount)>=MaxOneShotWriteCalls)
            throw new InvalidOperationException("D171_WRITE_BUDGET_STOP");
        await RefreshToken();
        using var req=new HttpRequestMessage(new HttpMethod(method),url);
        req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",_token.IdToken);
        if(data!=null)req.Content=new StringContent(JsonSerializer.Serialize(data),Encoding.UTF8,"application/json");
        if((method=="GET"||url.EndsWith(":runQuery",StringComparison.Ordinal))
            && Volatile.Read(ref _readCount)>=MaxOneShotReadCalls)
            throw new InvalidOperationException("D171_READ_BUDGET_STOP");
        var start=Environment.TickCount64;
        HttpResponseMessage res;
        try{res=await _http.SendAsync(req);}
        catch(HttpRequestException e){Log("FIRESTORE_HTTP","NETWORK_EXCEPTION",new{method,elapsed_ms=Environment.TickCount64-start,error=PublicFailureCode(e)});throw;}
        catch(TaskCanceledException){Log("FIRESTORE_HTTP","NETWORK_TIMEOUT",new{method,elapsed_ms=Environment.TickCount64-start});throw;}
        using(res){return await ParseDiagnosticHttpResponse(method,url,res,start,isRead,notFoundOkay);}
    }
    private async Task<JsonDocument?> ParseDiagnosticHttpResponse(string method,string url,HttpResponseMessage res,long start,bool isRead,bool notFoundOkay)
    {
        if(method=="GET"||url.EndsWith(":runQuery",StringComparison.Ordinal)){
            if(Interlocked.Increment(ref _readCount)>MaxOneShotReadCalls)throw new InvalidOperationException("D171_READ_BUDGET_STOP");
        }else Interlocked.Increment(ref _writeCount);
        var resultCode="HTTP_"+(int)res.StatusCode;
        var route = url.Contains("/members",StringComparison.Ordinal)?"MEMBERS" :
            url.Contains("/receipts",StringComparison.Ordinal)?"RECEIPTS" :
            url.Contains("/messages",StringComparison.Ordinal)?"MESSAGES" :
            url.Contains(":commit",StringComparison.Ordinal)?"DOCUMENT_WRITE" : "TEST_SESSION";
        // Missing session/list during pairing is a normal wait, not a transport failure.
        // Do not flood the on-screen error stream with expected HTTP 404 every 2 seconds.
        if(ExpectedDiscovery404(res.StatusCode,notFoundOkay))return null;
        Log("FIRESTORE_HTTP",resultCode,new{method,route,elapsed_ms=Environment.TickCount64-start});
        if(!res.IsSuccessStatusCode){
            string reason="UNSPECIFIED";
            try{
                // Extract only a whitelisted provider error status; never expose raw response bodies.
                var limited=await res.Content.ReadAsStringAsync();
                using var parsed=JsonDocument.Parse(limited);
                var err=parsed.RootElement.GetProperty("error");
                var safe=err.TryGetProperty("status",out var field)?field.GetString():"";
                if(safe!=null&&Regex.IsMatch(safe,@"^[A-Z_]{2,60}$"))reason=safe;
            }catch{}
            Log("FIRESTORE_FAILURE",resultCode,new{step=_activeStep,method,route,reason});
            throw new HttpRequestException(resultCode);
        }
        return JsonDocument.Parse(await res.Content.ReadAsStringAsync());
    }
    private async Task CreateDoc(string path,Dictionary<string,object> fields,string timestampField)
    {
        string name="projects/supra-inventory-beta/databases/(default)/documents/"+path;
        var data=new { writes=new[]{new {
          update=new{name,fields},
          currentDocument=new{exists=false},
          updateTransforms=new[]{Transform(timestampField)}
        }}};
        using var r=await Http("POST",CommitUrl,data);
    }
    private async Task CreateSession()
    {
        var id=Sid();
        var fields=new Dictionary<string,object>{
          ["schema"]=S("D169_DIAG_V1"),["owner_uid"]=S(_uid),["paired_picker_uid"]=S(""),
          ["expires_at"]=T(DateTimeOffset.UtcNow.AddHours(24)),
          ["leader_uid"]=S(_uid),["leader_node"]=S(_nodeId),["leader_epoch"]=I(1),
          ["lease_until"]=T(DateTimeOffset.UtcNow.AddSeconds(16))
        };
        await CreateDoc("d169_diag_sessions/"+id,fields,"created_at");
        Log("TEST_SESSION","CREATED",new{sid=id,lease=1});
    }
    private async Task JoinSession()
    {
        var path="d169_diag_sessions/"+Sid()+"/members/"+_uid;
        var fields=new Dictionary<string,object>{["uid"]=S(_uid),["role"]=S(_token.Role)};
        try{await CreateDoc(path,fields,"joined_at");Log("MEMBER_JOIN","PASS",new{role=_token.Role});}
        catch(HttpRequestException e)when(e.Message=="HTTP_409"||e.Message=="HTTP_400"){ // verify existing membership before accepting
            using var d=await Http("GET",RootUrl+"/"+path);
            if(d==null || GetString(d.RootElement,"uid")!=_uid)throw;
            Log("MEMBER_JOIN","EXISTS");
        }
    }
    private async Task Send()
    {
        var id=Guid.NewGuid().ToString("N");
        var type=_kind.Text;
        var fields=new Dictionary<string,object>{
          ["request_id"]=S(id),["sender_uid"]=S(_uid),["sender_node"]=S(_nodeId),["sender_role"]=S(_token.Role),
          ["target_uid"]=S("ALL"),["kind"]=S(type),["payload"]=S(_payload.Text[..Math.Min(80,_payload.Text.Length)]),
          ["expires_at"]=T(DateTimeOffset.UtcNow.AddMinutes(4))
        };
        await CreateDoc("d169_diag_sessions/"+Sid()+"/messages/"+id,fields,"created_at");
        Log("TEST_MESSAGE","SENT",new{request_id=id,kind=type,epoch=_epoch,receiver="ALL"});
    }
    private async Task Takeover()
    {
        using var doc=await Http("GET",Url());
        if(doc==null)throw new InvalidOperationException("NO_SESSION");
        var root=doc.RootElement;
        var oldEpoch=long.TryParse(GetString(root,"leader_epoch"),out var i)?i:0;
        var leader=GetString(root,"leader_uid");
        var until=GetString(root,"lease_until");
        if(leader!=_uid && DateTimeOffset.TryParse(until,out var t) && t>DateTimeOffset.UtcNow) {
            Log("TEST_TAKEOVER","GUARD_BLOCKED",new{old_epoch=oldEpoch});
            return;
        }
        var currentUpdateTime=root.GetProperty("updateTime").GetString()??"";
        var qs="?updateMask.fieldPaths=leader_uid&updateMask.fieldPaths=leader_epoch&updateMask.fieldPaths=lease_until&currentDocument.updateTime="+Uri.EscapeDataString(currentUpdateTime);
        var body=new {fields=new Dictionary<string,object>{
          ["leader_uid"]=S(_uid),["leader_epoch"]=I(oldEpoch+1),["lease_until"]=T(DateTimeOffset.UtcNow.AddSeconds(40))
        }};
        using var result=await Http("PATCH",Url()+qs,body);
        Log("TEST_TAKEOVER","CAS_COMMITTED",new{new_epoch=oldEpoch+1,old_leader=Fingerprint(leader)});
    }
    private async Task MaintainSimulatedLeader()
    {
        using var doc=await Http("GET",Url());
        if(doc==null)return;
        var root=doc.RootElement;
        var leaderNode=GetString(root,"leader_node");
        var currentLeader=GetString(root,"leader_uid");
        var expires=GetString(root,"lease_until");
        var generation=long.TryParse(GetString(root,"leader_epoch"),out var old)?old:0;
        var leaseTime=DateTimeOffset.TryParse(expires,out var until)?until:DateTimeOffset.MinValue;
        var now=DateTimeOffset.UtcNow;
        if(_phase==ResumeStartPhase)Log("HA3_LEASE_SCHEDULER","FIRESTORE_READ",new{role=_agentLabel,generation,
            holder_role=currentLeader==GetString(root,"owner_uid")?"A":"B",lease_remaining_ms=(long)(leaseTime-now).TotalMilliseconds,
            lease_seconds=16,periodic_primary_poll_ms=16000,query_listener_sleep_ms=8000,
            local_pause_active=now<_suspendLeaderUntil});
        if(_agentLabel=="A"&&_awaitInitialVpsClaim){
            if(generation>=2&&leaderNode!=_nodeId)_awaitInitialVpsClaim=false;
            else return; // admin A stands down until tamnv2 B claims initial simulated VPS.
        }
        if(leaderNode==_nodeId && now<_suspendLeaderUntil)return;
        if(leaderNode!=_nodeId && leaseTime>now){
            Log("SIM_LEADER","STANDBY",new{generation,owner_node=leaderNode[..Math.Min(8,leaderNode.Length)],lease_remaining_ms=(long)(leaseTime-now).TotalMilliseconds});
            return;
        }
        var takeOver=leaderNode!=_nodeId;
        if(!takeOver && leaseTime>now.AddSeconds(8))return;
        var time=root.GetProperty("updateTime").GetString()??"";
        var fields=new Dictionary<string,object>{
          ["lease_until"]=T(now.AddSeconds(16))
        };
        if(takeOver){
            fields["leader_uid"]=S(_uid);
            fields["leader_node"]=S(_nodeId);
            fields["leader_epoch"]=I(generation+1);
        }
        var qs="?currentDocument.updateTime="+Uri.EscapeDataString(time)
            +"&updateMask.fieldPaths=lease_until";
        if(takeOver)qs+="&updateMask.fieldPaths=leader_uid&updateMask.fieldPaths=leader_node&updateMask.fieldPaths=leader_epoch";
        try {
            if(_phase==ResumeStartPhase)Log("HA3_LEASE_CAS","ATTEMPT",new{takeover=takeOver,from_generation=generation,to_generation=takeOver?generation+1:generation,
                lease_remaining_ms=(long)(leaseTime-now).TotalMilliseconds,network=_networkMode});
            var casAt=Environment.TickCount64;
            using var result=await Http("PATCH",Url()+qs,new{fields});
            if(_phase==ResumeStartPhase)Log("HA3_LEASE_CAS","COMMITTED",new{takeover=takeOver,generation=takeOver?generation+1:generation,
                cas_http_ms=Environment.TickCount64-casAt});
            Log("SIM_LEADER",takeOver?"CAS_TAKEOVER_PASS":"HEARTBEAT_PASS",new{node=_nodeId[..8],generation=takeOver?generation+1:generation});
        }catch(HttpRequestException e)when(e.Message=="HTTP_409"||e.Message=="HTTP_400"||e.Message=="HTTP_403"){
            Log("SIM_LEADER","FENCING_DENIED",new{generation,code=e.Message});
            if(_phase==ResumeStartPhase)Log("HA3_LEASE_CAS","FENCING_DENIED",new{generation,code=e.Message,holder_is_me=leaderNode==_nodeId});
        }
    }
    private static string GetString(JsonElement document,string field)
    {
        if(!document.TryGetProperty("fields",out var fields) || !fields.TryGetProperty(field,out var item))return "";
        if(item.TryGetProperty("stringValue",out var a))return a.GetString()??"";
        if(item.TryGetProperty("integerValue",out var b))return b.GetString()??"";
        if(item.TryGetProperty("timestampValue",out var c))return c.GetString()??"";
        return "";
    }
    private void StartPoll()
    {
        if(_polling!=null)return;
        _polling=CancellationTokenSource.CreateLinkedTokenSource(_closed.Token);
        var cancel=_polling;
        _pollSince=DateTimeOffset.UtcNow.AddSeconds(-10);
        Log("LISTENER","START",new{mode="FIRESTORE_RECENT_QUERY_8S",http_read_budget=MaxOneShotReadCalls,write_budget=MaxOneShotWriteCalls,max_minutes=40});
        _=Task.Run(async()=>{
          while(!cancel.IsCancellationRequested)
          {
            try{await Poll();}
            catch(InvalidOperationException e)when(e.Message=="D171_READ_BUDGET_STOP"||e.Message=="D171_WRITE_BUDGET_STOP"||e.Message=="D171_TEST_DEADLINE_STOP"){
                Log("LISTENER",e.Message,new{reads=_readCount,writes=_writeCount});break;
            }
            catch(Exception e){Log("LISTENER","ERROR",new{type=e.GetType().Name});}
            try{await Task.Delay(8000,cancel.Token);}catch(OperationCanceledException){break;}
          }
        },cancel.Token);
    }
    private void StopPoll()
    {
        var c=_polling;_polling=null;
        if(c!=null){c.Cancel();Log("LISTENER","STOP");}
    }
    private async Task Poll()
    {
        if(Environment.TickCount64-_lastLeaderProbe>16000){
            var nowTicks=Environment.TickCount64;
            if(_phase==ResumeStartPhase)Log("HA3_POLL_SCHEDULE","WAKE",new{since_prior_probe_ms=_lastLeaderProbe==0?0:nowTicks-_lastLeaderProbe,
                threshold_ms=16000,listener_sleep_ms=8000,network=_networkMode});
            _lastLeaderProbe=nowTicks;
            await MaintainSimulatedLeader();
        }
        var since=_pollSince;
        await PollCollection("messages",since,async (id,root)=>{
          var from=GetString(root,"sender_uid");
          var to=GetString(root,"target_uid");
          if(GetString(root,"sender_node")==_nodeId || (to!="ALL" && to!=_uid))return true;
          if(DateTimeOffset.TryParse(GetString(root,"expires_at"),out var expiration) && expiration<DateTimeOffset.UtcNow)return true;
          var kind=GetString(root,"kind");
          var incomingPayload=GetString(root,"payload");
           if(incomingPayload.StartsWith("D171-PHASE-DONE-P",StringComparison.Ordinal)){
               if(from!=_uid && int.TryParse(incomingPayload.Substring("D171-PHASE-DONE-P".Length),out var done)
                   && done>=0 && done<Phases.Length &&
                   ((await MemberRole(from)) is "ADMIN" or "PICKPACK_ADMIN"))_peerComplete[done]=true;
               return true;
           }
          var expectedPrefix="D169-SIM-P"+_phase;
          var validPayload=kind=="PICKLIST_SIM"
            ? Regex.IsMatch(incomingPayload,"^"+Regex.Escape(expectedPrefix)+@"\|[0-9]{3,4}$")
            : incomingPayload==expectedPrefix;
          if(!validPayload) {
            var parsed=Regex.Match(incomingPayload,@"^D169-SIM-P([0-4])");
            var prior=parsed.Success&&int.TryParse(parsed.Groups[1].Value,out var incoming)&&incoming<_phase;
            if(prior)return true; // previous phase is terminal; do not reread forever
            // Cross-phase messages are deferred without per-poll log spam.
            return false;
          }
          Log("RX_TEST_MESSAGE","RECEIVED",new{request_id=id,kind,epoch=_epoch});
          var receiptId=id+"_"+_uid+"_"+_nodeId;
          var fields=new Dictionary<string,object>{
            ["request_id"]=S(id),["receiver_uid"]=S(_uid),["receiver_role"]=S(_token.Role),["receiver_node"]=S(_nodeId),["payload_echo"]=S(incomingPayload),["result"]=S("ACK"),
            ["elapsed_ms"]=I(0),["network_epoch"]=S("agent-"+_epoch)
          };
          try{await CreateDoc("d169_diag_sessions/"+Sid()+"/receipts/"+receiptId,fields,"created_at");
            Log("TX_TEST_ACK","PASS",new{request_id=id});
          }catch(HttpRequestException e)when(e.Message=="HTTP_409"||e.Message=="HTTP_400"){
            Log("TX_TEST_ACK","DUPLICATE_OR_RULES_REJECT",new{request_id=id,code=e.Message});
          }
          return true;
        });
        await PollCollection("receipts",since,async (id,receipt)=>{
          var requestId=GetString(receipt,"request_id");
          var receiverUid=GetString(receipt,"receiver_uid");
          var receiverNode=GetString(receipt,"receiver_node");
          if(requestId.Length!=32||receiverNode==_nodeId)return true;
          if(!_sentExpected.TryGetValue(requestId,out var expected))return true;
          if(GetString(receipt,"payload_echo")!=expected){
            Log("RX_TEST_RECEIPT","PAYLOAD_ECHO_MISMATCH",new{request_id=requestId});
            return true;
          }
          var role=await MemberRole(receiverUid);
          if(role=="PICKER")_pdaAcks.AddOrUpdate(requestId,1,(_,old)=>old+1);
          else if(role=="ADMIN"||role=="PICKPACK_ADMIN")_agentAcks.AddOrUpdate(requestId,1,(_,old)=>old+1);
          if(_sentTicks.TryGetValue(requestId,out var start))
            Log("RX_TEST_RECEIPT","ACK_CORRELATED",new{request_id=requestId,rtt_ms=Environment.TickCount64-start,role,epoch=_epoch});
          return true;
        });
    }
    private async Task<string> MemberRole(string uid)
    {
        if(_roles.TryGetValue(uid,out var cached))return cached;
        if(uid==_uid){_roles[uid]=_token.Role;return _token.Role;}
        using var member=await Http("GET",Url("/members/"+Uri.EscapeDataString(uid)),null,true);
        var role=member==null?"":GetString(member.RootElement,"role");
        if(role=="PICKER"||role=="ADMIN"||role=="PICKPACK_ADMIN")_roles[uid]=role;
        return role;
    }
    // Firestore filters on the server instead of repeatedly billing historic documents.
    private async Task PollCollection(string name,DateTimeOffset since,Func<string,JsonElement,Task<bool>> receive)
    {
        var query=new {structuredQuery=new{
            from=new[]{new{collectionId=name}},
            where=new{fieldFilter=new{field=new{fieldPath="created_at"},
                op="GREATER_THAN_OR_EQUAL",value=T(since)}},
            orderBy=new[]{new{field=new{fieldPath="created_at"},direction="ASCENDING"}},
            limit=100
        }};
        using var result=await Http("POST",Url()+":runQuery",query);
        if(result==null||result.RootElement.ValueKind!=JsonValueKind.Array)
            throw new InvalidOperationException("D171_QUERY_RESPONSE_INVALID");
        var count=0;
        foreach(var entry in result.RootElement.EnumerateArray()){
            if(!entry.TryGetProperty("document",out var item))continue;
            count++;
            if(!item.TryGetProperty("name",out var nm))continue;
            var id=nm.GetString()?.Split('/').LastOrDefault()??"";
            if(id.Length==0)continue;
            lock(_gate)if(_seen.Contains(name+":"+id))continue;
            if(await receive(id,item)){lock(_gate)_seen.Add(name+":"+id);}
        }
        if(count>=100)throw new InvalidOperationException("D171_QUERY_WINDOW_OVERFLOW_STOP");
        if(name=="receipts")_pollSince=DateTimeOffset.UtcNow.AddSeconds(-16);
    }
}
