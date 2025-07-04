import Swal from 'sweetalert2';
import axios from 'axios';
import withReactContent from 'sweetalert2-react-content';
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import UploadSection from '../components/UploadSection';
import SummaryCards from '../components/SummaryCards';
import FilterTabs from '../components/FilterTabs';
import ResultTable from '../components/ResultTable';

export default function ComparePage() {
  const MySwal = withReactContent(Swal);
  const tcInputRef = useRef(null);
  const sapInputRef = useRef(null);
  const { dispatch, state } = useContext(AppContext);
  const { tcFile: prevTcFile, sapFile: prevSapFile } = state;

  const [tcError, setTcError] = useState('');
  const [sapError, setSapError] = useState('');
  const [compareError, setCompareError] = useState(null);
  const [logFilename, setLogFilename] = useState(null);
  const errorRef = useRef(null);
  const [tcValid, setTcValid] = useState(false);
  const [sapValid, setSapValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [filter, setFilter] = useState('All');
  const [columns, setColumns] = useState({
    partNumber: true,
    description: true,
    tcQty: true,
    sapQty: true,
    status: true,
    action: true
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const tcAcceptedTypes = ['.plmxml', '.json', '.csv'];
  const sapAcceptedTypes = ['.csv', '.json', '.xlsx'];
  const maxSizeMB = 50;

  const checkInitialFileInputs = () => {
    if (tcInputRef.current?.files.length === 0 && prevTcFile) {
      dispatch({ type: 'SET_TC_FILE', payload: null });
    }
    if (sapInputRef.current?.files.length === 0 && prevSapFile) {
      dispatch({ type: 'SET_SAP_FILE', payload: null });
    }
  };

  useEffect(() => {
    checkInitialFileInputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e, source) => {
    setUploading(true);
    const file = e.target.files[0];
    if (!file) return setUploading(false);

    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const fileSizeMB = file.size / (1024 * 1024);
    const isValid = source === 'tc' ? tcAcceptedTypes.includes(fileExt) : sapAcceptedTypes.includes(fileExt);

    if (!isValid || fileSizeMB > maxSizeMB) {
      const msg = !isValid
        ? `❌ Invalid file type: ${fileExt}`
        : `❌ File too large: ${fileSizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`;

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

  const handleCompare = async () => {
    // Validation check
    if (!prevTcFile || !prevSapFile || !tcValid || !sapValid) {
      await MySwal.fire({
        icon: 'warning',
        title: 'Upload Required',
        text: 'Please upload valid Teamcenter and SAP files.',
      });
      return;
    }
    // Ask for confirmation before clearing old results
    const result = await MySwal.fire({
      icon: 'question',
      title: 'Start Comparison?',
      text: 'Starting a new comparison will reset existing results.',
      showCancelButton: true,
      confirmButtonText: 'Yes, continue',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setLogFilename(null); // Clear old error
    setLoading(true); // Show spinner
    setCompareError(null); // Reset previous errors

    const formData = new FormData();
    formData.append('tcFile', prevTcFile);
    formData.append('sapFile', prevSapFile);

    try {
      const response = await axios.post('http://localhost:5000/api/compare', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const resultData = response.data;
      if (resultData.logFilename) {
        setLogFilename(resultData.logFilename); // ✅ store log filename
      }

      // Update frontend results (replace with how you structure your table)
      setComparisonResults([
        ...resultData.matched.map((item) => ({ ...item, status: 'Matched' })),
        ...resultData.differences.map((item) => ({ ...item, status: 'Quantity Diff' })),
        ...resultData.tc_only.map((item) => ({ ...item, status: 'TC Only' })),
        ...resultData.sap_only.map((item) => ({ ...item, status: 'SAP Only' })),
      ]);

      await MySwal.fire({
        icon: 'success',
        title: 'Comparison Complete',
        text: 'Results have been loaded successfully.',
      });

    } catch (err) {
      console.error("Comparison failed:", err);
      setCompareError("Comparison failed. Please check server logs or try again.");
      setLogFilename(null);

      setTimeout(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      await MySwal.fire({
        icon: 'error',
        title: 'Comparison Failed',
        text: 'Comparison failed. Please try again later.',
      });
    } finally {
      console.log("compareError:", compareError);
      console.log("logFilename:", logFilename);
      setLoading(false);  // Hide spinner
    }
  };

  const handleReset = async () => {
    const result = await MySwal.fire({
      icon: 'warning',
      title: 'Reset All?',
      text: 'This will clear uploaded files and results. Continue?',
      showCancelButton: true,
      confirmButtonText: 'Yes, reset',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    if (tcInputRef.current) tcInputRef.current.value = '';
    if (sapInputRef.current) sapInputRef.current.value = '';

    setTcError('');
    setSapError('');
    setTcValid(false);
    setSapValid(false);
    setLoading(false);
    setComparisonResults([]);
    setSearchQuery('');
    setCurrentPage(1);
    setFilter('All');

    dispatch({ type: 'SET_TC_FILE', payload: null });
    dispatch({ type: 'SET_SAP_FILE', payload: null });

    MySwal.fire('Reset done', '', 'success');
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };  // reset to original
      }
      return { key, direction: 'asc' };
    });
  };

  const toggleColumn = (key) => {
    setColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownloadLog = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/download-log/${logFilename}`, {
        responseType: 'blob',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = logFilename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download log:", err);
      MySwal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: 'Could not download the log file.',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Upload section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadSection
          source="tc"
          acceptedTypes={tcAcceptedTypes}
          file={prevTcFile}
          error={tcError}
          inputRef={tcInputRef}
          handleFileChange={handleFileChange}
        />
        <UploadSection
          source="sap"
          acceptedTypes={sapAcceptedTypes}
          file={prevSapFile}
          error={sapError}
          inputRef={sapInputRef}
          handleFileChange={handleFileChange}
        />
      </div>

      {/* Compare & Reset buttons */}
      <div className="text-center mt-4 space-x-2">
        <button
          onClick={handleCompare}
          disabled={loading || !tcValid || !sapValid}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded shadow disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Start Comparison'}
        </button>

        <button
          onClick={handleReset}
          className="bg-red-500 text-white px-6 py-2 rounded shadow hover:bg-red-600 transition"
        >
          Reset
        </button>
      </div>


      {/* Comparison Summary & Filters */}
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
          {/* Search Input below filter tabs */}
          <div className="relative w-full max-w-xs ml-auto">
            <input
              type="text"
              placeholder="Search Part Number"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page
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
          //requestSort={requestSort}
          handleSort={handleSort}
          toggleColumn={toggleColumn}
          //results={results}
          compareError={compareError}
          errorRef={errorRef}
          logFilename={logFilename}
          handleDownloadLog={handleDownloadLog}
        />
      </div>
    </div>
  );
}
