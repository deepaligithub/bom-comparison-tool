import React from 'react';
import { FaCube, FaDatabase } from 'react-icons/fa';

export default function RowDetailModal({ row, mapping, onClose }) {
    if (!row) return null;

    const getMappedValue = (field) => row[field] ?? '-';

    const getMappedField = (label) => {
        const map = mapping?.find(m => m.tc === label || m.sap === label);
        return map ? map : { tc: label, sap: label };
    };

    const partNumberField = getMappedField('part_number');
    const descriptionField = getMappedField('desc') || getMappedField('description') || {};
    const quantityField = getMappedField('tc_quantity') || getMappedField('quantity');

    const tcQty = getMappedValue(quantityField.tc);
    const sapQty = getMappedValue(quantityField.sap);
    const status = row.status;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg p-6 relative transition-all duration-300">
                <button
                    onClick={onClose}
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
                        <p><strong>Part Number:</strong> {getMappedValue(partNumberField.tc)}</p>
                        <p><strong>Description:</strong> {getMappedValue(descriptionField.tc)}</p>
                        <p>
                            <strong>Quantity:</strong>{' '}
                            <span className={tcQty !== sapQty ? 'text-red-600 font-semibold' : ''}>
                                {tcQty}
                            </span>
                        </p>
                    </div>

                    {/* SAP Card */}
                    <div className="bg-orange-50 p-4 rounded border border-orange-200">
                        <h3 className="font-bold text-orange-700 mb-2 flex items-center gap-2">
                            <FaDatabase className="text-orange-700" /> SAP Data
                        </h3>
                        <p><strong>Material Number:</strong> {getMappedValue(partNumberField.sap)}</p>
                        <p><strong>Description:</strong> {getMappedValue(descriptionField.sap)}</p>
                        <p>
                            <strong>Quantity:</strong>{' '}
                            <span className={tcQty !== sapQty ? 'text-red-600 font-semibold' : ''}>
                                {sapQty}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Differences Block */}
                {status !== 'Matched' && (
                    <div className="mt-4 bg-red-50 text-red-700 p-3 rounded border border-red-200">
                        <h4 className="font-bold mb-1">Detected Differences</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {tcQty !== sapQty && (
                                <li>Quantity mismatch: TC ({tcQty}) vs SAP ({sapQty})</li>
                            )}
                            {['Only in TC', 'TC Only'].includes(status) && <li>❌ Not found in SAP</li>}
                            {['Only in SAP', 'SAP Only'].includes(status) && <li>❌ Not found in Teamcenter</li>}
                        </ul>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-6 text-right">
                    <button
                        onClick={onClose}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}