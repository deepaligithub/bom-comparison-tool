import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { HiOutlineCode, HiOutlineCog } from 'react-icons/hi';
import Swal from 'sweetalert2';
import { FaDownload, FaPlus, FaArrowRight, FaPuzzlePiece, FaTrashAlt, FaSave, FaRedo } from 'react-icons/fa';
import apiClient from '../../api/client';
import { toastSuccess, toastError } from '../../utils/toast';

export default function AddMappingPage() {
    const tcFileRef = useRef();
    const sapFileRef = useRef();
    const [tcColumns, setTcColumns] = useState([]);
    const [sapColumns, setSapColumns] = useState([]);
    const [mappings, setMappings] = useState([{ tc: '', sap: '', isKey: false }]);
    const [mode, setMode] = useState('ui');
    const [manualInput, setManualInput] = useState('');
    const [tcFileName, setTcFileName] = useState('');
    const [sapFileName, setSapFileName] = useState('');


    const usedTc = mappings.map(m => m.tc).filter(Boolean);
    const usedSap = mappings.map(m => m.sap).filter(Boolean);

    const remainingTc = tcColumns.filter(c => !usedTc.includes(c));
    const remainingSap = sapColumns.filter(c => !usedSap.includes(c));

    const canAddRow = remainingTc.length > 0 && remainingSap.length > 0;

    const resetAll = () => {
        setMappings([{ tc: '', sap: '', isKey: false }]);
        setTcColumns([]);
        setSapColumns([]);
        setManualInput('');
        setTcFileName('');
        setSapFileName('');
        if (tcFileRef.current) tcFileRef.current.value = null;
        if (sapFileRef.current) sapFileRef.current.value = null;
    };

    const autoMapColumns = (tcCols, sapCols) => {
        const mapped = [];
        tcCols.forEach(tc => {
            const match = sapCols.find(sap => sap.toLowerCase() === tc.toLowerCase());
            if (match) {
                mapped.push({ tc, sap: match });
            }
        });
        return mapped.length ? mapped : [{ tc: '', sap: '' }];
    };

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        // Clear existing mappings on new upload
        setMappings([{ tc: '', sap: '', isKey: false }]);

        const reader = new FileReader();

        const updateColumns = (columns, which) => {
            if (which === 'tc') {
                const newMappings = autoMapColumns(columns, sapColumns);
                setMappings(newMappings);
                setTcColumns(columns);
            } else {
                const newMappings = autoMapColumns(tcColumns, columns);
                setMappings(newMappings);
                setSapColumns(columns);
            }
        };

        if (file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                complete: (result) => {
                    const columns = Object.keys(result.data[0] || {});
                    updateColumns(columns, type);
                },
                error: () => {
                    Swal.fire('Failed to parse CSV', '', 'error');
                    resetAll();
                }
            });
        } else if (file.name.endsWith('.json')) {
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    const first = Array.isArray(json) ? json[0] : json;
                    const columns = Object.keys(first);
                    updateColumns(columns, type);
                } catch (err) {
                    Swal.fire('Invalid JSON file', '', 'error');
                    resetAll();
                }
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    const columns = json[0];
                    updateColumns(columns, type);
                } catch (err) {
                    Swal.fire('Invalid XLSX file', '', 'error');
                    resetAll();
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.plmxml')) {
            if (type !== 'tc') {
                Swal.fire('Target BOM should not be PLMXML', '', 'error');
                resetAll();
                return;
            }
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(e.target.result, 'application/xml');

                    const fieldSet = new Set();

                    // First, try <BillOfMaterial>
                    const billOfMaterials = Array.from(xml.getElementsByTagName('*', 'BillOfMaterial'));
                    if (billOfMaterials.length > 0) {
                        billOfMaterials.forEach(bom => {
                            Array.from(bom.children).forEach(child => {
                                Array.from(child.attributes).forEach(attr => {
                                    fieldSet.add(attr.name);
                                });
                            });
                        });
                    } else {
                        // Fallback: extract from <BOMLine>
                        const bomLines = Array.from(xml.getElementsByTagName('*', 'BOMLine'));
                        bomLines.forEach(line => {
                            Array.from(line.attributes).forEach(attr => {
                                fieldSet.add(attr.name);
                            });
                        });
                    }

                    // Also extract metadata from <Part> → <UserValue>
                    const parts = Array.from(xml.getElementsByTagName('*', 'Part'));
                    parts.forEach(part => {
                        const userValues = part.getElementsByTagName('*', 'UserValue');
                        Array.from(userValues).forEach(uv => {
                            const title = uv.getAttribute('title');
                            if (title) fieldSet.add(title);
                        });
                    });

                    const columns = Array.from(fieldSet);
                    updateColumns(columns, type);

                    if (type === 'tc') {
                        const newMappings = autoMapColumns(columns, sapColumns);
                        setMappings(newMappings);
                        setTcColumns(columns);
                    } else {
                        Swal.fire('Target BOM should not be PLMXML', '', 'error');
                        resetAll();
                    }

                } catch (err) {
                    Swal.fire('Error parsing PLMXML', '', 'error');
                    console.error(err);
                    resetAll();
                }
            };
            reader.readAsText(file);
        }
        else {
            Swal.fire('Unsupported file format', '', 'error');
            resetAll();
        }
    };

    const handleMappingChange = (index, field, value) => {
        const updated = [...mappings];
        updated[index][field] = value;
        setMappings(updated);
    };

    const parseManualMappings = () => {
        try {
            const lines = manualInput.trim().split('\n');
            const parsed = lines.map((line, i) => {
                let parts;

                // Support either comma-separated OR -> format
                if (line.includes('->')) {
                    parts = line.split('->').map(s => s.trim());
                }
                else if (line.includes(',')) {
                    parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                }
                else {
                    throw new Error(`Line ${i + 1} format invalid. Use "->" or comma.`);
                }

                if (parts.length !== 2 || !parts[0] || !parts[1]) {
                    throw new Error(`Invalid mapping on line ${i + 1}`);
                }

                // Allow only letters, numbers, and spaces
                const validPattern = /^[a-zA-Z0-9 ]+$/;
                if (!validPattern.test(parts[0]) || !validPattern.test(parts[1])) {
                    throw new Error(`Invalid characters on line ${i + 1}. Only letters, numbers, and spaces are allowed.`);
                }

                return {
                    tc: parts[0],
                    sap: parts[1],
                    isKey: false // admin will choose later via UI checkbox
                };
            });
            // Check for duplicates
            const seen = new Set();
            const hasDuplicate = parsed.some(m => {
                const key = `${m.tc.toLowerCase()}->${m.sap.toLowerCase()}`;
                if (seen.has(key)) return true;
                seen.add(key);
                return false;
            });

            if (hasDuplicate) {
                Swal.fire('Duplicate mappings found', 'Please remove duplicates before proceeding.', 'error');
                return;
            }

            setMappings(parsed);
            Swal.fire('Manual mapping parsed successfully', '', 'success');
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    };

    const toggleIsKey = (index) => {
        const updated = [...mappings];
        const currentKeys = updated.filter(m => m.isKey).length;
        const isCurrentlyKey = updated[index].isKey;

        if (!isCurrentlyKey && currentKeys >= 3) {
            Swal.fire('Only up to 3 key fields are allowed.', '', 'warning');
            return;
        }

        updated[index].isKey = !isCurrentlyKey;
        setMappings(updated);
    };

    const downloadManualMap = () => {
        if (!mappings.length) return;

        const content = mappings
            .filter(m => m.tc && m.sap)
            .map(m => `"${m.tc}" -> "${m.sap}"`)
            .join('\n');

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mapping.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const saveMappingsToBackend = async () => {
        try {
            await apiClient.post('/api/save-mapping', {
                mode,
                mappings
            });
            toastSuccess('Mapping saved');
            resetAll();
        } catch (error) {
            toastError('Error saving to backend');
        }
    };

    const addMappingRow = () => setMappings([...mappings, { tc: '', sap: '', isKey: false }]);
    const removeMappingRow = (index) => setMappings(mappings.filter((_, i) => i !== index));


    const handleSave = () => {
        const mapped = mappings.filter(m => m.tc && m.sap);
        const duplicates = new Set();
        const seen = new Set();

        if (mapped.length === 0) {
            Swal.fire('Please map at least one field.', '', 'warning');
            return;
        }

        mapped.forEach(m => {
            const key = `${m.tc.toLowerCase()}-${m.sap.toLowerCase()}`;
            if (seen.has(key)) duplicates.add(key);
            seen.add(key);
        });

        if (duplicates.size > 0) {
            Swal.fire('Duplicate mappings found.', '', 'error');
            return;
        }
        if (mapped.length > tcColumns.length || mapped.length > sapColumns.length) {
            Swal.fire('You have more mappings than available columns.', '', 'error');
            return;
        }
        // ✅ Call backend function
        saveMappingsToBackend();
    };
    const hasValidMappings = mappings.some(m => m.tc && m.sap);

    return (
        <div className="max-w-5xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-1 p-1 mb-8 rounded-2xl bg-slate-100/80 border border-slate-200/80 w-fit">
                <button
                    onClick={() => { setMode('ui'); resetAll(); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${mode === 'ui'
                        ? 'bg-white text-teal-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <HiOutlineCog className="text-lg" />
                    UI Mapping
                </button>
                <button
                    onClick={() => { setMode('manual'); resetAll(); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${mode === 'manual'
                        ? 'bg-white text-teal-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <HiOutlineCode className="text-lg" />
                    Manual Mapping
                </button>
            </div>

            {mode === 'ui' ? (
                <div className="space-y-8">
                    <div className="grid sm:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-semibold text-slate-800 mb-3">Upload Source BOM (sample)</h4>
                            <label className="relative inline-block mb-3">
                                <span className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl cursor-pointer transition-colors">
                                    Choose File
                                </span>
                                <input
                                    ref={tcFileRef}
                                    type="file"
                                    accept=".csv,.json,.xlsx,.plmxml"
                                    onChange={(e) => {
                                        handleFileUpload(e, 'tc');
                                        setTcFileName(e.target.files[0]?.name || '');
                                    }}
                                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </label>
                            {tcFileName && (
                                <div className="text-teal-600 text-sm font-medium mb-1 truncate flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-teal-500" /> <span className="truncate">{tcFileName}</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-500">Accepted: .csv, .json, .xlsx, .plmxml</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-semibold text-slate-800 mb-3">Upload Target BOM (sample)</h4>
                            <label className="relative inline-block mb-3">
                                <span className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl cursor-pointer transition-colors">
                                    Choose File
                                </span>
                                <input
                                    ref={sapFileRef}
                                    type="file"
                                    accept=".csv,.json,.xlsx"
                                    onChange={(e) => {
                                        handleFileUpload(e, 'sap');
                                        setSapFileName(e.target.files[0]?.name || '');
                                    }}
                                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </label>
                            {sapFileName && (
                                <div className="text-teal-600 text-sm font-medium mb-1 truncate flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-teal-500" /> <span className="truncate">{sapFileName}</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-500">Accepted: .csv, .json, .xlsx</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <FaPuzzlePiece className="text-teal-500" /> Column Mappings
                        </h3>
                        <div className="text-sm text-slate-700 bg-teal-50/80 border border-teal-100 rounded-xl p-4 mb-4">
                            <p className="font-semibold text-slate-800 mb-2">Key vs non-key</p>
                            <ul className="space-y-1 text-slate-600">
                                <li><strong>Key</strong> — Columns used to <em>match rows</em> (e.g. same part). At least one; up to 3 for composite keys.</li>
                                <li><strong>Non-key</strong> — Columns <em>compared and shown</em> after matching (e.g. Description, Qty).</li>
                            </ul>
                        </div>
                        <div className="text-sm text-slate-600 mb-4">
                            <span className="font-semibold text-slate-800">Selected key fields:</span>{' '}
                            {mappings.filter(m => m.isKey).map(m => m.tc).join(', ') || 'None'}
                        </div>
                        {mappings.map((map, idx) => {
                            const selectedTc = mappings.map(m => m.tc).filter((v, i) => v && i !== idx);
                            const selectedSap = mappings.map(m => m.sap).filter((v, i) => v && i !== idx);
                            const availableTc = tcColumns.filter(col => !selectedTc.includes(col));
                            const availableSap = sapColumns.filter(col => !selectedSap.includes(col));
                            return (
                                <div key={idx} className="flex flex-wrap items-center gap-3 mb-3">
                                    <select
                                        value={map.tc}
                                        onChange={e => handleMappingChange(idx, 'tc', e.target.value)}
                                        className="border border-slate-200 rounded-xl px-3 py-2 w-1/3 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    >
                                        <option value="">Select BOM A Column</option>
                                        {availableTc.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                    <span className="text-slate-400"><FaArrowRight /></span>
                                    <select
                                        value={map.sap}
                                        onChange={e => handleMappingChange(idx, 'sap', e.target.value)}
                                        className="border border-slate-200 rounded-xl px-3 py-2 w-1/3 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    >
                                        <option value="">Select Target BOM Column</option>
                                        {availableSap.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer" title="Key = match rows">
                                        <input type="checkbox" checked={map.isKey || false} onChange={() => toggleIsKey(idx)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                        <span className="text-slate-600">Use as Key</span>
                                    </label>
                                    <button onClick={() => removeMappingRow(idx)} className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                        <FaTrashAlt />
                                    </button>
                                </div>
                            );
                        })}
                        <button
                            onClick={addMappingRow}
                            disabled={!canAddRow}
                            className={`mt-3 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors ${canAddRow ? 'text-teal-600 hover:bg-teal-50' : 'text-slate-400 cursor-not-allowed'}`}
                        >
                            <FaPlus /> Add row
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                            <FaSave /> Save Mapping
                        </button>
                        <button onClick={resetAll} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2">
                            <FaRedo /> Reset
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">Manual column mapping</h2>
                    <div className="flex items-center gap-2 mb-2">
                        <label className="font-semibold text-slate-700">Enter mappings</label>
                        <div className="relative group">
                            <span className="text-teal-600 cursor-help text-sm">ℹ️</span>
                            <div className="absolute z-10 w-72 p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity left-4 top-6">
                                <p className="font-semibold mb-1">Formats:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li><code className="text-xs">{'part -> material_id'}</code></li>
                                    <li><code className="text-xs">part,material_id</code></li>
                                    <li>Paste from Excel (tabs → commas). Up to 3 key fields.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-t-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm text-slate-600">
                        Source BOM column → Target BOM column
                    </div>
                    <textarea
                        rows={8}
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData.getData('text/plain');
                            const formatted = text.split('\n').map(line => line.replace(/\t/g, ',').split(',').map(part => part.trim()).join(',')).join('\n');
                            setManualInput(manualInput ? `${manualInput}\n${formatted}` : formatted);
                        }}
                        placeholder="part_id -> material_number"
                        className="w-full border border-t-0 border-slate-200 rounded-b-xl p-4 resize-y font-mono text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />

                    <div className="flex flex-wrap gap-3">
                        <button onClick={parseManualMappings} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                            Parse
                        </button>
                        <button onClick={downloadManualMap} disabled={!hasValidMappings} className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors ${hasValidMappings ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            <FaDownload /> Download
                        </button>
                        <button onClick={saveMappingsToBackend} disabled={!hasValidMappings} className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors ${hasValidMappings ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            <FaSave /> Save
                        </button>
                        <button onClick={() => { setManualInput(''); setMappings([]); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium">
                            <FaRedo /> Reset
                        </button>
                    </div>

                    {mappings.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                            <h4 className="font-semibold text-slate-800 mb-3">Parsed mappings — set key fields</h4>
                            <p className="text-xs text-slate-600 mb-3">Key = match rows; non-key = compare only.</p>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-700 font-semibold">
                                        <tr>
                                            <th className="px-4 py-3 text-left border-b border-slate-200">Source BOM Column</th>
                                            <th className="px-4 py-3 text-left border-b border-slate-200">Target BOM Column</th>
                                            <th className="px-4 py-3 text-center border-b border-slate-200">Key</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mappings.map((m, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-white/50">
                                                <td className="px-4 py-2.5">{m.tc}</td>
                                                <td className="px-4 py-2.5">{m.sap}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <input type="checkbox" checked={m.isKey || false} onChange={() => { const keyCount = mappings.filter(x => x.isKey).length; const newMappings = [...mappings]; if (!newMappings[idx].isKey && keyCount >= 3) { Swal.fire('Only up to 3 key fields are allowed.', '', 'warning'); return; } newMappings[idx].isKey = !newMappings[idx].isKey; setMappings(newMappings); }} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
