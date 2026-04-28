<#
.SYNOPSIS
  Creates a delivery package (BOMCompareTool-Delivery) with the app and all documentation, ready for delivery to end users.
.DESCRIPTION
  Same contents as the upload package: builds frontend, copies backend (with embedded static), docs, samples, and run scripts.
  Output folder and zip use "Delivery" in the name so you can keep both Upload and Delivery packages in the same folder.
.EXAMPLE
  .\scripts\create-delivery-package.ps1
  .\scripts\create-delivery-package.ps1 -CreateZip
#>
Param(
  [string]$PackageName = "BOMCompareTool-Delivery",
  [switch]$CreateZip,
  [switch]$StandaloneExe   # Build and include BOMCompareTool.exe (no Python required for end user)
)
$ErrorActionPreference = "Stop"

$Root = (Get-Item $PSScriptRoot).Parent.FullName
$PackageDir = Join-Path $Root $PackageName
$BackendSrc = Join-Path $Root "backend"
$FrontendSrc = Join-Path $Root "frontend"
$DocsSrc = Join-Path $Root "docs"
$SamplesSrc = Join-Path $Root "samples"

# Validate paths
foreach ($p in @($BackendSrc, $FrontendSrc, $DocsSrc)) {
  if (-not (Test-Path $p)) { throw "Required folder not found: $p" }
}

Write-Host "=== BOM Compare Tool - Create Delivery Package ===" -ForegroundColor Cyan
Write-Host "Package output: $PackageDir" -ForegroundColor Gray

# Clean previous package
if (Test-Path $PackageDir) {
  Remove-Item $PackageDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null

# 1) Build frontend (and optionally standalone exe)
Write-Host "==> Building frontend..." -ForegroundColor Yellow
Push-Location $FrontendSrc
if (-not (Test-Path "node_modules")) { & npm install }
& npm run build
if (-not (Test-Path "build\index.html")) { throw "Frontend build failed (no build/index.html)" }
Pop-Location

if ($StandaloneExe) {
  Write-Host "==> Building standalone EXE (no Python required for end user)..." -ForegroundColor Yellow
  & (Join-Path $Root "scripts\build-standalone-exe.ps1") -OutputDir $PackageDir
  Write-Host "  BOMCompareTool.exe added to package." -ForegroundColor Gray
}

# 2) Copy backend (exclude cache, venv, logs, uploads - we add clean uploads/logs later)
Write-Host "==> Copying backend..." -ForegroundColor Yellow
$backendDest = Join-Path $PackageDir "backend"
New-Item -ItemType Directory -Force -Path $backendDest | Out-Null
Get-ChildItem -Path $BackendSrc -Force | Where-Object {
  $_.Name -notmatch '^(__pycache__|\.pytest_cache|venv|\.venv|logs|uploads|.*\.pyc)$'
} | ForEach-Object {
  if ($_.PSIsContainer) {
    Copy-Item -Path $_.FullName -Destination (Join-Path $backendDest $_.Name) -Recurse -Force
  } else {
    Copy-Item -Path $_.FullName -Destination (Join-Path $backendDest $_.Name) -Force
  }
}
Get-ChildItem -Path $backendDest -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $backendDest -Recurse -File -Filter "*.pyc" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# 3) Embed frontend build into backend/app/static
$staticDir = Join-Path $backendDest "app\static"
if (Test-Path $staticDir) { Remove-Item $staticDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
Copy-Item -Path (Join-Path $FrontendSrc "build\*") -Destination $staticDir -Recurse -Force
Write-Host "  Frontend build embedded in backend/app/static" -ForegroundColor Gray

# 4) Create clean uploads (auth_users.json only) and empty logs folder
$uploadsDir = Join-Path $backendDest "uploads"
$logsDir = Join-Path $backendDest "logs"
New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$authFile = Join-Path $uploadsDir "auth_users.json"
@'
{
  "admin": {
    "password_hash": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    "role": "admin",
    "plan": "paid"
  }
}
'@ | Set-Content -Path $authFile -Encoding UTF8
Write-Host "  Created uploads/auth_users.json (admin/admin), empty logs" -ForegroundColor Gray

# 5) Copy documentation (no PDF generation — guide is in-app Help page)
Write-Host "==> Documentation (markdown + HTML; guide is in-app Help)..." -ForegroundColor Yellow
$docsDest = Join-Path $PackageDir "docs"
New-Item -ItemType Directory -Force -Path $docsDest | Out-Null
Copy-Item -Path (Join-Path $DocsSrc "*.md") -Destination $docsDest -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $DocsSrc "BOM_Compare_Tool_Install_and_Use_Guide.html") -Destination $docsDest -Force -ErrorAction SilentlyContinue
# Root-level docs
foreach ($name in @("WINDOWS_STORE.md", "IMPROVEMENTS.md")) {
  $src = Join-Path $Root $name
  if (Test-Path $src) { Copy-Item -Path $src -Destination $docsDest -Force }
}
# Packager and Electron READMEs (optional)
foreach ($rel in @("packager\README_WAR_STYLE.md", "electron\README.md")) {
  $src = Join-Path $Root $rel
  if (Test-Path $src) { Copy-Item -Path $src -Destination $docsDest -Force }
}
# Docs index (reference only; use in-app Help for the guide)
@"
# Documentation (reference)

The **guide is in the app**: open the **Help** page from the menu after you log in.

These files are optional reference (markdown and HTML):

| Document | Description |
|----------|-------------|
| INSTALLATION.md | How to install and run |
| HOW_TO_USE.md | How to use the app |
| MAPPING.md | Column mapping and presets |
| BOM_Compare_Tool_Install_and_Use_Guide.html | Combined install + use (open in browser) |
"@ | Set-Content -Path (Join-Path $docsDest "INDEX.md") -Encoding UTF8

# 6) Copy root README
Copy-Item -Path (Join-Path $Root "README.md") -Destination $PackageDir -Force

# 7) Copy samples
Write-Host "==> Copying samples..." -ForegroundColor Yellow
$samplesDest = Join-Path $PackageDir "samples"
if (Test-Path $SamplesSrc) {
  New-Item -ItemType Directory -Force -Path $samplesDest | Out-Null
  Copy-Item -Path (Join-Path $SamplesSrc "*") -Destination $samplesDest -Recurse -Force
}

# 8) Run scripts for the package (one-click: install deps + run)
Write-Host "==> Adding run scripts..." -ForegroundColor Yellow
$runPs1 = @'
# BOM Compare Tool - one-click: install backend deps then run (app at http://127.0.0.1:5000)
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Write-Host "Python not found. Install Python 3.9+ and add to PATH." -ForegroundColor Red; exit 1 }
Write-Host "Installing backend dependencies (first time may take a moment)..." -ForegroundColor Yellow
Set-Location $Backend
python -m pip install -q -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed." -ForegroundColor Red; exit 1 }
Write-Host "Starting server at http://127.0.0.1:5000 ..." -ForegroundColor Green
Start-Process "http://127.0.0.1:5000"
python run_production.py
'@
Set-Content -Path (Join-Path $PackageDir "run.ps1") -Value $runPs1 -Encoding UTF8

$runBat = @'
@echo off
cd /d "%~dp0"
python -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" 2>nul || (echo Python 3.9+ required. Install Python and add to PATH. & pause & exit /b 1)
echo Installing backend dependencies (first time may take a moment)...
pip install -q -r backend\requirements.txt
if errorlevel 1 (echo pip install failed. & pause & exit /b 1)
echo Starting BOM Compare Tool at http://127.0.0.1:5000 ...
start http://127.0.0.1:5000
cd backend
python run_production.py
pause
'@
Set-Content -Path (Join-Path $PackageDir "run.bat") -Value $runBat -Encoding ASCII

# 9) Copy scripts folder (install-and-run.ps1 for dev/source tree; package one-click is run.bat above)
$scriptsDest = Join-Path $PackageDir "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDest | Out-Null
Copy-Item -Path (Join-Path $Root "scripts\install-and-run.ps1") -Destination $scriptsDest -Force -ErrorAction SilentlyContinue

# 10) Package readme (how to run) – Delivery variant
$hasExe = Test-Path (Join-Path $PackageDir "BOMCompareTool.exe")
$packageReadme = @"
BOM Compare Tool - Delivery Package
====================================

HOW TO RUN (choose one)
-----------------------

$(if ($hasExe) { @"
1. BOMCompareTool.exe (recommended — normal Windows way)
   Just double-click the exe. No install. The app starts and your browser opens at http://127.0.0.1:5000 .
   If anything goes wrong (e.g. port in use), a popup message will tell you what to do.
   Uploads and logs are stored in this folder.

2. run.bat (if you prefer Python or the exe is not included)
   Double-click run.bat. The first time it installs Python dependencies, then starts the app.
   You need Python 3.9+ on your PATH.

"@ } else { @"
1. run.bat
   Double-click run.bat. The first time it installs Python dependencies, then starts the app at http://127.0.0.1:5000 .
   You need Python 3.9+ on your PATH.

"@ })Why both exe and run.bat?
  Windows packages are exe-based: click the exe and it sets everything up; any issue shows a popup. run.bat is for when the exe is not included or you prefer running from Python.

Log in with  admin / admin .

FOLDER CONTENTS
----------------
$(if ($hasExe) { "  BOMCompareTool.exe   Standalone app—no install needed.`n" })  backend/     Server and embedded UI (used by run.bat).
  docs/        Optional reference (markdown/HTML). Use the Help page in the app for the guide.
  samples/     Sample BOM files.
  run.bat      Install deps and start (Windows); needs Python 3.9+.
  run.ps1      Same as run.bat (PowerShell).
  README.md    Project readme.

More help: use the **Help** page in the app after you log in.
"@
Set-Content -Path (Join-Path $PackageDir "PACKAGE_README.txt") -Value $packageReadme -Encoding UTF8

# 11) Optional zip
if ($CreateZip) {
  $zipPath = Join-Path $Root ($PackageName + ".zip")
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Write-Host "==> Creating zip: $zipPath" -ForegroundColor Yellow
  Compress-Archive -Path $PackageDir -DestinationPath $zipPath -Force
  Write-Host "DONE: Delivery package at $PackageDir and zip at $zipPath" -ForegroundColor Green
} else {
  Write-Host "DONE: Delivery package at $PackageDir" -ForegroundColor Green
}
Write-Host "To create a zip, run with -CreateZip" -ForegroundColor Gray
