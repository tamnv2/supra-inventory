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
    private int _phase=0;
    private string _agentLabel="?";
    private readonly string _operatorLogin;
    private readonly ConcurrentDictionary<string,int> _pdaAcks=new();
    private readonly ConcurrentDictionary<string,int> _agentAcks=new();
    private readonly ConcurrentDictionary<string,string> _roles=new();
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
    private DateTimeOffset _suspendLeaderUntil=DateTimeOffset.MinValue;
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
        Text="SUPRA D171 — Test 2 Agent + 1 PDA"; ClientSize=new Size(960,620);MinimumSize=new Size(850,560);
        Font=new Font("Segoe UI",10);
        var title=new Label{Text="D171 — TEST KẾT NỐI 2 AGENT ⇄ PDA",Left=16,Top=13,Width=900,Height=30,Font=new Font("Segoe UI",14,FontStyle.Bold)};
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
        _testAll.SetBounds(16,130,305,42);_confirmSwitch.SetBounds(335,130,335,42);
        Controls.AddRange(new Control[]{_testAll,_confirmSwitch});
        _confirmSwitch.Enabled=false;
        _testAll.Click += async (_,_)=>await Run(StartAutomaticTests);
        _confirmSwitch.Click += async (_,_)=>await Run(AdvancePhase);
        info.Text="Tự ghép cặp sau đăng nhập. Giữ cả hai app mở. Chỉ đổi Wi-Fi theo hướng dẫn trên màn hình.";
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
        var bytes=SHA256.HashData(Encoding.UTF8.GetBytes("SUPRA-D169-AUTO-PAIR-V7|"+date));
        return Convert.ToHexString(bytes)[..32].ToLowerInvariant();
    }
    private string ExpectedLocalNetwork(int phase) =>
        ((_agentLabel=="A" && (phase==1||phase==3))||(_agentLabel=="B"&&(phase==2||phase==3)))?"OFFICE":"NORMAL";
    private void ShowNetworkPhase()
    {
        var message=_phase<Phases.Length?Phases[_phase]:"ĐÃ HOÀN TẤT CÁC KỊCH BẢN";
        var recommended=ExpectedLocalNetwork(_phase);
        Log("NEXT_NETWORK_SETUP","OPERATOR_SWITCH_REQUIRED",new{step=_phase+1,total=Phases.Length,scenario=message});
        _confirmSwitch.Enabled=_phase>0&&_phase<Phases.Length;
        _testAll.Enabled=_phase==0;
        MessageBox.Show("Tài khoản "+_operatorLogin+" · Test Agent "+_agentLabel+": Kịch bản "+(_phase+1)+"/"+Phases.Length+": "+message+".\nWi-Fi Agent máy này cần: "+recommended+".\nĐổi mạng rồi bấm ĐÃ CHUYỂN MẠNG (trừ lượt đầu, bấm BẮT ĐẦU TEST).","SUPRA D171 · Test mạng",MessageBoxButtons.OK,MessageBoxIcon.Information);
    }
    private async Task StartAutomaticTests()
    {
        _testAll.Enabled=false;
        _activeStep="01_XAC_THUC_NHOM_AGENT_VA_TAO_PHIEN";
        await EnsureAutomaticSession();
        Text="SUPRA D171 Test — "+_operatorLogin+" (Agent "+_agentLabel+")";
        StartPoll();
        _activeStep="02_DANG_KY_AGENT_READY";
        await PublishReady();
        _activeStep="03_DOI_2_AGENT_VA_PDA_DU_3";
        await WaitForThreeReady();
        _activeStep="04_GUI_TEST_VA_CHO_ACK";
        await TestPhase();
        _phase=1;
        ShowNetworkPhase();
    }
    private async Task AdvancePhase()
    {
        if(_phase>=Phases.Length)return;
        var phase=Phases[_phase];
        Log("NETWORK_SWITCH","OPERATOR_CONFIRMED",new{phase,epoch=Interlocked.Increment(ref _epoch)});
        _mode.SelectedItem=ExpectedLocalNetwork(_phase);
        _activeStep="05_CAP_NHAT_MANG_AGENT";
        await PublishReady();
        _activeStep="06_DOI_3_THIET_BI_READY";
        await WaitForThreeReady();
        _activeStep="07_GUI_TEST_VA_CHO_ACK";
        await TestPhase();
        _phase++;
        ShowNetworkPhase();
    }
    private async Task EnsureAutomaticSession()
    {
        // Operator identities are validated at runtime and never written to public logs.
        // A is fixed to the privileged Admin; B is fixed to the second Owner operator.
        var account=_operatorLogin.Trim().ToLowerInvariant();
        _agentLabel=account=="admin"?"A":account=="tamnv2"?"B":
            throw new InvalidOperationException("D171_AGENT_ACCOUNT_NOT_AUTHORIZED");
        var tokenAccount=GetJwtClaim(_token.IdToken,"app_user_id");
        if(!string.Equals(tokenAccount,account,StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("D171_AUTH_IDENTITY_MISMATCH");
        if(_agentLabel=="A"){
            using var existing=await Http("GET",Url(),null,true);
            if(existing==null) {
                try { await CreateSession(); }
                catch(HttpRequestException e) when(e.Message=="HTTP_409"||e.Message=="HTTP_400") { }
            }
        }
        JsonDocument? root=null;
        for(var attempt=0;attempt<45;attempt++){
            root=await Http("GET",Url(),null,true);
            if(root!=null)break;
            await Task.Delay(2000);
        }
        if(root==null)throw new InvalidOperationException("D171_WAIT_ADMIN_A_SESSION_TIMEOUT");
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
    private async Task WaitForThreeReady()
    {
        for(var attempt=0;attempt<45;attempt++){
            using var d=await Http("GET",Url("/members")+"?pageSize=40",null,true);
            if(d!=null&&d.RootElement.TryGetProperty("documents",out var docs)){
                var agentCount=0;var pickerCount=0;
                foreach(var item in docs.EnumerateArray()){
                    var role=GetString(item,"role");
                    if(role=="PICKER"){
                        var timeText=GetString(item,"ready_at");
                        var window=_phase==0?TimeSpan.FromMinutes(3):TimeSpan.FromMinutes(30);
                        if(GetString(item,"ready_network")=="NORMAL"&&DateTimeOffset.TryParse(timeText,out var pickerReadyAt)&&pickerReadyAt>DateTimeOffset.UtcNow-window)pickerCount++;
                    }
                    if(role=="ADMIN"||role=="PICKPACK_ADMIN"){
                        var stamp=GetString(item,"ready_at");
                        if(GetString(item,"ready_phase")==_phase.ToString()&&DateTimeOffset.TryParse(stamp,out var when)&&when>DateTimeOffset.UtcNow.AddMinutes(-3))agentCount++;
                    }
                }
                if(agentCount==2&&pickerCount==1){Log("THREE_PARTY_READY","PASS",new{phase=_phase,agents=agentCount,pda=pickerCount});return;}
            }
            await Task.Delay(2000);
        }
        throw new InvalidOperationException("THREE_PARTY_READY_TIMEOUT: cần đủ 2 Agent và 1 PDA đang TEST cùng phiên, đồng bộ đúng vòng mạng.");
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
        await RunReadOnlyNetworkProbes(phase);
        var sent=new List<string>();
        foreach(var type in new[]{"PING","PICKLIST_SIM","PICKLIST_SIM","CALL_SIM","CHAT_SIM","KICK_SIM","LEADER_PROBE","RETRY_SIM","FAILOVER_SIM"}){
          sent.Add(await SendTest(type));
        }
        for(var t=0;t<30;t++){
          if(sent.All(id=>_pdaAcks.TryGetValue(id,out var p)&&p>0&&_agentAcks.TryGetValue(id,out var a)&&a>0))break;
          await Task.Delay(1000);
        }
        foreach(var id in sent){
          _pdaAcks.TryGetValue(id,out var p);_agentAcks.TryGetValue(id,out var a);
          Log("TEST_TERMINAL",p>0&&a>0?"ACK_PASS":"ACK_TIMEOUT",new{request_id=id,pda_receipts=p,peer_agent_receipts=a,required_role="PICKER_AND_AGENT",phase});
        }
        Log("PHASE","DONE",new{phase,passed=sent.Count(id=>_pdaAcks.TryGetValue(id,out var p)&&p>0&&_agentAcks.TryGetValue(id,out var a)&&a>0),total=sent.Count});
        if(_phase>0&&_phase<Phases.Length-1)await VerifyAutomaticLeaderFailover();
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
    private async Task VerifyAutomaticLeaderFailover()
    {
        // The current simulated PRIMARY suppresses only its test lease renewal.
        // The second EXE must stay running and take over within 20 seconds.
        using var before=await Http("GET",Url());
        if(before==null)throw new InvalidOperationException("MISSING_TEST_SESSION");
        var oldNode=GetString(before.RootElement,"leader_node");
        var oldEpoch=long.TryParse(GetString(before.RootElement,"leader_epoch"),out var e)?e:0;
        if(oldNode!=_nodeId){
            Log("FAILOVER_SUITE","STANDBY_MONITOR",new{phase=_phase,leader=oldNode[..Math.Min(8,oldNode.Length)],generation=oldEpoch});
            return;
        }
        _suspendLeaderUntil=DateTimeOffset.UtcNow.AddSeconds(22);
        Log("FAILOVER_SUITE","PRIMARY_HEARTBEAT_PAUSED",new{phase=_phase,generation=oldEpoch,limit_ms=20000});
        var started=Environment.TickCount64;
        while(Environment.TickCount64-started<20000){
            await Task.Delay(1000);
            using var current=await Http("GET",Url());
            if(current==null)continue;
            var newNode=GetString(current.RootElement,"leader_node");
            var newEpoch=long.TryParse(GetString(current.RootElement,"leader_epoch"),out var n)?n:0;
            if(newNode!=_nodeId && newEpoch==oldEpoch+1) {
                Log("FAILOVER_SUITE","PASS",new{phase=_phase,new_epoch=newEpoch,elapsed_ms=Environment.TickCount64-started});
                return;
            }
        }
        Log("FAILOVER_SUITE","TIMEOUT_NO_OTHER_AGENT_TAKEOVER",new{phase=_phase,generation=oldEpoch});
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
            if(!IsDisposed){
                _output.AppendText(DateTime.Now.ToString("HH:mm:ss")+" LOI ["+_activeStep+"] "+code+Environment.NewLine);
                MessageBox.Show("D171 khong the tiep tuc tai buoc: "+_activeStep+Environment.NewLine+
                    "Ma loi: "+code+Environment.NewLine+
                    "Log chi tiet: "+_logPath+Environment.NewLine+
                    "Gui file JSONL (khong gui mat khau hay token) de kiem tra.",
                    "SUPRA D171 - Loi can xu ly",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                _testAll.Enabled=_phase==0;
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
        await RefreshToken();
        using var req=new HttpRequestMessage(new HttpMethod(method),url);
        req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",_token.IdToken);
        if(data!=null)req.Content=new StringContent(JsonSerializer.Serialize(data),Encoding.UTF8,"application/json");
        var start=Environment.TickCount64;
        using var res=await _http.SendAsync(req);
        if(method=="GET")Interlocked.Increment(ref _readCount);else Interlocked.Increment(ref _writeCount);
        var resultCode="HTTP_"+(int)res.StatusCode;
        var route = url.Contains("/members",StringComparison.Ordinal)?"MEMBERS" :
            url.Contains("/receipts",StringComparison.Ordinal)?"RECEIPTS" :
            url.Contains("/messages",StringComparison.Ordinal)?"MESSAGES" :
            url.Contains(":commit",StringComparison.Ordinal)?"DOCUMENT_WRITE" : "TEST_SESSION";
        Log("FIRESTORE_HTTP",resultCode,new{method,route,elapsed_ms=Environment.TickCount64-start});
        if(notFoundOkay && res.StatusCode==HttpStatusCode.NotFound)return null;
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
            using var result=await Http("PATCH",Url()+qs,new{fields});
            Log("SIM_LEADER",takeOver?"CAS_TAKEOVER_PASS":"HEARTBEAT_PASS",new{node=_nodeId[..8],generation=takeOver?generation+1:generation});
        }catch(HttpRequestException e)when(e.Message=="HTTP_409"||e.Message=="HTTP_400"||e.Message=="HTTP_403"){
            Log("SIM_LEADER","FENCING_DENIED",new{generation,code=e.Message});
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
        Log("LISTENER","START",new{mode="REST_WATCHDOG_2S"});
        _=Task.Run(async()=>{
          while(!cancel.IsCancellationRequested)
          {
            try{await Poll();}catch(Exception e){Log("LISTENER","ERROR",new{type=e.GetType().Name});}
            try{await Task.Delay(2000,cancel.Token);}catch(OperationCanceledException){break;}
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
        await MaintainSimulatedLeader();
        await PollCollection("messages",async id=>{
          using var doc=await Http("GET",Url("/messages/"+id));
          if(doc==null)return true;
          var root=doc.RootElement;
          var from=GetString(root,"sender_uid");
          var to=GetString(root,"target_uid");
          if(GetString(root,"sender_node")==_nodeId || (to!="ALL" && to!=_uid))return true;
          if(DateTimeOffset.TryParse(GetString(root,"expires_at"),out var expiration) && expiration<DateTimeOffset.UtcNow)return true;
          var kind=GetString(root,"kind");
          var incomingPayload=GetString(root,"payload");
          var expectedPrefix="D169-SIM-P"+_phase;
          var validPayload=kind=="PICKLIST_SIM"
            ? Regex.IsMatch(incomingPayload,"^"+Regex.Escape(expectedPrefix)+@"\|[0-9]{3,4}$")
            : incomingPayload==expectedPrefix;
          if(!validPayload) {
            Log("RX_TEST_MESSAGE","PHASE_MISMATCH_RETRY_LATER",new{request_id=id,local_phase=_phase});
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
        await PollCollection("receipts",async id=>{
          using var receipt=await Http("GET",Url("/receipts/"+id));
          if(receipt==null)return true;
          var requestId=GetString(receipt.RootElement,"request_id");
          var receiverUid=GetString(receipt.RootElement,"receiver_uid");
          var receiverNode=GetString(receipt.RootElement,"receiver_node");
          if(requestId.Length!=32||receiverNode==_nodeId)return true;
          if(!_sentExpected.TryGetValue(requestId,out var expected))return true;
          if(GetString(receipt.RootElement,"payload_echo")!=expected){
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
    private async Task PollCollection(string name,Func<string,Task<bool>> receive)
    {
        string? next=null;
        do {
        using var doc=await Http("GET",Url("/"+name)+"?pageSize=100"+(next==null?"":"&pageToken="+Uri.EscapeDataString(next)),null,true);
        if(doc==null)return;
        var root=doc.RootElement;
        if(!root.TryGetProperty("documents",out var list))return;
        foreach(var item in list.EnumerateArray()){
          if(!item.TryGetProperty("name",out var nm))continue;
          var id=nm.GetString()?.Split('/').LastOrDefault()??"";
          if(id.Length==0)continue;
          lock(_gate)if(_seen.Contains(name+":"+id))continue;
          if(await receive(id)) {
            lock(_gate)_seen.Add(name+":"+id);
          }
        }
        next=root.TryGetProperty("nextPageToken",out var page)?page.GetString():null;
        }while(!string.IsNullOrEmpty(next));
    }
}
