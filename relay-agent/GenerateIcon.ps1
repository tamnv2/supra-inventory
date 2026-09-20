param([Parameter(Mandatory=$true)][string]$OutputPath)
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 64,64
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(5,45,89))
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0,189,235))
$green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34,224,79))
$white = [System.Drawing.Brushes]::White
# Circular transfer arrows.
$g.FillPie($blue, 6,8,50,42,188,210)
$g.FillPolygon($blue, @((New-Object Drawing.Point 34,7),(New-Object Drawing.Point 58,25),(New-Object Drawing.Point 34,41)))
$g.FillPie($green, 8,25,50,34,8,205)
$g.FillPolygon($green, @((New-Object Drawing.Point 30,25),(New-Object Drawing.Point 6,43),(New-Object Drawing.Point 30,59)))
# Scanner silhouette.
$g.FillRectangle($white,17,18,22,7)
$g.FillPolygon($white,@((New-Object Drawing.Point 20,24),(New-Object Drawing.Point 29,24),(New-Object Drawing.Point 24,39),(New-Object Drawing.Point 18,39)))
$g.DrawLine((New-Object Drawing.Pen([Drawing.Color]::White,3)),40,20,48,16)
$g.DrawLine((New-Object Drawing.Pen([Drawing.Color]::White,3)),41,25,50,25)
$g.DrawLine((New-Object Drawing.Pen([Drawing.Color]::White,3)),40,30,48,34)
# Warehouse and boxes.
$pen = New-Object Drawing.Pen([Drawing.Color]::White,3)
$g.DrawLines($pen,@((New-Object Drawing.Point 39,43),(New-Object Drawing.Point 50,36),(New-Object Drawing.Point 61,43),(New-Object Drawing.Point 61,57),(New-Object Drawing.Point 39,57),(New-Object Drawing.Point 39,43)))
$box = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(10,175,240))
$g.FillRectangle($box,42,46,7,7); $g.FillRectangle($box,51,46,7,7); $g.FillRectangle($box,46,54,7,5)
$g.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$stream = [System.IO.File]::Create($OutputPath)
$icon.Save($stream)
$stream.Dispose(); $icon.Dispose(); $bmp.Dispose()
