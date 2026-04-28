# BOM Compare Tool – Installation Guide

This guide explains how to install and run the BOM Compare Tool on your machine.

---

## How to run (choose one)

Windows packages are **exe-based**: just click the exe and it sets everything up. If something goes wrong (e.g. port in use), a **popup message** will tell you what’s wrong and what to do.

| How to run | When to use it | What you need |
|------------|----------------|---------------|
| **BOMCompareTool.exe** | You have a package that includes the exe. **Recommended.** No install—just double‑click. | Nothing. The app starts and opens in your browser. Any issue shows a popup message. |
| **run.bat** | The package has no exe, or you prefer to run from Python. | Python 3.9+ on your PATH. The script installs backend dependencies and starts the app. |
| **RUN.bat** (source only) | You develop or build from the full project (backend + frontend source). | Python 3.9+ and Node.js (LTS). Installs both backend and frontend deps, then starts both servers. |

**Why both exe and run.bat?**  
- The **exe** is the normal Windows way: one click, no install. If there’s a problem (e.g. port 5000 in use), you get a popup explaining the issue.  
- **run.bat** is a fallback when the exe isn’t in the package or you prefer using your installed Python.

---

## If you have a package (BOMCompareTool-Package or -Delivery)

1. Open the package folder.
2. **If you see `BOMCompareTool.exe`** (recommended)  
   **Double‑click the exe.** It will start the app and open your browser at **http://127.0.0.1:5000**. No install needed.  
   - If anything goes wrong (e.g. port already in use), a **popup message** will explain the issue and what to do.  
   - Data (uploads, logs) is stored in the same folder as the exe.
3. **If there is no exe, or you prefer Python**  
   Double‑click **`run.bat`**. The first time it installs backend dependencies, then starts the app. You need Python 3.9+ on your PATH.
4. Log in with **admin** / **admin**.

---

## If you have the full project (source code)

If you have the project folder with `backend`, `frontend`, and `scripts`:

1. Install **Python 3.9+** and **Node.js (LTS)** and add them to your PATH.
2. Double‑click **`RUN.bat`** in the project root.  
   It will install backend and frontend dependencies, start the backend, then start the frontend. The app opens at **http://localhost:3000**.
3. Log in with **admin** / **admin**. To stop, close both the backend window and the frontend window.

**If you prefer to run steps manually**, see Option A below.

---

## Prerequisites

- **Node.js** (LTS, e.g. 18 or 20) – for the React frontend  
  [Download](https://nodejs.org/)
- **Python 3** (3.9 or newer) – for the Flask backend  
  [Download](https://www.python.org/downloads/)
- **npm** – comes with Node.js

**Windows:** Add Python to your PATH:
- `C:\Users\<your-user>\AppData\Local\Programs\Python\Python3xx\`
- `C:\Users\<your-user>\AppData\Local\Programs\Python\Python3xx\Scripts\`

---

## Option A: Local development (manual steps)

### 1. Get the project

Clone or download the project and open a terminal in the project root (the folder that contains `backend` and `frontend`).

### 2. Install and run the backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

- Backend runs at **http://localhost:5000**
- Leave this terminal open.

**Optional – use a virtual environment (recommended):**

```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python run.py
```

### 3. Install and run the frontend

Open a **second** terminal in the project root:

```bash
cd frontend
npm install
npm start
```

- The app opens in your browser at **http://localhost:3000**
- If port 3000 is in use, the script will prompt to use another port (e.g. 3001).

### 4. Verify

- In the browser: log in with **admin** / **admin**.
- Backend health check: open **http://localhost:5000/api/health** – you should see a JSON response with `"status": "ok"`.

---

## Option B: Production run (single server, no dev server)

Use this when you want to serve the app without the React dev server (e.g. after building the frontend once).

### 1. Build the frontend

```bash
cd frontend
npm install
npm run build
```

This creates the production files in `frontend/build/`.

### 2. Serve backend and frontend together

The backend can serve the built frontend if you copy `frontend/build` into the backend’s static folder, or you can use a separate web server for the `build` folder. To run the API only with Waitress (production-style server):

```bash
cd backend
pip install -r requirements.txt
python run_production.py
```

- API runs at **http://127.0.0.1:5000**
- Point your browser to wherever the built React app is served (e.g. same host if you configured the Flask app to serve the `build` folder, or a reverse proxy).

### 3. Environment variables (optional)

For `run_production.py` you can set:

| Variable     | Description                          | Default        |
|-------------|--------------------------------------|----------------|
| `BOM_HOST`  | Host to bind (e.g. `0.0.0.0`)        | `127.0.0.1`    |
| `BOM_PORT`  | Port for the API                     | `5000`         |
| `DATA_DIR`  | Base directory for data              | Current dir    |
| `UPLOAD_FOLDER` | Path for uploads and auth file   | `DATA_DIR/uploads` |
| `LOG_DIR`   | Path for logs                        | `DATA_DIR/logs` |

---

## Option C: Windows desktop app (Electron)

For a standalone Windows app (installer or MSIX for Microsoft Store), use the Electron build.

**From the project root (PowerShell):**

```powershell
.\scripts\build-windows-app.ps1
```

**Prerequisites:** Node.js, Python 3, and:

```bash
pip install pyinstaller waitress
```

The script will:

1. Build the React frontend
2. Package the backend (e.g. PyInstaller)
3. Run Electron Builder and produce installers in `electron/dist-electron/`

See **WINDOWS_STORE.md** for Store submission and **electron/README.md** for Electron details.

---

## Where data is stored

- **Users and auth:** `backend/uploads/auth_users.json`  
  Default user: **admin** / **admin** (role: admin, plan: paid).
- **Saved mappings:** Under `backend/uploads/` (created when you save a mapping preset).
- **Logs:** `backend/logs/` (if the app is configured to write logs there).

---

## Troubleshooting

### Port is already in use

**Backend (port 5000):**

- **Option 1 – Use a different port:**
  - **Development** (`run.py`): set the port before starting, e.g.  
    `set FLASK_RUN_PORT=5001` (Windows CMD) or `$env:FLASK_RUN_PORT=5001` (PowerShell), then `python run.py`.
  - **Production** (`run_production.py`): set `BOM_PORT`, e.g.  
    `set BOM_PORT=5001` (Windows) or `BOM_PORT=5001 python run_production.py` (macOS/Linux).  
  If you change the backend port, set the frontend proxy to match (see `frontend/package.json` `"proxy"`).
- **Option 2 – Free port 5000:**  
  Find what is using it:  
  - **Windows:** `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F` (run Command Prompt as Administrator if needed).  
  - **macOS/Linux:** `lsof -i :5000` then stop that process or kill the PID.

**Frontend (port 3000):**

- When you run `npm start`, if port 3000 is in use, the script will ask to use another port (e.g. 3001). Type **Y** and press Enter, then open the URL shown (e.g. http://localhost:3001).
- Or free port 3000 the same way as above, using `3000` instead of `5000` in the commands.

### Other issues

| Issue | What to do |
|-------|------------|
| **"Flask API is running!" but frontend can’t connect** | Ensure the frontend is started (`npm start` in `frontend`) and you open http://localhost:3000 (not 5000). The dev server proxies API requests to the backend. |
| **A popup appears when I run the exe** | The exe shows a message when something goes wrong. Read the popup: e.g. "Port 5000 is already in use" means close the other app or set `BOM_PORT=5001` in a shortcut. Other errors may suggest checking logs in the same folder as the exe or contacting support. |
| **Login fails** | Check that `backend/uploads/auth_users.json` exists. If not, start the backend once so it can create the default admin user. |
| **pip or python not found** | Install Python and add it to your system PATH; on Windows, use “Add Python to PATH” in the installer. |

---

## Next steps

- See **[HOW_TO_USE.md](HOW_TO_USE.md)** for logging in, comparing BOMs, and using Mapping Manager.
- See **[MAPPING.md](MAPPING.md)** for column mapping and presets.
- See **[FEATURES_FREE_PAID.md](FEATURES_FREE_PAID.md)** for free vs paid features and user plans.
