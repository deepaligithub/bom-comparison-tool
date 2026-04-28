import os, sys, io, csv, json, math, logging, hashlib, subprocess
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, g, send_file
from collections import Counter, defaultdict
import pandas as pd
import xml.etree.ElementTree as ET

bp = Blueprint("api", __name__, url_prefix="/api")
NA_STR = "N/A"
RELAX_KEYS = True  # <- progressive key matching (3-of-3 -> 2-of-3 -> 1-of-3 if unambiguous)
SOURCE_BOM_LABEL = "Source BOM"
TARGET_BOM_LABEL = "Target BOM"

def _password_hash(password):
    return hashlib.sha256((password or "").encode("utf-8")).hexdigest()

def _auth_users_path():
    return os.path.join(current_app.config["UPLOAD_FOLDER"], "auth_users.json")

def _load_auth_users():
    path = _auth_users_path()
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Seed default admin (password: admin), plan: paid for full access
    default = {"admin": {"password_hash": _password_hash("admin"), "role": "admin", "plan": "paid"}}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(default, f, indent=2)
    return default

def _save_auth_users(data):
    path = _auth_users_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ----------------- plan / paid features -----------------
# Free: BOM Compare (view results), change password.
# Paid: + Export (Excel/PDF), Mapping Manager (create/edit/load mappings).
# Admin role: + Users page (unchanged by plan).
PAID_FEATURES = {"export", "mapping_manager"}


def _features_for_plan(plan, role):
    """Return dict of feature flags for a given plan and role."""
    paid = plan == "paid"
    admin = role == "admin"
    return {
        "export": paid,
        "mapping_manager": paid or admin,
        "users_page": admin,
    }


def _request_plan():
    """Plan from request (X-User-Plan header). Default 'free' if missing."""
    return (request.headers.get("X-User-Plan") or "free").strip().lower()


def _require_paid():
    """If request is from a free plan, abort with 402 and message."""
    if _request_plan() != "paid":
        return jsonify({
            "error": "This feature requires a paid plan",
            "code": "UPGRADE_REQUIRED",
        }), 402
    return None


# ----------------- helpers -----------------

def _is_blank(v):
    if v is None:
        return True
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return True
    s = str(v).strip()
    return s == "" or s.lower() in {"na", "n/a", "nan", "none"}

def _norm_print(v):
    if _is_blank(v):
        return NA_STR
    s = str(v)
    if s.endswith(".0"):
        try:
            f = float(s)
            if f.is_integer():
                return str(int(f))
        except Exception:
            pass
    return s


def _col_lookup(columns):
    """Build case-insensitive column lookup: lower(name) -> actual name (for mapper attributes)."""
    return {str(c).lower(): c for c in columns} if columns else {}


class _FileLike:
    """File-like object for _parse_file_to_rows: .filename, .read(), .seek()."""
    def __init__(self, path, filename):
        with open(path, "rb") as f:
            self._data = f.read()
        self._pos = 0
        self.filename = filename

    def read(self, size=-1):
        if size == -1:
            result = self._data[self._pos:]
            self._pos = len(self._data)
        else:
            result = self._data[self._pos : self._pos + size]
            self._pos += len(result)
        return result

    def seek(self, pos, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            self._pos = pos
        elif whence == io.SEEK_CUR:
            self._pos += pos
        else:
            self._pos = len(self._data) + pos
        return self._pos


def _get_samples_dir():
    """Return the samples directory (project root/samples or DATA_DIR/samples)."""
    if os.environ.get("DATA_DIR"):
        out = os.path.join(os.environ["DATA_DIR"], "samples")
        if os.path.isdir(out):
            return out
    # From backend/app/routes.py -> project root = parent of backend
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    candidates = [
        os.path.join(root, "samples"),
        os.path.join(os.getcwd(), "samples"),
        os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")), "samples"),
    ]
    for d in candidates:
        if os.path.isdir(d):
            return d
    return candidates[0]

def _parse_file_to_rows(file):
    """Return list[dict[str,str]]; all cell values are strings (no numeric coercion)."""
    name = (file.filename or "").lower()

    if name.endswith(".csv"):
        text = file.read().decode("utf-8-sig")
        file.seek(0)
        rows = list(csv.DictReader(io.StringIO(text)))
        return [{k: ("" if v is None else str(v)) for k, v in r.items()} for r in rows]

    if name.endswith(".xlsx") or name.endswith(".xls"):
        df = pd.read_excel(file, dtype=str, engine="openpyxl").fillna("")
        return df.to_dict(orient="records")

    if name.endswith(".json"):
        data = json.load(file)
        if isinstance(data, dict):
            data = data.get("rows", [])
        if not isinstance(data, list):
            raise ValueError("JSON must be a list of row objects or {rows:[...]}")
        return [{k: ("" if _is_blank(v) else str(v)) for k, v in r.items()} for r in data]

    if name.endswith(".plmxml"):
        try:
            tree = ET.parse(file)
            root = tree.getroot()
            ns = {"plm": root.tag.split("}")[0].strip("{")}
            rows = []
            for elem in root.findall(".//plm:ProductRevisionView", ns):
                rows.append({k: v for k, v in elem.attrib.items()})
            return rows
        except Exception as e:
            raise ValueError(f"PLMXML parsing failed: {str(e)}")

    raise ValueError(f"Unsupported file type: {name}")

def _load_active_mapping(logger):
    mapping_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "mappings")
    os.makedirs(mapping_dir, exist_ok=True)
    for fname in os.listdir(mapping_dir):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(mapping_dir, fname), "r", encoding="utf-8") as f:
            m = json.load(f)
        if m.get("active"):
            logger.info(f"[mapping] Active mapping file: {fname}")
            return m
    raise RuntimeError("No active mapping file found")

def _seed_default_mapping_presets(mapping_dir):
    """Create 5 OOTB default presets (1–5 keys) matching sample data column names (bom_a_sample_01 / bom_b_sample_01)."""
    existing = [f for f in os.listdir(mapping_dir) if f.endswith(".json")]
    if existing:
        return
    now = datetime.now().isoformat()
    # Column names must match sample CSVs: part number, material number, plant, plant code, revision, revision level, description, quantity, color
    presets = [
        {
            "fname": "Default_Single_Key_Part_Material.json",
            "keys": [{"tc": "part number", "sap": "material number", "isKey": True}],
            "active": True,
        },
        {
            "fname": "Default_2_Keys_Part_Plant.json",
            "keys": [
                {"tc": "part number", "sap": "material number", "isKey": True},
                {"tc": "plant", "sap": "plant code", "isKey": True},
            ],
            "active": False,
        },
        {
            "fname": "Default_3_Keys_Part_Plant_Revision.json",
            "keys": [
                {"tc": "part number", "sap": "material number", "isKey": True},
                {"tc": "plant", "sap": "plant code", "isKey": True},
                {"tc": "revision", "sap": "revision level", "isKey": True},
            ],
            "active": False,
        },
        {
            "fname": "Default_4_Keys.json",
            "keys": [
                {"tc": "part number", "sap": "material number", "isKey": True},
                {"tc": "plant", "sap": "plant code", "isKey": True},
                {"tc": "revision", "sap": "revision level", "isKey": True},
                {"tc": "quantity", "sap": "quantity", "isKey": True},
            ],
            "active": False,
        },
        {
            "fname": "Default_5_Keys.json",
            "keys": [
                {"tc": "part number", "sap": "material number", "isKey": True},
                {"tc": "plant", "sap": "plant code", "isKey": True},
                {"tc": "revision", "sap": "revision level", "isKey": True},
                {"tc": "quantity", "sap": "quantity", "isKey": True},
                {"tc": "color", "sap": "color", "isKey": True},
            ],
            "active": False,
        },
    ]
    # Non-key columns (avoid adding one that's already a key in this preset)
    key_tc_set = lambda klist: {m["tc"] for m in klist}
    non_key_all = [
        {"tc": "description", "sap": "description", "isKey": False},
        {"tc": "quantity", "sap": "quantity", "isKey": False},
        {"tc": "uom", "sap": "base unit", "isKey": False},
        {"tc": "color", "sap": "color", "isKey": False},
    ]
    for p in presets:
        used = key_tc_set(p["keys"])
        non_key = [m for m in non_key_all if m["tc"] not in used]
        content = {
            "mode": "preset",
            "mappings": p["keys"] + non_key,
            "active": p["active"],
            "created_at": now,
            "updated_at": now,
        }
        path = os.path.join(mapping_dir, p["fname"])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2)
    current_app.logger.info("Seeded 5 OOTB default presets (1–5 keys)")

def _pair_to_cols(pairs):
    cols = []
    for m in pairs:
        cols.append(f"BOM_A_{m['tc']}")
        cols.append(f"BOM_B_{m['sap']}")
    return cols

def _norm_cmp(v):
    """Side-agnostic normalization for comparisons:
       - blanks (None, '', NA, NaN, 'N/A in TC/SAP') -> 'N/A'
       - '5.0' -> '5'
       - everything else -> stripped string
    """
    if v is None:
        return "N/A"
    s = str(v).strip()
    if s.lower() in {"", "na", "n/a", "nan", "none", "n/a in tc", "n/a in sap"}:
        return "N/A"
    if s.lower().startswith("n/a in "):
        return "N/A"
    # collapse 5.0 -> 5
    if s.endswith(".0"):
        try:
            f = float(s)
            if f.is_integer():
                return str(int(f))
        except Exception:
            pass
    return s

# ----------------- route -----------------

@bp.route("/health", methods=["GET"])
def health():
    """Simple health check for load balancers or monitoring. Returns 200."""
    return jsonify({"status": "ok"}), 200


@bp.route("/info", methods=["GET"])
def app_info():
    """Return app info including data directory path (where uploads, logs, samples live)."""
    data_dir = os.environ.get("DATA_DIR", "")
    return jsonify({"dataDir": data_dir})


@bp.route("/admin/free-port", methods=["POST"])
def free_port():
    """Admin only: kill process(es) using the given port (Windows). Use to free 5000/5001 if stuck."""
    role = (request.headers.get("X-User-Role") or "user").strip().lower()
    if role != "admin":
        return jsonify({"error": "Admin only"}), 403
    data = request.get_json(silent=True) or {}
    try:
        port = int(data.get("port") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "port must be a number"}), 400
    if port <= 0 or port >= 65536:
        return jsonify({"error": "port must be between 1 and 65535"}), 400
    if sys.platform != "win32":
        return jsonify({"error": "Free port is only supported on Windows"}), 400
    try:
        out = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        if out.returncode != 0:
            return jsonify({"error": "Could not list ports"}), 500
        pids = set()
        for line in out.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 5 and "LISTENING" in line and f":{port}" in line:
                try:
                    pids.add(int(parts[-1]))
                except ValueError:
                    pass
        if not pids:
            return jsonify({"message": f"No process listening on port {port}", "killed": 0}), 200
        killed = 0
        for pid in pids:
            try:
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/F"],
                    capture_output=True,
                    timeout=5,
                    creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
                )
                killed += 1
            except Exception:
                pass
        return jsonify({"message": f"Stopped {killed} process(es) on port {port}", "killed": killed}), 200
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Operation timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/login", methods=["POST"])
def login():
    """Validate username/password and return user with role. Default admin: admin / admin."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username:
        return jsonify({"error": "Username is required"}), 400
    users = _load_auth_users()
    user = users.get(username)
    if not user or user.get("password_hash") != _password_hash(password):
        return jsonify({"error": "Invalid username or password"}), 401
    plan = user.get("plan", "free")
    return jsonify({
        "username": username,
        "role": user.get("role", "user"),
        "plan": plan,
        "features": _features_for_plan(plan, user.get("role", "user")),
    })


@bp.route("/features", methods=["GET"])
def get_features():
    """Return feature flags for the current user (from X-User-Plan and X-User-Role)."""
    plan = _request_plan()
    role = (request.headers.get("X-User-Role") or "user").strip().lower()
    return jsonify(_features_for_plan(plan, role))


@bp.route("/auth-users/<username>/plan", methods=["PATCH", "PUT"])
def set_user_plan(username):
    """Admin only: set plan to 'free' or 'paid' for a login user."""
    role = (request.headers.get("X-User-Role") or "user").strip().lower()
    if role != "admin":
        return jsonify({"error": "Admin only"}), 403
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "").strip().lower()
    if plan not in ("free", "paid"):
        return jsonify({"error": "plan must be 'free' or 'paid'"}), 400
    users = _load_auth_users()
    if username not in users:
        return jsonify({"error": "User not found"}), 404
    users[username] = {**users[username], "plan": plan}
    _save_auth_users(users)
    return jsonify({"username": username, "plan": plan})


@bp.route("/change-password", methods=["POST"])
def change_password():
    """Change password for the given user. Requires current password."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    users = _load_auth_users()
    user = users.get(username)
    if not user or user.get("password_hash") != _password_hash(current_password):
        return jsonify({"error": "Current password is incorrect"}), 401
    users[username] = {**user, "password_hash": _password_hash(new_password)}
    _save_auth_users(users)
    return jsonify({"message": "Password updated successfully"})


@bp.route("/compare2", methods=["POST"])
def compare_bom_v2():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"compare2_{ts}.log"
    log_path = os.path.join(current_app.config["LOG_FOLDER"], log_filename)
    g.log_filename = log_filename

    logger = logging.getLogger(log_filename)
    logger.setLevel(logging.INFO)
    if logger.hasHandlers():
        logger.handlers.clear()
    fh = logging.FileHandler(log_path)
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(fh)

    try:
        tc_file = request.files.get("bom_a") or request.files.get("tc_bom") or request.files.get("tc_file")
        sap_file = request.files.get("bom_b") or request.files.get("sap_bom") or request.files.get("sap_file")
        if not tc_file or not sap_file:
            return jsonify({"message": f"Both {SOURCE_BOM_LABEL} and {TARGET_BOM_LABEL} files are required"}), 400

        # --- mapping: use inline mapping from request if provided, else active mapping file
        mapping = None
        inline = request.form.get("mappings")
        if inline:
            try:
                raw = json.loads(inline)
                pairs_inline = raw if isinstance(raw, list) else raw.get("mappings", [])
                if pairs_inline and isinstance(pairs_inline[0], dict):
                    key_count = sum(1 for m in pairs_inline if m.get("isKey"))
                    if key_count >= 1:
                        mapping = {"mappings": pairs_inline}
                        logger.info("[mapping] Using inline mapping from request (dynamic)")
            except (json.JSONDecodeError, TypeError):
                pass
        if not mapping:
            mapping = _load_active_mapping(logger)
        pairs = mapping.get("mappings", [])
        key_pairs = [m for m in pairs if m.get("isKey")]
        val_pairs = [m for m in pairs if not m.get("isKey")]
        # OOTB-like fallback: if user didn't select any key, use first pair as key so compare still runs
        if not key_pairs and pairs:
            key_pairs = [pairs[0]]
            val_pairs = pairs[1:]
            logger.info("[mapping] No key selected; using first column pair as key (OOTB fallback)")
        if not key_pairs:
            return jsonify({"message": "Mapping must define at least one column pair (or mark one as key)."}), 400

        tc_key_cols = [m["tc"] for m in key_pairs]
        sap_key_cols = [m["sap"] for m in key_pairs]
        K = len(tc_key_cols)
        pk_tc, pk_sap = tc_key_cols[0], sap_key_cols[0]
        plant_tc = tc_key_cols[1] if K > 1 else None
        plant_sap = sap_key_cols[1] if K > 1 else None
        rev_tc   = tc_key_cols[2] if K > 2 else None
        rev_sap  = sap_key_cols[2] if K > 2 else None
        logger.info(f"[mapping] {SOURCE_BOM_LABEL} keys: {tc_key_cols} | {TARGET_BOM_LABEL} keys: {sap_key_cols}")

        # --- parse uploads (strings only)
        tc_rows_raw = _parse_file_to_rows(tc_file)
        sap_rows_raw = _parse_file_to_rows(sap_file)
        logger.info(f"[read] Rows -> {SOURCE_BOM_LABEL}: {len(tc_rows_raw)} | {TARGET_BOM_LABEL}: {len(sap_rows_raw)}")

        # --- skipped columns (mapping vs actual); column names resolved case-insensitively
        tc_cols = set(tc_rows_raw[0].keys()) if tc_rows_raw else set()
        sap_cols = set(sap_rows_raw[0].keys()) if sap_rows_raw else set()
        tc_lookup = _col_lookup(tc_cols)
        sap_lookup = _col_lookup(sap_cols)
        mapped_tc_lower = {m["tc"].lower() for m in pairs}
        mapped_sap_lower = {m["sap"].lower() for m in pairs}
        tc_cols_lower = set(tc_lookup.keys())
        sap_cols_lower = set(sap_lookup.keys())
        skipped_columns = {
            "missing_in_tc": [f"BOM_A_{c}" for c in sorted(m["tc"] for m in pairs if m["tc"].lower() not in tc_cols_lower)],
            "missing_in_sap": [f"BOM_B_{c}" for c in sorted(m["sap"] for m in pairs if m["sap"].lower() not in sap_cols_lower)],
            "extra_in_tc": [f"BOM_A_{c}" for c in sorted(tc_cols) if c.lower() not in mapped_tc_lower],
            "extra_in_sap": [f"BOM_B_{c}" for c in sorted(sap_cols) if c.lower() not in mapped_sap_lower],
            "message": "Columns not in mapping were ignored. Ask admin to add these mappings to see comparison."
        }

        # --- skip rows ONLY if the FIRST key is missing (part/material); keep rows with missing plant/revision
        def _get(row, col, lookup):  # case-insensitive column lookup for mapper attributes
            if row is None:
                return ""
            actual = lookup.get(str(col).lower(), col) if lookup else col
            return str(row.get(actual, "")).strip()

        skipped_rows = []
        def keep_tc(r):
            ok = not _is_blank(_get(r, pk_tc, tc_lookup))
            if not ok:
                skipped_rows.append({"source": SOURCE_BOM_LABEL, "reason": f"Missing key field '{pk_tc}'", "row": r})
            return ok
        def keep_sap(r):
            ok = not _is_blank(_get(r, pk_sap, sap_lookup))
            if not ok:
                skipped_rows.append({"source": TARGET_BOM_LABEL, "reason": f"Missing key field '{pk_sap}'", "row": r})
            return ok

        tc_rows = [r for r in tc_rows_raw if keep_tc(r)]
        sap_rows = [r for r in sap_rows_raw if keep_sap(r)]

        # --- group by FIRST key (part/material)
        tc_by_part = defaultdict(list)
        sap_by_mat = defaultdict(list)
        for r in tc_rows: tc_by_part[_get(r, pk_tc, tc_lookup)].append(r)
        for r in sap_rows: sap_by_mat[_get(r, pk_sap, sap_lookup)].append(r)

        all_primary = sorted(set(tc_by_part) | set(sap_by_mat))
        columns = _pair_to_cols(key_pairs) + _pair_to_cols(val_pairs) + ["status"]

        def _norm_side(v, side):  # side: SOURCE_BOM_LABEL or TARGET_BOM_LABEL
            if _is_blank(v):
                return "N/A in " + side
            s = str(v)
            if s.endswith(".0"):
                try:
                    f = float(s)
                    if f.is_integer():
                        return str(int(f))
                except Exception:
                    pass
            return s

        def make_record(t, s, status):
            rec = {}
            for m in key_pairs + val_pairs:
                rec[f"BOM_A_{m['tc']}"]  = _norm_side(_get(t, m["tc"], tc_lookup), SOURCE_BOM_LABEL)
                rec[f"BOM_B_{m['sap']}"] = _norm_side(_get(s, m["sap"], sap_lookup), TARGET_BOM_LABEL)
            rec["status"] = status
            return rec

        def values_different(t, s):
            for m in val_pairs:
                tc_val = _norm_cmp(_get(t, m["tc"], tc_lookup))
                sap_val = _norm_cmp(_get(s, m["sap"], sap_lookup))
                if tc_val != sap_val:
                    return True
            return False

        matched, different, tc_only, sap_only = [], [], [], []
        duplicates_sap_msgs, duplicates_tc_msgs = [], []
        duplicates_sap_rows, duplicates_tc_rows = [], []

        # --- helper to score a TC/SAP pair within same part:
        # plant exact match = 10 pts; SAP missing plant but TC has one = 8 pts; both missing = 6
        # revision match = +2; one missing = +1; mismatch = 0
        def score_pair(t, s):
            p_t = _get(t, plant_tc, tc_lookup) if plant_tc else ""
            p_s = _get(s, plant_sap, sap_lookup) if plant_sap else ""
            r_t = _get(t, rev_tc, tc_lookup)   if rev_tc   else ""
            r_s = _get(s, rev_sap, sap_lookup)  if rev_sap  else ""

            # HARD RULE: if both plants are present and DIFFERENT, do NOT pair this TC/SAP
            if plant_tc and plant_sap and p_t and p_s and p_t != p_s:
                return -1  # disallow this pairing

            score = 0
            # plant scoring (allow pairing if one side missing)
            if plant_tc and plant_sap:
                if p_t and p_s and p_t == p_s:
                    score += 10          # exact plant match
                elif (p_t and not p_s) or (not p_t and p_s):
                    score += 8           # one side missing plant -> allowed (for PN1003-style)
                else:
                    score += 6           # both missing plant

            # revision scoring (so we still prefer exact rev if present, but allow missing)
            if rev_tc and rev_sap:
                if r_t and r_s and r_t == r_s:
                    score += 2
                elif (r_t and not r_s) or (not r_t and r_s):
                    score += 1

            return score

        for pk in all_primary:
            t_list = tc_by_part.get(pk, [])
            s_list = sap_by_mat.get(pk, [])

            # If the part exists on one side only → TC Only / SAP Only later
            # If both sides have this part, pair greedily by best score
            used_s = set()
            for t in t_list:
                best_j = -1
                best_score = -1
                for j, s in enumerate(s_list):
                    if j in used_s: 
                        continue
                    sc = score_pair(t, s)
                    if sc > best_score:
                        best_score = sc
                        best_j = j
                if best_j >= 0:
                    used_s.add(best_j)
                    s = s_list[best_j]
                    isdiff = values_different(t, s)
                    (different if isdiff else matched).append(
                        make_record(t, s, "Different" if isdiff else "Matched")
                    )
                else:
                    # no target partner found for this source row
                    if pk not in sap_by_mat:
                        tc_only.append(make_record(t, None, "TC Only"))
                    else:
                        if plant_tc and plant_sap:
                            duplicates_tc_msgs.append(
                                f'In {SOURCE_BOM_LABEL} "part number" "{_get(t, pk_tc, tc_lookup)}" with "plant" "{_get(t, plant_tc, tc_lookup)}" '
                                + (f'and "revision" "{_get(t, rev_tc, tc_lookup)}" ' if rev_tc else "")
                                + f"are skipped because no matching key was found in {TARGET_BOM_LABEL} for these keys."
                            )
                            duplicates_tc_rows.append(t)
                        else:
                            duplicates_tc_msgs.append(
                                f'Extra {SOURCE_BOM_LABEL} row for part number "{_get(t, pk_tc, tc_lookup)}" was ignored (one-to-one pairing on primary key).'
                            )
                            duplicates_tc_rows.append(t)

            # any BOM B row left unmatched?
            for j, s in enumerate(s_list):
                if j in used_s:
                    continue
                if pk not in tc_by_part:
                    sap_only.append(make_record(None, s, "SAP Only"))
                else:
                    if plant_tc and plant_sap:
                        duplicates_sap_msgs.append(
                            f'In {TARGET_BOM_LABEL} "material number" "{_get(s, pk_sap, sap_lookup)}" with "plant code" "{_get(s, plant_sap, sap_lookup)}" '
                            + (f'and "revision level" "{_get(s, rev_sap, sap_lookup)}" ' if rev_sap else "")
                            + f"are skipped because no matching key was found in {SOURCE_BOM_LABEL} for these keys."
                        )
                        duplicates_sap_rows.append(s)
                    else:
                        duplicates_sap_msgs.append(
                            f'Extra {TARGET_BOM_LABEL} row for material number "{_get(s, pk_sap, sap_lookup)}" was ignored (one-to-one pairing on primary key).'
                        )
                        duplicates_sap_rows.append(s)

        # --- ignored summary (your “Total Ignore rows” box)
        skipped_columns_count = len(skipped_columns.get("extra_in_tc", [])) + len(skipped_columns.get("extra_in_sap", []))
        duplicate_rows_count = len(duplicates_sap_msgs) + len(duplicates_tc_msgs)
        skipped_rows_count   = len(skipped_rows)

        ignored_summary = {
            "total_ignored": skipped_columns_count + duplicate_rows_count + skipped_rows_count,
            "skipped_columns": {
                "count": skipped_columns_count,
                "extra_in_tc": skipped_columns.get("extra_in_tc", []),
                "extra_in_sap": skipped_columns.get("extra_in_sap", []),
                "message": "Columns not in mapping were ignored. Ask admin to add these mappings to see comparison."
            },
            "duplicates": {
                "count": duplicate_rows_count,
                "sap_messages": duplicates_sap_msgs,
                "sap_rows": duplicates_sap_rows, 
                "tc_messages": duplicates_tc_msgs,
                "tc_rows": duplicates_tc_rows,
                "reason": "Duplicates mean the first key exists on both sides but the Plant key does not match on the other side."
            },
            "skipped_rows": {
                "count": skipped_rows_count,
                "by_source": {
                    SOURCE_BOM_LABEL: sum(1 for r in skipped_rows if r["source"] == SOURCE_BOM_LABEL),
                    TARGET_BOM_LABEL: sum(1 for r in skipped_rows if r["source"] == TARGET_BOM_LABEL),
                }
            }
        }

        logger.info(f"[done] Matched={len(matched)} Different={len(different)} TC Only={len(tc_only)} SAP Only={len(sap_only)}")
        logger.info(
            "[compare2] duplicates: sap=%d tc=%d total=%d",
            len(duplicates_sap_msgs),
            len(duplicates_tc_msgs),
            len(duplicates_sap_msgs) + len(duplicates_tc_msgs),
        )
        return jsonify({
            "columns": columns,
            "matched": matched,
            "different": different,
            "tc_only": tc_only,
            "sap_only": sap_only,
            "skipped_rows": skipped_rows,
            "invalid_rows": [],
            "skipped_columns": skipped_columns,
            "ignored_summary": ignored_summary,
            "logFilename": log_filename,
        }), 200

    except Exception as e:
        logger.exception("[error] %s", e)
        return jsonify({"message": str(e), "logFilename": log_filename}), 400


# Default mapping for demo (matches samples/bom_a_sample_01.csv and bom_b_sample_01.csv)
_DEMO_MAPPING = [
    {"tc": "part number", "sap": "material number", "isKey": True},
    {"tc": "plant", "sap": "plant code", "isKey": False},
    {"tc": "revision", "sap": "revision level", "isKey": False},
    {"tc": "description", "sap": "description", "isKey": False},
    {"tc": "quantity", "sap": "quantity", "isKey": False},
    {"tc": "uom", "sap": "base unit", "isKey": False},
    {"tc": "color", "sap": "color", "isKey": False},
]


# Demo: prefer 1000-line BOM files; fall back to small sample if not present
_DEMO_FILES = [
    ("bom_a_1000.csv", "bom_b_1000.csv"),   # 1000 lines each — shipped demo
    ("bom_a_sample_01.csv", "bom_b_sample_01.csv"),  # fallback small sample
]


@bp.route("/demo", methods=["POST"])
def run_demo():
    """Run a comparison using built-in sample files. Returns same shape as /api/compare2."""
    samples_dir = _get_samples_dir()
    path_a = path_b = None
    name_a = name_b = None
    for na, nb in _DEMO_FILES:
        pa = os.path.join(samples_dir, na)
        pb = os.path.join(samples_dir, nb)
        if os.path.isfile(pa) and os.path.isfile(pb):
            path_a, path_b = pa, pb
            name_a, name_b = na, nb
            break
    if not path_a or not path_b:
        return jsonify({
            "message": "Demo sample files not found. Ensure samples/bom_a_1000.csv and samples/bom_b_1000.csv (or bom_a_sample_01.csv, bom_b_sample_01.csv) exist."
        }), 404
    try:
        with open(path_a, "rb") as fa, open(path_b, "rb") as fb:
            content_a, content_b = fa.read(), fb.read()
    except OSError as e:
        return jsonify({"message": f"Cannot read demo files: {e}"}), 500
    client = current_app.test_client()
    rv = client.post(
        "/api/compare2",
        data={
            "bom_a": (io.BytesIO(content_a), name_a),
            "bom_b": (io.BytesIO(content_b), name_b),
            "mappings": json.dumps(_DEMO_MAPPING),
        },
    )
    from flask import Response
    return Response(rv.data, status=rv.status_code, mimetype=rv.content_type)


users_data = [
    {"id": 1, "username": "admin", "email": "admin@example.com", "role": "admin", "status": "Active"},
    {"id": 2, "username": "alice", "email": "alice@example.com", "role": "user", "status": "Active"},
    {"id": 3, "username": "bob", "email": "bob@example.com", "role": "user", "status": "Inactive"},
]

user_counter = 4

logger = logging.getLogger(__name__)

@bp.route('/', methods=['GET'])
def home():
    return "Flask API is running!"

def parse_file(file):
    filename = file.filename.lower()
    if filename.endswith('.csv'):
        return pd.read_csv(file)
    elif filename.endswith('.xlsx'):
        return pd.read_excel(file)
    elif filename.endswith('.json'):
        return pd.read_json(file)
    elif filename.endswith('.plmxml'):
        content = file.read().decode('utf-8')
        parsed = xmltodict.parse(content)
        flat_data = json.loads(json.dumps(parsed))
        return pd.json_normalize(flat_data)
    else:
        raise ValueError("Unsupported file format")


@bp.route('/compare', methods=['POST'])
def compare_bom():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_role = request.headers.get('X-User-Role', 'user')
        log_filename = f"{user_role}_session_{timestamp}.log"
        log_path = os.path.join(current_app.config['LOG_FOLDER'], log_filename)
        g.log_filename = log_filename

        logger = logging.getLogger(log_filename)
        logger.setLevel(logging.DEBUG if user_role == 'admin' else logging.INFO)

        if logger.hasHandlers():
            logger.handlers.clear()

        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
        logger.addHandler(file_handler)

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
        logger.addHandler(console_handler)

        try:
            tc_file = request.files.get('bom_a') or request.files.get('tc_bom')
            sap_file = request.files.get('bom_b') or request.files.get('sap_bom')

            logger.info("Received files — %s: %s, %s: %s", SOURCE_BOM_LABEL, tc_file, TARGET_BOM_LABEL, sap_file)

            if not tc_file or not sap_file:
                return jsonify({"error": f"Both {SOURCE_BOM_LABEL} and {TARGET_BOM_LABEL} files are required"}), 400

            def parse_file(file):
                filename = file.filename.lower()
                logger.info(f"Parsing file: {filename}")
                if filename.endswith('.csv'):
                    return pd.read_csv(file)
                elif filename.endswith('.xlsx'):
                    return pd.read_excel(file)
                elif filename.endswith('.json'):
                    return pd.read_json(file)
                elif filename.endswith('.plmxml'):
                    content = file.read().decode('utf-8')
                    parsed = xmltodict.parse(content)
                    flat_data = json.loads(json.dumps(parsed))
                    return pd.json_normalize(flat_data)
                else:
                    raise ValueError(f"Unsupported file format: {filename}")

            # Load active mapping
            mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
            active_mapping = None

            for fname in os.listdir(mapping_dir):
                if fname.endswith('.json'):
                    fpath = os.path.join(mapping_dir, fname)
                    with open(fpath, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                        if content.get("active"):
                            active_mapping = content
                            logger.info("Loaded active mapping file: %s", fname)
                            break

            if not active_mapping:
                logger.error("No active mapping file found")
                return jsonify({'error': 'No active mapping file found'}), 400

            mappings = active_mapping.get('mappings', [])
            tc_keys = [m['tc'] for m in mappings if m.get('isKey')]
            sap_keys = [m['sap'] for m in mappings if m.get('isKey')]

            logger.info("Loaded active mapping: %s", mappings)
            logger.info("Key fields — %s: %s, %s: %s", SOURCE_BOM_LABEL, tc_keys, TARGET_BOM_LABEL, sap_keys)

            # Parse files
            tc_df_raw = parse_file(tc_file)
            sap_df_raw = parse_file(sap_file)

            logger.info("Parsed rows — %s: %d, %s: %d", SOURCE_BOM_LABEL, len(tc_df_raw), TARGET_BOM_LABEL, len(sap_df_raw))

            # Case-insensitive column resolution for mapper attributes
            tc_col_lookup = _col_lookup(tc_df_raw.columns)
            sap_col_lookup = _col_lookup(sap_df_raw.columns)
            tc_keys_actual = [tc_col_lookup[k.lower()] for k in tc_keys if k.lower() in tc_col_lookup]
            sap_keys_actual = [sap_col_lookup[k.lower()] for k in sap_keys if k.lower() in sap_col_lookup]
            if len(tc_keys_actual) != len(tc_keys) or len(sap_keys_actual) != len(sap_keys):
                logger.warning("Some key columns missing in file (case-insensitive match); using resolved keys only")

            tc_df = tc_df_raw.rename(columns=lambda col: f"BOM_A_{col.strip()}")
            sap_df = sap_df_raw.rename(columns=lambda col: f"BOM_B_{col.strip()}")

            tc_df['__key__'] = tc_df_raw[tc_keys_actual].astype(str).agg('|'.join, axis=1) if tc_keys_actual else ""
            sap_df['__key__'] = sap_df_raw[sap_keys_actual].astype(str).agg('|'.join, axis=1) if sap_keys_actual else ""

            # ---- [Optional Fields Missing Detection] ----
            # Detect optional (non-key) fields missing from TC and SAP BOMs (case-insensitive)
            def detect_optional_missing(df, mappings, side, col_lookup):
                available_lower = set(col_lookup.keys())
                return [m[side] for m in mappings if m[side].lower() not in available_lower]

            missing_optional_tc = detect_optional_missing(tc_df_raw, mappings, 'tc', tc_col_lookup)
            missing_optional_sap = detect_optional_missing(sap_df_raw, mappings, 'sap', sap_col_lookup)

            # Add to missing_mappings list and log it
            missing_mappings = []

            if missing_optional_tc or missing_optional_sap:
                missing_mappings.append({
                    "tc_missing": missing_optional_tc,
                    "sap_missing": missing_optional_sap
                })
            logger.warning("Optional columns missing — %s: %s, %s: %s", SOURCE_BOM_LABEL, missing_optional_tc, TARGET_BOM_LABEL, missing_optional_sap)

            skipped_rows = []
            def extract_missing_keys(row, expected_keys, col_lookup):
                missing = []
                for k in expected_keys:
                    actual = col_lookup.get(k.lower(), k)
                    if actual not in row or str(row.get(actual, '')).strip() == '':
                        missing.append(k)
                return missing

            tc_dict = {}
            for idx, row in tc_df_raw.iterrows():
                missing_keys = extract_missing_keys(row, tc_keys, tc_col_lookup)
                if missing_keys:
                    skipped_rows.append({
                        "source": SOURCE_BOM_LABEL,
                        "reason": f"Missing or blank key fields: {missing_keys}",
                        "row": row.to_dict()
                    })
                    continue
                key = '|'.join([str(row.get(actual, '')).strip() for actual in tc_keys_actual])
                tc_dict[key] = tc_df.iloc[idx].to_dict()

            sap_dict = {}
            for idx, row in sap_df_raw.iterrows():
                missing_keys = extract_missing_keys(row, sap_keys, sap_col_lookup)
                if missing_keys:
                    skipped_rows.append({
                        "source": TARGET_BOM_LABEL,
                        "reason": f"Missing or blank key fields: {missing_keys}",
                        "row": row.to_dict()
                    })
                    continue
                key = '|'.join([str(row.get(actual, '')).strip() for actual in sap_keys_actual])
                sap_dict[key] = sap_df.iloc[idx].to_dict()

            matched, different, tc_only, sap_only = [], [], [], []
            skipped_rows = []       # Rows skipped due to missing key fields
            invalid_rows = []       # Rows with blank/invalid data in compared fields
            missing_mappings = []   # Optional fields missing in uploaded files 

            all_keys = set(tc_dict.keys()).union(set(sap_dict.keys()))
            logger.info("All available comparison fields (from both files): %s", list(set(tc_df.columns).union(sap_df.columns)))
            logger.info("Total unique keys to compare: %d", len(all_keys))

            for key in all_keys:
                tc_row = tc_dict.get(key)
                sap_row = sap_dict.get(key)

                if tc_row and sap_row:
                    row = {}
                    diff_found = False
                    all_fields = set(tc_row.keys()).union(sap_row.keys())

                    for field in all_fields:
                        tc_val = tc_row.get(field, '')
                        sap_field = field.replace("BOM_A_", "BOM_B_")
                        sap_val = sap_row.get(sap_field, '')

                        row[field] = tc_val if pd.notna(tc_val) else 'N/A'
                        row[sap_field] = sap_val if pd.notna(sap_val) else 'N/A'

                        if str(tc_val).strip() != str(sap_val).strip():
                            diff_found = True

                    row['status'] = 'Different' if diff_found else 'Matched'
                    (different if diff_found else matched).append(row)

                elif tc_row:
                    row = {**tc_row}
                    for field in list(row):
                        if field.startswith('BOM_A_'):
                            row[field.replace('BOM_A_', 'BOM_B_')] = 'N/A'
                    row['status'] = 'TC Only'
                    tc_only.append(row)

                elif sap_row:
                    row = {**sap_row}
                    for field in list(row):
                        if field.startswith('BOM_B_'):
                            row[field.replace('BOM_B_', 'BOM_A_')] = 'N/A'
                    row['status'] = 'SAP Only'
                    sap_only.append(row)

            logger.info("Comparison completed: Matched=%d, Different=%d, %s only=%d, %s only=%d",
                        len(matched), len(different), SOURCE_BOM_LABEL, len(tc_only), TARGET_BOM_LABEL, len(sap_only))
            # Log skipped rows if any
            if skipped_rows:
                logger.warning("Skipped rows during comparison:")
                for skip in skipped_rows:
                    logger.warning("Source: %s | Reason: %s | Row: %s",
                                skip["source"], skip["reason"], skip["row"])
            # Log invalid rows if any
            if invalid_rows:
                logger.warning("Invalid rows (missing values in compared fields):")
                for inv in invalid_rows:
                    logger.warning("Source: %s | Row: %s", inv.get("source", "BOTH"), inv["row"])

            # Log missing optional mappings
            if missing_mappings:
                logger.warning("Missing optional fields in mappings:")
                logger.warning("Details: %s", missing_mappings)
    
            return jsonify({
                "matched": matched,
                "different": different,
                "tc_only": tc_only,
                "sap_only": sap_only,
                "skipped_rows": skipped_rows,
                "invalid_rows": invalid_rows,
                "missing_mappings": missing_mappings,
                "logFilename": g.log_filename
            })

        except Exception as e:
            logger.error(f"Comparison failed: {str(e)}", exc_info=True)
            return jsonify({
                'error': 'Internal server error',
                'logFilename': g.get('log_filename')
            }), 500
       
from flask import request, jsonify

@bp.route('/users', methods=['GET'])
def get_users():
    return jsonify(users_data)

@bp.route('/users', methods=['POST'])
def create_user():
    global user_counter
    data = request.json
    new_user = {
        'id': user_counter,
        'username': data['username'],
        'email': data['email'],
        'role': data.get('role', 'user'),
        'status': data.get('status', 'active')
    }
    users_data.append(new_user)
    user_counter += 1
    return jsonify(new_user), 201

@bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    for user in users_data:
        if user['id'] == user_id:
            user.update({
                'username': data['username'],
                'email': data['email'],
                'role': data['role'],
                'status': data['status']
            })
            return jsonify(user)
    return jsonify({'error': 'User not found'}), 404

@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    global users_data
    users_data = [u for u in users_data if u['id'] != user_id]
    return jsonify({'success': True})

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
    err = _require_paid()
    if err is not None:
        return err
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
    
@bp.route('/update-mapping', methods=['POST'])
def update_mapping():
    err = _require_paid()
    if err is not None:
        return err
    try:
        data = request.get_json()
        old_filename = data.get('old_filename')
        new_filename = data.get('new_filename')
        mappings = data.get('mappings')

        if not old_filename or not new_filename or not mappings:
            return jsonify({'error': 'Missing required fields'}), 400

        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        old_path = os.path.join(mapping_dir, old_filename)
        new_path = os.path.join(mapping_dir, new_filename)

        if not os.path.exists(old_path):
            return jsonify({'error': 'Original file not found'}), 404

        # Load old content
        with open(old_path, 'r', encoding='utf-8') as f:
            content = json.load(f)

        # Update mappings and timestamps
        content['mappings'] = mappings
        content['updated_at'] = datetime.now().isoformat()

        # Rename if needed
        if old_filename != new_filename:
            if os.path.exists(new_path):
                return jsonify({'error': 'New filename already exists'}), 400
            os.rename(old_path, new_path)
            save_path = new_path
        else:
            save_path = old_path

        # Save updated content
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2)

        return jsonify({'message': 'Mapping updated successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Failed to update mapping: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update mapping'}), 500

@bp.route('/mappings', methods=['GET'])
def list_mappings():
    try:
        mapping_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mappings')
        os.makedirs(mapping_dir, exist_ok=True)
        _seed_default_mapping_presets(mapping_dir)

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
    err = _require_paid()
    if err is not None:
        return err
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
    err = _require_paid()
    if err is not None:
        return err
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
    err = _require_paid()
    if err is not None:
        return err
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