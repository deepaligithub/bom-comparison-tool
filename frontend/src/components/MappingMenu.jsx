// components/MappingMenu.jsx — premium admin layout
import React, { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { FaBars, FaTimes, FaPlusCircle, FaFolderOpen, FaArrowLeft } from 'react-icons/fa';

export default function MappingMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinkClass = (active) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${active
      ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30 shadow-sm'
      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {/* Sidebar — premium dark */}
      <aside className="lg:w-72 w-full bg-[#0f172a] text-white lg:flex lg:flex-col shadow-2xl lg:border-r border-slate-700/50">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-700/50 lg:block lg:border-b lg:pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg">
              <FaFolderOpen className="text-white text-lg" />
            </div>
            <div>
              <span className="font-semibold text-slate-100 tracking-tight block">Mapping Manager</span>
              <span className="text-xs text-slate-500 font-medium">Admin</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Toggle menu"
          >
            {isOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
          </button>
        </div>
        <nav className={`${isOpen ? 'block' : 'hidden'} lg:block flex-1 p-4 space-y-1`}>
          <NavLink to="/admin/mapping/create" className={({ isActive }) => navLinkClass(isActive)}>
            <FaPlusCircle className="text-teal-400 shrink-0" size={18} />
            Create Mapping
          </NavLink>
          <NavLink to="/admin/mapping/manage" className={({ isActive }) => navLinkClass(isActive)}>
            <FaFolderOpen className="text-teal-400 shrink-0" size={18} />
            Manage Mappings
          </NavLink>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gradient-to-b from-white to-slate-50/50">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Mapping Manager</h1>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 font-medium text-sm transition-colors"
            aria-label="Back to Home"
          >
            <FaArrowLeft aria-hidden />
            Back to Home
          </Link>
        </header>
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
