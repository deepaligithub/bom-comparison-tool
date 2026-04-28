# BOM Compare Tool – Electron desktop app

This folder contains the Electron wrapper for the BOM Compare Tool. It starts the Flask backend and opens a window to the React app.

## Quick start (development)

1. From **project root**: build the frontend once.
   ```bash
   cd frontend && npm run build && cd ..
   ```
2. Install backend dependency: `pip install waitress` (in `backend/` or your venv).
3. From this folder:
   ```bash
   npm install
   npm start
   ```
   Electron will run `python backend/run_production.py` and load http://127.0.0.1:5000.

## Building for Windows (installer + MSIX)

From the **project root**, run:

```powershell
.\scripts\build-windows-app.ps1
```

Output is in `electron/dist-electron/` (NSIS installer and MSIX for the Microsoft Store).

See **WINDOWS_STORE.md** in the project root for Store submission steps.
