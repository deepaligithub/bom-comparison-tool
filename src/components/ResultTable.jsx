import React from 'react';
import { FaSort, FaSortUp, FaSortDown, FaCube, FaDatabase, FaCheckCircle, FaExclamationCircle, FaEye, FaMinusCircle } from 'react-icons/fa';

export default function ResultTable({
  comparisonResults,
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
  results,
  toggleColumn
}) {
  const getStatusColor = (status) => {
    if (status === 'Matched') return 'text-green-700';
    if (status === 'Quantity Diff') return 'text-red-600';
    if (status === 'TC Only' || status === 'Only in TC') return 'text-blue-600';
    if (status === 'SAP Only' || status === 'Only in SAP') return 'text-yellow-700';
    return '';
  };
  const getRowColor = (status, index) => {
    const base =
      status === 'Matched' ? 'bg-green-50' :
        status === 'Quantity Diff' ? 'bg-red-50' :
          status === 'TC Only' || status === 'Only in TC' ? 'bg-blue-50' :
            status === 'SAP Only' || status === 'Only in SAP' ? 'bg-yellow-50' : '';
    return `${base} ${index % 2 === 0 ? 'bg-opacity-90' : 'bg-opacity-100'}`;
  };
  const getStatusIcon = (status) => {
    if (status === 'Matched') return <FaCheckCircle className="inline-block mr-1 text-green-600" title="Matched" />;
    if (status === 'Quantity Diff') return <FaExclamationCircle className="inline-block mr-1 text-red-500" title="Difference" />;
    if (status === 'TC Only') return <FaMinusCircle className="inline-block mr-1 text-blue-500" title="Only in Teamcenter" />;
    if (status === 'SAP Only') return <FaMinusCircle className="inline-block mr-1 text-yellow-500" title="Only in SAP" />;
    return null;
  };

  // 1. Filter rows
  let filteredRows = comparisonResults.filter(row => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Different' && row.status === 'Quantity Diff') ||
      row.status === filter;
    const matchesSearch = row.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // 2. Search
  filteredRows = filteredRows.filter(row =>
    row.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 3. Sort
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key];
    const valB = b[sortConfig.key];
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // 4. Paginate
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  const allColumns = [
    { key: 'partNumber', label: 'Part Number' },
    { key: 'description', label: 'Description' },
    { key: 'tcQty', label: 'TC Qty' },
    { key: 'sapQty', label: 'SAP Qty' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' }
  ];

  return (
    <div className="space-y-4 mt-4">
      {/* Column Toggles */}
      <div className="flex gap-4 items-center flex-wrap text-sm">
        <span className="font-semibold">Columns:</span>
        {allColumns.map(col => (
          <label key={col.key} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={columns[col.key]}
              onChange={() =>
                setColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))
              }
            />
            <span>{col.label}</span>
          </label>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded shadow max-h-[70vh] overflow-y-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-10 shadow-sm text-left">
            <tr>
              {columns.partNumber && (
                <th onClick={() => handleSort('id')} className="px-4 py-2 cursor-pointer">
                  <div className="flex items-center justify-between gap-1">
                    <span>Part Number</span>
                    {sortConfig.key === 'id' ? (
                      sortConfig.direction === 'asc' ? <FaSortUp /> :
                        sortConfig.direction === 'desc' ? <FaSortDown /> :
                          <FaSort />
                    ) : (
                      <FaSort />
                    )}
                  </div>
                </th>
              )}
              {columns.description && (
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('desc')}>
                  <div className="flex items-center justify-between gap-1">
                    <span>Description</span>
                    {sortConfig.key === 'desc' ? (
                      sortConfig.direction === 'asc' ? <FaSortUp /> :
                        sortConfig.direction === 'desc' ? <FaSortDown /> :
                          <FaSort />
                    ) : (
                      <FaSort />
                    )}
                  </div>
                </th>

              )}
              {columns.tcQty && (
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('tcQty')}>
                  <div className="flex items-center justify-between gap-1">
                    <span>TC Qty </span>
                    {sortConfig.key === 'tcQty' ? (
                      sortConfig.direction === 'asc' ? <FaSortUp /> :
                        sortConfig.direction === 'desc' ? <FaSortDown /> :
                          <FaSort />
                    ) : (
                      <FaSort />
                    )}
                  </div>
                </th>
              )}
              {columns.sapQty && (
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('sapQty')}>
                   <div className="flex items-center justify-between gap-1">
                  <span>SAP Qty</span>
                  {sortConfig.key === 'sapQty' ? (
                    sortConfig.direction === 'asc' ? <FaSortUp /> :
                      sortConfig.direction === 'desc' ? <FaSortDown /> :
                        <FaSort />
                  ) : (
                    <FaSort />
                  )}
                </div>
                </th>
              )}
            {columns.status && (
              <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleSort('status')}>
                <div className="flex items-center justify-between gap-1">
                  <span>Status</span>
                  {sortConfig.key === 'status' ? (
                    sortConfig.direction === 'asc' ? <FaSortUp className="ml-1" /> :
                      sortConfig.direction === 'desc' ? <FaSortDown className="ml-1" /> :
                        <FaSort className="ml-1" />
                  ) : (
                    <FaSort className="ml-1" />
                  )}
                </div>
              </th>
            )}
            {columns.action && (
              <th className="px-4 py-2 text-left w-1/6 min-w-[140px]">Action</th>
            )}
          </tr>
        </thead>
        <tbody>
          {paginatedRows.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center text-gray-500 py-4">
                No results found
              </td>
            </tr>
          ) : (
            paginatedRows.map((row, idx) => (
              <tr key={idx}
                className={`${getRowColor(row.status, idx)} hover:bg-opacity-70 transition duration-150 ease-in`}>
                {columns.partNumber && (
                  <td className="px-4 py-2 w-1/6 break-words whitespace-normal">{row.id}</td>
                )}
                {columns.description && (
                  <td className="px-4 py-2 w-1/6 break-words whitespace-normal">{row.desc}</td>
                )}
                {columns.tcQty && (
                  <td
                    className={`px-4 py-2 w-1/6 break-words whitespace-normal ${row.status === 'Quantity Diff' ? 'text-red-600 font-semibold' : ''
                      }`}
                  >
                    {row.tcQty}
                  </td>
                )}
                {columns.sapQty && (
                  <td
                    className={`px-4 py-2 w-1/6 break-words whitespace-normal ${row.status === 'Quantity Diff' ? 'text-red-600 font-semibold' : ''
                      }`}
                  >
                    {row.sapQty}
                  </td>
                )}
                {columns.status && (
                  <td className={`px-4 py-2 font-medium ${getStatusColor(row.status)}`}>
                    {getStatusIcon(row.status)} {row.status}
                  </td>
                )}
                {columns.action && (
                  <td className="px-4 py-2 w-1/6 break-words whitespace-normal text-blue-600 cursor-pointer">
                    <button
                      onClick={() => setSelectedRow(row)}
                      className="text-blue-600 hover:underline"
                      title="View Details"                      >
                      <FaEye className="inline-block mr-1" title="View Details" />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

      {/* Pagination */ }
  <div className="flex flex-col sm:flex-row items-center justify-between mt-4 text-sm gap-2">
    <div className="flex items-center gap-2">
      <label>Rows per page:</label>
      <select
        value={rowsPerPage}
        onChange={(e) => {
          setRowsPerPage(Number(e.target.value));
          setCurrentPage(1);
        }}
        className="border rounded px-2 py-1"
      >
        {[5, 10, 15, 20].map(num => (
          <option key={num} value={num}>{num}</option>
        ))}
      </select>
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
        disabled={currentPage === 1}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Prev
      </button>
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Next
      </button>
    </div>

    <div className="text-gray-600">
      Showing {startIndex + 1} to {Math.min(endIndex, sortedRows.length)} of {sortedRows.length} items
    </div>
  </div>
  {/* Selected Row part Details */ }
  {
    selectedRow && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg p-6 relative transition-all duration-300">
          <button
            onClick={() => setSelectedRow(null)}
            className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl"
            aria-label="Close"
          >
            ✖
          </button>

          <h2 className="text-xl font-bold mb-4 text-gray-800">Part Detail View</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Teamcenter Card */}
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <h3 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
                <FaCube className="text-blue-700" />
                Teamcenter Data
              </h3>
              <p><strong>Part Number:</strong> {selectedRow.id}</p>
              <p><strong>Description:</strong> {selectedRow.desc}</p>
              <p>
                <strong>Quantity:</strong>{' '}
                <span className={selectedRow.tcQty !== selectedRow.sapQty ? 'text-red-600 font-semibold' : ''}>
                  {selectedRow.tcQty}
                </span>
              </p>
            </div>

            {/* SAP Card */}
            <div className="bg-orange-50 p-4 rounded border border-orange-200">
              <h3 className="font-bold text-orange-700 mb-2 flex items-center gap-2">
                <FaDatabase className="text-orange-700" /> SAP Data
              </h3>
              <p><strong>Material Number:</strong> {selectedRow.id}</p>
              <p><strong>Description:</strong> {selectedRow.desc}</p>
              <p>
                <strong>Quantity:</strong>{' '}
                <span className={selectedRow.tcQty !== selectedRow.sapQty ? 'text-red-600 font-semibold' : ''}>
                  {selectedRow.sapQty}
                </span>
              </p>
            </div>
          </div>

          {/* Differences Block */}
          {selectedRow.status !== 'Matched' && (
            <div className="mt-4 bg-red-50 text-red-700 p-3 rounded border border-red-200">
              <h4 className="font-bold mb-1">Detected Differences</h4>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {selectedRow.tcQty !== selectedRow.sapQty && (
                  <li>Quantity mismatch: TC ({selectedRow.tcQty}) vs SAP ({selectedRow.sapQty})</li>
                )}
                {['Only in TC', 'TC Only'].includes(selectedRow.status) && <li>❌ Not found in SAP</li>}
                {['Only in SAP', 'SAP Only'].includes(selectedRow.status) && <li>❌ Not found in Teamcenter</li>}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-right">
            <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition" onClick={() => setSelectedRow(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
    </div >
  );
}
