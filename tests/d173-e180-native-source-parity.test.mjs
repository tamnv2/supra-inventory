import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const ui=read('relay-agent/previews/D173E180NativePreview.cs');
const agent=read('relay-agent/Program.cs');
const roster=read('relay-agent/D119AgentFeatures.cs');
const desktop=read('relay-agent/D173DesktopResources.cs');

test('177 source controls remain mapped to real WinForms review, not HTML',()=>{
  for(const key of ['_agentCardTitle','_agentFleetGrid','_manualUpdate','_background',
    '_wmsTest','_browserBundleDownload','_browserBundleProgress',
    '_openAgentDataFolder','_moveAgentDataFolder','_manualPicklistConfirmAll'])
      assert.ok(agent.includes(key),key+' live source missing');
  assert.ok(roster.includes('_d173RosterToolbar'));
  assert.ok(roster.includes('D173SummaryTech'));
  assert.ok(desktop.includes('CreateD173DesktopCard'));
  for(const kind of ['TableLayoutPanel','DataGridView','TabControl','ProgressBar','ComboBox','Form','Panel'])
    assert.ok(ui.includes(kind),kind);
  assert.doesNotMatch(ui,/<html|<iframe|using Microsoft\.Web\.WebView2|new WebView2\s*\(|new HttpClient\s*\(|new WebBrowser\s*\(/);
});

test('all 177 Agent, Web and PickList fields/buttons are present in review source',()=>{
  for(const label of [
    'Tài khoản','Máy','Vai trò','Web Confirm','Phiên bản','Cập nhật',
    'Đăng xuất','Xuống nền','Chuyển chính','Tắt Agent','Làm mới phân loại mạng',
    'Tắt Web Agent','Chuyển sang Web Desktop','Kiểm tra','Tải trình duyệt Agent',
    'Mở thư mục dữ liệu','Đổi nơi lưu','Bảo vệ Web','ProgressBar',
    'Trình duyệt Agent: WebView2 Fixed','Bundle: Đã tải 100%',
    'Dữ liệu Agent: 1,07 GB','Runtime cài đặt:',
    'Tìm kiếm','Xác nhận tất cả','PickList','Trạng thái',
    'Tăng ca thêm 1 giờ','Đúng giờ về','Huỷ tăng ca','Bật sớm trước 05:45'])
    assert.ok(ui.includes(label),'177 control missing: '+label);
});

test('roster preserves 177 filters, identities, metadata, optional technical and all three row actions',()=>{
  for(const name of ['Tất cả','Agent (3)','Web (4)','PDA Picker','PDA Reporter',
    'Cột kỹ thuật','Làm mới dữ liệu','Kết thúc gọi 60s','Liên hệ nhóm',
    'Kích toàn bộ user','Tìm MNV / họ tên / nhà thầu',
    'Nhân sự','Phiên bản / Kênh','Đăng nhập',
    'Hoạt động gần nhất','Trạng thái','Nguồn / ID','Kích User','Chuyên viên','Kết thúc'])
     assert.ok(ui.includes(name),'177 roster control missing: '+name);
  assert.match(ui,/roster\.ScrollBars=ScrollBars\.Vertical/);
  assert.match(ui,/roster\.Columns\[i\]\.Visible=compact/);
  assert.match(ui,/roster\.Rows\.Add\(/);
});

test('top is fixed 50%, always no-scroll, responsive full data on small widths',()=>{
  assert.match(ui,/overview\.RowStyles\.Add\(new RowStyle\(SizeType\.Percent,50\)\)/);
  assert.match(ui,/upper=new Panel\{Dock=DockStyle\.Fill,AutoScroll=false\}/);
  assert.match(ui,/upper\.ClientSize\.Width>=1240/);
  assert.match(ui,/bool wide=upper\.ClientSize\.Width>=1240/);
  assert.match(ui,/ScrollBars\.None/);
  assert.match(ui,/ConfigureRosterColumns\(\)/);
});
