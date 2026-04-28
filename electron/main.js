const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

const DEFAULT_PORT = 5000;

let backendProcess = null;
let mainWindow = null;

const isDev = !app.isPackaged;
const isWindows = process.platform === "win32";

function getBackendExePath() {
  if (isDev) return null;
  const resources = process.resourcesPath;
  const exe = path.join(resources, "backend", "bom-backend.exe");
  return fs.existsSync(exe) ? exe : null;
}

function getBackendScriptPath() {
  if (isDev) {
    return path.join(app.getAppPath(), "..", "backend", "run_production.py");
  }
  return null;
}

function getStaticDir() {
  if (isDev) {
    return path.join(app.getAppPath(), "..", "frontend", "build");
  }
  return path.join(process.resourcesPath, "static");
}

function getDataDir() {
  return path.join(app.getPath("userData"), "data");
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const dataDir = getDataDir();
    const staticDir = getStaticDir();
    const logDir = path.join(dataDir, "logs");
    [dataDir, path.join(dataDir, "uploads"), logDir].forEach((d) => {
      try {
        fs.mkdirSync(d, { recursive: true });
      } catch (_) {}
    });

    const env = {
      ...process.env,
      STATIC_DIR: staticDir,
      DATA_DIR: dataDir,
      UPLOAD_FOLDER: path.join(dataDir, "uploads"),
      LOG_DIR: logDir,
      BOM_HOST: "127.0.0.1",
      BOM_PORT: String(DEFAULT_PORT),
    };

    const exePath = getBackendExePath();
    const scriptPath = getBackendScriptPath();
    const backendStderr = [];

    if (exePath) {
      backendProcess = spawn(exePath, [], {
        cwd: path.dirname(exePath),
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else if (scriptPath && fs.existsSync(scriptPath)) {
      const backendDir = path.join(app.getAppPath(), "..", "backend");
      const scriptName = path.basename(scriptPath);
      // On Windows try "py -3" first (Python launcher), then "python"
      const pythonCmd = isWindows ? "py" : "python3";
      const pythonArgs = isWindows ? ["-3", scriptName] : [scriptName];
      backendProcess = spawn(pythonCmd, pythonArgs, {
        cwd: backendDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      reject(new Error("No backend executable or run_production.py found."));
      return;
    }

    backendProcess.stdout?.on("data", (d) => process.stdout.write(d.toString()));
    backendProcess.stderr?.on("data", (d) => {
      const s = d.toString();
      backendStderr.push(s);
      process.stderr.write(s);
    });
    backendProcess.on("error", (err) => reject(Object.assign(err, { backendLog: backendStderr.join("") })));
    backendProcess.on("exit", (code, sig) => {
      if (code !== null && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
        console.error("Backend exited with code", code);
      }
    });

    const rejectWithLog = (err) => {
      err.backendLog = backendStderr.join("");
      reject(err);
    };

    waitForPortFile(dataDir, (err, port) => {
      if (err) return rejectWithLog(err);
      waitForServer(port, resolve, rejectWithLog);
    });
  });
}

function waitForPortFile(dataDir, cb) {
  const portPath = path.join(dataDir, "port.txt");
  const start = Date.now();
  const timeout = 20000;

  function poll() {
    try {
      if (fs.existsSync(portPath)) {
        const port = parseInt(fs.readFileSync(portPath, "utf8").trim(), 10);
        if (port > 0 && port < 65536) {
          return cb(null, port);
        }
      }
    } catch (_) {}
    if (Date.now() - start > timeout) {
      return cb(new Error("Backend did not write port file in time."));
    }
    setTimeout(poll, 200);
  }
  poll();
}

function waitForServer(port, resolve, reject) {
  const http = require("http");
  const apiUrl = `http://127.0.0.1:${port}`;
  const start = Date.now();
  const timeout = 45000;

  function tryOnce() {
    const req = http.get(`${apiUrl}/api/`, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        resolve(port);
        return;
      }
      schedule();
    });
    req.on("error", () => schedule());
    req.setTimeout(2000, () => {
      req.destroy();
      schedule();
    });
  }

  function schedule() {
    if (Date.now() - start > timeout) {
      reject(new Error("Backend did not start in time."));
      return;
    }
    setTimeout(tryOnce, 300);
  }

  tryOnce();
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow(backendPort) {
  const preloadPath = path.join(__dirname, "preload.js");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
    },
    title: "BOM Compare Tool",
    show: false,
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (backendPort != null) {
    mainWindow.loadURL(getBackendUrl(backendPort));
  }
}

function getBackendUrl(port) {
  return `http://127.0.0.1:${port}`;
}

function showBackendErrorPage(err) {
  const backendLog = (err && err.backendLog) ? String(err.backendLog).trim() : "";
  const message = (err && err.message) ? String(err.message) : "Backend failed to start.";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BOM Compare Tool – Startup Error</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; line-height: 1.5; }
  .box { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  h1 { font-size: 1.25rem; margin: 0 0 12px; color: #0f172a; }
  p { margin: 0 0 12px; color: #475569; }
  .err { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 8px; font-size: 0.875rem; margin: 12px 0; word-break: break-word; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 0.75rem; overflow: auto; max-height: 200px; margin: 12px 0; white-space: pre-wrap; }
  .tip { font-size: 0.875rem; color: #64748b; margin-top: 16px; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
</style></head><body>
  <div class="box">
    <h1>Backend could not start</h1>
    <p>${escapeHtml(message)}</p>
    ${backendLog ? `<p><strong>Backend log:</strong></p><pre>${escapeHtml(backendLog)}</pre>` : ""}
    <p class="tip">From the project root, install dependencies and try again:<br><code>cd backend && pip install -r requirements.txt</code></p>
    <p class="tip">Then run the app again from the <code>electron</code> folder.</p>
  </div>
</body></html>`;
  createWindow(null);
  mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

ipcMain.handle("open-data-folder", (event, dir) => {
  if (dir && typeof dir === "string") {
    shell.openPath(path.resolve(dir)).catch(() => {});
  }
});

app.whenReady().then(() => {
  startBackend()
    .then((port) => {
      createWindow(port);
    })
    .catch((err) => {
      console.error("Failed to start backend:", err);
      showBackendErrorPage(err);
    });
});

app.on("window-all-closed", () => {
  stopBackend();
  app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});
