# PyInstaller spec for BOM Compare backend. Run from backend/ with:
#   pyinstaller bom_backend.spec
# For standalone exe: ensure frontend is built and copied to backend/app/static first
#   (scripts/build-standalone-exe.ps1 does this). Output: dist/bom-backend.exe (single file).
import os
import sys

block_cipher = None
base = 'run_production.py'

# Bundle frontend (app/static) so standalone exe serves the UI; skip if not present (Electron build)
here = os.path.dirname(os.path.abspath(base))
static_src = os.path.join(here, 'app', 'static')
datas = []
if os.path.isdir(static_src) and os.path.isfile(os.path.join(static_src, 'index.html')):
    datas.append((static_src, 'app/static'))

# Bundle sample BOM files so "Run demo" works in packaged builds (exe / AppX).
samples_src = os.path.abspath(os.path.join(here, '..', 'samples'))
if os.path.isdir(samples_src):
    datas.append((samples_src, 'samples'))

a = Analysis(
    [base],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'flask',
        'flask_cors',
        'waitress',
        'pandas',
        'openpyxl',
        'xmltodict',
        'dotenv',
        'app',
        'app.routes',
        'app.config',
        'app.__init__',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='bom-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
