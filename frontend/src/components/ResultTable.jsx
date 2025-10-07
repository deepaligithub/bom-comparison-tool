import React, { useEffect } from 'react';
import {
    FaCheckCircle, FaExclamationCircle, FaMinusCircle,
    FaSort, FaSortUp, FaSortDown, FaEye
} from 'react-icons/fa';
import RowDetailModal from './RowDetailModal';
import Badge from './Badge';

export default function ResultTable({
    comparisonResults,
    activeMapping,
    columns,
    setColumns,
    filter,
    setFilter,
    rowsPerPage,
    setRowsPerPage,
    currentPage,
    setCurrentPage,
    searchQuery,
    setSearchQuery,
    setSelectedRow,
    sortConfig,
    requestSort,
    selectedRow,
    handleSort,
    toggleColumn,
    compareError,
    errorRef,
    logFilename,
    handleDownloadLog
}) {
    const getStatusColor = (status) => {
        if (status === 'Matched') return 'text-green-700';
        if (status === 'Different') return 'text-red-600';
        if (status === 'TC Only') return 'text-blue-600';
        if (status === 'SAP Only') return 'text-yellow-700';
        return '';
    };

    const getRowColor = (status, index) => {
        const base =
            status === 'Matched' ? 'bg-green-50' :
                status === 'Different' ? 'bg-red-50' :
                    status === 'TC Only' ? 'bg-blue-50' :
                        status === 'SAP Only' ? 'bg-yellow-50' : '';
        return `${base} ${index % 2 === 0 ? 'bg-opacity-90' : 'bg-opacity-100'}`;
    };

    const getStatusIcon = (status) => {
        if (status === 'Matched') return <FaCheckCircle className="inline-block mr-1 text-green-600" title="Matched" />;
        if (status === 'Different') return <FaExclamationCircle className="inline-block mr-1 text-red-500" title="Different" />;
        if (status === 'TC Only') return <FaMinusCircle className="inline-block mr-1 text-blue-500" title="Only in Teamcenter" />;
        if (status === 'SAP Only') return <FaMinusCircle className="inline-block mr-1 text-yellow-500" title="Only in SAP" />;
        return null;
    };

    const tcKeys = activeMapping?.mappings?.map(m => m.tc);
    const sapKeys = activeMapping?.mappings?.map(m => m.sap);

    // Dynamic columns based on mapping
    const dynamicColumns = [];
    const mergedColumnKeys = new Set();

    if (activeMapping?.mappings && Array.isArray(activeMapping.mappings)) {
        activeMapping.mappings.forEach(({ tc, sap }) => {
            if (tc === sap) {
                // ✅ Same name in TC and SAP — show single column
                if (!mergedColumnKeys.has(tc)) {
                    dynamicColumns.push({
                        key: tc,
                        label: tc
                    });
                    mergedColumnKeys.add(tc);
                }
            } else {
                // ✅ Different names — show both with TC_ / SAP_ prefixes
                if (!mergedColumnKeys.has(tc)) {
                    dynamicColumns.push({
                        key: tc,
                        label: `TC_${tc}`
                    });
                    mergedColumnKeys.add(tc);
                }
                if (!mergedColumnKeys.has(sap)) {
                    dynamicColumns.push({
                        key: sap,
                        label: `SAP_${sap}`
                    });
                    mergedColumnKeys.add(sap);
                }
            }
        });
    }

    const allColumns = [
        ...dynamicColumns,
        { key: 'status', label: 'Status' },
        { key: 'actions', label: 'Actions' }
    ];

    // Filter
    let filteredRows = comparisonResults?.filter(row => {
        const matchStatus = filter === 'All' || row.status === filter || (filter === 'Different' && row.status === 'Different');
        const matchSearch = Object.values(row).some(val =>
            String(val).toLowerCase().includes(searchQuery.toLowerCase())
        );
        return matchStatus && matchSearch;
    }) || [];

    // Sort
    const sortedRows = [...filteredRows].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination
    const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedRows = sortedRows.slice(startIndex, endIndex);

    useEffect(() => {
        console.log("👁️ selectedRow:", selectedRow);
    }, [selectedRow]);


    return (
        <div className="space-y-4 mt-4">
            {/* Column toggles */}
            <div className="flex gap-4 items-center flex-wrap text-sm">
                <span className="font-semibold">Columns:</span>
                {allColumns.map(col => (
                    <label key={col.key} className="flex items-center gap-1">
                        <input
                            type="checkbox"
                            checked={columns[col.key] ?? true}
                            onChange={() => toggleColumn(col.key)}
                            disabled={col.key === 'actions'} // prevent toggling off
                        />
                        <span className={col.key === 'actions' ? 'font-semibold text-gray-500' : ''}>
                            {col.label}
                        </span>
                    </label>
                ))}
            </div>

            {/* Compare Error */}
            {compareError && (
                <div
                    ref={errorRef}
                    className="bg-red-100 text-red-700 px-4 py-2 rounded border border-red-300 font-medium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4"
                >
                    <div className="flex items-center gap-2">
                        ⚠️ {compareError}
                    </div>
                    {logFilename && (
                        <button
                            onClick={handleDownloadLog}
                            className="text-sm text-white bg-gray-700 hover:bg-gray-800 px-3 py-1 rounded transition"
                        >
                            Download Log
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto bg-white rounded shadow max-h-[70vh] overflow-y-auto">
                <table className="min-w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-gray-100 z-10 shadow-sm text-left">
                        <tr>
                            {allColumns.map(col =>
                                (columns[col.key] || col.key === 'actions') && (
                                    <th
                                        key={col.key}
                                        className="px-4 py-2 cursor-pointer select-none"
                                        onClick={() => col.key !== 'actions' && handleSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {col.key !== 'actions' && (
                                                sortConfig.key === col.key ? (
                                                    sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />
                                                ) : <FaSort className="text-gray-400" />
                                            )}
                                        </div>
                                    </th>
                                )
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.map((row, idx) => (
                            <tr
                                key={idx}
                                className={`${getRowColor(row.status, idx)} hover:bg-gray-100`}
                            >
                                {allColumns.map(col =>
                                    (col.key === 'actions' || columns[col.key]) && (
                                        <td key={col.key} className="px-4 py-2 whitespace-nowrap">
                                            {col.key === 'status' ? (
                                                <span className={`font-medium ${getStatusColor(row.status)}`}>
                                                    {getStatusIcon(row.status)} {row.status}
                                                </span>
                                            ) : col.key === 'actions' ? (
                                                <button
                                                    onClick={() => setSelectedRow(row)}
                                                    className="p-2 rounded-full hover:bg-blue-100 text-blue-600 text-lg"
                                                    title="View Details"
                                                >
                                                    <FaEye />
                                                </button>
                                            ) : (
                                                (() => {
                                                    const value = row[col.key];
                                                    const isEmpty = !value || String(value).trim() === '';
                                                    const isTC = col.label?.startsWith('TC_');
                                                    const isSAP = col.label?.startsWith('SAP_');

                                                    if (!isEmpty) return value;

                                                    if (isTC && row.status === 'SAP Only') {
                                                        return <Badge label="N/A" tooltip="Missing in Teamcenter" type="blue" />;
                                                    } else if (isSAP && row.status === 'TC Only') {
                                                        return <Badge label="N/A" tooltip="Missing in SAP" type="orange" />;
                                                    } else {
                                                        return <Badge label="N/A" tooltip="Value not available" type="gray" />;
                                                    }
                                                })()
                                            )}
                                        </td>
                                    )
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selectedRow && (
                <>
                    {console.log("🔍 Mapping passed to RowDetailModal:", activeMapping?.mappings)}
                    <RowDetailModal
                        row={selectedRow}
                        mapping={activeMapping?.mappings}
                        onClose={() => setSelectedRow(null)}
                    />
                </>
            )}
            {/* Pagination */}
            <div className="flex justify-end gap-2 text-sm">
                <button
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                >
                    Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                    <button
                        key={i}
                        className={`px-3 py-1 rounded ${currentPage === i + 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-blue-100'
                            }`}
                        onClick={() => setCurrentPage(i + 1)}
                    >
                        {i + 1}
                    </button>
                ))}
                <button
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                >
                    Next
                </button>
            </div>
        </div>
    );
}