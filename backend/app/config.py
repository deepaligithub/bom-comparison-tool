import os

class Config:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'uploads')
    LOG_FOLDER = os.path.join(BASE_DIR, '..', 'logs')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
