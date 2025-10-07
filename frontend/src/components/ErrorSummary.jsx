import React, { useState } from 'react';
import { FaChevronRight, FaChevronDown, FaExclamationTriangle, FaBan, FaExchangeAlt } from 'react-icons/fa';

const CollapsibleSection = ({ icon, title, data, renderRow, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);

    if (!data || data.length === 0) return null;

    return (
        <div className="border rounded-lg p-3 bg-white shadow">
            <button
                className="w-full flex justify-between items-center font-semibold text-left text-red-700 hover:bg-red-50 px-2 py-1 rounded transition"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-2 text-base">
                    {icon}
                    {title} <span className="text-sm text-gray-600">({data.length})</span>
                </div>
                <div>
                    {open ? <FaChevronDown /> : <FaChevronRight />}
                </div>
            </button>

            {open && (
                <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                    {data.map((row, idx) => (
                        <div
                            key={idx}
                            className="bg-red-50 border border-red-200 p-2 rounded text-sm font-mono"
                        >
                            {renderRow(row, idx)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function ErrorSummary({ skippedRows, invalidRows, missingMappings }) {
    if (
        (!skippedRows || skippedRows.length === 0) &&
        (!invalidRows || invalidRows.length === 0) &&
        (!missingMappings || missingMappings.length === 0)
    ) {
        return null;
    }

    return (
        <div className="border border-red-400 bg-red-100 text-red-900 p-4 rounded-lg shadow-md space-y-4 max-h-[400px] overflow-y-auto">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <FaExclamationTriangle className="text-red-600" /> Data Issues Detected
            </h3>

            <CollapsibleSection
                icon={<FaExchangeAlt className="text-orange-600" />}
                title="Mapped fields Missing in Uploaded Files"
                data={missingMappings}
                renderRow={(row) => (
                    <div>
                        {row.tc_missing?.length > 0 && (
                            <div><strong>Missing in TC File:</strong> {row.tc_missing.join(', ')}</div>
                        )}
                        {row.sap_missing?.length > 0 && (
                            <div><strong>Missing in SAP File:</strong> {row.sap_missing.join(', ')}</div>
                        )}
                    </div>
                )}
            />

            <CollapsibleSection
                icon={<FaBan className="text-red-700" />}
                title="Invalid Data Rows (Empty or Non-Comparable Fields)"
                data={invalidRows}
                renderRow={(row) => (
                    <div>
                        <div><strong>Source:</strong> {row.source || 'Unknown'}</div>
                        <div className="grid grid-cols-2 gap-1">
                            {Object.entries(row.row || row).map(([k, v]) => (
                                <div key={k}><strong>{k}:</strong> {v || 'N/A'}</div>
                            ))}
                        </div>
                    </div>
                )}
            />

            <CollapsibleSection
                icon={<FaExchangeAlt className="text-yellow-700" />}
                title="Skipped Due to Missing Keys (Rows or Columns)"
                data={skippedRows}
                renderRow={(row) => (
                    <div>
                        <div><strong>Source:</strong> {row.source || 'Unknown'}</div>
                        <div className="grid grid-cols-2 gap-1">
                            {Object.entries(row.row || row).map(([k, v]) => (
                                <div key={k}><strong>{k}:</strong> {v || 'N/A'}</div>
                            ))}
                        </div>
                    </div>
                )}
            />
        </div>
    );
}
