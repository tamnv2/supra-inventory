# D173-E043 — Agent144 Mẫu 2 color/theme FIELD FAIL repair (25/10/2026)

## Owner FIELD finding / scope
- Owner confirms v144 **layout OK** but both Light/Dark palettes and theme switch **FIELD FAIL** against the already approved two Mẫu 2 reference images.
- This is a same-change D173 repair, **NOT** Owner PASS for E042/v144 and not authorization to alter WMS/Office/Firestore/Worker/Android/OBPP.
- This PR is CODE ONLY until fresh CI and physical screenshot/DPI regression. No production/tag/OTA advancement. D172 PENDING/HOLD independently.

## Reference-derived color contract (RGB sampled directly from Owner screenshots)
| Token | Light | Dark |
|---|---|---|
| Application workspace | `#F7F9FC` | `#0E1726` |
| Sidebar | `#FEFEFE` | `#101E30` |
| Content card | `#FFFFFF` | `#19273A` |
| Inner surface | `#EDF3F9` | `#142236` |
| Table header | `#EDF2F8` | `#22354D` |
| Main text | `#253850` | `#E4ECF7` |
| Secondary text | `#65778D` | `#9BADC2` |
| Borders | `#DCE5EE` | `#34445A` |
| Selected/nav/primary actions | `#008E88` | `#008E88` |

## Root cause from v144 live source
1. `D173E038Sidebar.cs` hardcoded active-nav `#2474D8` with always-white labels; both diverge from Owner-selected teal and Light sidebar.
2. `D173E036Theme.cs` restored each control's initial background in Light, and recolored only `D173NearNeutral()` in Dark; this leaves hardcoded dark-native islands with dark labels and light-native islands in dark mode.
3. `D119AgentFeatures.cs` reintroduced light-only `Gainsboro/DimGray` button cells during session repaint, overriding theme set at startup.
4. `D173DesktopResources.cs` drew blue charts and applied light-only `DataGridView` header styles. Cards rendered with the native black border rather than a palette border.

## Impact / guard matrix
| Contract | Components | Safety / test |
|---|---|---|
| Light/Dark/AUTO palette | Native WinForms theme, sidebar, cards, OS graphs, session grids | Switch back/forth repeatedly, AUTO at VN 06:00/18:00, persist preference; no white-on-white or navy-on-navy |
| Live roster repaint | Picker/Reporter/Agent readonly session rows | Repeat realtime/session updates after mode switch; only valid Picker actions remain active; disabled buttons remain visibly disabled |
| WMS browser | Embedded WebView2 | Skip browser contents in palette recursion; verify WMS page still navigates/confirm and browser show/hide persists |
| HA/Auth/Network | PRIMARY/standby, auth, Office/WMS login | No protocol/state/source edits; startup smoke, handoff and field test required |
| Resource/Quota | Existing OS local GDI+ chart 1/2/5/10 s | No new provider calls, storage, timer or data flow |
| External shared resources | Worker/Core/Firebase/Android/D172 | Untouched source; require D172 isolation CI proof |

## State and release boundary
- D173-E043 new branch `fix/d173-e043-agent144-sample2-theme-20261025`; PR #743 **CODE ONLY**, released signed v144 remains unchanged.
- Source/code proposal present; **CI PASS / RELEASE PASS / FIELD PASS / OWNER PASS for this repair not inferred** until corresponding evidence.
- Required: CI Windows .NET 4.8 x64 + startup smoke + static palette/regression; physical Light/Dark screenshots at 100/125/150/200% DPI, session repaint, WMS/HA, tray.
- Continue same D173 until explicit Owner field approval. Do not auto publish an unverified binary.
