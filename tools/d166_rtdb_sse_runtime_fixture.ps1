param(
  [Parameter(Mandatory = $true)][string]$AgentAssembly
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $AgentAssembly)) { throw "D166_HA_ASSEMBLY_NOT_FOUND" }
$assembly = [System.Reflection.Assembly]::LoadFrom((Resolve-Path $AgentAssembly).Path)
$type = $assembly.GetType("SupraInventoryRelayAgent.RtdbHaLiveness", $true)
$flags = [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
$ctor = $type.GetConstructors($flags) | Where-Object { $_.GetParameters().Count -eq 3 } | Select-Object -First 1
if (-not $ctor) { throw "D166_HA_CONSTRUCTOR_MISSING" }
$log = [System.Action[string]] { param($value) }
$updated = [System.Action] { }
$target = $ctor.Invoke([object[]]@("fixture-agent", $log, $updated))
$apply = $type.GetMethod("ApplyStreamData", $flags)
$getFresh = $type.GetMethod("TryGetFresh", [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic)
if (-not $apply -or -not $getFresh) { throw "D166_HA_SSE_METHODS_MISSING" }

function Assert-Fresh([string]$gen, [bool]$expected) {
  $arg = [object[]]@($gen, "agent-primary", [long]0)
  $actual = [bool]$getFresh.Invoke($target, $arg)
  if ($actual -ne $expected) { throw "D166_HA_SSE_FRESHNESS_MISMATCH" }
}
function Apply-Frame([string]$kind, [string]$payload) {
  [void]$apply.Invoke($target, [object[]]@($kind, $payload))
}

try {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $root = @{
    path = "/"
    data = @{
      agent_instance_id = "agent-primary"
      generation = "g1"
      heartbeat_at_ms = $now
    }
  } | ConvertTo-Json -Compress -Depth 6
  Apply-Frame "put" $root
  Assert-Fresh "g1" $true

  # The source must preserve unmentioned fields on PATCH.
  $patch = @{ path = "/"; data = @{ heartbeat_at_ms = $now + 1 } } | ConvertTo-Json -Compress -Depth 6
  Apply-Frame "patch" $patch
  Assert-Fresh "g1" $true

  # Child-event updates are independent of the root envelope.
  Apply-Frame "put" '{"path":"/generation","data":"g2"}'
  Assert-Fresh "g1" $false
  Assert-Fresh "g2" $true

  # Keepalive, malformed input and unsupported event must not clear proof.
  Apply-Frame "keep-alive" '{"path":"/","data":null}'
  Apply-Frame "patch" "invalid-json"
  Assert-Fresh "g2" $true

  # An authoritative root deletion must invalidate liveness.
  Apply-Frame "put" '{"path":"/","data":null}'
  Assert-Fresh "g2" $false

  Write-Output "D166_HA_NESTED_SSE_RUNTIME_FIXTURE=PASS"
}
finally {
  if ($target -is [System.IDisposable]) { $target.Dispose() }
}
