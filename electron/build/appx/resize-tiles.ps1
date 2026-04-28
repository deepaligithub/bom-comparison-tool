# Resize source.png to AppX tile assets. Run from repo root or electron folder.
# Requires: source.png in this folder (appx).

$ErrorActionPreference = "Stop"
$appxDir = $PSScriptRoot
$sourcePath = Join-Path $appxDir "source.png"
if (-not (Test-Path $sourcePath)) {
    Write-Host "Missing source.png in $appxDir" -ForegroundColor Red
    exit 1
}

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $sourcePath))
$bgColor = [System.Drawing.Color]::FromArgb(26, 95, 95) # dark teal

function Save-Resized {
    param([int]$w, [int]$h, [string]$name)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($source, 0, 0, $w, $h)
    $outPath = Join-Path $appxDir $name
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "  $name"
}

function Save-WideLogo {
    $w = 310
    $h = 150
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear($bgColor)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    # Center the square icon, scale to fit height 150
    $size = 150
    $x = [int](($w - $size) / 2)
    $g.DrawImage($source, $x, 0, $size, $size)
    $outPath = Join-Path $appxDir "Wide310x150Logo.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "  Wide310x150Logo.png"
}

Write-Host "Generating AppX tile assets..."
Save-Resized -w 50 -h 50 -name "StoreLogo.png"
Save-Resized -w 44 -h 44 -name "Square44x44Logo.png"
Save-Resized -w 150 -h 150 -name "Square150x150Logo.png"
Save-WideLogo
$source.Dispose()
Write-Host "Done. You can delete source.png if desired."
