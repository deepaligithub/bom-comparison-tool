import React from 'react';
import {
  FiFilter,
  FiCheck,
  FiXCircle,
  FiPlusCircle
} from 'react-icons/fi';
import { BsDatabase } from 'react-icons/bs';

const tabStyles = {
  base: 'flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition hover:scale-105',
  active: 'ring-2 ring-offset-1',
  All: 'bg-gray-200 text-gray-700',
  Matched: 'bg-green-100 text-green-700',
  Different: 'bg-red-100 text-red-700',
  'TC Only': 'bg-blue-100 text-blue-700',
  'SAP Only': 'bg-yellow-100 text-yellow-700'
};

const iconMap = {
  All: <FiFilter />,
  Matched: <FiCheck />,
  Different: <FiXCircle />,
  'TC Only': <FiPlusCircle />,
  'SAP Only': <BsDatabase />
};

export default function FilterTabs({ currentFilter, counts, onChange }) {
  const tabs = ['All', 'Matched', 'Different', 'TC Only', 'SAP Only'];

  return (
    <div className="flex items-center flex-wrap gap-3 mt-4">
      <span className="text-sm font-semibold text-gray-700">Filters:</span>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`${tabStyles.base} ${tabStyles[tab]} ${
            currentFilter === tab ? tabStyles.active : ''
          }`}
        >
          {iconMap[tab]}
          {tab}
          <span className="ml-1 bg-white text-gray-800 text-xs px-1.5 py-0.5 rounded-full">
            {counts[tab] || 0}
          </span>
        </button>
      ))}
    </div>
  );
}
