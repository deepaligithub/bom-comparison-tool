// BOMComparePage.jsx
import React, { useMemo, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    FaCheckCircle,   // Matched
    FaTimesCircle,   // Different / Qty Mismatch
    FaCubes,         // TC Only
    FaBoxes          // SAP Only  (FA5; good substitute for BoxesStacked)
} from 'react-icons/fa';


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
    function equalish(a, b) {
        if (isNA(a) && isNA(b)) return true;
        const A = norm(a), B = norm(b);
        if (A.isNum && B.isNum) return A.n === B.n;
        return (A.s || "") === (B.s || "");
    }
    // build paired columns in mapped order (TC_*, SAP_*)
    const pairs = React.useMemo(() => {
        const out = [];
        for (let i = 0; i < columns.length - 1; i += 2) {
            const tc = columns[i];
            const sap = columns[i + 1];
            if (!tc?.startsWith("TC_") || !sap?.startsWith("SAP_")) continue;
            const label = `${tc.replace(/^TC_/, "")} / ${sap.replace(/^SAP_/, "")}`;
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

    const partTC = get("TC_part number");
    const partSAP = get("SAP_material number");
    const plantTC = get("TC_plant");
    const plantSAP = get("SAP_plant code");
    const revTC = get("TC_revision");
    const revSAP = get("SAP_revision level");

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
                        {status}{status === "Different" ? ` • ${diffCount} differences` : ""}
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
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee", width: 260 }}>Field [TC / SAP]</th>
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>TC</th>
                                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>SAP</th>
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
    const bg = source === "SAP" ? "#e1f5f9" : "#efe6ff";
    const fg = source === "SAP" ? "#006b7e" : "#4b2bb5";
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
            if (m) add("SAP", m[1], m[2] || "", m[3] || "", reasonFrom(msg), sapRows[i] || null);
            else if (e) add("SAP", e[1], "", "", "Extra row", sapRows[i] || null);
            else add("SAP", "", "", "", reasonFrom(msg), sapRows[i] || null);
        });

        tcMsgs.forEach((msg, i) => {
            const m = msg.match(reTC);
            const e = msg.match(reTCExtra);
            if (m) add("TC", m[1], m[2] || "", m[3] || "", reasonFrom(msg), tcRows[i] || null);
            else if (e) add("TC", e[1], "", "", "Extra row", tcRows[i] || null);
            else add("TC", "", "", "", reasonFrom(msg), tcRows[i] || null);
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
                            {["All", "TC", "SAP"].map(s => <option key={s} value={s}>{s}</option>)}
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
                                    {skippedColsList.map(c => <li key={c} style={{ margin: "4px 0" }}>- {c}</li>)}
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

const PAGE_SIZES = [5, 10, 15];
const NA = "N/A";

export default function BOMComparePage() {
    // file inputs
    const tcRef = useRef(null);
    const sapRef = useRef(null);

    // uploads
    const [tcFile, setTcFile] = useState(null);
    const [sapFile, setSapFile] = useState(null);

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
    const [pageSize, setPageSize] = useState(10);
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

    // ----------------------------------------------------
    // Compare (POST /api/compare2 with tc_bom & sap_bom)
    // ----------------------------------------------------
    async function onCompare() {
        try {
            setError("");
            // validate uploads
            if (!tcFile || !sapFile) {
                setError("Please upload both Teamcenter and SAP BOM files.");
                return;
            }
            setLoading(true);

            const fd = new FormData();
            fd.append("tc_bom", tcFile);
            fd.append("sap_bom", sapFile);

            console.log("[UI] POST /api/compare2", { tc: tcFile?.name, sap: sapFile?.name });
            const { data } = await axios.post("/api/compare2", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            console.log("[UI] /api/compare2 →", data);
            console.log("[UI] /api/compare2 → ignored_summary", data?.ignored_summary);
            console.log("[UI] /api/compare2 → duplicates", data?.ignored_summary?.duplicates);

            // 1) columns straight from server
            const colsFromServer = Array.isArray(data.columns) ? data.columns.map(String) : [];
            const dataCols = colsFromServer.filter((c) => c !== "status");

            setColumns(colsFromServer);
            const vis = {};
            dataCols.forEach((c) => (vis[c] = true));
            setVisibleCols(vis);

            // 2) flatten buckets and normalize
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
            // ignored/skipped/meta
            setSkippedRows(data.skipped_rows || []);
            setSkippedColumns(data.skipped_columns || null);
            setIgnoredSummary(data.ignored_summary || null);
            setLogFilename(data.logFilename || "");

            setCounts({
                matched: (data.matched || []).length,
                different: (data.different || []).length,
                tc_only: (data.tc_only || []).length,
                sap_only: (data.sap_only || []).length,
                total:
                    (data.matched || []).length +
                    (data.different || []).length +
                    (data.tc_only || []).length +
                    (data.sap_only || []).length,
            });

        } catch (e) {
            console.error("[UI] compare2 failed:", e);
            console.error("[UI] server said:", e?.response?.data);
            setError(e?.response?.data?.message || e.message || "Compare failed");
        } finally {
            setLoading(false);
        }
    }

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

            if (A.empty && B.empty) return 0;
            if (A.empty) return 1;
            if (B.empty) return -1;

            if (A.num && B.num) {
                return (A.val - B.val) * dir;
            }
            return A.val.localeCompare(B.val) * dir;
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
        const doc = new jsPDF({ orientation: "landscape" });
        const visible = dataColumns.filter((c) => visibleCols[c]);
        const head = [[...visible, "status"]];
        const body = filteredRows.map((r) => [...visible.map((c) => sanitizeCell(r[c])), sanitizeCell(r.status)]);
        doc.text("BOM Compare Report", 14, 12);
        autoTable(doc, { head, body, startY: 16, styles: { fontSize: 6 } });
        doc.save("bom-compare-report.pdf");
    }

    async function downloadLog() {
        try {
            if (!logFilename) return;
            const res = await axios.get(`/api/download-log/${encodeURIComponent(logFilename)}`, {
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
        const visible = dataColumns.filter((c) => visibleCols[c]);

        function csvEscape(x) {
            const s = String(x == null ? "" : x);
            return '"' + s.replace(/"/g, '""') + '"';
        }

        const headers = [...visible, "status"];
        const lines = [headers.join(",")];

        for (const r of filteredRows) {
            const row = [
                ...visible.map((c) => csvEscape(r[c])),
                csvEscape(r.status),
            ];
            lines.push(row.join(","));
        }

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bom-compare.csv";
        a.click();
        URL.revokeObjectURL(url);
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
                if (!tc.startsWith("TC_") || !sap.startsWith("SAP_")) continue;
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
                const baseTc = p.tc.replace(/^TC_/, "");
                const baseSap = p.sap.replace(/^SAP_/, "");
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
                    <div style={colPop.groupTitle}>TC | SAP pairs</div>
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
                                    <span style={colPop.name}>{p.tc}</span>
                                </label>
                                <label style={colPop.label}>
                                    <input
                                        type="checkbox"
                                        checked={!!visibleCols[p.sap]}
                                        onChange={(e) => setVisibleCols(prev => ({ ...prev, [p.sap]: e.target.checked }))}
                                    />
                                    <span style={colPop.name}>{p.sap}</span>
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
            <h1 style={{ marginBottom: 8 }}><b>Teamcenter ↔ SAP BOM Compare</b></h1>

            {/* Upload cards */}
            <div style={row}>
                <div style={card}>
                    <div style={cardTitle}>Teamcenter BOM</div>
                    {/* Teamcenter */}
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

                {/* SAP */}
                <div style={card}>
                    <div style={cardTitle}>SAP BOM</div>
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

            {/* Actions */}
            <div style={{ ...row, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onCompare} disabled={loading || !tcFile || !sapFile} style={btnGreen}>
                        {loading ? "Comparing..." : "Compare"}
                    </button>
                    <button onClick={resetAll} style={btn}>Reset</button>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                        ref={ignoredBtnRef}
                        type="button"
                        onClick={() => setIgnoredOpen(true)}
                        style={btnWarn}
                        title="View why some rows/columns are not shown in the comparison table"
                    >
                        Review Ignored Items ({ignoredCount})
                    </button>
                    <button onClick={exportCsvMain} disabled={!rows.length} style={btn}>Export CSV</button>
                    <button onClick={exportPdf} disabled={!rows.length} style={btn}>Export PDF</button>
                    {logFilename ? (
                        <button onClick={downloadLog} style={btn}>Download Log</button>
                    ) : null}
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div style={errorBanner}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Summary */}
            {counts && (
                <div style={{ ...row, gap: 8, alignItems: "center" }}>
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
                        label="TC Only"
                        value={counts.tc_only}
                        active={statusFilter === "TC Only"}
                        onClick={() => { setStatusFilter("TC Only"); setPage(1); }}
                    />
                    <CountPill
                        label="SAP Only"
                        value={counts.sap_only}
                        active={statusFilter === "SAP Only"}
                        onClick={() => { setStatusFilter("SAP Only"); setPage(1); }}
                    />
                </div>
            )}

            {/* Toolbar */}
            <div style={{ ...row, alignItems: "center" }}>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>

                    {/* Toolbar (no status dropdown) */}
                    <div style={{ ...row, alignItems: "center", position: "relative" }}>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                            <input
                                style={searchBox}
                                placeholder="Search in all columns…"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            />

                            <button
                                ref={colsBtnRef}
                                type="button"
                                onClick={() => setColsOpen(o => !o)}
                                style={{
                                    padding: "6px 10px",
                                    border: colsOpen ? "1px solid #1976d2" : "1px solid #ddd",
                                    borderRadius: 8,
                                    background: colsOpen ? "#1976d2" : "white",
                                    color: colsOpen ? "white" : "inherit",
                                    cursor: "pointer"
                                }}
                                title="Manage columns"
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
                    </div>
                </div>
            </div>

            {/* Result table */}
            <div style={tableWrap}>
                <table style={table}>
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
                                    <span style={thLabel}>{c}</span>
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
                                    No rows
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((r, idx) => (
                                <tr key={idx} style={rowStyleForStatus(r.status)}>
                                    {dataColumns.filter((c) => visibleCols[c]).map((c) => (
                                        <td key={c} style={td} title={sanitizeCell(r[c])}>
                                            {highlightText(r[c], search)}</td>
                                    ))}
                                    <td style={td} title={sanitizeCell(r.status)}>
                                        <span style={statusBadgeStyle(r.status)}>
                                            <StatusIcon status={r.status} />
                                            {highlightText(r.status, search)}
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
                padding: "6px 12px",
                borderRadius: 9999,
                border: active ? "1px solid #1976d2" : "1px solid #ddd",
                background: active ? "#1976d2" : "white",
                color: active ? "white" : "#1976d2",
                fontSize: 12,
                minWidth: 120,
                textAlign: "center",
                cursor: "pointer",
                boxShadow: active ? "0 0 0 2px rgba(25,118,210,0.15)" : "none"
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
/* ————— styles ————— */
const wrap = { padding: 16, fontFamily: "system-ui, Arial" };
const row = { display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" };

const card = {
    flex: 1, minWidth: 280, padding: 12,
    border: "1px solid #e0e0e0", borderRadius: 8, background: "#fafafa",
    minHeight: 150 // <- fixed-ish height for stable layout
};
const statusLine = (ok, hasMsg) => ({
    display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 6,
    color: hasMsg ? (ok ? "#16a34a" : "#dc2626") : "#667085",
    minHeight: 18
});
const iconCell = { fontWeight: 700, width: 16, textAlign: "center" };
const hintLine = { fontSize: 12, color: "#667085", marginTop: 4 };
const cardTitle = { fontWeight: 600, marginBottom: 6 };

const btn = { padding: "8px 12px", background: "white", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" };
const btnWarn = {
    padding: "6px 10px",
    border: "1px solid #b45309",
    borderRadius: 8,
    background: "#fff7ed",      // warm/amber tint
    color: "#7c2d12",
    fontWeight: 700,
    cursor: "pointer",
};
const btnGreen = {
    padding: "6px 10px",
    border: "1px solid #16a34a",
    borderRadius: 8,
    background: "#16a34a",
    color: "white",
    cursor: "pointer",
};

const errorBanner = { background: "#fdecea", color: "#b71c1c", padding: 10, borderRadius: 6, border: "1px solid #f5c6cb" };

const searchBox = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, width: 300 };

const tableWrap = { border: "1px solid #eee", borderRadius: 8, overflow: "auto" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" };
const thBase = { textAlign: "left", padding: 8, borderBottom: "1px solid #eee", position: "sticky", top: 0, background: "#fafafa" };
const thSortable = { ...thBase, cursor: "pointer", userSelect: "none", width: 160 };
const thAction = { ...thBase, width: 90, textAlign: "left" };
const thLabel = { display: "inline-block", maxWidth: "calc(100% - 20px)", verticalAlign: "middle" };
const thArrow = { marginLeft: 6, fontSize: 12, opacity: 0.6 };

const td = { padding: 8, borderBottom: "1px solid #f3f3f3", whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" };
const tdEmpty = { padding: 16, textAlign: "center", color: "#888" };

const iconBtn = {
    padding: "4px 6px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "white",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
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
