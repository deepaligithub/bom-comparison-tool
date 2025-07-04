import React from 'react';
import { FaListUl, FaEquals, FaExchangeAlt, FaFingerprint } from 'react-icons/fa';

export default function SummaryCards({ results = [] }) {
  const total = results.length;

  const matched = results.filter(r => r.status === 'Matched').length;
  const differences = results.filter(r => r.status === 'Quantity Diff').length;
  const tcOnly = results.filter(r => r.status === 'Only in TC' || r.status === 'TC Only').length;
  const sapOnly = results.filter(r => r.status === 'Only in SAP' || r.status === 'SAP Only').length;
  const unique = tcOnly + sapOnly;

  const safePercent = (value) => {
    if (!total || isNaN(value)) return '';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const cards = [
    {
      label: 'Total Items',
      value: total,
      percent: '',
      gradient: 'bg-gradient-to-r from-blue-500 to-blue-700',
      icon: <FaListUl className="h-6 w-6 text-white" title="Total items in both BOMs" />,
    },
    {
      label: 'Matched',
      value: matched,
      percent: safePercent(matched),
      gradient: 'bg-gradient-to-r from-green-500 to-green-700',
      icon: <FaEquals className="h-6 w-6 text-white" title="Matched items" />,
    },
    {
      label: 'Differences',
      value: differences,
      percent: safePercent(differences),
      gradient: 'bg-gradient-to-r from-red-400 to-red-600',
      icon: <FaExchangeAlt className="h-6 w-6 text-white" title="Quantity or data differences" />,
    },
    {
      label: 'Unique Items',
      value: unique,
      percent: safePercent(unique),
      gradient: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
      icon: <FaFingerprint className="h-6 w-6 text-white" title="Only in TC or SAP" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => (
        <div key={i} className={`rounded-lg shadow text-white p-4 flex items-center space-x-4 ${card.gradient}`}>
          <div className="p-2 bg-white bg-opacity-10 rounded-full">
            {card.icon}
          </div>
          <div>
            <div className="text-sm font-medium">{card.label}</div>
            <div className="text-xl font-bold">
              {card.value}
              {card.percent && <span className="text-sm font-light ml-1">({card.percent})</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
