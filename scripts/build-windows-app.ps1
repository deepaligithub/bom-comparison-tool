# Build BOM Compare Tool for Windows (Electron + backend exe + React).
# Run from repo root. Prereqs: Node, Python 3, pip, PyInstaller (pip install pyinstaller).
# Optional: npm install in electron/ and frontend/.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== BOM Compare Tool - Windows build ===" -ForegroundColor Cyan
Write-Host "Root: $Root"

# 1) React build
Write-Host "`n[1/4] Building React frontend..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
npm run build
if (-not (Test-Path "build\index.html")) { throw "Frontend build failed" }
Set-Location $Root

# 2) Backend exe (PyInstaller)
Write-Host "`n[2/4] Building backend executable (PyInstaller)..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "backend")
# Do not activate venv (it may point to another user's Python). Use Python on PATH.
pip install -q pyinstaller waitress
python -m PyInstaller --noconfirm --clean bom_backend.spec
$exe = Join-Path $Root "backend\dist\bom-backend.exe"
if (-not (Test-Path $exe)) { throw "Backend exe not found: $exe" }
Set-Location $Root

# 3) Copy into electron resources
$resBackend = Join-Path $Root "electron\resources\backend"
$resStatic  = Join-Path $Root "electron\resources\static"
New-Item -ItemType Directory -Force -Path $resBackend | Out-Null
New-Item -ItemType Directory -Force -Path $resStatic  | Out-Null
Write-Host "`n[3/4] Copying backend exe and static files..." -ForegroundColor Yellow
Copy-Item $exe $resBackend -Force
Copy-Item (Join-Path $Root "frontend\build\*") $resStatic -Recurse -Force

# 4) Electron build (NSIS installer + AppX for Store)
Write-Host "`n[4/4] Building Electron app (NSIS + AppX)..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "electron")
# Use a timestamped output dir to avoid "file in use" when previous build folder is locked
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$outDirName = "dist-electron-$timestamp"
if (-not (Test-Path "node_modules")) { npm install }
npx electron-builder --config.directories.output=$outDirName
Set-Location $Root

$outDirTemp = Join-Path $Root "electron\$outDirName"
$appx = Join-Path $outDirTemp "BOM Compare Tool 1.0.7.appx"
$exeInstaller = Join-Path $outDirTemp "BOM Compare Tool Setup 1.0.7.exe"
if (-not (Test-Path $appx)) { throw "AppX not found after build: $appx" }
if (-not (Test-Path $exeInstaller)) { throw "NSIS installer not found: $exeInstaller" }
# Copy to standard dist-electron so store script and docs find the package
$outDir = Join-Path $Root "electron\dist-electron"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Copy-Item $appx (Join-Path $outDir "BOM Compare Tool 1.0.7.appx") -Force
Copy-Item $exeInstaller (Join-Path $outDir "BOM Compare Tool Setup 1.0.7.exe") -Force
Write-Host "  Output also copied to dist-electron\" -ForegroundColor Gray

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "Windows package output: $outDir" -ForegroundColor Cyan
Write-Host "  - Store upload: BOM Compare Tool 1.0.7.appx" -ForegroundColor Gray
Write-Host "  - Installer:   BOM Compare Tool Setup 1.0.7.exe" -ForegroundColor Gray
