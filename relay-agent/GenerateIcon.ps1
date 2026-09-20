param([Parameter(Mandatory=$true)][string]$OutputPath)

Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "app-icon.jpg"
if (-not (Test-Path $sourcePath)) {
  throw "Missing approved D089 icon asset: $sourcePath"
}

$source = $null
$bitmap = $null
$graphics = $null
$icon = $null
$stream = $null

try {
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap 64,64
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::FromArgb(13,38,80))
  $graphics.DrawImage($source, 0, 0, 64, 64)

  $handle = $bitmap.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($handle)
  $stream = [System.IO.File]::Create($OutputPath)
  $icon.Save($stream)
}
finally {
  if ($stream -ne $null) { $stream.Dispose() }
  if ($icon -ne $null) { $icon.Dispose() }
  if ($graphics -ne $null) { $graphics.Dispose() }
  if ($bitmap -ne $null) { $bitmap.Dispose() }
  if ($source -ne $null) { $source.Dispose() }
}
