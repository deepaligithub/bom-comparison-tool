<#
.SYNOPSIS
  Build the app and create a folder ready to upload to the Microsoft Store.
.DESCRIPTION
  Runs the full Windows build (React + PyInstaller backend + Electron), then copies
  the MSIX/AppX package into a dedicated folder with upload instructions.
  Output folder: BOMCompareTool-MicrosoftStore (in project root).
.EXAMPLE
  .\scripts\create-microsoft-store-package.ps1
  .\scripts\create-microsoft-store-package.ps1 -SkipBuild   # Only assemble from existing dist-electron
#>
Param(
  [switch]$SkipBuild = $false   # If set, only copy from existing electron\dist-electron
)
$ErrorActionPreference = "Stop"
$Root = (Get-Item $PSScriptRoot).Parent.FullName
$ElectronDist = Join-Path $Root "electron\dist-electron"
$StoreFolder = Join-Path $Root "BOMCompareTool-MicrosoftStore"

Write-Host ""
Write-Host "=== BOM Compare Tool - Microsoft Store package ===" -ForegroundColor Cyan
Write-Host "Project root: $Root" -ForegroundColor Gray
Write-Host ""

if (-not $SkipBuild) {
  Write-Host "Running full Windows build (React + backend exe + Electron)..." -ForegroundColor Yellow
  & (Join-Path $Root "scripts\build-windows-app.ps1")
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed. If the error was 'file in use' or 'app.asar':" -ForegroundColor Yellow
    Write-Host "  Close any running BOM Compare Tool or Electron window, then run this script again." -ForegroundColor Yellow
    Write-Host "  Or run with -SkipBuild to create the Store folder from an existing .appx in electron\dist-electron" -ForegroundColor Gray
    throw "Build failed."
  }
  Write-Host ""
}

# Find the Store package (.appx or .msix) — use newest by LastWriteTime so we don't pick an old build
$appx = Get-ChildItem -Path $ElectronDist -Filter "*.appx" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $appx) { $appx = Get-ChildItem -Path $ElectronDist -Filter "*.msix" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 }
if (-not $appx) {
  Write-Host "No .appx or .msix found in $ElectronDist" -ForegroundColor Red
  Write-Host "Run without -SkipBuild first: .\scripts\create-microsoft-store-package.ps1" -ForegroundColor Yellow
  exit 1
}

# Create Store upload folder
if (Test-Path $StoreFolder) { Remove-Item $StoreFolder -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StoreFolder | Out-Null

Copy-Item -Path $appx.FullName -Destination (Join-Path $StoreFolder $appx.Name) -Force
Write-Host "Copied: $($appx.Name)" -ForegroundColor Green

$instructions = @"
BOM Compare Tool — Microsoft Store upload package
================================================

This folder contains the package to upload in Partner Center.

UPLOAD THIS FILE:
  $($appx.Name)

STEPS:
1. Open https://partner.microsoft.com/dashboard/windows/overview
2. Open your app (or create one: New product → MSIX or PWA app).
3. Start a new submission.
4. Under Packages: upload the file above ($($appx.Name)).
5. Fill in description, screenshots, age rating, privacy policy URL.
6. Submit for certification.

Before first upload: set your Store identity in electron\package.json
  (build.appx: publisher, publisherDisplayName, identityName).
  See: docs\MICROSOFT_STORE_UPLOAD_STEPS.md

"@
Set-Content -Path (Join-Path $StoreFolder "UPLOAD_INSTRUCTIONS.txt") -Value $instructions -Encoding UTF8

Write-Host ""
Write-Host "DONE: Microsoft Store package ready." -ForegroundColor Green
Write-Host "  Folder: $StoreFolder" -ForegroundColor Cyan
Write-Host "  Upload this file in Partner Center: $($appx.Name)" -ForegroundColor Gray
Write-Host ""
