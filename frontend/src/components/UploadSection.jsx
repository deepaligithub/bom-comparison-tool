import React from 'react';
import { FiPackage, FiDatabase } from 'react-icons/fi';
import { SIDE_A, SIDE_B } from '../config/sideConfig';

export default function UploadSection({
  source,
  acceptedTypes,
  file,
  error,
  inputRef,
  handleFileChange,
}) {
  const isTC = source === 'tc';
  const labelColorMap = {
    tc: 'blue',
    sap: 'orange',
  };
  const labelColor = labelColorMap[source]; // source is 'tc' or 'sap'
  const sideMeta = isTC ? SIDE_A : SIDE_B;
  const title = sideMeta.label; // "Source BOM" / "Target BOM"
  const hint = sideMeta.description;
  const Icon = isTC ? FiPackage : FiDatabase;

  return (
    <div
      className={`border-2 border-dashed border-${labelColor}-300 rounded-lg bg-white p-6 shadow-sm space-y-4`}
    >
      <div className="flex flex-col items-center space-y-2">
        {/* Icon */}
        <div className={`bg-${labelColor}-100 rounded-full p-3`}>
          <Icon className={`text-${labelColor}-600 h-6 w-6`} />
        </div>
        {/* Title & Hint */}
        <h3 className={`text-${labelColor}-700 font-semibold`}>{title}</h3>
        <p className="text-sm text-gray-500">{hint}</p>

        {/* Hidden Input */}
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileChange(e, source)}
          className="hidden"
          id={`${source}-upload-input`}
        />
        {/* Trigger Button */}
        <label htmlFor={`${source}-upload-input`}>
          <span
            className={`inline-block px-4 py-2 text-white text-sm rounded shadow cursor-pointer transition ${source === 'tc'
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-orange-600 hover:bg-orange-700'
              }`}
          >
            Choose File
          </span>
        </label>

        {/* Uploaded File Info */}
        {file && !error && (
          <p className="text-green-600 text-sm mt-1 truncate max-w-full">✅ {file.name}</p>
        )}

        {/* Error Display */}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        {/* Accepted formats */}
        <p className="text-xs text-gray-500">
          Supported: {acceptedTypes.join(', ')} (Max 50MB)
        </p>
      </div>
    </div>
  );
}