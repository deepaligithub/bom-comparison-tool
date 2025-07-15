import React, { useState } from 'react';

export default function PaginatedMappingTable({ mappings }) {
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;

    const totalPages = Math.ceil(mappings.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const currentRows = mappings.slice(start, end);

    return (
        <>
            <table className="min-w-full text-sm border rounded">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                    <tr>
                        <th className="text-left px-4 py-2 border-r w-1/2">Teamcenter Column (TC)</th>
                        <th className="text-left px-4 py-2">SAP Column</th>
                    </tr>
                </thead>
                <tbody>
                    {currentRows.map((m, i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                            <td className="px-4 py-2 border-r font-mono text-gray-800">{m.tc}</td>
                            <td className="px-4 py-2 font-mono text-gray-800">{m.sap}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-center mt-4 gap-3 text-sm">
                <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-200 text-gray-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                    Prev
                </button>
                <span className="px-2 py-1">Page {currentPage} of {totalPages}</span>
                <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-200 text-gray-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                    Next
                </button>
            </div>
        </>
    );
}
