# packager/app_runner.py
import os, sys, argparse
from waitress import serve

def main():
    # Add sibling "site" to sys.path (for compiled deps like numpy/pandas)
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))

    # 1) compiled deps (numpy/pandas) next to the .pyz
    site_dir = os.path.join(base_dir, "site")
    if os.path.isdir(site_dir):
        sys.path.insert(0, site_dir)

    # 2) static files (React build) next to the .pyz
    static_dir = os.path.join(base_dir, "static")
    if os.path.isdir(static_dir):
        os.environ["STATIC_DIR"] = static_dir
    
    # seed data dir for uploads/logs <<<
    data_dir = os.path.join(base_dir, "data")
    if os.path.isdir(data_dir):
        os.environ["DATA_DIR"] = data_dir
        os.environ.setdefault("UPLOAD_DIR", os.path.join(data_dir, "uploads"))

    # Parse args
    parser = argparse.ArgumentParser(description="BOMValidatorTool server")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5000")))
    parser.add_argument("--log-dir", default=os.environ.get("LOG_DIR", "./logs"))
    args = parser.parse_args()

    os.makedirs(args.log_dir, exist_ok=True)
    os.environ["LOG_DIR"] = os.path.abspath(args.log_dir)

    from app import create_app
    app = create_app()
    print("Static folder:", app.static_folder)
    print(f"Serving on http://{args.host}:{args.port}")
    serve(app, host=args.host, port=args.port)
