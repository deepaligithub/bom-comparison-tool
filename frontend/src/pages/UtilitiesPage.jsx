import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdStop, MdArrowBack, MdInfoOutline } from 'react-icons/md';
import apiClient from '../api/client';

const COMMON_PORTS = [5000, 5001, 5002, 3000, 8080];

export default function UtilitiesPage() {
  const [port, setPort] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCleanPort = async () => {
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post('/api/admin/free-port', { port });
      setResult(res.data?.message || 'Done.');
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to stop process.';
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium text-sm mb-6 transition"
        aria-label="Back to Home"
      >
        <MdArrowBack aria-hidden /> Back to Home
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 tracking-tight mb-2">Utilities</h1>
      <p className="text-slate-600 text-sm mb-8">Admin tools for troubleshooting and cleaning up processes.</p>

      {/* Clean process on port */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MdStop className="text-amber-500" aria-hidden />
            Clean process on port
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Stop the process that is listening on a given port (e.g. when the app fails to start because the port is in use).
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="port" className="block text-sm font-medium text-slate-700 mb-2">Port number</label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 5000)}
                className="w-28 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleCleanPort}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <MdStop aria-hidden /> {loading ? 'Stopping…' : 'Stop process on this port'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 mr-2">Quick select:</span>
            {COMMON_PORTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPort(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${port === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {result && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
              <MdInfoOutline className="flex-shrink-0 mt-0.5" />
              <span>{result}</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-800 text-sm">
              <MdInfoOutline className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-slate-500 text-xs mt-6">
        Windows only. Requires admin role. Use when the app reports &quot;Port already in use&quot; — close the app first, then stop the process here and start the app again.
      </p>
    </div>
  );
}
