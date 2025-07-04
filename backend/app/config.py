import os

class Config:
    UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
    LOG_FOLDER = os.path.join(os.getcwd(), "logs")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
