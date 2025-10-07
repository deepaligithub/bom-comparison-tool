import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { FaEdit, FaTrash, FaSort, FaUserShield, FaEye, FaSearch } from 'react-icons/fa';
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
      const res = await axios.get('/api/users');
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
      await axios.post('/api/users', form);
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
        await axios.delete(`/api/users/${id}`);
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

  const handleUpdate = async () => {
    try {
      await axios.put(`/api/users/${editModal.user.id}`, editModal.user);
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
        className={`w-8 h-8 rounded-full text-sm flex items-center justify-center border ${currentPage === 1 ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
          }`}
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
            className={`w-8 h-8 rounded-full text-sm flex items-center justify-center border ${currentPage === i ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
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
          className={`w-8 h-8 rounded-full text-sm flex items-center justify-center border ${currentPage === totalPages ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
            }`}
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600 transition disabled:opacity-30"
        >
          ‹
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600 transition disabled:opacity-30"
        >
          ›
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/3 bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Add New User</h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {/* Username */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <FaUserShield />
              </span>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Username"
                className={`w-full pl-10 border px-3 py-2 rounded ${formErrors.username ? 'border-red-500' : 'border-gray-300'}`}
              />
              {formErrors.username && (
                <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.username}</p>
              )}
            </div>

            {/* Email */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <FaEye />
              </span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                className={`w-full pl-10 border px-3 py-2 rounded ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
              />
              {formErrors.email && (
                <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.email}</p>
              )}
            </div>

            {/* Role */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <FaUserShield />
              </span>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className={`w-full pl-10 border px-3 py-2 rounded bg-white ${formErrors.role ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {formErrors.role && (
                <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.role}</p>
              )}
            </div>

            {/* Status - Readonly */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                ●
              </span>
              <input
                name="status"
                value={form.status}
                readOnly
                className="w-full pl-10 border px-3 py-2 rounded bg-gray-100 text-gray-500"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                Add User
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition">
                Reset
              </button>
            </div>
          </form>
        </div>
        {/* User List Table */}
        <div className="md:w-2/3 bg-white shadow rounded-lg p-4">
          <div className="flex justify-between mb-4">
            <div className="relative w-1/2">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:ring"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // reset to page 1 when search
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="perPage" className="text-sm text-gray-700 font-medium">
                Page size:
              </label>
              <select
                id="perPage"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border px-2 py-1 rounded text-sm"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

          </div>

          <table className="w-full table-fixed text-left border border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {['username', 'email', 'role', 'status'].map((field) => (
                  <th
                    key={field}
                    className="p-2 border cursor-pointer w-1/4"
                    onClick={() => handleSort(field)}
                  >
                    <div className="flex items-center gap-1">
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                      {sortField === field && sortOrder !== 'none' && (
                        <FaSort className={`transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-2 border w-1/4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <div className="text-center text-red-500 font-medium my-4">
                  No users found.
                </div>
              )}
              {paginatedUsers.map((user, idx) => (
                <tr key={user.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 border">{user.username}</td>
                  <td className="p-2 border">{user.email}</td>
                  <td className="p-2 border">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>
                      {user.role === 'admin' ? <FaUserShield /> : <FaEye />} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="p-2 border">
                    <span className={`inline-block w-3 h-3 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="ml-2 text-sm">{user.status}</span>
                  </td>
                  <td className="p-2 border flex gap-3">
                    <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800">
                      <FaEdit />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="mt-4">{renderPagination()}</div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <EditUserModal
          user={editModal.user}
          onClose={() => setEditModal({ isOpen: false, user: null })}
          onSave={handleUpdate}
          setUser={(updated) =>
            setEditModal((prev) => ({ ...prev, user: { ...prev.user, ...updated } }))
          }
        />
      )}

    </div>
  );
}
