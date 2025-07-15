import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { MdCompareArrows } from 'react-icons/md';
import { MdOutlineSchema } from 'react-icons/md';
import { FiLogOut } from 'react-icons/fi';

export default function Navbar() {
  const location = useLocation();
  const { state, dispatch } = useContext(AppContext);
  const user = state.user;
  const navigate = useNavigate();
  console.log("Navbar rendered with user:", user);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/');
  };

  // Enhanced link matching
  const navLink = (to, label, matchPrefix = false) => {
    const isActive = matchPrefix
      ? location.pathname.startsWith(to)
      : location.pathname === to;

    return (
      <Link
        to={to}
        className={`px-3 py-2 rounded text-sm font-medium ${isActive
          ? 'bg-blue-600 text-white'
          : 'text-blue-600 hover:bg-blue-100'
          }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="bg-white shadow flex items-center justify-between px-6 py-3">
      <div className="flex items-center">
        <img src="/logo.png" alt="Logo" className="h-8 mr-3" />
        <h1 className="text-xl font-bold text-blue-700">BOM Comparison Tool</h1>
      </div>
      <div className="space-x-2">
        {navLink('/compare', <><MdCompareArrows className="inline mr-1" /> BOM Comparison</>)}
        {user?.role === 'admin' && navLink('/admin/mapping', <><MdOutlineSchema className="inline mr-1" /> Mapping Manager</>)}
        {user?.role === 'admin' && navLink('/users', 'Users')}
        <button
          onClick={handleLogout}
          className="inline-flex items-center px-3 py-2 rounded text-sm font-medium text-red-500 hover:bg-red-100 transition"
          title="Logout"
        >
          <FiLogOut className="mr-1" />
          Logout
        </button>
      </div>

    </nav>
  );
}
