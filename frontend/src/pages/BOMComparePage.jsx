import React, { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import UploadSection from '../components/UploadSection';
import SummaryCards from '../components/SummaryCards';
import FilterTabs from '../components/FilterTabs';
import ResultTable from '../components/ResultTable';
import Papa from 'papaparse';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import axios from 'axios';

export default function BOMComparePage() {
    const MySwal = withReactContent(Swal);
    const tcInputRef = useRef(null);
    const sapInputRef = useRef(null);
    const errorRef = useRef(null);

    const { dispatch, state } = useContext(AppContext);
    const { tcFile, sapFile } = state;

    const [tcError, setTcError] = useState('');
    const [sapError, setSapError] = useState('');
    const [tcValid, setTcValid] = useState(false);
    const [sapValid, setSapValid] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeMapping, setActiveMapping] = useState(null);
    const [comparisonResults, setComparisonResults] = useState([]);
    const [logFilename, setLogFilename] = useState(null);
    const [compareError, setCompareError] = useState(null);

    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [columns, setColumns] = useState({});
    const [selectedRow, setSelectedRow] = useState(null);

    const tcAcceptedTypes = ['.csv', '.xlsx'];
    const sapAcceptedTypes = ['.csv', '.xlsx'];

    const maxSizeMB = 50;

    useEffect(() => {
        fetchActiveMapping();
    }, []);

    const fetchActiveMapping = async () => {
        try {
            const res = await axios.get('/api/mappings');
            const activeFile = res.data.find(f => f.active);
            if (!activeFile) return;

            const fileRes = await axios.get(`/api/load-mapping/${activeFile.filename}`);
            setActiveMapping(fileRes.data);
        } catch (err) {
            console.error('Failed to load active mapping:', err);
        }
    };

    const handleFileChange = (e, source) => {
        setUploading(true);
        const file = e.target.files[0];
        if (!file) return setUploading(false);

        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const fileSizeMB = file.size / (1024 * 1024);
        const isValid = source === 'tc'
            ? tcAcceptedTypes.includes(fileExt)
            : sapAcceptedTypes.includes(fileExt);

        const msg = !isValid
            ? `❌ Invalid file type: ${fileExt}`
            : `❌ File too large: ${fileSizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`;

        if (!isValid || fileSizeMB > maxSizeMB) {
            if (source === 'tc') {
                setTcError(msg);
                setTcValid(false);
                dispatch({ type: 'SET_TC_FILE', payload: null });
            } else {
                setSapError(msg);
                setSapValid(false);
                dispatch({ type: 'SET_SAP_FILE', payload: null });
            }
            e.target.value = '';
            setUploading(false);
            return;
        }

        if (source === 'tc') {
            dispatch({ type: 'SET_TC_FILE', payload: file });
            setTcError('');
            setTcValid(true);
        } else {
            dispatch({ type: 'SET_SAP_FILE', payload: file });
            setSapError('');
            setSapValid(true);
        }

        setUploading(false);
    };

    const readCSVHeaders = (file) => {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: header => header.trim(),
                complete: (results) => resolve(results.meta.fields),
                error: reject
            });
        });
    };

    const handleCompare = async () => {
        if (!tcFile || !sapFile) {
            Swal.fire('Please upload both TC and SAP files.');
            return;
        }

        if (!activeMapping || !activeMapping.mappings) {
            Swal.fire('No active mapping found. Please activate one in Manage Mappings.');
            return;
        }

        const confirm = await MySwal.fire({
            icon: 'question',
            title: 'Start Comparison?',
            text: 'This will overwrite current results.',
            showCancelButton: true,
            confirmButtonText: 'Yes, compare',
        });

        if (!confirm.isConfirmed) return;

        try {
            const [tcHeaders, sapHeaders] = await Promise.all([
                readCSVHeaders(tcFile),
                readCSVHeaders(sapFile)
            ]);

            const mappedTcColumns = activeMapping.mappings.map(m => m.tc);
            const mappedSapColumns = activeMapping.mappings.map(m => m.sap);

            const missingTc = mappedTcColumns.filter(col =>
                !tcHeaders.map(h => h.trim().toLowerCase()).includes(col.trim().toLowerCase())
            );

            const missingSap = mappedSapColumns.filter(col =>
                !sapHeaders.map(h => h.trim().toLowerCase()).includes(col.trim().toLowerCase())
            );

            console.log("TC Headers:", tcHeaders);
            console.log("SAP Headers:", sapHeaders);
            console.log("Mapped TC Columns:", mappedTcColumns);
            console.log("Mapped SAP Columns:", mappedSapColumns);
            Swal.fire(`TC Headers: ${tcHeaders.join(', ')}`);

            if (missingTc.length || missingSap.length) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Column Mismatch',
                    html: `
            ${missingTc.length ? `<b>Missing in TC:</b><br>${missingTc.join(', ')}<br><br>` : ''}
            ${missingSap.length ? `<b>Missing in SAP:</b><br>${missingSap.join(', ')}` : ''}
          `
                });
                return;
            }

            setLoading(true);
            const formData = new FormData();
            formData.append('tcFile', tcFile);
            formData.append('sapFile', sapFile);

            const res = await axios.post('/api/compare', formData);
            console.log('Compare API Response:', res.data);
            setLogFilename(res.data.logFilename);

            // Dynamically build column keys with TC_ and SAP_
            const mapRow = (row, status) => {
                const rowData = { status };
                activeMapping.mappings.forEach(m => {
                    rowData[m.tc] = row[m.tc] || '';
                    rowData[m.sap] = row[m.sap] || '';
                });
                console.log('Mapped Row:', rowData);
                return rowData;
            };

            const allRows = [
                ...res.data.matched.map(r => mapRow(r, 'Matched')),
                ...res.data.differences.map(r => mapRow(r, 'Quantity Diff')),
                ...res.data.tc_only.map(r => mapRow(r, 'TC Only')),
                ...res.data.sap_only.map(r => mapRow(r, 'SAP Only')),
            ];

            setComparisonResults(allRows);

            // Set columns for filtering/toggling
            const colKeys = allRows.length > 0 ? Object.keys(allRows[0]) : [];
            const colMap = {};
            colKeys.forEach(k => colMap[k] = true);
            setColumns(colMap);

            await Swal.fire({
                icon: 'success',
                title: 'Comparison Done',
                timer: 1300,
                showConfirmButton: false
            });

        } catch (err) {
            console.error(err);
            setCompareError('Comparison failed.');
            await Swal.fire('Comparison failed', '', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Reset All?',
            text: 'This will clear uploads and results.',
            showCancelButton: true,
            confirmButtonText: 'Reset',
        });
        if (!confirm.isConfirmed) return;

        tcInputRef.current.value = '';
        sapInputRef.current.value = '';
        dispatch({ type: 'SET_TC_FILE', payload: null });
        dispatch({ type: 'SET_SAP_FILE', payload: null });

        setTcError('');
        setSapError('');
        setTcValid(false);
        setSapValid(false);
        setComparisonResults([]);
        setCompareError(null);
        setLogFilename(null);
        setFilter('All');
        setSearchQuery('');
        setCurrentPage(1);

        await Swal.fire('Reset done', '', 'success');
    };

    const handleSort = (key) => {
        setSortConfig(prev =>
            prev.key === key
                ? (prev.direction === 'asc'
                    ? { key, direction: 'desc' }
                    : { key: '', direction: null })
                : { key, direction: 'asc' }
        );
    };

    const toggleColumn = (key) => {
        setColumns(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleDownloadLog = async () => {
        try {
            const res = await axios.get(`/api/download-log/${logFilename}`, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = logFilename;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            Swal.fire('Log download failed', '', 'error');
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UploadSection
                    source="tc"
                    acceptedTypes={tcAcceptedTypes}
                    file={tcFile}
                    error={tcError}
                    inputRef={tcInputRef}
                    handleFileChange={handleFileChange}
                />
                <UploadSection
                    source="sap"
                    acceptedTypes={sapAcceptedTypes}
                    file={sapFile}
                    error={sapError}
                    inputRef={sapInputRef}
                    handleFileChange={handleFileChange}
                />
            </div>

            {/* Compare / Reset Buttons */}
            <div className="text-center mt-4 space-x-2">
                <button
                    onClick={handleCompare}
                    disabled={!tcValid || !sapValid || loading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded shadow disabled:opacity-50"
                >
                    {loading ? 'Comparing...' : 'Start Comparison'}
                </button>
                <button
                    onClick={handleReset}
                    className="bg-red-500 text-white px-6 py-2 rounded shadow hover:bg-red-600 transition"
                >
                    Reset
                </button>
            </div>

            {/* Results */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Comparison Results</h2>
                    <div className="flex gap-2">
                        <button className="bg-green-600 text-white px-4 py-1 rounded">Export Excel</button>
                        <button className="bg-gray-600 text-white px-4 py-1 rounded">Export PDF</button>
                        <button className="bg-blue-600 text-white px-4 py-1 rounded">Email Report</button>
                    </div>
                </div>

                <SummaryCards results={comparisonResults} />

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <FilterTabs
                        currentFilter={filter}
                        onChange={setFilter}
                        counts={{
                            All: comparisonResults.length,
                            Matched: comparisonResults.filter(r => r.status === 'Matched').length,
                            Different: comparisonResults.filter(r => r.status === 'Quantity Diff').length,
                            'TC Only': comparisonResults.filter(r => r.status === 'TC Only').length,
                            'SAP Only': comparisonResults.filter(r => r.status === 'SAP Only').length,
                        }}
                    />
                    <div className="relative w-full max-w-xs ml-auto">
                        <input
                            type="text"
                            placeholder="Search Part Number"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-2 text-gray-500 hover:text-black text-sm"
                                title="Clear"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <ResultTable
                    comparisonResults={comparisonResults}
                    filter={filter}
                    setFilter={setFilter}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    columns={columns}
                    setColumns={setColumns}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    rowsPerPage={rowsPerPage}
                    setRowsPerPage={setRowsPerPage}
                    selectedRow={selectedRow}
                    setSelectedRow={setSelectedRow}
                    handleSort={handleSort}
                    toggleColumn={toggleColumn}
                    compareError={compareError}
                    errorRef={errorRef}
                    logFilename={logFilename}
                    handleDownloadLog={handleDownloadLog}
                    activeMapping={activeMapping}
                />
            </div>
        </div>
    );
}
