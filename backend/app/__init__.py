import os
import time
import uuid
import logging
from typing import cast
from logging.handlers import TimedRotatingFileHandler
from flask import Flask, g, request, send_from_directory, abort
from .config import Config


def create_app():
    # Use external static dir if provided (for .pyz runtime)
    static_dir: str = os.environ.get("STATIC_DIR") or os.path.join(
        os.path.dirname(__file__), "static"
    )

    # Serve static files from backend/app/static (where the React build will be copied)
    app = Flask(
        __name__,
        static_folder=static_dir,
        static_url_path="/",
    )
    app.config.from_object(Config)

    # Prefer explicit env vars; otherwise default to current working directory.
    data_dir = os.environ.get("DATA_DIR", os.getcwd())
    upload_dir = os.environ.get("UPLOAD_DIR", os.path.join(data_dir, "uploads"))
    log_dir_cfg = os.environ.get("LOG_DIR", os.path.join(data_dir, "logs"))
    app.config["UPLOAD_FOLDER"] = upload_dir
    app.config["LOG_FOLDER"] = log_dir_cfg

    # Ensure upload and log folders exist
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["LOG_FOLDER"], exist_ok=True)

    # ---- Structured, rotating logs (plain text) ----
    # LOG_DIR env var overrides app.config['LOG_FOLDER'] (useful for packaging/runtime)
    log_dir = os.environ.get("LOG_DIR", app.config["LOG_FOLDER"])
    os.makedirs(log_dir, exist_ok=True)

    handler = TimedRotatingFileHandler(
        filename=os.path.join(log_dir, "app.log"),
        when="midnight",
        backupCount=14,
        encoding="utf-8",
    )
    handler.setLevel(os.environ.get("LOG_LEVEL", "INFO"))
    handler.setFormatter(logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    ))

    # attach to app.logger only (avoid duplicate console logs)
    app.logger.handlers.clear()
    app.logger.addHandler(handler)
    app.logger.setLevel(handler.level)

    @app.before_request
    def _start_timer():
        g._start = time.time()
        g.req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

    @app.after_request
    def _after(resp):
        try:
            dur_ms = int((time.time() - g._start) * 1000)
        except Exception:
            dur_ms = -1
        app.logger.info(
            "request",
            extra={
                "request_method": request.method,
                "path": request.path,
                "status": resp.status_code,
                "duration_ms": dur_ms,
                "remote_addr": request.headers.get("X-Forwarded-For", request.remote_addr),
                "user_agent": request.headers.get("User-Agent"),
                "req_id": g.get("req_id"),
            },
        )
        resp.headers["X-Request-ID"] = g.get("req_id")
        return resp

    # ---- API routes under /api ----
    from .routes import bp as routes_bp
    app.register_blueprint(routes_bp, url_prefix="/api")

    # ---- SPA fallback (serve React build) ----
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path: str):
        path = path or ""
        static_root = cast(str, app.static_folder)  # app.static_folder is Optional[str] in stubs

        # Let API routes handle /api/*
        if path.startswith("api/"):
            abort(404)

        full = os.path.join(static_root, path)
        if path and os.path.exists(full):
            return send_from_directory(static_root, path)
        return send_from_directory(static_root, "index.html")

    return app
