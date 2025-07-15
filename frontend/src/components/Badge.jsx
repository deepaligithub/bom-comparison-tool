import React from 'react';

export default function Badge({ label, tooltip, type = 'gray' }) {
    const colorMap = {
        gray: 'text-gray-400 italic',
        blue: 'bg-blue-100 text-blue-700',
        orange: 'bg-orange-100 text-orange-700',
        red: 'bg-red-100 text-red-700',
    };

    return (
        <span
            className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${colorMap[type] || colorMap.gray
                }`}
            title={tooltip}
        >
            {label}
        </span>
    );
}
