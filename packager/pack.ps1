Param(
  [string]$Python = "py",
  [string]$Npm = "npm",
  [switch]$ForceSeed
)
$ErrorActionPreference = "Stop"

# Resolve npm executable robustly on Windows
$NpmExe = $null
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if ($npmCmd) { $NpmExe = $npmCmd.Source }
else {
  $npmPlain = (Get-Command npm -ErrorAction SilentlyContinue)
  if ($npmPlain) { $NpmExe = $npmPlain.Source }
}
if (-not $NpmExe) { throw "npm not found on PATH. Install Node.js LTS and reopen PowerShell." }

$ROOT   = (Get-Location).Path
if (!(Test-Path "$ROOT\backend"))  { throw "Run from repo root (backend/ not found)" }
if (!(Test-Path "$ROOT\frontend")) { throw "Run from repo root (frontend/ not found)" }

$OUT    = "$ROOT\dist"
$BUNDLE = "$ROOT\.bundle_zipapp"      # temp bundle
$VENV   = "$ROOT\.pack-venv"          # persistent venv
$VENDOR = "$ROOT\.vendor_zipapp"      # persistent vendor cache
$STAMP  = "$VENDOR\.deps.hash"
$FRONT_HASH_FILE = "$ROOT\.frontend.hash"

if (!(Test-Path $OUT)) { New-Item -ItemType Directory -Force -Path $OUT | Out-Null }
if (Test-Path $BUNDLE) { Remove-Item $BUNDLE -Recurse -Force }
New-Item -ItemType Directory -Force -Path $BUNDLE | Out-Null

# === Frontend change detection ===
Write-Host "==> Frontend: change detection"
$lockPath = Join-Path $ROOT "frontend\package-lock.json"
if (!(Test-Path $lockPath)) { $lockPath = Join-Path $ROOT "frontend\package.json" }

function Get-CombinedHash([string]$lock, [string]$srcDir) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $enc = [System.Text.Encoding]::UTF8

  $lockHash = (Get-FileHash $lock -Algorithm SHA256).Hash
  $bytes = $enc.GetBytes($lockHash)
  $sha.TransformBlock($bytes, 0, $bytes.Length, $null, 0) | Out-Null

  if (Test-Path $srcDir) {
    Get-ChildItem -Path $srcDir -Recurse -File | Sort-Object FullName | ForEach-Object {
      $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
      $b = $enc.GetBytes($h)
      $sha.TransformBlock($b, 0, $b.Length, $null, 0) | Out-Null
    }
  }
  $sha.TransformFinalBlock(@(),0,0) | Out-Null
  ([System.BitConverter]::ToString($sha.Hash)).Replace("-", "").ToLower()
}

$frontHash = Get-CombinedHash $lockPath (Join-Path $ROOT "frontend\src")
$needNpmInstall = $true
$needBuild = $true

if (Test-Path $FRONT_HASH_FILE) {
  $prev = Get-Content $FRONT_HASH_FILE -Raw
  if ($prev -eq $frontHash) {
    Write-Host "  - lock & src unchanged"
    if (Test-Path (Join-Path $ROOT "frontend\node_modules")) { $needNpmInstall = $false }
    if (Test-Path (Join-Path $ROOT "frontend\build"))        { $needBuild = $false }
  }
} else {
  Write-Host "  - changes detected (or first run)"
}

# === npm install ===
Write-Host "==> Frontend: npm install"
Push-Location (Join-Path $ROOT "frontend")
if ($needNpmInstall) {
  if ( (Test-Path "package-lock.json") -or (Test-Path "npm-shrinkwrap.json") ) {
    & $NpmExe ci
  } else {
    & $NpmExe install
  }
} else {
  Write-Host "  - skipped (node_modules present, lock unchanged)"
}

# === build ===
Write-Host "==> Frontend: build"
if ($needBuild) {
  & $NpmExe run build
  Set-Content -Path $FRONT_HASH_FILE -Value $frontHash -NoNewline
} else {
  Write-Host "  - skipped (frontend/build present, sources unchanged)"
}
Pop-Location

# === Embed build into Flask static ===
Write-Host "==> Embed frontend build into backend/app/static"
if (Test-Path "backend\app\static") { Remove-Item "backend\app\static" -Recurse -Force }
New-Item -ItemType Directory -Force -Path "backend\app\static" | Out-Null
Copy-Item -Recurse -Force "frontend\build\*" "backend\app\static\"

# === Python venv (reused) ===
Write-Host "==> Python build venv (reused between runs)"
if (!(Test-Path $VENV)) { & $Python -3 -m venv $VENV }
& "$VENV\Scripts\Activate.ps1"

# Optional: upgrade pip unless skipped
if (-not $env:SKIP_PIP_UPGRADE) {
  & python -m pip install --upgrade pip
}

Write-Host "==> Install runtime deps into venv (idempotent)"
& python -m pip install -r backend/requirements.txt waitress

# === Vendor caching for zipapp ===
Write-Host "==> Vendor deps only when requirements change"
$reqContent = (Get-Content backend\requirements.txt -Raw) + "`nwaitress`n"
$sha = [System.Security.Cryptography.SHA256]::Create()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($reqContent)
$reqHash = ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLower()

$needVendor = $true
if (Test-Path $STAMP) {
  $old = Get-Content $STAMP -Raw
  if ($old -eq $reqHash) { $needVendor = $false }
}

if ($needVendor) {
  Write-Host "  - dependencies changed -> (re)vendor into $VENDOR"
  if (Test-Path $VENDOR) { Remove-Item $VENDOR -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $VENDOR | Out-Null
  & python -m pip install -t "$VENDOR" -r backend/requirements.txt waitress
  Set-Content -Path $STAMP -Value $reqHash -NoNewline
} else {
  Write-Host "  - dependencies unchanged -> reuse cached vendor ($VENDOR)"
}

# === Assemble & zipapp ===
Write-Host "==> Assemble bundle from cached vendor + app code"
if (Test-Path $BUNDLE) { Remove-Item $BUNDLE -Recurse -Force }
New-Item -ItemType Directory -Force -Path $BUNDLE | Out-Null
Copy-Item -Recurse -Force "$VENDOR\*" "$BUNDLE\"
New-Item -ItemType Directory -Force -Path "$BUNDLE\app" | Out-Null
Copy-Item -Recurse -Force "backend\app\*" "$BUNDLE\app\"
Copy-Item "packager\app_runner.py" "$BUNDLE\app_runner.py"

Write-Host "==> Create zipapp"
& python -m zipapp "$BUNDLE" -o "$OUT\bomvalidator.pyz" -m "app_runner:main"

# ---- Seed data/uploads next to the .pyz (DELETE then COPY) ----
$seedSrc = "backend\uploads"
$seedDst = Join-Path $OUT "data\uploads"

if (Test-Path $seedSrc) {
  # remove destination entirely
  if (Test-Path $seedDst) { Remove-Item $seedDst -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $seedDst | Out-Null

  # copy fresh contents (robocopy preserves structure, overwrites everything)
  robocopy $seedSrc $seedDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host "Seeded uploads folder to $seedDst (destination was deleted first)"
} else {
  Write-Host "No backend\uploads folder to seed."
}

deactivate
Remove-Item $BUNDLE -Recurse -Force
Write-Host "DONE: $OUT\bomvalidator.pyz"

# Put static build next to the .pyz so Flask can serve from real FS
New-Item -ItemType Directory -Force -Path "$OUT\static" | Out-Null
Copy-Item -Recurse -Force "frontend\build\*" "$OUT\static\"

New-Item -ItemType Directory -Force -Path "$OUT\site" | Out-Null
& python -m pip install -t "$OUT\site" pandas openpyxl numpy
