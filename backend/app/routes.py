import os, sys, io, csv, json, math, logging
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, g, send_file
from collections import Counter, defaultdict
import pandas as pd
import xml.etree.ElementTree as ET

bp = Blueprint("api", __name__, url_prefix="/api")
NA_STR = "N/A"
RELAX_KEYS = True  # <- progressive key matching (3-of-3 -> 2-of-3 -> 1-of-3 if unambiguous)

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

def _pair_to_cols(pairs):
    cols = []
    for m in pairs:
        cols.append(f"TC_{m['tc']}")
        cols.append(f"SAP_{m['sap']}")
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
        tc_file = request.files.get("tc_bom") or request.files.get("tc_file")
        sap_file = request.files.get("sap_bom") or request.files.get("sap_file")
        if not tc_file or not sap_file:
            return jsonify({"message": "Both Teamcenter and SAP BOM files are required"}), 400

        # --- mapping
        mapping = _load_active_mapping(logger)
        pairs = mapping.get("mappings", [])
        key_pairs = [m for m in pairs if m.get("isKey")]
        val_pairs = [m for m in pairs if not m.get("isKey")]
        if not key_pairs:
            return jsonify({"message": "Mapping must define at least one key (isKey=true)."}), 400

        tc_key_cols = [m["tc"] for m in key_pairs]
        sap_key_cols = [m["sap"] for m in key_pairs]
        K = len(tc_key_cols)
        pk_tc, pk_sap = tc_key_cols[0], sap_key_cols[0]
        plant_tc = tc_key_cols[1] if K > 1 else None
        plant_sap = sap_key_cols[1] if K > 1 else None
        rev_tc   = tc_key_cols[2] if K > 2 else None
        rev_sap  = sap_key_cols[2] if K > 2 else None
        logger.info(f"[mapping] TC keys: {tc_key_cols} | SAP keys: {sap_key_cols}")

        # --- parse uploads (strings only)
        tc_rows_raw = _parse_file_to_rows(tc_file)
        sap_rows_raw = _parse_file_to_rows(sap_file)
        logger.info(f"[read] Rows -> TC: {len(tc_rows_raw)} | SAP: {len(sap_rows_raw)}")

        # --- skipped columns (mapping vs actual)
        tc_cols = set(tc_rows_raw[0].keys()) if tc_rows_raw else set()
        sap_cols = set(sap_rows_raw[0].keys()) if sap_rows_raw else set()
        mapped_tc = {m["tc"] for m in pairs}
        mapped_sap = {m["sap"] for m in pairs}
        skipped_columns = {
            "missing_in_tc": [f"TC_{c}" for c in sorted(mapped_tc - tc_cols)],
            "missing_in_sap": [f"SAP_{c}" for c in sorted(mapped_sap - sap_cols)],
            "extra_in_tc": [f"TC_{c}" for c in sorted(tc_cols - mapped_tc)],
            "extra_in_sap": [f"SAP_{c}" for c in sorted(sap_cols - mapped_sap)],
            "message": "Columns not in mapping were ignored. Ask admin to add these mappings to see comparison."
        }

        # --- skip rows ONLY if the FIRST key is missing (part/material); keep rows with missing plant/revision
        skipped_rows = []
        def keep_tc(r): 
            ok = not _is_blank(r.get(pk_tc))
            if not ok:
                skipped_rows.append({"source": "TC", "reason": f"Missing key field '{pk_tc}'", "row": r})
            return ok
        def keep_sap(r):
            ok = not _is_blank(r.get(pk_sap))
            if not ok:
                skipped_rows.append({"source": "SAP", "reason": f"Missing key field '{pk_sap}'", "row": r})
            return ok

        tc_rows = [r for r in tc_rows_raw if keep_tc(r)]
        sap_rows = [r for r in sap_rows_raw if keep_sap(r)]

        # --- group by FIRST key (part/material)
        def _get(row, col): return "" if row is None else str(row.get(col, "")).strip()
        tc_by_part = defaultdict(list)
        sap_by_mat = defaultdict(list)
        for r in tc_rows: tc_by_part[_get(r, pk_tc)].append(r)
        for r in sap_rows: sap_by_mat[_get(r, pk_sap)].append(r)

        all_primary = sorted(set(tc_by_part) | set(sap_by_mat))
        columns = _pair_to_cols(key_pairs) + _pair_to_cols(val_pairs) + ["status"]

        def _norm_side(v, side):  # side: "TC" or "SAP"
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
                rec[f"TC_{m['tc']}"]  = _norm_side("" if t is None else t.get(m["tc"]), "TC")
                rec[f"SAP_{m['sap']}"] = _norm_side("" if s is None else s.get(m["sap"]), "SAP")
            rec["status"] = status
            return rec

        def values_different(t, s):
            for m in val_pairs:
                tc_val = _norm_cmp("" if t is None else t.get(m["tc"]))
                sap_val = _norm_cmp("" if s is None else s.get(m["sap"]))
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
            p_t = _get(t, plant_tc) if plant_tc else ""
            p_s = _get(s, plant_sap) if plant_sap else ""
            r_t = _get(t, rev_tc)   if rev_tc   else ""
            r_s = _get(s, rev_sap)  if rev_sap  else ""

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
                    # no SAP partner found for this TC row
                    if pk not in sap_by_mat:  # material not present on SAP at all
                        tc_only.append(make_record(t, None, "TC Only"))
                    else:
                        # Duplicates:
                        # - If plant keys exist → plant-level duplicate message (as before)
                        # - If NO plant key (1-key mode) → generic duplicate message
                        if plant_tc and plant_sap:
                            duplicates_tc_msgs.append(
                                f'In TC BOM "part number" "{_get(t, pk_tc)}" with "plant" "{_get(t, plant_tc)}" '
                                + (f'and "revision" "{_get(t, rev_tc)}" ' if rev_tc else "")
                                + "are skipped because no matching Plant Code was found in SAP for these keys."
                            )
                            duplicates_tc_rows.append(t)
                        else:
                            duplicates_tc_msgs.append(
                                f'Extra TC row for part number "{_get(t, pk_tc)}" was ignored (one-to-one pairing on primary key).'
                            )
                            duplicates_tc_rows.append(t)

            # any SAP row left unmatched?
            for j, s in enumerate(s_list):
                if j in used_s:
                    continue
                if pk not in tc_by_part:
                    sap_only.append(make_record(None, s, "SAP Only"))
                else:
                    # Duplicates:
                    # - If plant keys exist → plant-level duplicate message (as before)
                    # - If NO plant key (1-key mode) → generic duplicate message
                    if plant_tc and plant_sap:
                        duplicates_sap_msgs.append(
                            f'In SAP BOM "material number" "{_get(s, pk_sap)}" with "plant code" "{_get(s, plant_sap)}" '
                            + (f'and "revision level" "{_get(s, rev_sap)}" ' if rev_sap else "")
                            + "are skipped because no matching Plant was found in TC for these keys."
                        )
                        duplicates_sap_rows.append(s)
                    else:
                        duplicates_sap_msgs.append(
                            f'Extra SAP row for material number "{_get(s, pk_sap)}" was ignored (one-to-one pairing on primary key).'
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
                "message": "Columns extra_tc_col and extra_sap_col are skipped because these columns are not found in the mapping file. Ask admin to add these mappings to see comparison."
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
                    "TC": sum(1 for r in skipped_rows if r["source"] == "TC"),
                    "SAP": sum(1 for r in skipped_rows if r["source"] == "SAP"),
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
    
users_data = [
  { 'id': 1, 'username': 'deepali.k1', 'email': 'deepali.k1@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 2, 'username': 'arun.shah', 'email': 'arun.shah@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 3, 'username': 'neha.verma', 'email': 'neha.verma@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 4, 'username': 'rahul.rai', 'email': 'rahul.rai@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 5, 'username': 'priya.d', 'email': 'priya.d@example.com', 'role': 'admin', 'status': 'Inactive' },
  { 'id': 6, 'username': 'kiran.m', 'email': 'kiran.m@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 7, 'username': 'amit.k', 'email': 'amit.k@example.com', 'role': 'admin', 'status': 'Inactive' },
  { 'id': 8, 'username': 'sneha.r', 'email': 'sneha.r@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 9, 'username': 'vivek.g', 'email': 'vivek.g@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 10, 'username': 'pooja.s', 'email': 'pooja.s@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 11, 'username': 'ankit.p', 'email': 'ankit.p@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 12, 'username': 'rani.j', 'email': 'rani.j@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 13, 'username': 'nilesh.k', 'email': 'nilesh.k@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 14, 'username': 'tanya.b', 'email': 'tanya.b@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 15, 'username': 'alok.y', 'email': 'alok.y@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 16, 'username': 'manoj.k', 'email': 'manoj.k@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 17, 'username': 'geeta.v', 'email': 'geeta.v@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 18, 'username': 'meena.r', 'email': 'meena.r@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 19, 'username': 'rohit.s', 'email': 'rohit.s@example.com', 'role': 'admin', 'status': 'Inactive' },
  { 'id': 20, 'username': 'jyoti.n', 'email': 'jyoti.n@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 21, 'username': 'sachin.b', 'email': 'sachin.b@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 22, 'username': 'rekha.d', 'email': 'rekha.d@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 23, 'username': 'suresh.m', 'email': 'suresh.m@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 24, 'username': 'lata.s', 'email': 'lata.s@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 25, 'username': 'tarun.k', 'email': 'tarun.k@example.com', 'role': 'admin', 'status': 'Inactive' },
  { 'id': 26, 'username': 'shruti.p', 'email': 'shruti.p@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 27, 'username': 'vijay.r', 'email': 'vijay.r@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 28, 'username': 'kamal.n', 'email': 'kamal.n@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 29, 'username': 'nikita.t', 'email': 'nikita.t@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 30, 'username': 'yogesh.k', 'email': 'yogesh.k@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 31, 'username': 'anita.j', 'email': 'anita.j@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 32, 'username': 'parth.s', 'email': 'parth.s@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 33, 'username': 'sanjay.v', 'email': 'sanjay.v@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 34, 'username': 'seema.m', 'email': 'seema.m@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 35, 'username': 'ishan.d', 'email': 'ishan.d@example.com', 'role': 'admin', 'status': 'Inactive' },
  { 'id': 36, 'username': 'divya.r', 'email': 'divya.r@example.com', 'role': 'user', 'status': 'Active' },
  { 'id': 37, 'username': 'rakesh.t', 'email': 'rakesh.t@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 38, 'username': 'nidhi.p', 'email': 'nidhi.p@example.com', 'role': 'user', 'status': 'Inactive' },
  { 'id': 39, 'username': 'amit.j', 'email': 'amit.j@example.com', 'role': 'admin', 'status': 'Active' },
  { 'id': 40, 'username': 'sonali.k', 'email': 'sonali.k@example.com', 'role': 'user', 'status': 'Active' },
  { "id": 41, "username": "alice", "email": "alice@example.com", "role": "admin", "status": "Active" },
  { "id": 42, "username": "bob", "email": "bob@example.com", "role": "user", "status": "Active" },
  { "id": 43, "username": "carol", "email": "carol@example.com", "role": "user", "status": "Inactive" },
  { "id": 44, "username": "dave", "email": "dave@example.com", "role": "admin", "status": "Active" },
  { "id": 45, "username": "eve", "email": "eve@example.com", "role": "user", "status": "Active" },
  { "id": 46, "username": "frank", "email": "frank@example.com", "role": "user", "status": "Inactive" },
  { "id": 47, "username": "grace", "email": "grace@example.com", "role": "admin", "status": "Active" },
  { "id": 48, "username": "heidi", "email": "heidi@example.com", "role": "user", "status": "Active" },
  { "id": 49, "username": "ivan", "email": "ivan@example.com", "role": "user", "status": "Inactive" },
  { "id": 50, "username": "judy", "email": "judy@example.com", "role": "admin", "status": "Active" },
  { "id": 51, "username": "kate", "email": "kate@example.com", "role": "user", "status": "Active" },
  { "id": 52, "username": "leo", "email": "leo@example.com", "role": "user", "status": "Inactive" },
  { "id": 53, "username": "maya", "email": "maya@example.com", "role": "admin", "status": "Active" },
  { "id": 54, "username": "nick", "email": "nick@example.com", "role": "user", "status": "Active" },
  { "id": 55, "username": "olivia", "email": "olivia@example.com", "role": "user", "status": "Inactive" },
  { "id": 56, "username": "peter", "email": "peter@example.com", "role": "admin", "status": "Active" },
  { "id": 57, "username": "quinn", "email": "quinn@example.com", "role": "user", "status": "Active" },
  { "id": 58, "username": "rachel", "email": "rachel@example.com", "role": "user", "status": "Inactive" },
  { "id": 59, "username": "sam", "email": "sam@example.com", "role": "admin", "status": "Active" },
  { "id": 60, "username": "tina", "email": "tina@example.com", "role": "user", "status": "Active" },
  { "id": 61, "username": "umar", "email": "umar@example.com", "role": "user", "status": "Inactive" },
  { "id": 62, "username": "victor", "email": "victor@example.com", "role": "admin", "status": "Active" },
  { "id": 63, "username": "wendy", "email": "wendy@example.com", "role": "user", "status": "Active" },
  { "id": 64, "username": "xavier", "email": "xavier@example.com", "role": "user", "status": "Inactive" },
  { "id": 65, "username": "yasmin", "email": "yasmin@example.com", "role": "admin", "status": "Active" },
  { "id": 66, "username": "zane", "email": "zane@example.com", "role": "user", "status": "Active" },
  { "id": 67, "username": "aarav", "email": "aarav@example.com", "role": "user", "status": "Inactive" },
  { "id": 68, "username": "bella", "email": "bella@example.com", "role": "admin", "status": "Active" },
  { "id": 69, "username": "chris", "email": "chris@example.com", "role": "user", "status": "Active" },
  { "id": 70, "username": "diana", "email": "diana@example.com", "role": "user", "status": "Inactive" }
]

user_counter = 41

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
            tc_file = request.files.get('tc_bom')
            sap_file = request.files.get('sap_bom')

            logger.info("Received files — TC: %s, SAP: %s", tc_file, sap_file)

            if not tc_file or not sap_file:
                return jsonify({"error": "Both TC and SAP BOM files are required"}), 400

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
            logger.info("Key fields — TC: %s, SAP: %s", tc_keys, sap_keys)

            # Parse files
            tc_df_raw = parse_file(tc_file)
            sap_df_raw = parse_file(sap_file)

            logger.info("Parsed rows — TC: %d, SAP: %d", len(tc_df_raw), len(sap_df_raw))

            tc_df = tc_df_raw.rename(columns=lambda col: f"TC_{col.strip()}")
            sap_df = sap_df_raw.rename(columns=lambda col: f"SAP_{col.strip()}")

            tc_df['__key__'] = tc_df_raw[tc_keys].astype(str).agg('|'.join, axis=1)
            sap_df['__key__'] = sap_df_raw[sap_keys].astype(str).agg('|'.join, axis=1)
            
            # ---- [Optional Fields Missing Detection] ----
            # Detect optional (non-key) fields missing from TC and SAP BOMs
            def detect_optional_missing(df, mappings, side):
                available = set(df.columns)
                return [m[side] for m in mappings if m[side] not in available]

            missing_optional_tc = detect_optional_missing(tc_df_raw, mappings, 'tc')
            missing_optional_sap = detect_optional_missing(sap_df_raw, mappings, 'sap')

            # Add to missing_mappings list and log it
            missing_mappings = []

            if missing_optional_tc or missing_optional_sap:
                missing_mappings.append({
                    "tc_missing": missing_optional_tc,
                    "sap_missing": missing_optional_sap
                })
            logger.warning("Optional columns missing — TC: %s, SAP: %s", missing_optional_tc, missing_optional_sap)

            skipped_rows = []
            def extract_missing_keys(row, expected_keys):
                missing = []
                for k in expected_keys:
                    if k not in row or str(row[k]).strip() == '':
                        missing.append(k)
                return missing

            tc_dict = {}
            for idx, row in tc_df_raw.iterrows():
                missing_keys = extract_missing_keys(row, tc_keys)
                if missing_keys:
                    skipped_rows.append({
                        "source": "TC",
                        "reason": f"Missing or blank key fields: {missing_keys}",
                        "row": row.to_dict()
                    })
                    continue
                key = '|'.join([str(row[k]).strip() for k in tc_keys])
                tc_dict[key] = tc_df.iloc[idx].to_dict()

            sap_dict = {}
            for idx, row in sap_df_raw.iterrows():
                missing_keys = extract_missing_keys(row, sap_keys)
                if missing_keys:
                    skipped_rows.append({
                        "source": "SAP",
                        "reason": f"Missing or blank key fields: {missing_keys}",
                        "row": row.to_dict()
                    })
                    continue
                key = '|'.join([str(row[k]).strip() for k in sap_keys])
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
                        sap_field = field.replace("TC_", "SAP_")
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
                        if field.startswith('TC_'):
                            row[field.replace('TC_', 'SAP_')] = 'N/A'
                    row['status'] = 'TC Only'
                    tc_only.append(row)

                elif sap_row:
                    row = {**sap_row}
                    for field in list(row):
                        if field.startswith('SAP_'):
                            row[field.replace('SAP_', 'TC_')] = 'N/A'
                    row['status'] = 'SAP Only'
                    sap_only.append(row)

            logger.info("Comparison completed: Matched=%d, Different=%d, TC Only=%d, SAP Only=%d",
                        len(matched), len(different), len(tc_only), len(sap_only))
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
    
@bp.route('/update-mapping', methods=['POST'])
def update_mapping():
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