import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Dialog } from '@headlessui/react';
import { FaTrashAlt, FaEye, FaEdit } from 'react-icons/fa';
import { Switch } from '@headlessui/react';
import Swal from 'sweetalert2';
import PaginatedMappingTable from '../../components/PaginatedMappingTable';

export default function LoadMappingPage() {
    const [mappingFiles, setMappingFiles] = useState([]);
    const [selectedMapping, setSelectedMapping] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const fetchMappings = async () => {
        try {
            const res = await axios.get('/api/mappings');
            const sorted = res.data.sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
            setMappingFiles(sorted);
        } catch (error) {
            console.error('Error fetching mappings:', error);
        }
    };

    const loadMapping = async (filename) => {
        try {
            const res = await axios.get(`/api/load-mapping/${filename}`);
            setSelectedMapping({ filename, ...res.data });
        } catch (error) {
            console.error('Error loading mapping:', error);
            Swal.fire('Error loading mapping', '', 'error');
        }
    };

    const deleteMapping = async (filename) => {
        const confirm = await Swal.fire({
            title: 'Delete Mapping?',
            text: `Are you sure you want to delete "${filename}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
        });

        if (!confirm.isConfirmed) return;

        try {
            await axios.delete(`/api/mapping/${filename}`);
            Swal.fire('Deleted!', 'Mapping has been deleted.', 'success');
            fetchMappings();
            setSelectedMapping(null);
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to delete mapping';
            Swal.fire(msg, '', 'error');
        }
    };

    const handleToggle = async (filename, newStatus) => {
        try {
            setLoading(true);
            await axios.post(`/api/mapping/status/${filename}`, { status: newStatus });
            fetchMappings();
            setSelectedMapping(null);
        } catch (error) {
            const errMsg = error?.response?.data?.error || 'Failed to update status';
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };
    const renameFile = async (oldName) => {
        const { value: newName } = await Swal.fire({
            title: 'Rename Mapping File',
            input: 'text',
            inputLabel: 'New filename (without extension)',
            inputValue: oldName.replace('.json', ''),
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || !/^[\w-]+$/.test(value)) {
                    return 'Enter a valid filename (letters, numbers, underscore, Hyphen)';
                }
                return null;
            }
        });

        if (!newName || newName === oldName.replace('.json', '')) return;

        const newFullName = `${newName}.json`;

        try {
            await axios.post(`/api/rename-mapping`, {
                old_name: oldName,
                new_name: newFullName
            });

            Swal.fire('Renamed!', '', 'success');
            fetchMappings();

            // ✅ Update detail view if currently showing this file
            if (selectedMapping?.filename === oldName) {
                setSelectedMapping(prev => ({
                    ...prev,
                    filename: newFullName
                }));
            }

        } catch (err) {
            Swal.fire('Rename failed', '', 'error');
        }
    };

    useEffect(() => {
        fetchMappings();
        setCurrentPage(1); // Reset to first page
    }, []);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-900">
                <ul className="list-disc list-inside space-y-1"><b>Note -</b>
                    <li><strong>Maximum 10 mappings</strong> can be saved.</li>
                    <li><strong>Only one</strong> mapping can be active at a time.</li>
                    <li>The <strong>first saved mapping</strong> is automatically set as active.</li>
                    <li><strong>Active mapping cannot be deleted</strong>.</li>
                    <li>Toggling active status only updates the involved files' timestamps.</li>
                </ul>
            </div>
            <div className="rounded-lg mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
                    {mappingFiles
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((file, index) => {
                            const cardColors = ['bg-white', 'bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-pink-50', 'bg-purple-50'];
                            const colorClass = cardColors[index % cardColors.length];

                            return (
                                <div
                                    key={file.filename}
                                    className={`${colorClass} border border-gray-300 rounded-lg shadow p-4 flex flex-col justify-between h-full`}
                                >
                                    <div>
                                        <h4 className="text-md font-semibold mb-1 break-words">{file.filename}</h4>
                                        <p className="text-xs text-gray-600">Created: {file.created_at?.split('T')[0] || 'N/A'}</p>
                                        <p className="text-xs text-gray-600 mb-2">
                                            Updated: {file.updated_at?.replace('T', ' ').split('.')[0] || 'N/A'}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between mt-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-700">Active</span>
                                            <Switch
                                                checked={file.active === true}
                                                onChange={() => handleToggle(file.filename, !file.active)}
                                                className={`${file.active ? 'bg-green-500' : 'bg-gray-300'
                                                    } relative inline-flex h-5 w-10 items-center rounded-full transition-colors`}
                                                disabled={loading}
                                            >
                                                <span
                                                    className={`${file.active ? 'translate-x-5' : 'translate-x-1'
                                                        } inline-block h-4 w-4 transform bg-white rounded-full transition-transform`}
                                                />
                                            </Switch>
                                        </div>

                                        <div className="flex gap-3 text-sm text-gray-600">
                                            <button
                                                onClick={() => loadMapping(file.filename)}
                                                className="hover:text-blue-700"
                                                title="View"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                onClick={() => renameFile(file.filename)}
                                                className="hover:text-yellow-700"
                                                title="Rename"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                onClick={() => deleteMapping(file.filename)}
                                                className="hover:text-red-700"
                                                title="Delete"
                                            >
                                                <FaTrashAlt />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-end mt-4 space-x-2">
                    <button
                        className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Prev
                    </button>

                    {Array.from({ length: Math.ceil(mappingFiles.length / itemsPerPage) }, (_, i) => (
                        <button
                            key={i}
                            className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-100'}`}
                            onClick={() => setCurrentPage(i + 1)}
                        >
                            {i + 1}
                        </button>
                    ))}

                    <button
                        className={`px-3 py-1 rounded ${currentPage === Math.ceil(mappingFiles.length / itemsPerPage) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(mappingFiles.length / itemsPerPage)))}
                        disabled={currentPage === Math.ceil(mappingFiles.length / itemsPerPage)}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Mapping Viewer Section */}
            {selectedMapping && (
                <Dialog open={true} onClose={() => setSelectedMapping(null)} className="relative z-50">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

                    {/* Modal Panel */}
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl overflow-y-auto max-h-[80vh]">
                            <Dialog.Title className="text-lg font-bold text-blue-800 mb-4 border-b pb-2">
                                Mapping Details: <span className="font-mono text-gray-700">{selectedMapping.filename}</span>
                            </Dialog.Title>

                            {Array.isArray(selectedMapping.mappings) && selectedMapping.mappings.length <= 20 ? (
                                <div className="max-h-64 overflow-y-auto border rounded">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0">
                                            <tr>
                                                <th className="text-left px-4 py-2 border-r w-1/2">Teamcenter Column (TC)</th>
                                                <th className="text-left px-4 py-2">SAP Column</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedMapping.mappings.map((m, i) => (
                                                <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                                    <td className="px-4 py-2 border-r font-mono text-gray-800">{m.tc}</td>
                                                    <td className="px-4 py-2 font-mono text-gray-800">{m.sap}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <PaginatedMappingTable mappings={selectedMapping.mappings || []} />
                            )}

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => setSelectedMapping(null)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Close
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Dialog>
            )}
        </div>
    );

}
