import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { Dialog } from '@headlessui/react';
import { FaTrashAlt, FaEye, FaEdit, FaInfoCircle } from 'react-icons/fa';
import { Switch } from '@headlessui/react';
import Swal from 'sweetalert2';
import { toastSuccess, toastError } from '../../utils/toast';
import PaginatedMappingTable from '../../components/PaginatedMappingTable';
import ManageMappingModal from '../admin/ManageMappingModal';

export default function LoadMappingPage() {
  const [mappingFiles, setMappingFiles] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const fetchMappings = async () => {
    try {
      const res = await apiClient.get('/api/mappings');
      const sorted = res.data.sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
      setMappingFiles(sorted);
    } catch (error) {
      console.error('Error fetching mappings:', error);
    }
  };

  const loadMapping = async (filename) => {
    try {
      const res = await apiClient.get(`/api/load-mapping/${filename}`);
      setSelectedMapping({ filename, ...res.data });
    } catch (error) {
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
      await apiClient.delete(`/api/mapping/${filename}`);
      toastSuccess('Mapping deleted');
      fetchMappings();
      setSelectedMapping(null);
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to delete mapping';
      toastError(msg);
    }
  };

  const handleToggle = async (filename, newStatus) => {
    try {
      setLoading(true);
      await apiClient.post(`/api/mapping/status/${filename}`, { status: newStatus });
      fetchMappings();
      setSelectedMapping(null);
    } catch (error) {
      const errMsg = error?.response?.data?.error || 'Failed to update status';
      Swal.fire('Error', errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = async (filename) => {
    try {
      const res = await apiClient.get(`/api/load-mapping/${filename}`);
      setSelectedMapping({ filename, ...res.data });
      setShowEditModal(true);
    } catch (err) {
      Swal.fire('Error loading mapping for edit', '', 'error');
    }
  };

  useEffect(() => {
    fetchMappings();
    setCurrentPage(1);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Premium info card */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-teal-50 to-slate-50 border border-teal-100/80 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
            <FaInfoCircle className="text-teal-600 text-xl" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-2">About mappings</p>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li>• Save <strong>as many mappings</strong> as you need.</li>
              <li>• <strong>Only one</strong> mapping can be active at a time.</li>
              <li>• The <strong>first saved mapping</strong> is set as active by default.</li>
              <li>• <strong>Active mapping cannot be deleted</strong>.</li>
              <li>• Toggling active status updates file timestamps.</li>
              <li>• <strong>Edit</strong> filename and fields anytime.</li>
            </ul>
          </div>
        </div>
      </div>

      {mappingFiles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FaEdit className="text-slate-400 text-2xl" />
          </div>
          <p className="text-slate-800 font-semibold text-lg mb-2">No mappings yet</p>
          <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">Create a column mapping to compare Source BOM and Target BOM.</p>
          <Link
            to="/admin/mapping/create"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl"
          >
            Create your first mapping
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {mappingFiles
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((file) => (
                <div
                  key={file.filename}
                  className="bg-white border border-slate-200/80 rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 p-6 flex flex-col justify-between min-h-[200px] group"
                >
                  <div>
                    <h4 className="text-base font-semibold text-slate-800 mb-2 break-words pr-2">{file.filename}</h4>
                    <p className="text-xs text-slate-500">Created: {file.created_at?.split('T')[0] || 'N/A'}</p>
                    <p className="text-xs text-slate-500">Updated: {file.updated_at?.replace('T', ' ').split('.')[0] || 'N/A'}</p>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">Active</span>
                      <Switch
                        checked={file.active === true}
                        onChange={() => handleToggle(file.filename, !file.active)}
                        className={`${file.active ? 'bg-teal-600' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200`}
                        disabled={loading}
                      >
                        <span className={`${file.active ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform bg-white rounded-full transition-transform duration-200 shadow`} />
                      </Switch>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => loadMapping(file.filename)}
                        className="p-2.5 rounded-xl text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition-all"
                        title="View"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => openEditModal(file.filename)}
                        className="p-2.5 rounded-xl text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-all"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => deleteMapping(file.filename)}
                        className="p-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
                        title="Delete"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Pagination */}
          {Math.ceil(mappingFiles.length / itemsPerPage) > 1 && (
            <div className="flex justify-end gap-2">
              <button
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${currentPage === 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              {Array.from({ length: Math.ceil(mappingFiles.length / itemsPerPage) }, (_, i) => (
                <button
                  key={i}
                  className={`min-w-[2.5rem] px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${currentPage === i + 1 ? 'bg-teal-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${currentPage === Math.ceil(mappingFiles.length / itemsPerPage) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(mappingFiles.length / itemsPerPage)))}
                disabled={currentPage === Math.ceil(mappingFiles.length / itemsPerPage)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Viewer Dialog */}
      {selectedMapping && !showEditModal && (
        <Dialog open={true} onClose={() => setSelectedMapping(null)} className="relative z-50">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-2xl overflow-y-auto max-h-[85vh] border border-slate-200">
              <Dialog.Title className="text-lg font-semibold text-slate-800 mb-6 pb-4 border-b border-slate-200">
                Mapping: <span className="font-mono text-teal-700">{selectedMapping.filename}</span>
              </Dialog.Title>

              {Array.isArray(selectedMapping.mappings) && selectedMapping.mappings.length <= 20 ? (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        <th className="text-left px-5 py-3 border-b border-r border-slate-200 w-1/2">Source BOM Column</th>
                        <th className="text-left px-5 py-3 border-b border-slate-200">Target BOM Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMapping.mappings.map((m, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-5 py-2.5 border-r border-slate-100 font-mono text-slate-800">{m.tc}</td>
                          <td className="px-5 py-2.5 font-mono text-slate-800">{m.sap}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <PaginatedMappingTable mappings={selectedMapping.mappings || []} />
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedMapping(null)}
                  className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-all"
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}

      {showEditModal && selectedMapping && (
        <ManageMappingModal
          mappingData={selectedMapping}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMapping(null);
          }}
          onRefresh={fetchMappings}
        />
      )}
    </div>
  );
}
