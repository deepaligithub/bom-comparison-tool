#!/usr/bin/env bash
set -euo pipefail

# ----- flags -----
FORCE_SEED=0
for arg in "$@"; do
  if [ "$arg" = "--force-seed" ]; then FORCE_SEED=1; fi
done

# ----- paths & sanity -----
ROOT="$(pwd)"
[[ -d "$ROOT/backend" ]]  || { echo "Run from repo root (backend/ not found)"; exit 1; }
[[ -d "$ROOT/frontend" ]] || { echo "Run from repo root (frontend/ not found)"; exit 1; }

OUT="$ROOT/dist"
BUNDLE="$ROOT/.bundle_zipapp"        # temp bundle
VENV="$ROOT/.pack-venv"              # persistent venv (cache)
VENDOR="$ROOT/.vendor_zipapp"        # persistent vendor site-packages cache
STAMP="$VENDOR/.deps.hash"
FRONT_HASH_FILE="$ROOT/.frontend.hash"

mkdir -p "$OUT"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE"

# ----- frontend change detection (lock + src hash) -----
echo "==> Frontend: change detection"
LOCK_FILE="frontend/package-lock.json"
[[ -f "$LOCK_FILE" ]] || LOCK_FILE="frontend/package.json"
LOCK_PART=$(sha256sum "$LOCK_FILE" | awk '{print $1}')
SRC_PART=$((find frontend/src -type f -print0 2>/dev/null | xargs -0 sha256sum 2>/dev/null || true) | sha256sum | awk '{print $1}')
FRONT_HASH="$LOCK_PART.$SRC_PART"

NEED_NPM_INSTALL=1
NEED_BUILD=1
if [[ -f "$FRONT_HASH_FILE" ]] && [[ "$(cat "$FRONT_HASH_FILE")" == "$FRONT_HASH" ]]; then
  echo "  - lock & src unchanged"
  [[ -d "frontend/node_modules" ]] && NEED_NPM_INSTALL=0
  [[ -d "frontend/build"       ]] && NEED_BUILD=0
else
  echo "  - changes detected in lock/src (or first run)"
fi

# ----- npm install / build -----
echo "==> Frontend: npm install"
pushd frontend >/dev/null
if [[ $NEED_NPM_INSTALL -eq 1 ]]; then
  if [[ -f package-lock.json ]] || [[ -f npm-shrinkwrap.json ]]; then
    npm ci
  else
    npm install
  fi
else
  echo "  - skipped (node_modules present, lock unchanged)"
fi

echo "==> Frontend: build"
if [[ $NEED_BUILD -eq 1 ]]; then
  npm run build
  echo "$FRONT_HASH" > "$FRONT_HASH_FILE"
else
  echo "  - skipped (frontend/build present, sources unchanged)"
fi
popd >/dev/null

# ----- embed UI into backend for local testing -----
echo "==> Embed frontend build into backend/app/static"
rm -rf backend/app/static
mkdir -p backend/app/static
cp -R frontend/build/* backend/app/static/ || true

# ----- ALSO put UI next to the .pyz (runtime static) -----
echo "==> Copy frontend build into dist/static (runtime)"
rm -rf "$OUT/static"
mkdir -p "$OUT/static"
cp -R frontend/build/* "$OUT/static/" || true

echo "==> Python build venv (reused between runs)"
if [[ ! -d "$VENV" ]]; then
  if command -v py >/dev/null 2>&1; then
    py -3 -m venv "$VENV"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m venv "$VENV"
  else
    python -m venv "$VENV"
  fi
fi

# Activate (bin on Unix, Scripts on Windows)
if [[ -f "$VENV/bin/activate" ]]; then
  # shellcheck disable=SC1090
  source "$VENV/bin/activate"
elif [[ -f "$VENV/Scripts/activate" ]]; then
  # shellcheck disable=SC1090
  source "$VENV/Scripts/activate"
else
  echo "ERROR: could not find venv activate script in $VENV"
  exit 1
fi

# Optional: upgrade pip unless skipped
if [[ -z "${SKIP_PIP_UPGRADE:-}" ]]; then
  python -m pip install --upgrade pip
fi

# ----- install runtime deps into venv (idempotent) -----
echo "==> Install runtime deps into venv (idempotent)"
python -m pip install -r backend/requirements.txt waitress

# ----- vendor deps for zipapp only when requirements change -----
echo "==> Vendor deps for zipapp only when requirements change"
REQ_HASH="$(cat backend/requirements.txt <(echo waitress) | sha256sum | awk '{print $1}')"
if [[ ! -f "$STAMP" ]] || [[ "$REQ_HASH" != "$(cat "$STAMP")" ]]; then
  echo "  - dependencies changed → (re)vendor into $VENDOR"
  rm -rf "$VENDOR"
  mkdir -p "$VENDOR"
  python -m pip install -t "$VENDOR" -r backend/requirements.txt waitress
  echo "$REQ_HASH" > "$STAMP"
else
  echo "  - dependencies unchanged → reuse cached vendor ($VENDOR)"
fi

# ----- assemble bundle & zipapp -----
echo "==> Assemble bundle from cached vendor + app code"
mkdir -p "$BUNDLE/app"
cp -R "$VENDOR/"* "$BUNDLE/"           # site-packages into bundle (pure-Python only)
cp -R backend/app/* "$BUNDLE/app/"
cp packager/app_runner.py "$BUNDLE/app_runner.py"

echo "==> Create zipapp"
python -m zipapp "$BUNDLE" -o "$OUT/bomvalidator.pyz" -m "app_runner:main"

# temp cleanup
deactivate
rm -rf "$BUNDLE"

# ----- compiled deps next to the .pyz (numpy/pandas/openpyxl) -----
echo "==> Install compiled deps into dist/site (numpy/pandas/openpyxl)"
mkdir -p "$OUT/site"

# Use the venv's Python (bin on Unix, Scripts on Windows)
if [[ -x "$VENV/bin/python" ]]; then
  VPY="$VENV/bin/python"
else
  VPY="$VENV/Scripts/python.exe"
fi
"$VPY" -m pip install -t "$OUT/site" --upgrade pandas openpyxl numpy

# ----- Seed data/uploads next to the .pyz (DELETE then COPY) -----
echo "==> Reset dist/data/uploads then seed from backend/uploads"
SEED_SRC="backend/uploads"
SEED_DST="$OUT/data/uploads"

if [[ -d "$SEED_SRC" ]]; then
  rm -rf "$SEED_DST"
  mkdir -p "$SEED_DST"

  # Prefer rsync if available; else fall back to cp
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$SEED_SRC"/ "$SEED_DST"/
  else
    # cp fallback; the trailing '/.' copies hidden files too
    cp -a "$SEED_SRC"/. "$SEED_DST"/
  fi

  echo "Seeded uploads fodler to $SEED_DST (destination was deleted first)"
else
  echo "No backend/uploads folder to seed."
fi

echo ""
echo "DONE: $OUT/bomvalidator.pyz"
echo "Run: py dist/bomvalidator.pyz --host 0.0.0.0 --port 5000 --log-dir ./logs"
