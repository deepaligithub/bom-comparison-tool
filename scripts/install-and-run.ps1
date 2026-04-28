<#
.SYNOPSIS
  One-click install and run: install backend + frontend dependencies, then start both servers.
.DESCRIPTION
  Run from project root (or via RUN.bat). Ensures Python and Node are available,
  installs backend (pip) and frontend (npm) dependencies, starts the backend in a new window,
  then starts the frontend (npm start). The app opens at http://localhost:3000.
.EXAMPLE
  .\scripts\install-and-run.ps1
  Or double-click RUN.bat in the project root.
#>
$ErrorActionPreference = "Stop"
$Root = (Get-Item $PSScriptRoot).Parent.FullName
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

Write-Host ""
Write-Host "=== BOM Compare Tool - Install & Run ===" -ForegroundColor Cyan
Write-Host "Project root: $Root" -ForegroundColor Gray
Write-Host ""

# 1) Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Install Python 3.9+ and add it to PATH." -ForegroundColor Red
    Write-Host "See docs/INSTALLATION.md for details." -ForegroundColor Yellow
    exit 1
}
$pyVersion = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
Write-Host "[1/4] Python found: $pyVersion" -ForegroundColor Green

# 2) Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install Node.js (LTS) and add it to PATH." -ForegroundColor Red
    Write-Host "See docs/INSTALLATION.md for details." -ForegroundColor Yellow
    exit 1
}
$nodeVersion = node -v
Write-Host "[2/4] Node.js found: $nodeVersion" -ForegroundColor Green

# 3) Install backend dependencies
Write-Host "[3/4] Installing backend dependencies..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    python -m pip install -q -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
} catch {
    Write-Host "Backend install failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "      Backend dependencies OK." -ForegroundColor Green

# 4) Install frontend dependencies
Write-Host "[4/4] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location $FrontendDir
try {
    npm install --no-fund --no-audit 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} catch {
    Write-Host "Frontend install failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "      Frontend dependencies OK." -ForegroundColor Green

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:3000 (opens in browser)" -ForegroundColor Gray
Write-Host ""

# Start backend in a new window (keeps running when this script continues)
$backendCmd = "cd /d `"$BackendDir`" && python run.py"
Start-Process cmd -ArgumentList "/k", $backendCmd -WindowStyle Normal

# Give backend a moment to bind
Start-Sleep -Seconds 3

# Start frontend in this window (npm start will open the browser)
Push-Location $FrontendDir
Write-Host "Frontend starting... Close this window to stop the app." -ForegroundColor Yellow
Write-Host ""
& npm start
