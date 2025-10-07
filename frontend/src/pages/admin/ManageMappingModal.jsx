// ManageMappingModal.jsx
import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';

export default function ManageMappingModal({ mappingData, onClose, onRefresh }) {
    const [filename, setFilename] = useState(mappingData.filename);
    const [mappings, setMappings] = useState(mappingData.mappings || []);

    useEffect(() => {
        setFilename(mappingData.filename);
        setMappings(mappingData.mappings || []);
    }, [mappingData]);

    const handleChange = (index, field, value) => {
        const updated = [...mappings];
        updated[index][field] = value;
        setMappings(updated);
    };

    const toggleIsKey = (index) => {
        const current = mappings[index];
        const isKeyCount = mappings.filter(m => m.isKey).length;
        if (!current.isKey && isKeyCount >= 3) {
            Swal.fire('Maximum 3 keys allowed', '', 'warning');
            return;
        }
        const updated = [...mappings];
        updated[index].isKey = !updated[index].isKey;
        setMappings(updated);
    };

    const handleSave = async () => {
        const keyCount = mappings.filter(m => m.isKey).length;
        if (keyCount < 1) {
            Swal.fire('At least one key column required', '', 'warning');
            return;
        }
        try {
            await axios.post('/api/update-mapping', {
                old_filename: mappingData.filename,
                new_filename: filename,
                mappings,
            });
            Swal.fire('Mapping updated successfully', '', 'success');
            onClose();
            onRefresh();
        } catch (err) {
            Swal.fire('Failed to save mapping', '', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl w-full relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-3 text-gray-500 hover:text-red-600 text-xl font-bold"
                    title="Close"
                >
                    &times;
                </button>

                <div className="mb-4">
                    <label className="font-semibold text-gray-700 block mb-1">Filename</label>
                    <input
                        type="text"
                        className="border p-2 rounded w-full"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto max-h-[400px] border rounded">
                    <table className="min-w-full text-sm border-collapse">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 border">TC Column</th>
                                <th className="px-4 py-2 border">SAP Column</th>
                                <th className="px-4 py-2 border text-center">Is Key?</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mappings.map((m, idx) => (
                                <tr key={idx} className="border-b">
                                    <td className="px-4 py-2 border">
                                        <input
                                            type="text"
                                            className="w-full border px-2 py-1 rounded"
                                            value={m.tc}
                                            onChange={(e) => handleChange(idx, 'tc', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-2 border">
                                        <input
                                            type="text"
                                            className="w-full border px-2 py-1 rounded"
                                            value={m.sap}
                                            onChange={(e) => handleChange(idx, 'sap', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-2 border text-center">
                                        <input
                                            type="checkbox"
                                            checked={m.isKey || false}
                                            onChange={() => toggleIsKey(idx)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end gap-3">
                    <button
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        onClick={handleSave}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
