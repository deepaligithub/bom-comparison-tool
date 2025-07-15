// components/MappingMenu.jsx
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaPlusCircle, FaFolderOpen } from 'react-icons/fa';

export default function MappingMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const menuClass = (active) =>
        `flex items-center px-4 py-2 rounded transition-all font-medium text-sm ${active ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-100'
        }`;

    return (
        <div className="flex flex-col lg:flex-row min-h-screen">
            {/* Sidebar */}
            <div className="lg:w-64 w-full bg-white border-r shadow-md lg:block">
                {/* Mobile Toggle Button */}
                <div className="lg:hidden flex justify-between items-center px-4 py-3 border-b">
                    <h2 className="font-bold text-blue-700">Mappings</h2>
                    <button onClick={() => setIsOpen(!isOpen)} className="text-blue-700 text-lg">
                        {isOpen ? <FaTimes /> : <FaBars />}
                    </button>
                </div>

                {/* Sidebar Links */}
                <div className={`${isOpen ? 'block' : 'hidden'} lg:block`}>
                    <nav className="flex flex-col gap-1 px-4 py-4">
                        <NavLink to="/admin/mapping/create" className={menuClass(isActive('/admin/mapping/create'))}>
                            <FaPlusCircle className="mr-2" /> Create Mapping
                        </NavLink>
                        <NavLink to="/admin/mapping/manage" className={menuClass(isActive('/admin/mapping/manage'))}>
                            <FaFolderOpen className="mr-2" /> Manage Mappings
                        </NavLink>
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 p-4 bg-gray-50 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
