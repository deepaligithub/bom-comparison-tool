"""
Production entry point for the Flask app. Uses waitress and reads
STATIC_DIR, DATA_DIR, LOG_DIR from environment (set by Electron when packaged).
When run as a standalone PyInstaller exe, sets these so the exe is self-contained,
opens the browser automatically, and shows a Windows message box if something goes wrong.
"""
import os
import sys
import threading
import time
import webbrowser
import socket
import shutil

# Ensure backend/app is on path when run as PyInstaller exe or from project root
if getattr(sys, "frozen", False):
    base = os.path.dirname(sys.executable)
    # Standalone exe or AppX: static files are in the PyInstaller extract folder.
    os.environ["STATIC_DIR"] = os.path.join(sys._MEIPASS, "app", "static")

    # Only set DATA_DIR when not already set (e.g. by Electron when it spawns this exe).
    # When run from the desktop app or Store, Electron passes DATA_DIR = userData/data.
    # When run as standalone exe (no launcher), use LOCALAPPDATA\Cinematics\BOMCompareTool.
    if not os.environ.get("DATA_DIR"):
        local_app_data = os.environ.get("LOCALAPPDATA", base)
        data_root = os.path.join(local_app_data, "Cinematics", "BOMCompareTool")
        os.makedirs(data_root, exist_ok=True)
        os.environ["DATA_DIR"] = data_root

    data_root = os.environ.get("DATA_DIR", base)
    # Seed demo samples into DATA_DIR/samples from bundled read-only assets (if present)
    bundled_samples = os.path.join(sys._MEIPASS, "samples")
    target_samples = os.path.join(data_root, "samples")
    try:
        if os.path.isdir(bundled_samples):
            os.makedirs(target_samples, exist_ok=True)
            for name in os.listdir(bundled_samples):
                src = os.path.join(bundled_samples, name)
                dst = os.path.join(target_samples, name)
                if os.path.isfile(src) and not os.path.exists(dst):
                    shutil.copy2(src, dst)
    except Exception:
        # Failing to copy samples should not block the app from starting.
        pass
else:
    base = os.path.dirname(os.path.abspath(__file__))

if base not in sys.path:
    sys.path.insert(0, base)

os.chdir(base)


def _show_error_popup(title, message):
    """Show a Windows message box when running as exe; otherwise print and exit."""
    if getattr(sys, "frozen", False) and sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)  # MB_ICONERROR
        except Exception:
            print(f"{title}: {message}", file=sys.stderr)
    else:
        print(f"{title}: {message}", file=sys.stderr)
    sys.exit(1)


def _is_port_in_use(host, port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            s.bind((host, port))
            return False
    except OSError:
        return True


def main():
    from waitress import serve
    from app import create_app

    app = create_app()
    app.config["UPLOAD_FOLDER"] = os.environ.get(
        "UPLOAD_FOLDER",
        os.path.join(os.environ.get("DATA_DIR", os.getcwd()), "uploads"),
    )
    app.config["LOG_FOLDER"] = os.environ.get(
        "LOG_DIR",
        os.path.join(os.environ.get("DATA_DIR", os.getcwd()), "logs"),
    )
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["LOG_FOLDER"], exist_ok=True)

    HOST = os.environ.get("BOM_HOST", "127.0.0.1")
    start_port = int(os.environ.get("BOM_PORT", "5000"))
    port_range = range(start_port, min(start_port + 11, 65536))
    PORT = None
    for p in port_range:
        if not _is_port_in_use(HOST, p):
            PORT = p
            break
    if PORT is None:
        end_port = min(start_port + 10, 65535)
        exe_name = os.path.basename(sys.executable) if getattr(sys, "frozen", False) else "BOMCompareTool.exe"
        _show_error_popup(
            "BOM Compare Tool - Port in use",
            f"Ports {start_port}–{end_port} are already in use.\n\n"
            f"• Close other applications using these ports, or\n\n"
            f"• Use a different port: create a file 'Start BOM Compare.bat' in this folder with:\n\n"
            f"  set BOM_PORT=5011\n"
            f"  \"%~dp0{exe_name}\"\n\n"
            f"Then run that batch file instead of the exe.",
        )
    URL = f"http://{HOST}:{PORT}"
    # So Electron can discover which port we're using (when port 5000 was in use we may have picked 5001, etc.)
    data_dir = os.environ.get("DATA_DIR")
    if data_dir:
        try:
            port_file = os.path.join(data_dir, "port.txt")
            with open(port_file, "w") as f:
                f.write(str(PORT))
        except Exception:
            pass

    def _open_browser():
        time.sleep(2)
        try:
            webbrowser.open(URL)
        except Exception:
            pass

    if getattr(sys, "frozen", False):
        threading.Thread(target=_open_browser, daemon=True).start()
    serve(app, host=HOST, port=PORT, threads=4)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        err_msg = str(e)
        if getattr(sys, "frozen", False) and sys.platform == "win32":
            _show_error_popup(
                "BOM Compare Tool - Error",
                f"Could not start the application.\n\n{err_msg}\n\nPlease check the logs in this folder or contact support.",
            )
        else:
            raise
