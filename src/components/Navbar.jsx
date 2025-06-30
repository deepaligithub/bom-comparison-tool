import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

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

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded text-sm font-medium ${
        location.pathname === to ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white shadow flex items-center justify-between px-6 py-3">
      <div className="flex items-center">
        <img src="/logo.png" alt="Logo" className="h-8 mr-3" />
        <h1 className="text-xl font-bold text-blue-700">BOM Comparison Tool</h1>
      </div>
      <div className="space-x-2">
        {navLink('/', 'Compare')}
        {user?.role === 'admin' && navLink('/mappings', 'Mappings')}
        {user?.role === 'admin' && navLink('/users', 'Users')}
        <button onClick={handleLogout} className="text-sm text-red-500 hover:underline">
          Logout
        </button>
      </div>
    </nav>
  );
}
