// BOMComparePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import apiClient from "../api/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    FaCheckCircle,   // Matched
    FaTimesCircle,   // Different / Qty Mismatch
    FaCubes,         // TC Only = only in Source BOM (first file)
    FaBoxes          // SAP Only  (FA5; good substitute for BoxesStacked)
} from 'react-icons/fa';
import { useFeatures } from "../hooks/useFeatures";
import UpgradePrompt from "../components/UpgradePrompt";
import { STATUS_DISPLAY_LABELS, SIDE_A, SIDE_B } from "../config/sideConfig";
import { appConfig } from "../config/appConfig";
import { buildDynamicMapping } from "../utils/dynamicMapping";
import { toastSuccess, toastError } from "../utils/toast";

/** Display name for a column key: "Source BOM - x" / "Target BOM - x" instead of BOM_A_ / BOM_B_ */
function columnDisplayName(colKey) {
    if (!colKey || typeof colKey !== "string") return colKey;
    if (colKey.startsWith("BOM_A_")) return `${SIDE_A.label} - ${colKey.replace(/^BOM_A_/, "")}`;
    if (colKey.startsWith("BOM_B_")) return `${SIDE_B.label} - ${colKey.replace(/^BOM_B_/, "")}`;
    return colKey;
}

/** Get column names from a BOM file (CSV, JSON, XLSX). PLMXML not supported in browser. */
function getHeadersFromFile(file) {
    return new Promise((resolve, reject) => {
        const name = (file?.name || "").toLowerCase();
        if (name.endsWith(".csv")) {
            Papa.parse(file, {
                header: true,
                preview: 1,
                complete: (res) => {
                    const row = res.data?.[0];
                    resolve(row ? Object.keys(row) : []);
                },
                error: () => resolve([]),
            });
        } else if (name.endsWith(".json")) {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    const first = Array.isArray(data) ? data[0] : data;
                    resolve(first && typeof first === "object" ? Object.keys(first) : []);
                } catch {
                    resolve([]);
                }
            };
            reader.onerror = () => resolve([]);
            reader.readAsText(file);
        } else if (name.endsWith(".xlsx")) {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const row = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
                    resolve(Array.isArray(row) ? row.map(String) : []);
                } catch {
                    resolve([]);
                }
            };
            reader.onerror = () => resolve([]);
            reader.readAsArrayBuffer(file);
        } else {
            resolve([]);
        }
    });
}

/* ===================== Ignored Popover + helpers (added) ===================== */

function RowDetailsModal({ row, columns, onClose }) {
    // local copy feedback
    const [copied, setCopied] = React.useState(false);

    const NA_RX = /^n\/a(?:\s+in\s+(tc|sap))?$/i;
    const isNA = (v) => NA_RX.test(String(v || "").trim());

    const norm = (v) => {
        const s = String(v ?? "").trim();
        const n = Number(s);
        if (s !== "" && Number.isFinite(n) && !Number.isNaN(n)) return { n, s, isNum: true };
        return { s: s.toLowerCase(), raw: s, isNum: false };
    };
    const equalish = React.useCallback((a, b) => {
        if (isNA(a) && isNA(b)) return true;
        const A = norm(a), B = norm(b);
        if (A.isNum && B.isNum) return A.n === B.n;
        return (A.s || "") === (B.s || "");
    }, []);
    // build paired columns in mapped order (BOM_A_*, BOM_B_*)
    const pairs = React.useMemo(() => {
        const out = [];
        for (let i = 0; i < columns.length - 1; i += 2) {
            const tc = columns[i];
            const sap = columns[i + 1];
            if (!tc?.startsWith("BOM_A_") || !sap?.startsWith("BOM_B_")) continue;
            const label = `${tc.replace(/^BOM_A_/, "")} / ${sap.replace(/^BOM_B_/, "")}`;
            out.push({ label, tc, sap });
        }
        return out;
    }, [columns]);

    // compute count of differences
    const diffCount = React.useMemo(() => {
        let n = 0;
        pairs.forEach(p => {
            const v1 = row[p.tc];
            const v2 = row[p.sap];
            if (!equalish(v1, v2)) n += 1;
        });
        return n;
    }, [pairs, row, equalish]);

    // chips for keys (part/material, plant/code, revision/level)
    const chip = (title, leftVal, rightVal) => (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 8px", borderRadius: 16, background: "#f5f7fb",
            border: "1px solid #e4e8f1", fontSize: 12, marginRight: 8
        }}>
            <strong style={{ color: "#4a5a7a" }}>{title}</strong>
            <span style={{ color: "#223" }}>{String(leftVal ?? "")}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: "#223" }}>{String(rightVal ?? "")}</span>
        </span>
    );

    const get = (name) => row[name] ?? "";

    const partTC = get("BOM_A_part number");
    const partSAP = get("BOM_B_material number");
    const plantTC = get("BOM_A_plant");
    const plantSAP = get("BOM_B_plant code");
    const revTC = get("BOM_A_revision");
    const revSAP = get("BOM_B_revision level");

    const status = String(row.status || "");
    const statusBg =
        status === "Matched" ? "#e8f5e9" :
            status === "Different" ? "#fff3e0" :
                status === "TC Only" ? "#e3f2fd" :
                    status === "SAP Only" ? "#fce4ec" : "#f5f5f5";
    const statusFg =
        status === "Matched" ? "#2e7d32" :
            status === "Different" ? "#ef6c00" :
                status === "TC Only" ? "#1565c0" :
                    status === "SAP Only" ? "#ad1457" : "#555";

    const copyKeys = () => {
        const pieces = [partTC || partSAP, plantTC || plantSAP, revTC || revSAP].filter(Boolean);
        const text = pieces.join(" | ") || "(no keys)";
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
            });
        }
    };

    return (
        <div
            role="dialog" aria-modal="true"
            style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "min(920px, 96vw)", maxHeight: "80vh", overflow: "auto",
                    background: "white", borderRadius: 12, padding: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                        padding: "4px 10px", borderRadius: 999, background: statusBg, color: statusFg,
                        fontWeight: 700, fontSize: 12
                    }}>
                        {STATUS_DISPLAY_LABELS[status] ?? status}{status === "Different" ? ` • ${diffCount} differences` : ""}
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button
                            onClick={copyKeys}
                            style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, background: "white", cursor: "pointer" }}
                            title={copied ? "Copied" : "Copy keys"}
                        >
                            {copied ? "✓ Copied" : "Copy keys"}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: "6px 10px", border: "1px solid #1976d2", borderRadius: 8, background: "#1976d2", color: "white", cursor: "pointer" }}
                        >
                            Close
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                    {chip("Part / Material", partTC || "—", partSAP || "—")}
                    {chip("Plant / Code", plantTC || "—", plantSAP || "—")}
                    {/*{chip("Revision / Level", revTC || "—", revSAP || "—")}*/}
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "#fafafa" }}>
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee", width: 260 }}>Field [{SIDE_A.label} / {SIDE_B.label}]</th>
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{SIDE_A.label}</th>
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>{SIDE_B.label}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pairs.map(p => {
                                const v1 = row[p.tc], v2 = row[p.sap];
                                const same = equalish(v1, v2);
                                const cellStyle = {
                                    padding: 8, borderBottom: "1px solid #f5f5f5", whiteSpace: "normal",
                                    wordBreak: "break-word", overflowWrap: "anywhere"
                                };
                                return (
                                    <tr key={p.tc}>
                                        <td style={{ padding: 8, borderBottom: "1px solid #f5f5f5", background: "#fcfdff" }}>{p.label}</td>
                                        <td style={{ ...cellStyle, background: same ? "transparent" : "rgba(255, 244, 204, 0.7)" }} title={String(v1 ?? "")}>{String(v1 ?? "")}</td>
                                        <td style={{ ...cellStyle, background: same ? "transparent" : "rgba(255, 244, 204, 0.7)" }} title={String(v2 ?? "")}>{String(v2 ?? "")}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// tiny badges/chips for the popover
function SourceBadge({ source }) {
    const bg = source === SIDE_B.label ? "#e1f5f9" : "#efe6ff";
    const fg = source === SIDE_B.label ? "#006b7e" : "#4b2bb5";
    return (
        <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: 999,
            background: bg, color: fg, fontSize: 12, fontWeight: 600
        }}>
            {source || "—"}
        </span>
    );
}

function ReasonChip({ text }) {
    return (
        <span style={{
            display: "inline-block", padding: "2px 6px", borderRadius: 8,
            background: "#eef5ff", color: "#1a56b3", fontSize: 12, marginRight: 6
        }}>
            {text}
        </span>
    );
}

// styles for ignored popover
const ig = {
    overlay: {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "8vh", zIndex: 10000
    },
    panel: {
        width: "min(1100px, 96vw)",
        maxHeight: "76vh",
        background: "white",
        borderRadius: 12,
        border: "1px solid #e8e8e8",
        boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
    },
    header: {
        display: "flex", gap: 8, alignItems: "center",
        padding: 12, borderBottom: "1px solid #eee"
    },
    search: {
        width: 220, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8
    },
    select: {
        padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8, background: "white"
    },
    btn: {
        padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, background: "white", cursor: "pointer"
    },
    btnPrimary: {
        padding: "6px 10px", border: "1px solid #1976d2", borderRadius: 8, background: "#1976d2", color: "white", cursor: "pointer"
    },
    tabsRow: { display: "flex", gap: 8, padding: "10px 12px", borderBottom: "1px solid #f0f0f0" },
    content: { padding: 12, overflow: "auto" },
    subbar: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
    selectSm: { padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6, background: "white" },

    tableWrap: { border: "1px solid #eee", borderRadius: 8, overflow: "hidden" },
    table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13 },
    th: (isAction) => ({
        textAlign: "left", padding: 8, borderBottom: "1px solid #eee", background: "#fafafa",
        position: "sticky", top: 0, cursor: isAction ? "default" : "pointer", userSelect: "none",
        width: isAction ? 120 : undefined
    }),
    thLabel: { display: "inline-block", maxWidth: "calc(100% - 20px)", verticalAlign: "middle" },
    thArrow: { marginLeft: 6, fontSize: 12, opacity: 0.6 },
    td: { padding: 8, borderBottom: "1px solid #f7f7f7", whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" },
    empty: { padding: 16, textAlign: "center", color: "#777" },
    btnSm: { padding: "4px 8px", border: "1px solid #ddd", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12 },
    pagination: { display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", marginTop: 8 }
};

function IgnoredPopover({ open, onClose, duplicates, skippedRows, skippedColumns }) {
    const overlayRef = React.useRef(null);
    const [copiedRowId, setCopiedRowId] = React.useState(null);
    const [rawRow, setRawRow] = React.useState(null);

    // Always call hooks at top level (no conditional returns before this)
    React.useEffect(() => {
        console.log("[IgnoredPopover] props.duplicates →", duplicates);
        function onEsc(e) { if (e.key === "Escape") onClose?.(); }
        function onClick(e) { if (e.target === overlayRef.current) onClose?.(); }
        if (open) {
            document.addEventListener("keydown", onEsc);
            document.addEventListener("mousedown", onClick);
        }
        return () => {
            document.removeEventListener("keydown", onEsc);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open, onClose, duplicates]);

    // ---- parse duplicate messages from backend strings into rows
    function parseDuplicateMessages(duplicates) {
        console.log("[parseDuplicateMessages] in →", duplicates);
        const items = [];
        if (!duplicates) return items;

        const reSAP = /material number"\s*"([^"]+)"(?:.*?plant code"\s*"([^"]*)")?(?:.*?revision level"\s*"([^"]*)")?/i;
        const reSAPExtra = /Extra SAP row for material number "\s*([^"]+)\s*"/i;
        const reTC = /part number"\s*"([^"]+)"(?:.*?plant"\s*"([^"]*)")?(?:.*?revision"\s*"([^"]*)")?/i;
        const reTCExtra = /Extra TC row for part number "\s*([^"]+)\s*"/i;

        const sapMsgs = duplicates?.sap_messages || [];
        const tcMsgs = duplicates?.tc_messages || [];
        const sapRows = duplicates?.sap_rows || [];
        const tcRows = duplicates?.tc_rows || [];

        const add = (source, part, plant, rev, reason, raw) => {
            items.push({
                key: `${source}|${part}|${plant}|${rev}|${items.length}`,
                source,
                part_or_material: part || "",
                plant_or_code: plant || "",
                revision_or_level: rev || "",
                reason,
                raw: raw || null
            });
        };

        const reasonFrom = (msg) => msg;

        sapMsgs.forEach((msg, i) => {
            const m = msg.match(reSAP);
            const e = msg.match(reSAPExtra);
            if (m) add(SIDE_B.label, m[1], m[2] || "", m[3] || "", reasonFrom(msg), sapRows[i] || null);
            else if (e) add(SIDE_B.label, e[1], "", "", "Extra row", sapRows[i] || null);
            else add(SIDE_B.label, "", "", "", reasonFrom(msg), sapRows[i] || null);
        });

        tcMsgs.forEach((msg, i) => {
            const m = msg.match(reTC);
            const e = msg.match(reTCExtra);
            if (m) add(SIDE_A.label, m[1], m[2] || "", m[3] || "", reasonFrom(msg), tcRows[i] || null);
            else if (e) add(SIDE_A.label, e[1], "", "", "Extra row", tcRows[i] || null);
            else add(SIDE_A.label, "", "", "", reasonFrom(msg), tcRows[i] || null);
        });

        return items;
    }

    const duplicateRows = React.useMemo(() => parseDuplicateMessages(duplicates), [duplicates]);
    React.useEffect(() => {
        console.log("[IgnoredPopover] computed duplicateRows →", duplicateRows);
    }, [duplicateRows]);

    // ---- normalize missing-keys from skipped_rows
    const missingRows = React.useMemo(() => {
        const rows = [];
        const extractMissing = (reason) => {
            const list = String(reason || "").match(/\[([^\]]+)\]/);
            const single = String(reason || "").match(/missing key field '([^']+)'/i);
            if (list) {
                return list[1]
                    .split(",")
                    .map(s => s.replace(/['"]/g, "").trim())
                    .filter(Boolean);
            }
            if (single) return [single[1].trim()];
            return ["Key missing"];
        };
        (skippedRows || []).forEach((r, idx) => {
            rows.push({
                source: r.source || "",
                key: `${r.source || "?"}|${idx}`,
                missing: extractMissing(r.reason || ""),
                part_or_material: (r.row?.["part number"] || r.row?.["material number"] || ""),
                plant_or_code: (r.row?.["plant"] || r.row?.["plant code"] || ""),
                revision_or_level: (r.row?.["revision"] || r.row?.["revision level"] || ""),
                reason: r.reason || "Missing key",
                raw: r.row || null,
            });
        });
        return rows;
    }, [skippedRows]);

    // ---- skipped columns (names only)
    const skippedColsList = React.useMemo(() => {
        const tc = skippedColumns?.extra_in_tc || [];
        const sap = skippedColumns?.extra_in_sap || [];
        return [...tc, ...sap];
    }, [skippedColumns]);

    // ---- global filters/tabs
    const [tab, setTab] = React.useState("dup");
    const [q, setQ] = React.useState("");
    const [srcFilter, setSrcFilter] = React.useState("All");

    const applyFilters = React.useCallback((rows) => {
        let out = rows || [];
        if (srcFilter !== "All") out = out.filter(r => r.source === srcFilter);
        if (q.trim()) {
            const needle = q.toLowerCase();
            out = out.filter(r =>
                String(r.part_or_material).toLowerCase().includes(needle) ||
                String(r.plant_or_code).toLowerCase().includes(needle) ||
                String(r.revision_or_level).toLowerCase().includes(needle) ||
                String(r.reason).toLowerCase().includes(needle) ||
                String(r.source).toLowerCase().includes(needle)
            );
        }
        return out;
    }, [q, srcFilter]);

    // ---- per-tab sort/pagination
    const [dupSort, setDupSort] = React.useState({ column: null, dir: null });
    const [missSort, setMissSort] = React.useState({ column: null, dir: null });

    const [dupPage, setDupPage] = React.useState(1);
    const [dupSize, setDupSize] = React.useState(5);
    const [missPage, setMissPage] = React.useState(1);
    const [missSize, setMissSize] = React.useState(5);

    const cycleSort = (stateSetter, col) => {
        stateSetter(prev => {
            if (prev.column !== col) return { column: col, dir: "asc" };
            if (prev.dir === "asc") return { column: col, dir: "desc" };
            return { column: null, dir: null };
        });
    };

    const normalize = (v) => {
        const s = (v ?? "").toString().trim().toLowerCase();
        const n = Number(s);
        if (s && Number.isFinite(n) && !Number.isNaN(n)) return { type: "num", v: n };
        return { type: "str", v: s };
    };

    const sortRows = (rows, sortState) => {
        if (!sortState.column || !sortState.dir) return rows;
        const dir = sortState.dir === "asc" ? 1 : -1;
        const col = sortState.column;
        const arr = [...rows];
        arr.sort((a, b) => {
            const A = normalize(a[col]);
            const B = normalize(b[col]);
            if (A.type === "num" && B.type === "num") return (A.v - B.v) * dir;
            return A.v.localeCompare(B.v) * dir;
        });
        return arr;
    };
    

    const paginate = (rows, page, size) => {
        const total = Math.max(1, Math.ceil(rows.length / size));
        const start = (page - 1) * size;
        return { rows: rows.slice(start, start + size), total };
    };

    // ---- actions (CSV export uses NO template literals to avoid editor coloring issues)
    const copyKeys = (r) => {
        const parts = [r.part_or_material, r.plant_or_code, r.revision_or_level].filter(Boolean);
        const text = parts.join(" | ") || "(no keys)";
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => { });
        }
    };

    const handleCopyKeys = (row) => {
        copyKeys(row);
        setCopiedRowId(row.key);
        setTimeout(() => setCopiedRowId(null), 1000); //  1s then revert
    };

    const exportCSV = (rows, filename) => {
        function csvEscape(x) {
            const s = String(x == null ? "" : x);
            return '"' + s.replace(/"/g, '""') + '"';
        }

        const headers = ["Source", "Part/Material", "Plant/Plant code", "Revision", "Reason"];
        const lines = [headers.join(",")].concat(
            (rows || []).map(r => {
                const arr = [
                    r.source,
                    r.part_or_material,
                    r.plant_or_code,
                    r.revision_or_level,
                    r.reason
                ];
                return arr.map(csvEscape).join(",");
            })
        );

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Only after hooks: guard render by `open`
    if (!open) return null;

    // ---- render helpers
    const TabBtn = ({ id, label, count }) => (
        <button
            onClick={() => setTab(id)}
            style={{
                padding: "6px 10px",
                border: tab === id ? "1px solid #1976d2" : "1px solid #ddd",
                background: tab === id ? "#1976d2" : "white",
                color: tab === id ? "white" : "inherit",
                borderRadius: 8,
                cursor: "pointer"
            }}
        >
            {label} ({count})
        </button>
    );

    const dupFiltered = applyFilters(duplicateRows);
    const missFiltered = applyFilters(missingRows);

    const dupSorted = sortRows(dupFiltered, dupSort);
    const missSorted = sortRows(missFiltered, missSort);

    const { rows: dupPageRows, total: dupTotalPages } = paginate(dupSorted, dupPage, dupSize);
    const { rows: missPageRows, total: missTotalPages } = paginate(missSorted, missPage, missSize);

    return (
        <div ref={overlayRef} style={ig.overlay}>
            <div style={ig.panel}>
                <div style={ig.header}>
                    <div style={{ fontWeight: 700 }}>Items not included in comparison</div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            style={ig.search}
                            placeholder="Search ignored…"
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setDupPage(1); setMissPage(1); }}
                        />
                        <select
                            value={srcFilter}
                            onChange={(e) => { setSrcFilter(e.target.value); setDupPage(1); setMissPage(1); }}
                            style={ig.select}
                            title="Filter by source"
                        >
                            {["All", SIDE_A.label, SIDE_B.label].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                            onClick={() => {
                                const all = [...dupFiltered, ...missFiltered];
                                exportCSV(all, "ignored_all.csv");
                            }}
                            style={ig.btn}
                            title="Export all visible ignored rows (after filters)"
                        >
                            Export all CSV
                        </button>
                        <button onClick={onClose} style={ig.btnPrimary}>Close</button>
                    </div>
                </div>

                <div style={ig.tabsRow}>
                    <TabBtn id="dup" label="Duplicates" count={dupFiltered.length} />
                    <TabBtn id="miss" label="Missing Keys" count={missFiltered.length} />
                    <TabBtn id="cols" label="Skipped Columns" count={skippedColsList.length} />
                </div>

                <div style={ig.content}>
                    {tab === "dup" && (
                        <div>
                            <div style={ig.subbar}>
                                <div>Rows per page:&nbsp;
                                    <select value={dupSize} onChange={(e) => { setDupSize(Number(e.target.value)); setDupPage(1); }} style={ig.selectSm}>
                                        {[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                    <button onClick={() => exportCSV(dupFiltered, "duplicates.csv")} style={ig.btn}>Export CSV</button>
                                </div>
                            </div>

                            <div style={ig.tableWrap}>
                                <table style={ig.table}>
                                    <thead>
                                        <tr>
                                            {["source", "part_or_material", "plant_or_code", "revision_or_level", "reason", "actions"].map(h => (
                                                <th
                                                    key={h}
                                                    style={ig.th(h === "actions")}
                                                    onClick={() => h === "actions" ? null : cycleSort(setDupSort, h)}
                                                    aria-sort={
                                                        dupSort.column === h ? (dupSort.dir === "asc" ? "ascending" : "descending") : "none"
                                                    }
                                                    title={h === "actions" ? "" : "Click to sort (none → asc → desc)"}
                                                >
                                                    <span style={ig.thLabel}>
                                                        {h === "part_or_material" ? "Part/Material"
                                                            : h === "plant_or_code" ? "Plant/Plant code"
                                                                : h === "revision_or_level" ? "Revision"
                                                                    : h.charAt(0).toUpperCase() + h.slice(1)}
                                                    </span>
                                                    {h !== "actions" && (
                                                        <span style={ig.thArrow}>
                                                            {dupSort.column === h ? (dupSort.dir === "asc" ? "▲" : "▼") : "↕"}
                                                        </span>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dupPageRows.length === 0 && (
                                            <tr><td colSpan={6} style={ig.empty}>Nothing to show</td></tr>
                                        )}
                                        {dupPageRows.map(r => (
                                            <tr key={r.key}>
                                                <td style={ig.td} title={r.source}><SourceBadge source={r.source} /></td>
                                                <td style={ig.td} title={r.part_or_material}>{r.part_or_material || "—"}</td>
                                                <td style={ig.td} title={r.plant_or_code}>{r.plant_or_code || "—"}</td>
                                                <td style={ig.td} title={r.revision_or_level}>{r.revision_or_level || "—"}</td>
                                                <td style={ig.td} title={r.reason}><ReasonChip text={r.reason} /></td>
                                                <td style={ig.td}>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button
                                                            style={iconBtn}
                                                            title="View raw details"
                                                            aria-label="View raw details"
                                                            onClick={() => setRawRow(r)}
                                                        >
                                                            <EyeIcon />
                                                        </button>
                                                        <button
                                                            style={ig.btnSm}
                                                            onClick={() => handleCopyKeys(r)}
                                                            title={copiedRowId === r.key ? "Copied" : "Copy keys"}
                                                            aria-live="polite"
                                                        >
                                                            {copiedRowId === r.key ? "✓ Copied" : "Copy"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={ig.pagination}>
                                <button style={ig.btn} disabled={dupPage <= 1} onClick={() => setDupPage(p => Math.max(1, p - 1))}>Prev</button>
                                <span>Page {dupPage} / {dupTotalPages}</span>
                                <button style={ig.btn} disabled={dupPage >= dupTotalPages} onClick={() => setDupPage(p => Math.min(dupTotalPages, p + 1))}>Next</button>
                            </div>
                        </div>
                    )}

                    {tab === "miss" && (
                        <div>
                            <div style={ig.subbar}>
                                <div>Rows per page:&nbsp;
                                    <select value={missSize} onChange={(e) => { setMissSize(Number(e.target.value)); setMissPage(1); }} style={ig.selectSm}>
                                        {[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                    <button onClick={() => exportCSV(missFiltered, "missing_keys.csv")} style={ig.btn}>Export CSV</button>
                                </div>
                            </div>

                            <div style={ig.tableWrap}>
                                <table style={ig.table}>
                                    <thead>
                                        <tr>
                                            {["source", "missing", "part_or_material", "plant_or_code", "revision_or_level", "reason", "actions"].map(h => (
                                                <th
                                                    key={h}
                                                    style={ig.th(h === "actions")}
                                                    onClick={() => h === "actions" ? null : cycleSort(setMissSort, h)}
                                                    aria-sort={
                                                        missSort.column === h ? (missSort.dir === "asc" ? "ascending" : "descending") : "none"
                                                    }
                                                    title={h === "actions" ? "" : "Click to sort (none → asc → desc)"}
                                                >
                                                    <span style={ig.thLabel}>
                                                        {h === "part_or_material" ? "Part/Material"
                                                            : h === "plant_or_code" ? "Plant/Plant code"
                                                                : h === "revision_or_level" ? "Revision"
                                                                    : h === "missing" ? "Missing field(s)"
                                                                        : h.charAt(0).toUpperCase() + h.slice(1)}
                                                    </span>
                                                    {h !== "actions" && (
                                                        <span style={ig.thArrow}>
                                                            {missSort.column === h ? (missSort.dir === "asc" ? "▲" : "▼") : "↕"}
                                                        </span>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {missPageRows.length === 0 && (
                                            <tr><td colSpan={7} style={ig.empty}>Nothing to show</td></tr>
                                        )}
                                        {missPageRows.map(r => (
                                            <tr key={r.key}>
                                                <td style={ig.td} title={r.source}><SourceBadge source={r.source} /></td>
                                                <td style={ig.td} title={(r.missing || []).join(", ")}>
                                                    {(r.missing || []).map(m => <ReasonChip key={m} text={`Missing '${m}'`} />)}
                                                </td>
                                                <td style={ig.td} title={r.part_or_material}>{r.part_or_material || "—"}</td>
                                                <td style={ig.td} title={r.plant_or_code}>{r.plant_or_code || "—"}</td>
                                                <td style={ig.td} title={r.revision_or_level}>{r.revision_or_level || "—"}</td>
                                                <td style={ig.td} title={r.reason}><ReasonChip text={r.reason} /></td>
                                                <td style={ig.td}>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        {/* Eye icon button */}
                                                        <button
                                                            style={{ ...ig.btnSm, padding: "4px 6px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                            onClick={() => setRawRow(r)}
                                                            title="View raw row"
                                                            aria-label="View raw row"
                                                        >
                                                            <EyeIcon />
                                                        </button>

                                                        {/* Copy → ✓ Copied for 1s */}
                                                        <button
                                                            style={ig.btnSm}
                                                            onClick={() => handleCopyKeys(r)}
                                                            title={copiedRowId === r.key ? "Copied" : "Copy keys"}
                                                            aria-live="polite"
                                                        >
                                                            {copiedRowId === r.key ? "✓ Copied" : "Copy"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={ig.pagination}>
                                <button style={ig.btn} disabled={missPage <= 1} onClick={() => setMissPage(p => Math.max(1, p - 1))}>Prev</button>
                                <span>Page {missPage} / {missTotalPages}</span>
                                <button style={ig.btn} disabled={missPage >= missTotalPages} onClick={() => setMissPage(p => Math.min(missTotalPages, p + 1))}>Next</button>
                            </div>
                        </div>
                    )}

                    {tab === "cols" && (
                        <div>
                            <div style={{ marginBottom: 6, fontWeight: 600 }}>Columns ignored ({skippedColsList.length})</div>
                            {skippedColsList.length === 0 ? (
                                <div style={ig.empty}>No extra columns were ignored.</div>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {skippedColsList.map(c => (
                                        <li key={c} style={{ margin: "4px 0" }}>
                                            - {columnDisplayName(c)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div
                                style={{
                                    marginTop: 10,
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    background: "#f7fbff",
                                    border: "1px solid #d9ecff",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    boxShadow: "inset 3px 0 0 0 #3b82f6"
                                }}
                            >
                                <div
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: "50%",
                                        background: "#3b82f6",
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: 700,
                                        fontSize: 10,
                                        flex: "0 0 22px",
                                        marginTop: 1
                                    }}
                                >
                                    i
                                </div>
                                <div style={{ color: "#143a63", lineHeight: 1.5 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Info</div>
                                    <div>
                                        These columns weren’t compared because they aren’t in the mapping.
                                        If you want them included, ask the admin to add them to the compare fields in the mapping.
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                    {rawRow && <RawRowModal row={rawRow} onClose={() => setRawRow(null)} />}
                </div>
            </div>
        </div>
    );
}

function RawRowModal({ row, onClose }) {
    // Prefer backend raw if present; else build a compact fallback from the entry itself
    const raw = row?.raw;
    const fallbackKV = !raw ? (() => {
        const kv = {};
        if (row?.source) kv["Source"] = row.source;
        if (Array.isArray(row?.missing) && row.missing.length) kv["Missing key field(s)"] = row.missing.join(", ");
        if (row?.part_or_material) kv["Part/Material"] = row.part_or_material;
        if (row?.plant_or_code) kv["Plant/Plant code"] = row.plant_or_code;
        if (row?.revision_or_level) kv["Revision"] = row.revision_or_level;
        if (row?.reason) kv["Reason"] = row.reason;
        return kv;
    })() : null;

    const kvObj = raw || fallbackKV; // choose what to render

    return (
        <div
            role="dialog" aria-modal="true"
            style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10001,
                display: "flex", alignItems: "center", justifyContent: "center"
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "min(720px, 95vw)", maxHeight: "70vh", overflow: "auto", background: "white",
                    borderRadius: 10, padding: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Raw Row</h3>
                    <div style={{ marginLeft: "auto" }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: "6px 10px", border: "1px solid #1976d2", borderRadius: 8,
                                background: "#1976d2", color: "white", cursor: "pointer"
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>

                {kvObj ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13 }}>
                        <tbody>
                            {Object.keys(kvObj).map((k) => (
                                <tr key={k}>
                                    <td style={{ width: "35%", padding: 6, borderBottom: "1px solid #eee", background: "#fafafa" }}>{k}</td>
                                    <td style={{ padding: 6, borderBottom: "1px solid #eee", whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                        {String(kvObj[k] ?? "")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div style={{ color: "#666" }}>
                        No raw row payload was provided by the server for this ignored entry.
                    </div>
                )}
            </div>
        </div>
    );
}

/* ===================== End Ignored Popover + helpers ===================== */

const PAGE_SIZES = [10, 25, 50, 100, 250];
const NA = "N/A";

export default function BOMComparePage() {
    const { canExport } = useFeatures();
    const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);

    // file inputs
    const tcRef = useRef(null);
    const sapRef = useRef(null);
    /** Scroll target so results are visible after compare completes */
    const resultsRef = useRef(null);
    /** Ref for keyboard shortcut so handler always sees latest state */
    const compareStateRef = useRef({ tcFile: null, sapFile: null, loading: false, onCompare: null });

    // uploads
    const [tcFile, setTcFile] = useState(null);
    const [sapFile, setSapFile] = useState(null);

    /** When true, do not send inline mapping; backend uses the active saved mapping (preset) from Mapping Manager. */
    const [useSavedMappingPreset, setUseSavedMappingPreset] = useState(false);
    /** Name of the active mapping preset (when "Use saved preset" is on); from GET /api/mappings. */
    const [activePresetName, setActivePresetName] = useState(null);

    // api/ui state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // table state
    const [columns, setColumns] = useState([]);         // ordered list from server (mapping-driven; includes "status" last)
    const [visibleCols, setVisibleCols] = useState({}); // { [columnName]: boolean }
    const [rows, setRows] = useState([]);               // flattened: matched + different + tc_only + sap_only

    // diagnostics
    const [skippedRows, setSkippedRows] = useState([]);         // missing keys / leftovers
    const [skippedColumns, setSkippedColumns] = useState(null); // {missing_in_tc, missing_in_sap, extra_in_tc, extra_in_sap}
    const [ignoredSummary, setIgnoredSummary] = useState(null); // { total_ignored, skipped_columns, duplicates, skipped_rows }
    const [logFilename, setLogFilename] = useState("");

    // table UX controls
    const [statusFilter, setStatusFilter] = useState("All"); // All | Matched | Different | TC Only | SAP Only
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    // modal
    const [detailRow, setDetailRow] = useState(null);

    // derived
    const dataColumns = useMemo(() => columns.filter((c) => c !== "status"), [columns]);

    // counts for total rows, skipped, invalid, etc.
    const [counts, setCounts] = useState(null);

    // Column popover styles
    const [colsOpen, setColsOpen] = useState(false);
    const colsBtnRef = useRef(null);

    // sort state: column = string | null, dir = 'asc' | 'desc' | null
    const [sort, setSort] = useState({ column: null, dir: null });

    // show ignored row count from what backend already returns
    const [ignoredOpen, setIgnoredOpen] = useState(false);
    const ignoredBtnRef = useRef(null);

    /** 'csv' | 'pdf' when export is in progress; shows "Preparing…" on the button */
    const [exportInProgress, setExportInProgress] = useState(null);

    // Accepted file types + size cap
    const tcAcceptedTypes = ['.csv', '.xlsx', '.json', '.plmxml'];
    const sapAcceptedTypes = ['.csv', '.xlsx', '.json'];
    const maxSizeMB = 50;
    const MAX_BYTES = maxSizeMB * 1024 * 1024;
    const ICON = { ok: '✓', bad: '✕', info: 'ℹ' };
    const ext = (name = "") => {
        const i = name.lastIndexOf(".");
        return i >= 0 ? name.slice(i).toLowerCase() : "";
    };
    const [tcStatus, setTcStatus] = useState({ ok: false, msg: "" });
    const [sapStatus, setSapStatus] = useState({ ok: false, msg: "" });

    // When "Use saved preset" is on, fetch active mapping name for display
    useEffect(() => {
        if (!useSavedMappingPreset) {
            setActivePresetName(null);
            return;
        }
        let cancelled = false;
        apiClient.get("/api/mappings")
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res.data) ? res.data : [];
                const active = list.find((m) => m.active);
                setActivePresetName(active ? active.filename : null);
            })
            .catch(() => {
                if (!cancelled) setActivePresetName(null);
            });
        return () => { cancelled = true; };
    }, [useSavedMappingPreset]);

    // Ctrl+Enter to run compare when both files are selected
    useEffect(() => {
        const handler = (e) => {
            if (e.key !== "Enter" || !e.ctrlKey) return;
            if (e.target.closest("input, textarea, select, [contenteditable=\"true\"]")) return;
            const { tcFile: f1, sapFile: f2, loading: ld, onCompare: run } = compareStateRef.current;
            if (f1 && f2 && !ld && typeof run === "function") run();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    function validateFile(file, accepted) {
        if (!file) return { ok: false, msg: "" };
        const e = ext(file.name);
        if (!accepted.includes(e)) return { ok: false, msg: `Unsupported type: ${e || '(none)'}` };
        if (file.size > MAX_BYTES) return { ok: false, msg: `File too large. Max ${maxSizeMB}MB` };
        return { ok: true, msg: file.name };
    }
    // file selection handlers
    function onTcSelect(e) {
        const f = e.target.files?.[0] || null;
        const v = validateFile(f, tcAcceptedTypes);
        if (!v.ok) {
            setTcFile(null);
            setTcStatus(v);
            if (tcRef.current) tcRef.current.value = "";
            return;
        }
        setTcFile(f);
        setTcStatus({ ok: true, msg: f.name });
    }

    function onSapSelect(e) {
        const f = e.target.files?.[0] || null;
        const v = validateFile(f, sapAcceptedTypes);
        if (!v.ok) {
            setSapFile(null);
            setSapStatus(v);
            if (sapRef.current) sapRef.current.value = "";
            return;
        }
        setSapFile(f);
        setSapStatus({ ok: true, msg: f.name });
    }

    // reset all state to initial
    function resetAll() {
        setTcFile(null);
        setSapFile(null);
        if (tcRef.current) tcRef.current.value = "";
        if (sapRef.current) sapRef.current.value = "";
        setTcStatus({ ok: false, msg: "" });
        setSapStatus({ ok: false, msg: "" });

        setLoading(false);
        setError("");

        setColumns([]);
        setVisibleCols({});
        setRows([]);

        setSkippedRows([]);
        setSkippedColumns(null);
        setIgnoredSummary(null);
        setLogFilename("");

        setStatusFilter("All");
        setSearch("");
        setPageSize(10);
        setPage(1);

        setDetailRow(null);
        setCounts(null);
    }

    function sanitizeCell(v) {
        if (v === null || v === undefined) return NA;
        if (typeof v === "number" && (!isFinite(v) || isNaN(v))) return NA;
        const s = String(v);
        return s.endsWith(".0") ? String(parseFloat(s)) : s;
    }

    //highlight search matches in a cell
    const HIGHLIGHT_STYLE = {
        background: "rgba(255, 234, 0, 0.8)",
        borderRadius: 2,
        padding: "0 1px",
    };

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function highlightText(value, term) {
        const text = sanitizeCell(value);
        if (!term || !term.trim()) return text;

        const safe = escapeRegExp(term.trim());
        try {
            const re = new RegExp("(" + safe + ")", "ig");
            const parts = String(text).split(re);
            return parts.map((part, i) =>
                part.toLowerCase() === term.toLowerCase()
                    ? <mark key={i} style={HIGHLIGHT_STYLE}>{part}</mark>
                    : <React.Fragment key={i}>{part}</React.Fragment>
            );
        } catch {
            return text;
        }
    }

    function cycleSort(col) {
        setSort((prev) => {
            if (prev.column !== col) return { column: col, dir: "asc" };
            if (prev.dir === "asc") return { column: col, dir: "desc" };
            return { column: null, dir: null }; // none
        });
        setPage(1);
    }

    function sortArrow(col) {
        if (sort.column === col) {
            if (sort.dir === "asc") return "▲";
            if (sort.dir === "desc") return "▼";
        }
        return "↕"; // unsorted hint
    }

    // normalize for sorting: numbers as numbers; empties/N/A last
    function normalizeForSort(v) {
        if (v === null || v === undefined) return { empty: true, val: "" };
        const s = String(v).trim();
        if (!s || /^n\/a(?:\s+in\s+(tc|sap))?$/i.test(s)) return { empty: true, val: "" };
        const n = Number(s);
        if (!Number.isNaN(n) && Number.isFinite(n)) return { empty: false, val: n, num: true };
        return { empty: false, val: s.toLowerCase(), num: false };
    }

    // Apply compare API response to state (shared by onCompare and onDemo)
    function applyCompareResponse(data) {
        const colsFromServer = Array.isArray(data.columns) ? data.columns.map(String) : [];
        const dataCols = colsFromServer.filter((c) => c !== "status");
        setColumns(colsFromServer);
        const vis = {};
        dataCols.forEach((c) => (vis[c] = true));
        setVisibleCols(vis);
        const buckets = [
            ...(data.matched || []),
            ...(data.different || []),
            ...(data.tc_only || []),
            ...(data.sap_only || []),
        ];
        const normalized = buckets.map((r) => {
            const out = {};
            for (const c of dataCols) {
                out[c] = sanitizeCell(Object.prototype.hasOwnProperty.call(r, c) ? r[c] : NA);
            }
            out.status = sanitizeCell(r.status || "Unknown");
            return out;
        });
        setRows(normalized);
        setPage(1);
        setSkippedRows(data.skipped_rows || []);
        setSkippedColumns(data.skipped_columns || null);
        setIgnoredSummary(data.ignored_summary || null);
        setLogFilename(data.logFilename || "");
        const summary = {
            matched: (data.matched || []).length,
            different: (data.different || []).length,
            tc_only: (data.tc_only || []).length,
            sap_only: (data.sap_only || []).length,
            total:
                (data.matched || []).length +
                (data.different || []).length +
                (data.tc_only || []).length +
                (data.sap_only || []).length,
        };
        setCounts(summary);
        try {
            localStorage.setItem("bom_last_compare", JSON.stringify({ at: new Date().toISOString(), summary }));
        } catch (_) { /* ignore */ }
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }

    // ----------------------------------------------------
    // Demo: run compare with built-in sample files (no upload)
    // ----------------------------------------------------
    async function onDemo() {
        try {
            setError("");
            setLoading(true);
            const { data } = await apiClient.post("/api/demo");
            applyCompareResponse(data);
            toastSuccess("Demo complete");
        } catch (e) {
            console.error("[UI] demo failed:", e);
            const msg = e?.response?.data?.message || e?.response?.data?.error || e.message || "Demo failed.";
            setError(msg);
            toastError(msg);
        } finally {
            setLoading(false);
        }
    }

    // ----------------------------------------------------
    // Compare (POST /api/compare2 with tc_bom & sap_bom)
    // ----------------------------------------------------
    async function onCompare() {
        try {
            setError("");
            if (!tcFile || !sapFile) {
                setError(`Please upload both ${SIDE_A.label} and ${SIDE_B.label} files.`);
                return;
            }
            setLoading(true);

            const fd = new FormData();
            fd.append("bom_a", tcFile);
            fd.append("bom_b", sapFile);

            if (useSavedMappingPreset) {
                // Backend will load active mapping from disk
            } else {
                let mappingsToSend = null;
                try {
                    const listRes = await apiClient.get("/api/mappings");
                    const list = Array.isArray(listRes.data) ? listRes.data : [];
                    const active = list.find((m) => m.active);
                    if (active?.filename) {
                        const loadRes = await apiClient.get(`/api/load-mapping/${encodeURIComponent(active.filename)}`);
                        const content = loadRes.data;
                        const mappings = content?.mappings;
                        if (Array.isArray(mappings) && mappings.length > 0) mappingsToSend = mappings;
                    }
                } catch (_) { /* ignore */ }
                if (!mappingsToSend) {
                    const colsA = await getHeadersFromFile(tcFile);
                    const colsB = await getHeadersFromFile(sapFile);
                    mappingsToSend = buildDynamicMapping(colsA, colsB);
                }
                if (mappingsToSend?.length) fd.append("mappings", JSON.stringify(mappingsToSend));
            }

            const { data } = await apiClient.post("/api/compare2", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            applyCompareResponse(data);
            toastSuccess("Comparison complete");
        } catch (e) {
            console.error("[UI] compare2 failed:", e);
            const isNetworkError = !e.response && (e.message === "Network Error" || e.code === "ERR_NETWORK");
            const msg = e?.response?.data?.message || e?.response?.data?.error || e.message || "Validation failed";
            const isNoActiveMapping = useSavedMappingPreset && /no active mapping|active mapping file found/i.test(String(msg));
            const displayMsg = isNetworkError ? "Check your connection and try again." : isNoActiveMapping
                ? "No saved mapping preset is active. Create one in Mapping Manager and set it as active, or turn off \"Use saved mapping preset\"."
                : msg;
            setError(displayMsg);
            toastError(displayMsg);
        } finally {
            setLoading(false);
        }
    }

    // Keep ref updated for Ctrl+Enter shortcut
    useEffect(() => {
        compareStateRef.current = { tcFile, sapFile, loading, onCompare };
    });

    // derive ignored count
    const ignoredCount = useMemo(() => {
        const dup =
            (ignoredSummary?.duplicates?.count ??
                ((ignoredSummary?.duplicates?.sap_messages?.length || 0) +
                    (ignoredSummary?.duplicates?.tc_messages?.length || 0))) || 0;
        const skRows = (skippedRows || []).length;
        const skCols =
            (skippedColumns?.extra_in_tc?.length || 0) +
            (skippedColumns?.extra_in_sap?.length || 0);
        return dup + skRows + skCols;
    }, [ignoredSummary, skippedRows, skippedColumns]);

    // filtering (visible+hidden), search, pagination
    const filteredRows = useMemo(() => {
        let r = rows;
        if (statusFilter !== "All") {
            r = r.filter((x) => x.status === statusFilter);
        }
        if (search.trim()) {
            const needle = search.toLowerCase();
            r = r.filter((row) =>
                dataColumns.some((c) => String(row[c]).toLowerCase().includes(needle))
            );
        }
        return r;
    }, [rows, statusFilter, search, dataColumns]);

    const sortedRows = useMemo(() => {
        if (!sort.column || !sort.dir) return filteredRows;
        const col = sort.column;
        const dir = sort.dir === "asc" ? 1 : -1;
        const arr = [...filteredRows];

        arr.sort((a, b) => {
            const A = normalizeForSort(a[col]);
            const B = normalizeForSort(b[col]);
            const dirMul = dir; // dir is 1 or -1

            if (A.empty && B.empty) return 0;
            if (A.empty) return 1 * dirMul;
            if (B.empty) return -1 * dirMul;
            if (A.num && B.num) return (A.val - B.val) * dirMul;
            return String(A.val).localeCompare(String(B.val), undefined, { numeric: true, sensitivity: "base" }) * dirMul;
        });
        return arr;
    }, [filteredRows, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const pageRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedRows.slice(start, start + pageSize);
    }, [sortedRows, page, pageSize]);

    function exportPdf() {
        if (!rows.length) return;
        setExportInProgress("pdf");
        try {
            const doc = new jsPDF({ orientation: "landscape" });
            const visible = dataColumns.filter((c) => visibleCols[c]);
            const head = [[...visible, "status"]];
            const body = filteredRows.map((r) => [...visible.map((c) => sanitizeCell(r[c])), sanitizeCell(STATUS_DISPLAY_LABELS[r.status] ?? r.status)]);
            doc.text("BOM Validatiion Report", 14, 12);
            autoTable(doc, { head, body, startY: 16, styles: { fontSize: 6 } });
            doc.save("bom-validation-report.pdf");
            toastSuccess("PDF downloaded");
        } finally {
            setTimeout(() => setExportInProgress(null), 200);
        }
    }

    async function downloadLog() {
        try {
            if (!logFilename) return;
            const res = await apiClient.get(`/api/download-log/${encodeURIComponent(logFilename)}`, {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = logFilename;
            document.body.appendChild(a);   // Safari/iOS robustness
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error("[UI] download log failed:", e);
        }
    }
    function exportCsvMain() {
        if (!rows.length) return;
        setExportInProgress("csv");
        try {
            const visible = dataColumns.filter((c) => visibleCols[c]);

            function csvEscape(x) {
                const s = String(x == null ? "" : x);
                return '"' + s.replace(/"/g, '""') + '"';
            }

            const headerLabels = [...visible.map((c) => columnDisplayName(c)), "Status"];
            const lines = [headerLabels.map((h) => (h.includes(",") ? `"${h}"` : h)).join(",")];

            for (const r of filteredRows) {
                const row = [
                    ...visible.map((c) => csvEscape(r[c])),
                    csvEscape(STATUS_DISPLAY_LABELS[r.status] ?? r.status),
                ];
                lines.push(row.join(","));
            }

            const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "bom-validation-report.csv";
            a.click();
            URL.revokeObjectURL(url);
            toastSuccess("CSV downloaded");
        } finally {
            setTimeout(() => setExportInProgress(null), 200);
        }
    }

    function ColumnsPopover({
        open,
        anchorRef,
        onClose,
        dataColumns,
        visibleCols,
        setVisibleCols,
        skippedRows,
    }) {
        const popRef = React.useRef(null);
        React.useEffect(() => {
            function handleClick(e) {
                if (!open) return;
                if (popRef.current && !popRef.current.contains(e.target) &&
                    anchorRef.current && !anchorRef.current.contains(e.target)) {
                    onClose?.();
                }
            }
            function handleEsc(e) { if (e.key === "Escape") onClose?.(); }
            document.addEventListener("mousedown", handleClick);
            document.addEventListener("keydown", handleEsc);
            return () => {
                document.removeEventListener("mousedown", handleClick);
                document.removeEventListener("keydown", handleEsc);
            };
        }, [open, onClose, anchorRef]);

        const pairs = React.useMemo(() => {
            const cols = dataColumns;
            const out = [];
            for (let i = 0; i < cols.length; i += 2) {
                const tc = cols[i];
                const sap = cols[i + 1];
                if (!tc || !sap) break;
                if (!tc.startsWith("BOM_A_") || !sap.startsWith("BOM_B_")) continue;
                out.push({ tc, sap });
            }
            return out;
        }, [dataColumns]);
        const keyPairSet = React.useMemo(() => {
            // Only treat part/material + plant/code as keys.
            const isLikelyKey = (base) => {
                const b = base.toLowerCase();
                return (
                    b.includes("part number") ||
                    b.includes("material number") ||
                    b === "plant" || b.includes("plant code")
                );
            };

            const set = new Set();
            pairs.forEach(p => {
                const baseTc = p.tc.replace(/^BOM_A_/, "");
                const baseSap = p.sap.replace(/^BOM_B_/, "");
                if (isLikelyKey(baseTc) || isLikelyKey(baseSap)) {
                    set.add(p.tc + "||" + p.sap);
                }
            });
            return set;
        }, [pairs]);

        const activePreset = React.useMemo(() => {
            const allOn = pairs.every(p => !!visibleCols[p.tc] && !!visibleCols[p.sap]);
            const noneOn = pairs.every(p => !visibleCols[p.tc] && !visibleCols[p.sap]);
            const keysOn = pairs.every(p => {
                const isKey = keyPairSet.has(p.tc + "||" + p.sap);
                return isKey ? (!!visibleCols[p.tc] && !!visibleCols[p.sap]) : (!visibleCols[p.tc] && !visibleCols[p.sap]);
            });
            const nonKeysOn = pairs.every(p => {
                const isKey = keyPairSet.has(p.tc + "||" + p.sap);
                return isKey ? (!visibleCols[p.tc] && !visibleCols[p.sap]) : (!!visibleCols[p.tc] && !!visibleCols[p.sap]);
            });

            if (allOn) return "all";
            if (keysOn) return "keys";
            if (nonKeysOn) return "nonkeys";
            if (noneOn) return "clear";
            return "custom";
        }, [pairs, visibleCols, keyPairSet]);

        const [filter, setFilter] = React.useState("");

        const filteredPairs = React.useMemo(() => {
            if (!filter.trim()) return pairs;
            const needle = filter.toLowerCase();
            return pairs.filter(p =>
                p.tc.toLowerCase().includes(needle) || p.sap.toLowerCase().includes(needle)
            );
        }, [pairs, filter]);

        const selectedCount = React.useMemo(
            () => dataColumns.reduce((n, c) => n + (visibleCols[c] ? 1 : 0), 0),
            [dataColumns, visibleCols]
        );

        const setPair = (p, checked) => {
            setVisibleCols(prev => ({
                ...prev,
                [p.tc]: checked,
                [p.sap]: checked,
            }));
        };

        const isPinned = (p) => keyPairSet.has(p.tc + "||" + p.sap);

        const selectAll = () => {
            setVisibleCols(prev => {
                const next = { ...prev };
                pairs.forEach(p => { next[p.tc] = true; next[p.sap] = true; });
                return next;
            });
        };

        const clearAll = () => {
            setVisibleCols(prev => {
                const next = { ...prev };
                pairs.forEach(p => { next[p.tc] = false; next[p.sap] = false; });
                return next;
            });
        };

        const showKeysOnly = () => {
            setVisibleCols(prev => {
                const next = { ...prev };
                pairs.forEach(p => {
                    const isKey = isPinned(p);
                    next[p.tc] = isKey;
                    next[p.sap] = isKey;
                });
                return next;
            });
        };

        const showNonKeys = () => {
            setVisibleCols(prev => {
                const next = { ...prev };
                pairs.forEach(p => {
                    const isKey = isPinned(p);
                    next[p.tc] = !isKey;
                    next[p.sap] = !isKey;
                });
                return next;
            });
        };

        if (!open) return null;

        return (
            <div ref={popRef} style={colPop.wrap}>
                <div style={colPop.header}>
                    <input
                        style={colPop.search}
                        placeholder="Filter columns..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        autoFocus
                    />
                    <div style={colPop.presetRow}>
                        <button
                            style={{ ...colPop.presetBtn, ...(activePreset === "all" ? colPop.presetBtnActive : {}) }}
                            onClick={selectAll}
                        >
                            Show All
                        </button>
                        <button
                            style={{ ...colPop.presetBtn, ...(activePreset === "keys" ? colPop.presetBtnActive : {}) }}
                            onClick={showKeysOnly}
                        >
                            Keys Only
                        </button>
                        <button
                            style={{ ...colPop.presetBtn, ...(activePreset === "nonkeys" ? colPop.presetBtnActive : {}) }}
                            onClick={showNonKeys}
                        >
                            Non-keys
                        </button>
                        <button
                            style={{ ...colPop.presetBtn, ...(activePreset === "clear" ? colPop.presetBtnActive : {}) }}
                            onClick={clearAll}
                        >
                            Clear
                        </button>
                    </div>

                </div>

                <div style={colPop.list}>
                    <div style={colPop.groupTitle}>{SIDE_A.label} | {SIDE_B.label} pairs</div>
                    {filteredPairs.map((p) => {
                        const pinned = isPinned(p);
                        return (
                            <div key={p.tc} style={colPop.row}>
                                <div style={colPop.pinCell} title="Key pair from mapping file"> {pinned ? "📌" : ""} </div>
                                <label style={colPop.label}>
                                    <input
                                        type="checkbox"
                                        checked={!!visibleCols[p.tc]}
                                        onChange={(e) => setVisibleCols(prev => ({ ...prev, [p.tc]: e.target.checked }))}
                                    />
                                    <span style={colPop.name}>{columnDisplayName(p.tc)}</span>
                                </label>
                                <label style={colPop.label}>
                                    <input
                                        type="checkbox"
                                        checked={!!visibleCols[p.sap]}
                                        onChange={(e) => setVisibleCols(prev => ({ ...prev, [p.sap]: e.target.checked }))}
                                    />
                                    <span style={colPop.name}>{columnDisplayName(p.sap)}</span>
                                </label>
                                {!pinned && (
                                    <button
                                        title="Toggle both"
                                        style={colPop.togglePair}
                                        onClick={() => setPair(p, !(visibleCols[p.tc] && visibleCols[p.sap]))}
                                    >
                                        ↔
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {filteredPairs.length === 0 && (
                        <div style={colPop.empty}>No columns match your filter.</div>
                    )}
                </div>

                <div style={colPop.footer}>
                    <div>{selectedCount} selected</div>
                    <div style={{ marginLeft: "auto" }}>
                        <button style={colPop.footerBtn} onClick={onClose}>Close</button>
                    </div>
                </div>

            </div>
        );
    }

    /* styles for the popover */
    const colPop = {
        wrap: {
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: 560,
            maxWidth: "92vw",
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            background: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            zIndex: 10000,
        },
        header: { padding: 10, borderBottom: "1px solid #eee" },
        search: {
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 8,
        },
        presetRow: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },
        presetBtn: {
            padding: "6px 10px",
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#f8f8f8",
            cursor: "pointer",
        },
        presetBtnActive: {
            background: "#1976d2",
            color: "white",
            borderColor: "#1976d2",
            boxShadow: "0 0 0 2px rgba(25,118,210,0.15)",
        },
        list: {
            maxHeight: "60vh",
            overflow: "auto",
            padding: 10,
        },
        groupTitle: { fontWeight: 700, fontSize: 12, color: "#555", margin: "2px 0 8px" },
        row: {
            display: "grid",
            gridTemplateColumns: "24px 1fr 1fr 34px",
            alignItems: "center",
            gap: 10,
            padding: "6px 4px",
            borderRadius: 6,
        },
        pinCell: { textAlign: "center", width: 24 },
        label: { display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" },
        name: { fontSize: 13 },
        togglePair: {
            border: "1px solid #ddd",
            background: "white",
            borderRadius: 6,
            cursor: "pointer",
            padding: "4px 6px",
        },
        empty: { color: "#888", fontSize: 12, padding: 10 },
        footer: {
            borderTop: "1px solid #eee",
            padding: 10,
            display: "flex",
            alignItems: "center",
        },
        footerBtn: {
            padding: "6px 10px",
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#f8f8f8",
            cursor: "pointer",
        },
    };

    // UI
    return (
        <div style={wrap}>
            <header style={{ marginBottom: 24 }}>
                <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", marginBottom: 12, textDecoration: "none", fontWeight: 500 }} className="hover:text-slate-900" aria-label="Back to Home">
                    ← Back to Home
                </Link>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.02em" }}>{SIDE_A.label} ↔ {SIDE_B.label} Compare</h1>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }} aria-hidden="false">
                    PLM to PLM · PLM to ERP · ERP to ERP — any BOM compare
                </p>
                <div style={{ padding: "12px 16px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#475569" }}>
                    Try the app with sample data: click <strong>Run demo</strong> (no upload needed). For mappings and presets, see the{" "}
                    <Link to="/help" style={{ fontWeight: 600, color: "#0f766e", textDecoration: "none" }}>User Guide</Link>.
                </div>
            </header>

            {/* Upload cards */}
            <div style={row}>
                <div style={card}>
                    <div style={cardTitle}>Upload {SIDE_A.label}</div>
                    <input
                        ref={tcRef}
                        type="file"
                        accept={tcAcceptedTypes.join(',')}
                        onChange={onTcSelect}
                    />

                    <div style={statusLine(tcStatus.ok, !!tcStatus.msg)}>
                        <span style={iconCell} aria-hidden="true">
                            {tcStatus.msg ? (tcStatus.ok ? ICON.ok : ICON.bad) : ""}
                        </span>
                        <span>{tcStatus.msg}</span>
                    </div>
                    <div style={hintLine}>
                        Accepted: {tcAcceptedTypes.join(', ')} • Max {maxSizeMB}MB
                    </div>
                </div>

                <div style={card}>
                    <div style={cardTitle}>Upload {SIDE_B.label}</div>
                    <input
                        ref={sapRef}
                        type="file"
                        accept={sapAcceptedTypes.join(',')}
                        onChange={onSapSelect}
                    />

                    <div style={statusLine(sapStatus.ok, !!sapStatus.msg)}>
                        <span style={iconCell} aria-hidden="true">
                            {sapStatus.msg ? (sapStatus.ok ? ICON.ok : ICON.bad) : ""}
                        </span>
                        <span>{sapStatus.msg}</span>
                    </div>
                    <div style={hintLine}>
                        Accepted: {sapAcceptedTypes.join(', ')} • Max {maxSizeMB}MB
                    </div>
                </div>
            </div>

            {/* Actions toolbar */}
            <div style={{ ...row, alignItems: "center", padding: "16px 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#475569" }} title="Use the active mapping from Mapping Manager.">
                        <input type="checkbox" checked={useSavedMappingPreset} onChange={(e) => setUseSavedMappingPreset(e.target.checked)} aria-describedby="preset-desc" />
                        <span id="preset-desc">Use saved mapping preset</span>
                    </label>
                    {useSavedMappingPreset && (
                        <span style={{ fontSize: 12, color: activePresetName ? "#0f766e" : "#b45309", fontWeight: 500 }}>
                            {activePresetName ? `Active: ${activePresetName}` : "No active preset"}
                        </span>
                    )}
                    <button
                        onClick={onCompare}
                        disabled={loading || !tcFile || !sapFile}
                        style={btnGreen}
                        title="Compare the two BOMs (Ctrl+Enter)"
                    >
                        {loading ? "Comparing…" : "Validate BOMs"}
                    </button>
                    <button
                        onClick={onDemo}
                        disabled={loading}
                        style={{ ...btn, borderColor: "#0d9488", color: "#0d9488" }}
                        title="Run a comparison with built-in sample files (no upload needed)"
                    >
                        Run demo
                    </button>
                    <button onClick={resetAll} style={btn}>Reset</button>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    <button
                        ref={ignoredBtnRef}
                        type="button"
                        onClick={() => setIgnoredOpen(true)}
                        style={btnWarn}
                        title="View why some rows/columns are not shown in the comparison table"
                    >
                        Review Ignored Items ({ignoredCount})
                    </button>
                    <button
                        onClick={canExport ? exportCsvMain : () => setUpgradePromptOpen(true)}
                        disabled={!rows.length || exportInProgress != null}
                        style={btn}
                        title={canExport ? "Export results as CSV" : "Export (full version from Microsoft Store)"}
                        aria-busy={exportInProgress === "csv"}
                    >
                        {exportInProgress === "csv" ? "Preparing…" : "Export CSV"}
                    </button>
                    <button
                        onClick={canExport ? exportPdf : () => setUpgradePromptOpen(true)}
                        disabled={!rows.length || exportInProgress != null}
                        style={btn}
                        title={canExport ? "Export results as PDF" : "Export (full version from Microsoft Store)"}
                        aria-busy={exportInProgress === "pdf"}
                    >
                        {exportInProgress === "pdf" ? "Preparing…" : "Export PDF"}
                    </button>
                    {logFilename ? (
                        <button onClick={downloadLog} style={btn}>Download Log</button>
                    ) : null}
                </div>
                <UpgradePrompt
                    open={upgradePromptOpen}
                    onClose={() => setUpgradePromptOpen(false)}
                    featureName="Export (CSV/PDF)"
                />
            </div>

            {/* Error banner */}
            {error && (
                <div style={errorBanner}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Empty state: no results yet */}
            {!loading && rows.length === 0 && !counts && !error && (
                <div ref={resultsRef} style={{ padding: 24, background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12, marginTop: 16, textAlign: "center" }}>
                    <p style={{ fontSize: 15, color: "#475569", marginBottom: 8 }}>No comparison results yet</p>
                    <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Upload {SIDE_A.label} and {SIDE_B.label} above, then click <strong>Compare</strong>, or click <strong>Run demo</strong> to try with sample data.</p>
                    <button type="button" onClick={onDemo} style={{ ...btn, background: "#0f766e", color: "#fff" }}>Run demo</button>
                </div>
            )}

            {/* Summary — scroll target when results load */}
            {counts && (
                <div ref={resultsRef} style={{ ...row, gap: 10, alignItems: "center", scrollMarginTop: 24, paddingTop: 16 }}>
                    <CountPill
                        label="Total"
                        value={counts.total}
                        active={statusFilter === "All"}
                        onClick={() => { setStatusFilter("All"); setPage(1); }}
                    />
                    <CountPill
                        label="Matched"
                        value={counts.matched}
                        active={statusFilter === "Matched"}
                        onClick={() => { setStatusFilter("Matched"); setPage(1); }}
                    />
                    <CountPill
                        label="Different"
                        value={counts.different}
                        active={statusFilter === "Different"}
                        onClick={() => { setStatusFilter("Different"); setPage(1); }}
                    />
                    <CountPill
                        label={STATUS_DISPLAY_LABELS["TC Only"]}
                        value={counts.tc_only}
                        active={statusFilter === "TC Only"}
                        onClick={() => { setStatusFilter("TC Only"); setPage(1); }}
                    />
                    <CountPill
                        label={STATUS_DISPLAY_LABELS["SAP Only"]}
                        value={counts.sap_only}
                        active={statusFilter === "SAP Only"}
                        onClick={() => { setStatusFilter("SAP Only"); setPage(1); }}
                    />
                </div>
            )}

            {counts?.total === 0 && (
                <div style={{ padding: "14px 16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
                    No matching rows. Check your mapping and that both files contain the key columns with overlapping values. Open <strong>Review Ignored Items</strong> to see why rows were skipped.
                </div>
            )}

            {/* Column mapping: from active mapping; keys narrow results */}
            {rows.length > 0 && dataColumns.length > 0 && (
                <div role="region" aria-label="Column mapping" style={{ padding: "14px 18px", background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "#334155" }}>Column mapping</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Columns follow the active mapping in Mapping Manager. Key columns narrow down the results (they match rows); other columns are compared and shown.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div>
                            <strong style={{ color: "#0f766e" }}>Compared (available in both):</strong>{" "}
                            {dataColumns
                                .filter((c) => c.startsWith("BOM_A_"))
                                .map((c) => columnDisplayName(c))
                                .join(", ") || "—"}
                        </div>
                        {skippedColumns?.extra_in_tc?.length > 0 && (
                            <div>
                                <strong style={{ color: "#b45309" }}>Only in {SIDE_A.label} (not compared):</strong>{" "}
                                {skippedColumns.extra_in_tc.map((c) => columnDisplayName(c)).join(", ")}
                            </div>
                        )}
                        {skippedColumns?.extra_in_sap?.length > 0 && (
                            <div>
                                <strong style={{ color: "#b45309" }}>Only in {SIDE_B.label} (not compared):</strong>{" "}
                                {skippedColumns.extra_in_sap.map((c) => columnDisplayName(c)).join(", ")}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Results section */}
            {rows.length > 0 && (
                <>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: "#334155", marginBottom: 12, marginTop: 8 }}>Results</h2>
                    <div style={{ ...row, alignItems: "center", position: "relative", marginBottom: 12 }}>
                        <input
                            style={searchBox}
                            placeholder="Search in all columns…"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            aria-label="Search in results"
                        />
                        <button
                            ref={colsBtnRef}
                            type="button"
                            onClick={() => setColsOpen(o => !o)}
                            style={{
                                ...btn,
                                border: colsOpen ? "1px solid #0f766e" : "1px solid #cbd5e1",
                                background: colsOpen ? "#0f766e" : "#fff",
                                color: colsOpen ? "#fff" : "#334155",
                            }}
                            title="Show or hide columns"
                        >
                            Columns ▾
                        </button>
                        <ColumnsPopover
                            open={colsOpen}
                            anchorRef={colsBtnRef}
                            onClose={() => setColsOpen(false)}
                            dataColumns={dataColumns}
                            visibleCols={visibleCols}
                            setVisibleCols={setVisibleCols}
                            skippedRows={skippedRows}
                        />
                    </div>
                </>
            )}

            {/* Result table */}
            <div style={tableWrap}>
                <table style={table} role="table" aria-label="BOM comparison results">
                    <thead>
                        <tr>
                            {dataColumns.filter((c) => visibleCols[c]).map((c) => (
                                <th
                                    key={c}
                                    style={thSortable}
                                    onClick={() => cycleSort(c)}
                                    aria-sort={
                                        sort.column === c ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                                    }
                                    title="Click to sort (none → asc → desc)"
                                >
                                    <span style={thLabel}>{columnDisplayName(c)}</span>
                                    <span style={thArrow}>{sortArrow(c)}</span>
                                </th>
                            ))}
                            <th
                                style={thSortable}
                                onClick={() => cycleSort("status")}
                                aria-sort={
                                    sort.column === "status" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                                }
                                title="Click to sort (none → asc → desc)"
                            >
                                <span style={thLabel}>Status</span>
                                <span style={thArrow}>{sortArrow("status")}</span>
                            </th>
                            <th style={thAction}>Action</th>
                        </tr>
                    </thead>
                    {/* Main Compare Table body */}
                    <tbody>
                        {pageRows.length === 0 ? (
                            <tr>
                                <td colSpan={dataColumns.filter((c) => visibleCols[c]).length + 2} style={tdEmpty}>
                                    {counts?.total === 0
                                        ? "No matching rows. Check your mapping or file contents."
                                        : "No rows"}
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((r, idx) => (
                                <tr key={idx} style={rowStyleForStatus(r.status)}>
                                    {dataColumns.filter((c) => visibleCols[c]).map((c) => (
                                        <td key={c} style={td} title={sanitizeCell(r[c])}>
                                            {highlightText(r[c], search)}</td>
                                    ))}
                                    <td style={td} title={sanitizeCell(STATUS_DISPLAY_LABELS[r.status] ?? r.status)}>
                                        <span style={statusBadgeStyle(r.status)}>
                                            <StatusIcon status={r.status} />
                                            {highlightText(STATUS_DISPLAY_LABELS[r.status] ?? r.status, search)}
                                        </span>
                                    </td>
                                    <td style={td}>
                                        <button
                                            style={iconBtn}
                                            onClick={() => setDetailRow(r)}
                                            aria-label="View details"
                                            title="View details"
                                        >
                                            <EyeIcon />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ ...row, alignItems: "center" }}>
                <div>
                    Show:&nbsp;
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    >
                        {PAGE_SIZES.map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <button style={btn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Prev
                    </button>
                    <span>Page {page} / {totalPages}</span>
                    <button style={btn} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Next
                    </button>
                </div>
            </div>

            {/* Diagnostics: skipped/invalid */}
            <IgnoredPopover
                open={ignoredOpen}
                onClose={() => setIgnoredOpen(false)}
                duplicates={ignoredSummary?.duplicates}
                skippedRows={skippedRows}
                skippedColumns={skippedColumns}
            />

            {/* Detail modal */}
            {detailRow && (
                <RowDetailsModal
                    row={detailRow}
                    columns={dataColumns}
                    onClose={() => setDetailRow(null)}
                />
            )}
        </div>
    );
}

/* ————— Tiny presentational helpers ————— */

function CountPill({ label, value, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={!!active}
            title={`Filter: ${label}`}
            style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: active ? "1px solid #0f766e" : "1px solid #e2e8f0",
                background: active ? "#0f766e" : "#fff",
                color: active ? "#fff" : "#475569",
                fontSize: 13,
                fontWeight: 500,
                minWidth: 100,
                textAlign: "center",
                cursor: "pointer",
                boxShadow: active ? "0 1px 2px rgba(15,118,110,.2)" : "none"
            }}
        >
            {label}: {value}
        </button>
    );
}
function EyeIcon(props) {
    return (
        <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" {...props}
        >
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path>
            <circle cx="12" cy="12" r="3.5"></circle>
        </svg>
    );
}
/* ————— Enterprise styles ————— */
const wrap = { padding: "24px 32px 40px", maxWidth: 1400, margin: "0 auto" };
const row = { display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" };

const card = {
    flex: 1, minWidth: 280, padding: 20,
    border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff",
    minHeight: 160, boxShadow: "0 1px 3px rgba(0,0,0,.06)"
};
const statusLine = (ok, hasMsg) => ({
    display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 8,
    color: hasMsg ? (ok ? "#059669" : "#dc2626") : "#64748b",
    minHeight: 20
});
const iconCell = { fontWeight: 700, width: 18, textAlign: "center" };
const hintLine = { fontSize: 12, color: "#64748b", marginTop: 6 };
const cardTitle = { fontWeight: 600, fontSize: 14, color: "#0f172a", marginBottom: 8, letterSpacing: "-0.01em" };

const btn = {
    padding: "8px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8,
    cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#334155"
};
const btnWarn = {
    padding: "8px 16px", border: "1px solid #d97706", borderRadius: 8,
    background: "#fffbeb", color: "#92400e", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
const btnGreen = {
    padding: "10px 20px", border: "none", borderRadius: 8, background: "#0f766e",
    color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,.05)",
};

const errorBanner = { background: "#fef2f2", color: "#b91c1c", padding: 12, borderRadius: 8, border: "1px solid #fecaca" };

const searchBox = { padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, width: 320, fontSize: 13 };

const tableWrap = { border: "1px solid #e2e8f0", borderRadius: 12, overflow: "auto", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.06)" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" };
const thBase = { textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#f8fafc", fontWeight: 600, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" };
const thSortable = { ...thBase, cursor: "pointer", userSelect: "none", width: 160 };
const thAction = { ...thBase, width: 90, textAlign: "left" };
const thLabel = { display: "inline-block", maxWidth: "calc(100% - 20px)", verticalAlign: "middle" };
const thArrow = { marginLeft: 6, fontSize: 11, opacity: 0.7 };

const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere", fontSize: 13 };
const tdEmpty = { padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 };

const iconBtn = {
    padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff",
    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
};

const STATUS_THEME = {
    "Matched": {
        accent: "#16a34a", tint: "#ecfdf5", text: "#065f46",
        badgeBg: "linear-gradient(180deg, rgba(34,197,94,.16), rgba(34,197,94,.08))"
    },
    "Different": {
        accent: "#ef4444", tint: "#fef2f2", text: "#7f1d1d",
        badgeBg: "linear-gradient(180deg, rgba(239,68,68,.16), rgba(239,68,68,.08))"
    },
    "Qty Mismatch": {
        accent: "#ef4444", tint: "#fef2f2", text: "#7f1d1d",
        badgeBg: "linear-gradient(180deg, rgba(239,68,68,.16), rgba(239,68,68,.08))"
    },
    "TC Only": {
        accent: "#2563eb", tint: "#eff6ff", text: "#1e3a8a",
        badgeBg: "linear-gradient(180deg, rgba(37,99,235,.16), rgba(37,99,235,.08))"
    },
    "SAP Only": {
        accent: "#f59e0b", tint: "#fffbeb", text: "#78350f",
        badgeBg: "linear-gradient(180deg, rgba(245,158,11,.16), rgba(245,158,11,.08))"
    },
};
const themeForStatus = (s) => STATUS_THEME[s] || {
    accent: "#94a3b8", tint: "#f8fafc", text: "#0f172a",
    badgeBg: "linear-gradient(180deg, rgba(148,163,184,.16), rgba(148,163,184,.08))",
};

const rowStyleForStatus = (status) => {
    const t = themeForStatus(status);
    return { background: t.tint, boxShadow: `inset 3px 0 0 ${t.accent}AA` };
};
const statusBadgeStyle = (status) => {
    const t = themeForStatus(status);
    return {
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "4px 10px", borderRadius: 999, fontWeight: 700,
        color: t.text, background: t.badgeBg, border: `1px solid ${t.accent}55`,
        boxShadow: "0 1px 0 rgba(0,0,0,.04), inset 0 0 0 1px rgba(255,255,255,.15)",
    };
};
const StatusIcon = ({ status }) => {
    const map = {
        "Matched": { Icon: FaCheckCircle, color: "#16a34a" },
        "Different": { Icon: FaTimesCircle, color: "#ef4444" },
        "Qty Mismatch": { Icon: FaTimesCircle, color: "#ef4444" },
        "TC Only": { Icon: FaCubes, color: "#2563eb" },
        "SAP Only": { Icon: FaBoxes, color: "#f59e0b" },
    };
    const { Icon, color } = map[status] || { Icon: FaCheckCircle, color: "#334155" };
    return <Icon style={{ color, fontSize: 16 }} aria-hidden="true" />;
};
