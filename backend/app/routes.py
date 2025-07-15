import os
import json
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file, g

bp = Blueprint('api', __name__, url_prefix='/api')

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    filename='logs/session.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s'
)

@bp.route('/', methods=['GET'])
def home():
    return "Flask API is running!"

@bp.route('/compare', methods=['POST'])
def compare_bom():
    import csv

    try:
        tc_file = request.files.get('tcFile')
        sap_file = request.files.get('sapFile')

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_role = request.headers.get('X-User-Role', 'user')
        log_filename = f"{user_role}_session_{timestamp}.log"
        log_path = os.path.join(current_app.config['LOG_FOLDER'], log_filename)
        g.log_filename = log_filename

        logger = logging.getLogger(log_filename)
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
        logger.addHandler(file_handler)
        logger.setLevel(logging.DEBUG if user_role == 'admin' else logging.INFO)

        if not tc_file or not sap_file:
            logger.warning("Missing one or both files in the request.")
            return jsonify({'error': 'Both TC and SAP files are required'}), 400

        # Load active mapping
        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        active_file = next((f for f in os.listdir(mapping_dir)
                            if f.endswith('.json') and json.load(open(os.path.join(mapping_dir, f))).get("active")), None)

        if not active_file:
            return jsonify({'error': 'No active mapping found'}), 400

        mapping_path = os.path.join(mapping_dir, active_file)
        with open(mapping_path, 'r') as f:
            mapping_json = json.load(f)

        mappings = mapping_json.get('mappings', [])
        if len(mappings) < 2:
            return jsonify({'error': 'Invalid mapping file — at least one key and one quantity field required'}), 400

        def parse_csv(file):
            decoded = file.read().decode('utf-8')
            file.seek(0)
            return list(csv.DictReader(decoded.splitlines()))

        tc_rows = parse_csv(tc_file)
        sap_rows = parse_csv(sap_file)

        logger.info(f"Parsed {len(tc_rows)} TC rows and {len(sap_rows)} SAP rows.")

        matched = []
        tc_only = []
        sap_only = []
        differences = []

        # First mapping is assumed to be the KEY, rest can be quantity or other fields
        key_fields = [mappings[0]]
        quantity_fields = mappings[1:]

        def build_key(row, key_mappings, side):
            parts = []
            for m in key_mappings:
                col = m[side]
                val = row.get(col, '').strip().lower()
                parts.append(val)
            return '|'.join(parts)  # delimiter for composite key

        # Build SAP index
        sap_index = {}
        for row in sap_rows:
            key = build_key(row, key_fields, 'sap')
            if key:
                sap_index[key] = row

        seen_keys = set()

        for tc_row in tc_rows:
            key = build_key(tc_row, key_fields, 'tc')
            if not key:
                continue
            seen_keys.add(key)
            sap_row = sap_index.get(key)
            if not sap_row:
                tc_only.append(tc_row)
                continue

            # Compare quantities (numeric-safe)
            difference_found = False
            for m in quantity_fields:
                tc_val = tc_row.get(m['tc'], '').strip()
                sap_val = sap_row.get(m['sap'], '').strip()
                try:
                    if float(tc_val) != float(sap_val):
                        difference_found = True
                        break
                except:
                    if tc_val != sap_val:
                        difference_found = True
                        break

            if difference_found:
                differences.append({**tc_row, **sap_row})
            else:
                matched.append({**tc_row, **sap_row})

        # SAP-only items
        for sap_row in sap_rows:
            key = build_key(sap_row, key_fields, 'sap')
            if key and key not in seen_keys:
                sap_only.append(sap_row)

        result = {
            "matched": matched,
            "tc_only": tc_only,
            "sap_only": sap_only,
            "differences": differences,
            "logFilename": g.log_filename
        }

        logger.info("Comparison complete. M: %d | D: %d | TC-Only: %d | SAP-Only: %d",
                    len(matched), len(differences), len(tc_only), len(sap_only))

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
        download_name=filename,
        mimetype='text/plain'
    )

@bp.route('/save-mapping', methods=['POST'])
def save_mapping():
    try:
        data = request.get_json()
        mode = data.get('mode')
        mappings = data.get('mappings', [])

        if not mappings or not isinstance(mappings, list):
            return jsonify({"error": "No valid mappings provided"}), 400

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{mode}_mapping_{timestamp}.json"
        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        os.makedirs(mapping_dir, exist_ok=True)
        
        # ✅ Check if there are already 10 files
        existing_files = [f for f in os.listdir(mapping_dir) if f.endswith('.json')]
        if len(existing_files) >= 10:
            return jsonify({"error": "Mapping limit reached. Maximum 10 mappings allowed."}), 400

        existing_files = [f for f in os.listdir(mapping_dir) if f.endswith('.json')]
        is_first_mapping = len(existing_files) == 0

        content = {
            "mode": mode,
            "mappings": mappings,
            "active": is_first_mapping,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        filepath = os.path.join(mapping_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2)

        return jsonify({"message": "Mapping saved successfully", "file": filename}), 200

    except Exception as e:
        current_app.logger.error(f"Failed to save mapping: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to save mapping"}), 500

@bp.route('/mappings', methods=['GET'])
def list_mappings():
    try:
        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        os.makedirs(mapping_dir, exist_ok=True)

        files = []
        for fname in os.listdir(mapping_dir):
            if fname.endswith('.json'):
                path = os.path.join(mapping_dir, fname)
                with open(path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                    files.append({
                        "filename": fname,
                        "created_at": content.get("created_at", "N/A"),
                        "updated_at": content.get("updated_at", "N/A"),
                        "active": content.get("active", False)
                    })

        return jsonify(files), 200
    except Exception as e:
        current_app.logger.error(f"Failed to list mappings: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to list mappings"}), 500

@bp.route('/load-mapping/<filename>', methods=['GET'])
def load_mapping_file(filename):
    try:
        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        file_path = os.path.join(mapping_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            content = json.load(f)

        return jsonify(content), 200
    except Exception as e:
        current_app.logger.error(f"Failed to load mapping: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to load mapping"}), 500

@bp.route('/mapping/<filename>', methods=['DELETE'])
def delete_mapping_file(filename):
    try:
        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        file_path = os.path.join(mapping_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        # 🔒 Prevent deleting active mapping
        with open(file_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
            if content.get('active') is True:
                return jsonify({"error": "Cannot delete active mapping"}), 400

        os.remove(file_path)
        return jsonify({"message": "Mapping deleted"}), 200

    except Exception as e:
        current_app.logger.error(f"Failed to delete mapping: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to delete mapping"}), 500

@bp.route('/mapping/status/<filename>', methods=['POST'])
def update_mapping_status(filename):
    try:
        data = request.get_json()
        new_status = data.get("status")

        if new_status is None:
            return jsonify({"error": "Missing status"}), 400

        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        file_path = os.path.join(mapping_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        if new_status is False:
            active_files = []
            for fname in os.listdir(mapping_dir):
                if fname.endswith('.json'):
                    fpath = os.path.join(mapping_dir, fname)
                    with open(fpath, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                        if content.get('active') is True:
                            active_files.append(fname)

            if len(active_files) == 1 and active_files[0] == filename:
                return jsonify({"error": "At least one mapping must be active"}), 400

            with open(file_path, 'r+', encoding='utf-8') as f:
                content = json.load(f)
                content['active'] = False
                content['updated_at'] = datetime.now().isoformat()
                f.seek(0)
                json.dump(content, f, indent=2)
                f.truncate()

        else:
            for fname in os.listdir(mapping_dir):
                if fname.endswith('.json'):
                    fpath = os.path.join(mapping_dir, fname)
                    with open(fpath, 'r+', encoding='utf-8') as f:
                        content = json.load(f)
                        new_active = (fname == filename)
                        if content.get('active') != new_active:
                            content['active'] = new_active
                            content['updated_at'] = datetime.now().isoformat()
                            f.seek(0)
                            json.dump(content, f, indent=2)
                            f.truncate()

        return jsonify({"message": "Status updated"}), 200

    except Exception as e:
        current_app.logger.error(f"Failed to update status: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to update status"}), 500

@bp.route('/rename-mapping', methods=['POST'])
def rename_mapping_file():
    try:
        data = request.get_json()
        old_name = data.get('old_name')
        new_name = data.get('new_name')

        if not old_name or not new_name:
            return jsonify({"error": "Missing filename(s)"}), 400

        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        old_path = os.path.join(mapping_dir, old_name)
        new_path = os.path.join(mapping_dir, new_name)

        if not os.path.exists(old_path):
            return jsonify({"error": "Original file not found"}), 404
        if os.path.exists(new_path):
            return jsonify({"error": "New filename already exists"}), 400

        os.rename(old_path, new_path)
        return jsonify({"message": "File renamed"}), 200

    except Exception as e:
        current_app.logger.error(f"Failed to rename file: {str(e)}", exc_info=True)
        return jsonify({"error": "Rename failed"}), 500
