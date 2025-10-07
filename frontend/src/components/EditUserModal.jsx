import React, { useEffect, useRef, useState } from 'react';

export default function EditUserModal({ user, onClose, onChange, onSubmit }) {
    const modalRef = useRef();
    const [originalUser, setOriginalUser] = useState(null);
    const [isChanged, setIsChanged] = useState(false);
    const [editableUser, setEditableUser] = useState(user);
    const [errors, setErrors] = useState({});


    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose(); // ESC closes modal
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (user) {
            setOriginalUser(user);
            setEditableUser(user);
            setIsChanged(false); // Reset change tracker
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


    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
            <div
                ref={modalRef}
                className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative"
            >
                {/* Close Button */}
                <button
                    className="absolute top-3 right-3 text-gray-500 hover:text-red-500 text-lg"
                    onClick={onClose}
                    aria-label="Close"
                >
                    ✖
                </button>

                {/* Title */}
                <h2 className="text-xl font-bold text-center text-gray-800 mb-6">
                    Edit User
                </h2>

                {/* Form */}
                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            name="username"
                            value={editableUser?.username || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setEditableUser({ ...editableUser, username: value });
                                setErrors((prev) => ({
                                    ...prev,
                                    username: value.trim() ? '' : 'Username is required',
                                }));
                            }}
                            className={`w-full border rounded-md px-3 py-2 outline-blue-500 focus:ring-2 ${errors.username ? 'border-red-500' : ''}`}
                        />
                        {errors.username && (
                            <p className="text-red-500 text-xs mt-1">{errors.username}</p>
                        )}

                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={editableUser?.email || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setEditableUser({ ...editableUser, email: value });
                                setErrors((prev) => ({
                                    ...prev,
                                    email: !value.trim()
                                        ? 'Email is required'
                                        : /^\S+@\S+\.\S+$/.test(value)
                                            ? ''
                                            : 'Invalid email format',
                                }));
                            }}
                            className={`w-full border rounded-md px-3 py-2 outline-blue-500 focus:ring-2 ${errors.email ? 'border-red-500' : ''}`}
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                        )}

                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                name="role"
                                onChange={(e) => setEditableUser({ ...editableUser, role: e.target.value })}
                                value={editableUser?.role || ''}
                                className="w-full border rounded-md px-3 py-2"
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                name="status"
                                onChange={(e) => setEditableUser({ ...editableUser, status: e.target.value })}
                                value={editableUser?.status || ''}
                                className="w-full border rounded-md px-3 py-2"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={(e) => {
                                e.preventDefault();
                                onSubmit(editableUser);
                            }}
                            disabled={!isChanged || Object.values(errors).some((e) => e)}
                            className={`px-4 py-2 rounded text-white ${isChanged && !Object.values(errors).some(e => e) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
