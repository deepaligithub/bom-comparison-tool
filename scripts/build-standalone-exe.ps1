<#
.SYNOPSIS
  Build a standalone BOM Compare Tool .exe that installs nothing—double-click to run. No Python or Node required for end users.
.DESCRIPTION
  Builds the React frontend, copies it into backend/app/static, then runs PyInstaller to produce a single .exe that bundles
  the Flask backend, Waitress, and the frontend. When run, the exe starts the server and opens the browser to http://127.0.0.1:5000.
  Output: backend/dist/BOMCompareTool.exe (or bom-backend.exe). Optionally copies to a release folder.
.EXAMPLE
  .\scripts\build-standalone-exe.ps1
  .\scripts\build-standalone-exe.ps1 -OutputDir ".\Release"
#>
Param(
  [string]$OutputDir = ""   # If set, copy the exe and rename to BOMCompareTool.exe here
)
$ErrorActionPreference = "Stop"
$Root = (Get-Item $PSScriptRoot).Parent.FullName
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$StaticDir = Join-Path $BackendDir "app\static"

Write-Host ""
Write-Host "=== BOM Compare Tool - Standalone EXE build ===" -ForegroundColor Cyan
Write-Host "Project root: $Root" -ForegroundColor Gray
Write-Host ""

# 1) Build frontend
Write-Host "[1/3] Building React frontend..." -ForegroundColor Yellow
Push-Location $FrontendDir
if (-not (Test-Path "node_modules")) { & npm install }
& npm run build
if (-not (Test-Path "build\index.html")) { throw "Frontend build failed (no build/index.html)" }
Pop-Location

# 2) Copy frontend build into backend/app/static (so PyInstaller can bundle it)
Write-Host "[2/3] Copying frontend into backend/app/static..." -ForegroundColor Yellow
if (Test-Path $StaticDir) { Remove-Item $StaticDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StaticDir | Out-Null
Copy-Item -Path (Join-Path $FrontendDir "build\*") -Destination $StaticDir -Recurse -Force
Write-Host "  Done." -ForegroundColor Gray

# 3) PyInstaller
Write-Host "[3/3] Building executable (PyInstaller)..." -ForegroundColor Yellow
Push-Location $BackendDir
python -m pip install -q pyinstaller waitress 2>&1 | Out-Null
python -m PyInstaller --noconfirm --clean bom_backend.spec
$exePath = Join-Path $BackendDir "dist\bom-backend.exe"
if (-not (Test-Path $exePath)) { throw "PyInstaller did not produce $exePath" }
Pop-Location

Write-Host ""
Write-Host "DONE: Standalone exe built." -ForegroundColor Green
Write-Host "  Location: $exePath" -ForegroundColor Cyan
Write-Host "  Double-click to run; no Python or Node required. Browser opens at http://127.0.0.1:5000" -ForegroundColor Gray
Write-Host "  Log in with admin / admin. Data (uploads, logs) is stored in the same folder as the exe." -ForegroundColor Gray
Write-Host ""

if ($OutputDir) {
  $OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  $destExe = Join-Path $OutputDir "BOMCompareTool.exe"
  Copy-Item -Path $exePath -Destination $destExe -Force
  Write-Host "  Copied to: $destExe" -ForegroundColor Cyan
}
