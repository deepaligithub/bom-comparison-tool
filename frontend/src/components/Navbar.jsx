import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { MdCompareArrows, MdOutlineSchema, MdHelpOutline, MdHome, MdBuild } from 'react-icons/md';
import { FiLogOut, FiUser, FiLock } from 'react-icons/fi';
import ChangePasswordModal from './ChangePasswordModal';
import { useFeatures } from '../hooks/useFeatures';
import { appConfig } from '../config/appConfig';

export default function Navbar() {
  const location = useLocation();
  const { state, dispatch } = useContext(AppContext);
  const user = state.user;
  const { canUseMappingManager } = useFeatures();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    }
    if (accountOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountOpen]);

  const handleLogout = () => {
    setAccountOpen(false);
    dispatch({ type: 'LOGOUT' });
    navigate('/');
  };

  const openChangePassword = () => {
    setAccountOpen(false);
    setChangePasswordOpen(true);
  };

  const navLink = (to, label, matchPrefix = false) => {
    const isActive = matchPrefix
      ? location.pathname.startsWith(to)
      : (to === '/' ? location.pathname === '/' : location.pathname === to);

    return (
      <Link
        to={to}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive
          ? 'bg-teal-700 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav className="bg-white border-b border-slate-200 flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition">
            <img src="/logo.svg" alt="" className="h-8 w-8 object-contain" aria-hidden />
            <span className="text-lg font-semibold text-slate-800 tracking-tight">{appConfig.appName}</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {navLink('/', <><MdHome className="inline mr-1.5" /> Home</>)}
          {navLink('/compare', <><MdCompareArrows className="inline mr-1.5" /> BOM Compare</>)}
          {canUseMappingManager && navLink('/admin/mapping', <><MdOutlineSchema className="inline mr-1.5" /> Mapping Manager</>, true)}
          {user?.features?.users_page && navLink('/users', 'Users')}
          {user?.role === 'admin' && navLink('/admin/utilities', <><MdBuild className="inline mr-1.5" /> Utilities</>)}
          {navLink('/help', <><MdHelpOutline className="inline mr-1.5" /> Help</>)}

          {/* Account dropdown */}
          <div className="relative" ref={accountRef}>
<button
            type="button"
            onClick={() => setAccountOpen((o) => !o)}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 transition"
            title="Account"
          >
              <FiUser className="mr-1" />
              {user?.username || 'Account'}
              <span className="ml-1 text-xs text-gray-500">▾</span>
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-1 w-48 py-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                <button
                  type="button"
                  onClick={openChangePassword}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FiLock className="mr-2 text-gray-500" />
                  Change password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <FiLogOut className="mr-2" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        username={user?.username}
      />
    </>
  );
}
