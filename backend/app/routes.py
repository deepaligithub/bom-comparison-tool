from flask import Blueprint, request, jsonify, current_app, send_file, g
import os
import logging
import datetime

bp = Blueprint('api', __name__, url_prefix='/api')

# Configure logging once
logger = logging.getLogger(__name__)
logging.basicConfig(
    filename='logs/session.log', 
    level=logging.INFO, 
    format='%(asctime)s %(levelname)s: %(message)s'
)

# GET is for just local testing : http://localhost:5000/ #
UPLOAD_FOLDER = 'uploads'
@bp.route('/', methods=['GET'])
def home():
    return "Flask API is running!"

@bp.route('/compare', methods=['POST'])
def compare_bom():
    try:
        tc_file = request.files.get('tcFile')
        sap_file = request.files.get('sapFile')
        # Generate timestamped log file name per session
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        user_role = request.headers.get('X-User-Role', 'user')  # frontend should send this
        log_filename = f"{user_role}_session_{timestamp}.log"
        log_path = os.path.join(current_app.config['LOG_FOLDER'], log_filename)

        # Attach to `g` or return to frontend
        g.log_filename = log_filename  # store in context for this request
        
        # Setup dynamic logger
        logger = logging.getLogger(log_filename)
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))

        logger.addHandler(file_handler)
        logger.setLevel(logging.DEBUG if user_role == 'admin' else logging.INFO)

        if not tc_file or not sap_file:
            logger.warning("Missing one or both files in the request.")
            return jsonify({'error': 'Both TC and SAP files are required'}), 400

        upload_path = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_path, exist_ok=True)

        tc_path = os.path.join(upload_path, tc_file.filename)
        sap_path = os.path.join(upload_path, sap_file.filename)

        tc_file.save(tc_path)
        sap_file.save(sap_path)

        logger.info(f"Saved uploaded files: {tc_file.filename}, {sap_file.filename}")

        # Dummy comparison result
        result = {
            "matched": [],
            "tc_only": [],
            "sap_only": [],
            "differences": [],
            "logFilename": g.log_filename
        }

        logger.info("Comparison completed successfully.")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Comparison failed: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500
    
@bp.route('/download-log/<filename>', methods=['GET'])
def download_log(filename):
    log_path = os.path.join(current_app.config['LOG_FOLDER'], filename)

    if not os.path.exists(log_path):
        return jsonify({'error': 'Log file not found'}), 404

    return send_file(
        log_path,
        as_attachment=True,
        download_name=filename,  # This works in Flask >= 2.0
        mimetype='text/plain'
    )
