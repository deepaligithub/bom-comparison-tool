import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import Swal from 'sweetalert2';
import { FaEdit, FaTrash, FaSort, FaUserShield, FaEye, FaSearch, FaArrowLeft } from 'react-icons/fa';
import EditUserModal from '../components/EditUserModal';


export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', email: '', role: 'user', status: 'Active' });
  const [searchQuery, setSearchQuery] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('none');
  const [editModal, setEditModal] = useState({ isOpen: false, user: null });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const resetForm = () => {
    setForm({ username: '', email: '', role: 'user', status: 'Active' });
  };

  const validateForm = () => {
    const errors = {};
    if (!form.username.trim()) errors.username = 'Username is required';
    if (!form.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errors.email = 'Invalid email format';
    }
    if (!form.role) errors.role = 'Role is required';
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    setFormErrors((prevErrors) => {
      const newErrors = { ...prevErrors };

      if (name === 'username') {
        newErrors.username = value.trim() ? '' : 'Username is required';
      }

      if (name === 'email') {
        if (!value.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/^\S+@\S+\.\S+$/.test(value)) {
          newErrors.email = 'Invalid email format';
        } else {
          newErrors.email = '';
        }
      }

      if (name === 'role') {
        newErrors.role = value ? '' : 'Role is required';
      }

      return newErrors;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();

    if (!form.username.trim()) {
      errors.username = 'Username is required.';
    }

    if (!form.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errors.email = 'Email is not valid.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await apiClient.post('/api/users', form);
      Swal.fire('Added!', 'User added successfully.', 'success');
      fetchUsers();
      resetForm();
    } catch (err) {
      Swal.fire('Error', 'Something went wrong.', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this user!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
    });

    if (confirm.isConfirmed) {
      try {
        await apiClient.delete(`/api/users/${id}`);
        Swal.fire('Deleted!', 'User has been deleted.', 'success');
        fetchUsers();
      } catch (err) {
        Swal.fire('Error', 'Deletion failed.', 'error');
      }
    }
  };

  const handleEdit = (user) => {
    setEditModal({ isOpen: true, user });
  };

  const handleUpdate = async (updatedUser) => {
    const userToSave = updatedUser || editModal.user;
    if (!userToSave?.id) return;
    try {
      await apiClient.put(`/api/users/${userToSave.id}`, userToSave);
      Swal.fire('Updated!', 'User updated successfully.', 'success');
      setEditModal({ isOpen: false, user: null });
      fetchUsers();
    } catch (err) {
      Swal.fire('Error', 'Failed to update user.', 'error');
    }
  };

  // Search, Sort, Paginate
  const filteredUsers = users.filter((user) =>
    Object.values(user).some((val) =>
      typeof val === 'string' && val.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortOrder === 'none') return 0;
    const valA = String(a[sortField] || '').toLowerCase();
    const valB = String(b[sortField] || '').toLowerCase();
    return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

  const paginatedUsers = sortedUsers.slice((currentPage - 1) * perPage, currentPage * perPage);
  const totalPages = Math.ceil(filteredUsers.length / perPage);

  const handleSort = (field) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('asc');
    } else {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? 'none' : 'asc'));
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];

    // Always show 1st page
    pages.push(
      <button
        key={1}
        onClick={() => setCurrentPage(1)}
        className={`w-9 h-9 rounded-xl text-sm font-medium flex items-center justify-center border transition ${currentPage === 1 ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}
      >
        1
      </button>
    );

    // Show ... if needed before current
    if (currentPage > 3) {
      pages.push(
        <span key="start-ellipsis" className="px-1 text-gray-500 text-sm">
          ...
        </span>
      );
    }

    // Pages around current
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages && !pages.find(p => p.key === i.toString())) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`w-9 h-9 rounded-xl text-sm font-medium flex items-center justify-center border transition ${currentPage === i ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}
          >
            {i}
          </button>
        );
      }
    }

    // Show ... if needed after current
    if (currentPage < totalPages - 2) {
      pages.push(
        <span key="end-ellipsis" className="px-1 text-gray-500 text-sm">
          ...
        </span>
      );
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(
        <button
          key={totalPages}
          onClick={() => setCurrentPage(totalPages)}
            className={`w-9 h-9 rounded-xl text-sm font-medium flex items-center justify-center border transition ${currentPage === totalPages ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div className="flex items-center justify-center gap-1 mt-2">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-teal-600 hover:bg-slate-100 transition disabled:opacity-40"
        >
          ‹
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-teal-600 hover:bg-slate-100 transition disabled:opacity-40"
        >
          ›
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 font-medium text-sm mb-6 transition-colors" aria-label="Back to Home">
        <FaArrowLeft aria-hidden /> Back to Home
      </Link>
      <h1 className="text-2xl font-semibold text-slate-800 tracking-tight mb-8">User management</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-80 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">Add new user</h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <FaUserShield />
              </span>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Username"
                className={`w-full pl-10 border px-3 py-2.5 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${formErrors.username ? 'border-red-500' : 'border-slate-200'}`}
              />
              {formErrors.username && <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.username}</p>}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <FaEye />
              </span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                className={`w-full pl-10 border px-3 py-2.5 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${formErrors.email ? 'border-red-500' : 'border-slate-200'}`}
              />
              {formErrors.email && <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.email}</p>}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <FaUserShield />
              </span>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className={`w-full pl-10 border px-3 py-2.5 rounded-xl bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${formErrors.role ? 'border-red-500' : 'border-slate-200'}`}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {formErrors.role && <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.role}</p>}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">●</span>
              <input name="status" value={form.status} readOnly className="w-full pl-10 border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 text-slate-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-teal-700 transition shadow-sm">
                Add user
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition">
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="perPage" className="text-sm font-medium text-slate-600">Per page</label>
              <select id="perPage" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 px-3 py-2 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500/20">
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['username', 'email', 'role', 'status'].map((field) => (
                    <th key={field} className="px-5 py-3.5 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort(field)}>
                      <div className="flex items-center gap-1">
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                        {sortField === field && sortOrder !== 'none' && <FaSort className={`text-slate-400 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />}
                      </div>
                    </th>
                  ))}
                  <th className="px-5 py-3.5 font-semibold text-slate-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No users found.</td></tr>
                )}
                {paginatedUsers.map((user, idx) => (
                  <tr key={user.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-5 py-3 font-medium text-slate-800">{user.username}</td>
                    <td className="px-5 py-3 text-slate-600">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${user.role === 'admin' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'}`}>
                        {user.role === 'admin' ? <FaUserShield /> : <FaEye />} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-teal-500' : 'bg-red-500'}`} />
                        <span className="text-slate-600">{user.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(user)} className="p-2.5 rounded-xl text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition" title="Edit"><FaEdit /></button>
                        <button onClick={() => handleDelete(user.id)} className="p-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition" title="Delete"><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-100">{renderPagination()}</div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <EditUserModal
          user={editModal.user}
          onClose={() => setEditModal({ isOpen: false, user: null })}
          onSave={handleUpdate}
        />
      )}

    </div>
  );
}
