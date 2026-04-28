import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { appConfig } from '../config/appConfig';
import { MdCompareArrows, MdPlayCircleOutline, MdMenuBook, MdCheckCircle } from 'react-icons/md';
import { FaChartBar } from 'react-icons/fa';
import apiClient from '../api/client';

const STORAGE_KEY = 'bom_last_compare';

/** PLM & ERP systems we support for BOM compare — enterprise SEO & clarity */
const PLM_SYSTEMS = [
  'Siemens Teamcenter',
  'PTC Windchill',
  'Arena PLM',
  'Dassault Enovia',
  'Aras Innovator',
  'Oracle Agile PLM',
  'SAP PLM',
];
const ERP_SYSTEMS = [
  'SAP ERP / S/4HANA',
  'Oracle ERP Cloud',
  'Microsoft Dynamics',
  'Infor',
  'NetSuite',
  'Epicor',
  'Sage',
  'IFS',
  'Acumatica',
];

export default function DashboardPage() {
  const { state } = useContext(AppContext);
  const navigate = useNavigate();
  const username = state.user?.username || '';
  const [dataDir, setDataDir] = useState('');

  let lastCompare = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) lastCompare = JSON.parse(raw);
  } catch (_) {}

  const runDemo = () => navigate('/compare');

  useEffect(() => {
    apiClient
      .get('/api/info')
      .then((res) => {
        const dir = (res.data?.dataDir || '').trim();
        if (dir) setDataDir(dir);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ——— How to use guide: unmissable, top ——— */}
        <Link
          to="/help"
          className="flex items-center gap-3 w-full p-4 mb-8 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all border border-indigo-500/30"
          aria-label="Open User Guide and Documentation"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
            <MdMenuBook className="text-2xl" aria-hidden />
          </div>
          <div className="flex-1 text-left">
            <span className="block font-semibold text-lg">How to use — User Guide &amp; Documentation</span>
            <span className="block text-sm text-indigo-100 mt-0.5">Step-by-step: compare BOMs, set up mappings, export results. PLM to PLM · PLM to ERP · ERP to ERP — any BOM compare.</span>
          </div>
          <span className="flex-shrink-0 text-indigo-200 font-medium text-sm">Open guide →</span>
        </Link>

        {/* ——— Hero ——— */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Welcome{username ? `, ${username}` : ''}
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl">
            {appConfig.tagline || 'PLM to PLM · PLM to ERP · ERP to ERP — any BOM compare'}
          </p>
        </header>

        {/* ——— Which systems BOM can be compared ——— */}
        <section className="mb-10 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <MdCheckCircle className="text-emerald-600 text-xl" aria-hidden />
              Which systems&apos; BOM can be compared
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Export BOMs from any of these (or any system) as CSV, Excel, JSON, or PLMXML — then compare side by side.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="px-6 py-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">PLM</h3>
              <ul className="space-y-2">
                {PLM_SYSTEMS.map((name) => (
                  <li key={name} className="text-slate-700 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" aria-hidden />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">ERP</h3>
              <ul className="space-y-2">
                {ERP_SYSTEMS.map((name) => (
                  <li key={name} className="text-slate-700 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Comparison possibilities</h3>
            <p className="text-sm text-slate-600 mb-3">
              You can compare <strong>any two BOMs</strong> — same system, different systems, or mixed. Export each BOM as CSV, Excel, JSON, or PLMXML (source only), then run the compare.
            </p>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li><strong>PLM to PLM:</strong> e.g. Siemens Teamcenter vs PTC Windchill, Windchill vs Arena PLM, Enovia vs Aras.</li>
              <li><strong>PLM to ERP:</strong> e.g. Teamcenter to SAP, Windchill to Oracle ERP, Arena to Microsoft Dynamics.</li>
              <li><strong>ERP to ERP:</strong> e.g. SAP to Oracle, SAP to NetSuite, Microsoft Dynamics to Infor.</li>
            </ul>
          </div>
          <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500">
            Plus any other system that exports BOMs (CSV, XLSX, JSON, PLMXML). Custom column mapping in Mapping Manager.
          </div>
        </section>

        {/* ——— Install / data location ——— */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-2">Where the app stores your data</h2>
          <p className="text-sm text-slate-600 mb-3">
            BOM Compare Tool runs locally on your workstation. Uploads, logs, and generated files are stored on disk, so you
            can back them up or inspect them if needed.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Data folder on this machine</p>
              <code className="block bg-slate-100 px-3 py-2 rounded text-xs text-slate-800 break-all font-mono">
                {dataDir || 'C:\\Users\\<your username>\\AppData\\Roaming\\BOM Compare Tool\\data'}
              </code>
              {!dataDir && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Replace &lt;your username&gt; with your Windows user name. Exact path may differ slightly depending on how the
                  app was installed.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ——— Quick actions ——— */}
        <section className="mb-10">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Link
              to="/compare"
              className="group flex items-center gap-5 p-6 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-lg hover:shadow-teal-100/50 transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-teal-100 group-hover:bg-teal-200 flex items-center justify-center transition-colors">
                <MdCompareArrows className="text-teal-700 text-2xl" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-teal-800">New compare</h3>
                <p className="text-sm text-slate-500 mt-0.5">Upload Source &amp; Target BOM and run validation</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={runDemo}
              className="group flex items-center gap-5 p-6 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100/50 transition-all text-left w-full"
            >
              <div className="w-14 h-14 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                <MdPlayCircleOutline className="text-amber-700 text-2xl" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-amber-800">Run demo</h3>
                <p className="text-sm text-slate-500 mt-0.5">Try with sample data (no upload)</p>
              </div>
            </button>
          </div>
        </section>

        {/* ——— Last comparison ——— */}
        {lastCompare?.summary && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
              <FaChartBar className="text-slate-500" aria-hidden />
              Last comparison
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {new Date(lastCompare.at).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-emerald-700 font-medium">{lastCompare.summary.matched} matched</span>
              <span className="text-amber-700 font-medium">{lastCompare.summary.different} different</span>
              <span className="text-slate-600">{lastCompare.summary.tc_only} only in Source BOM</span>
              <span className="text-slate-600">{lastCompare.summary.sap_only} only in Target BOM</span>
              <span className="text-slate-800 font-medium">{lastCompare.summary.total} total</span>
            </div>
            <Link
              to="/compare"
              className="inline-block mt-4 text-teal-700 font-medium text-sm hover:underline"
            >
              Compare again →
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
