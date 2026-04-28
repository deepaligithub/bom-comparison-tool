import React, { useEffect, useRef, useState } from 'react';

export default function EditUserModal({ user, onClose, onSave }) {
  const modalRef = useRef();
  const [originalUser, setOriginalUser] = useState(null);
  const [isChanged, setIsChanged] = useState(false);
  const [editableUser, setEditableUser] = useState(user);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (user) {
      setOriginalUser(user);
      setEditableUser(user);
      setIsChanged(false);
    }
  }, [user]);

  useEffect(() => {
    if (!editableUser || !originalUser) return;
    const changed =
      editableUser.username !== originalUser.username ||
      editableUser.email !== originalUser.email ||
      editableUser.role !== originalUser.role ||
      editableUser.status !== originalUser.status;
    setIsChanged(changed);
  }, [editableUser, originalUser]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isChanged && !Object.values(errors).some(Boolean) && onSave) {
      onSave(editableUser);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn"
      >
        <button
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition z-10"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-semibold text-slate-800">Edit user</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              name="username"
              value={editableUser?.username || ''}
              onChange={(e) => {
                const value = e.target.value;
                setEditableUser({ ...editableUser, username: value });
                setErrors((prev) => ({ ...prev, username: value.trim() ? '' : 'Username is required' }));
              }}
              className={`w-full border rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${errors.username ? 'border-red-500' : 'border-slate-200'}`}
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={editableUser?.email || ''}
              onChange={(e) => {
                const value = e.target.value;
                setEditableUser({ ...editableUser, email: value });
                setErrors((prev) => ({
                  ...prev,
                  email: !value.trim() ? 'Email is required' : /^\S+@\S+\.\S+$/.test(value) ? '' : 'Invalid email format',
                }));
              }}
              className={`w-full border rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${errors.email ? 'border-red-500' : 'border-slate-200'}`}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                name="role"
                onChange={(e) => setEditableUser({ ...editableUser, role: e.target.value })}
                value={editableUser?.role || ''}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                name="status"
                onChange={(e) => setEditableUser({ ...editableUser, status: e.target.value })}
                value={editableUser?.status || ''}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isChanged || Object.values(errors).some(Boolean)}
              className={`px-5 py-2.5 rounded-xl font-medium transition ${isChanged && !Object.values(errors).some(Boolean) ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
