// ManageMappingModal.jsx — premium modal
import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import apiClient from '../../api/client';
import { toastSuccess, toastError } from '../../utils/toast';

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
      await apiClient.post('/api/update-mapping', {
        old_filename: mappingData.filename,
        new_filename: filename,
        mappings,
      });
      toastSuccess('Mapping updated');
      onClose();
      onRefresh();
    } catch (err) {
      toastError('Failed to save mapping');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        <div className="px-6 py-5 border-b border-slate-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            title="Close"
          >
            &times;
          </button>
          <h2 className="text-lg font-semibold text-slate-800 pr-10">Edit mapping</h2>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="font-medium text-slate-700 block mb-2">Filename</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>

          <div>
            <label className="font-medium text-slate-700 block mb-2">Columns</label>
            <div className="overflow-x-auto max-h-[360px] rounded-xl border border-slate-200">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Source BOM Column</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Target BOM Column</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 w-24">Key</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                          value={m.tc}
                          onChange={(e) => handleChange(idx, 'tc', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                          value={m.sap}
                          onChange={(e) => handleChange(idx, 'sap', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.isKey || false}
                          onChange={() => toggleIsKey(idx)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-3">
          <button
            className="px-4 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2.5 rounded-xl font-medium text-white bg-teal-600 hover:bg-teal-700 transition shadow-sm"
            onClick={handleSave}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
