import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const CollapsibleCompareInfoBox = ({ title, children, color = 'yellow' }) => {
    const [isOpen, setIsOpen] = useState(false);

    const borderColor = {
        yellow: 'border-yellow-400 bg-yellow-100 text-yellow-800',
        red: 'border-red-400 bg-red-100 text-red-800',
        gray: 'border-gray-400 bg-gray-100 text-gray-800'
    }[color];

    return (
        <div className={`mt-4 border-l-4 p-4 rounded ${borderColor}`}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <h4 className="font-bold">{title}</h4>
                {isOpen ? <FaChevronUp /> : <FaChevronDown />}
            </div>
            {isOpen && <div className="mt-2 text-sm">{children}</div>}
        </div>
    );
};

export default CollapsibleCompareInfoBox;
