from flask import Flask
from .config import Config
import os

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Ensure upload and log folders exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['LOG_FOLDER'], exist_ok=True)

    from .routes import bp as routes_bp
    app.register_blueprint(routes_bp)

    return app
