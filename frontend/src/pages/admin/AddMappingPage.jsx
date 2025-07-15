import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { HiOutlineCode, HiOutlineCog } from 'react-icons/hi';
import Swal from 'sweetalert2';
import { FaDownload, FaPlus, FaArrowRight, FaPuzzlePiece, FaTrashAlt, FaSave, FaRedo } from 'react-icons/fa';
import axios from 'axios';

export default function AddMappingPage() {
    const tcFileRef = useRef();
    const sapFileRef = useRef();
    const [tcColumns, setTcColumns] = useState([]);
    const [sapColumns, setSapColumns] = useState([]);
    const [mappings, setMappings] = useState([{ tc: '', sap: '' }]);
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
        setMappings([{ tc: '', sap: '' }]);
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
        setMappings([{ tc: '', sap: '' }]);

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
                Swal.fire('SAP should not be PLMXML', '', 'error');
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
                        Swal.fire('SAP should not be PLMXML', '', 'error');
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
                    sap: parts[1]
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
            const res = await axios.get('/api/mappings');
            if (res.data.length >= 10) {
                Swal.fire(
                    'Limit Reached',
                    'Only 10 mappings are allowed. Please delete an existing one to add a new mapping.',
                    'warning'
                );
                return;
            }
            await axios.post('/api/save-mapping', {
                mode,
                mappings
            });
            Swal.fire('Mapping saved to backend!', '', 'success').then(() => {
                resetAll();  // ✅ Reset the page after success
            });
        } catch (error) {
            Swal.fire('Error saving to backend', '', 'error');
        }
    };

    const addMappingRow = () => setMappings([...mappings, { tc: '', sap: '' }]);
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
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6 flex space-x-2">
                <button
                    onClick={() => { setMode('ui'); resetAll(); }}
                    className={`flex items-center px-4 py-2 rounded-t-md text-sm font-semibold transition-colors duration-200 ${mode === 'ui'
                        ? 'bg-white border-b-2 border-blue-600 text-blue-600 shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-white'
                        }`}
                >
                    <HiOutlineCog className="mr-2" />
                    UI Mapping
                </button>

                <button
                    onClick={() => { setMode('manual'); resetAll(); }}
                    className={`flex items-center px-4 py-2 rounded-t-md text-sm font-semibold transition-colors duration-200 ${mode === 'manual'
                        ? 'bg-white border-b-2 border-blue-600 text-blue-600 shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-white'
                        }`}
                >
                    <HiOutlineCode className="mr-2" />
                    Manual Mapping
                </button>
            </div>

            {mode === 'ui' ? (
                <div>
                    <div className="grid sm:grid-cols-2 gap-6 mb-6">
                        <div className="border border-gray-300 rounded-lg shadow-sm p-4 bg-white">
                            <h4 className="font-semibold text-gray-700 mb-3">Upload Teamcenter BOM</h4>
                            <label className="relative inline-block mb-2">
                                <span className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-3 rounded cursor-pointer">
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
                                <div className="text-green-600 text-sm font-medium mb-1 truncate flex items-center gap-1">
                                    ✅ <span className="truncate">{tcFileName}</span>
                                </div>
                            )}
                            <p className="text-xs text-gray-500">Accepted formats: .csv, .json, .xlsx, .plmxml</p>
                        </div>

                        <div className="border border-gray-300 rounded-lg shadow-sm p-4 bg-white">
                            <h4 className="font-semibold text-gray-700 mb-3">Upload SAP BOM</h4>
                            <label className="relative inline-block mb-2">
                                <span className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-3 rounded cursor-pointer">
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
                                <div className="text-green-600 text-sm font-medium mb-1 truncate flex items-center gap-1">
                                    ✅ <span className="truncate">{sapFileName}</span>
                                </div>
                            )}
                            <p className="text-xs text-gray-500">Accepted formats: .csv, .json, .xlsx</p>
                        </div>
                    </div>

                    <div className="border p-4 rounded bg-gray-50">
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <FaPuzzlePiece className="text-indigo-500" /> Column Mappings
                        </h3>
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
                                        className="border border-gray-300 rounded px-3 py-1 w-1/3"
                                    >
                                        <option value="">Select TC Column</option>
                                        {availableTc.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>

                                    <span className="text-gray-500 text-xl"><FaArrowRight /></span>

                                    <select
                                        value={map.sap}
                                        onChange={e => handleMappingChange(idx, 'sap', e.target.value)}
                                        className="border border-gray-300 rounded px-3 py-1 w-1/3"
                                    >
                                        <option value="">Select SAP Column</option>
                                        {availableSap.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>

                                    <button onClick={() => removeMappingRow(idx)} className="text-red-500 hover:text-red-700 text-xl">
                                        <FaTrashAlt />
                                    </button>
                                </div>
                            );
                        })}

                        <button
                            onClick={addMappingRow}
                            disabled={!canAddRow}
                            className={`mt-2 px-4 py-2 text-sm font-semibold rounded flex items-center gap-2 ${canAddRow
                                ? 'text-blue-600 hover:underline'
                                : 'text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <FaPlus /> Add Mapping Row
                        </button>
                    </div>

                    <div className="mt-6 flex gap-4">
                        <button onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow flex items-center gap-2">
                            <FaSave /> Save Mapping
                        </button>
                        <button
                            onClick={resetAll}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded shadow flex items-center gap-2">
                            <FaRedo /> Reset
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <h2 className="text-xl font-bold mb-4">Admin Column Mapping</h2>
                    <div className="flex items-center gap-2 mb-1">
                        <label className="block font-semibold">Enter Mappings:</label>
                        <div className="relative inline-block group">
                            <span className="text-blue-600 font-bold cursor-pointer text-sm">ℹ️</span>
                            <div className="absolute z-10 w-72 p-3 text-sm text-gray-800 bg-white border border-gray-300 rounded shadow-md opacity-0 group-hover:opacity-100 group-hover:visible invisible transition-opacity duration-200 left-4 top-6">
                                <p className="mb-1 font-semibold text-gray-700">Supported formats:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><code>{'part number -> material id'}</code></li>
                                    <li><code>part number,material id</code></li>
                                    <li><code>"part number","material id"</code></li>
                                    <li>Paste from Excel (tabs auto-convert to commas)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="border p-2 bg-gray-100 rounded-t font-mono text-sm">
                        Syntax: tc column → sap column
                    </div>
                    <textarea
                        rows={8}
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData.getData('text/plain');
                            const formatted = text
                                .split('\n')
                                .map(line =>
                                    line
                                        .replace(/\t/g, ',')
                                        .split(',')
                                        .map(part => part.trim())
                                        .join(',')
                                )
                                .join('\n');
                            const newValue = manualInput ? `${manualInput}\n${formatted}` : formatted;
                            setManualInput(newValue);
                        }}
                        placeholder="part_id -> material_number"
                        className="w-full border p-2 rounded-b resize-y font-mono text-sm placeholder:text-gray-400"
                    />

                    <div className="flex gap-4 mb-4 mt-2">
                        <button
                            onClick={parseManualMappings}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            Parse Manual Mapping
                        </button>
                        <button
                            onClick={downloadManualMap}
                            disabled={!hasValidMappings}
                            className={`px-4 py-2 rounded flex items-center gap-2 ${hasValidMappings
                                ? 'bg-gray-500 hover:bg-gray-600 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <FaDownload /> Download Mapping
                        </button>
                        <button
                            onClick={saveMappingsToBackend}
                            disabled={!hasValidMappings}
                            className={`px-4 py-2 rounded flex items-center gap-2 ${hasValidMappings
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <FaSave /> Save Mapping
                        </button>
                        <button
                            onClick={() => { setManualInput(''); setMappings([]); }}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center gap-2"
                        >
                            <FaRedo /> Reset
                        </button>
                    </div>

                    {mappings.length > 0 && (
                        <div className="border p-4 rounded bg-gray-50 text-sm">
                            <h4 className="font-semibold mb-2">Parsed Mappings:</h4>
                            <ul className="list-disc list-inside">
                                {mappings.filter(m => m.tc && m.sap).map((m, i) => (
                                    <li key={i}>{`"${m.tc}" -> "${m.sap}"`}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
