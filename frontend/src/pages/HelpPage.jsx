import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdCompareArrows, MdOutlineSchema, MdOutlineHelp, MdArrowBack, MdFolderOpen, MdStop } from 'react-icons/md';
import { FiDownload } from 'react-icons/fi';
import { HiOutlineKey, HiOutlineViewGrid } from 'react-icons/hi';
import { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import apiClient from '../api/client';

const DOC_TITLE = 'BOM Compare — User Guide & Documentation | SAP, Teamcenter, Windchill, ERP & PLM';

const sectionStyle = "mb-10";
const headingStyle = "text-lg font-semibold text-gray-900 mt-8 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2";
const subheadingStyle = "text-base font-medium text-gray-800 mt-5 mb-2";
const paraStyle = "text-gray-700 mb-3 leading-relaxed";
const listStyle = "list-disc list-inside text-gray-700 space-y-2 mb-4 ml-2";
const tableWrap = "overflow-x-auto my-4 border border-gray-200 rounded-lg shadow-sm";
const linkStyle = "text-blue-600 hover:underline font-medium";

export default function HelpPage() {
  const { state } = useContext(AppContext);
  const [dataDir, setDataDir] = useState('');
  const [freePortNum, setFreePortNum] = useState(5000);
  const [freePortLoading, setFreePortLoading] = useState(false);
  const [freePortResult, setFreePortResult] = useState(null);

  useEffect(() => {
    document.title = DOC_TITLE;
    return () => { document.title = 'BOM Compare Tool'; };
  }, []);

  useEffect(() => {
    apiClient.get('/api/info').then((res) => setDataDir(res.data?.dataDir || '')).catch(() => setDataDir(''));
  }, []);

  const handleOpenDataFolder = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openDataFolder && dataDir) {
      window.electronAPI.openDataFolder(dataDir);
    }
  };

  const handleFreePort = async () => {
    setFreePortResult(null);
    setFreePortLoading(true);
    try {
      const res = await apiClient.post('/api/admin/free-port', { port: freePortNum });
      setFreePortResult(res.data?.message || 'Done');
    } catch (err) {
      setFreePortResult(err.response?.data?.error || 'Failed');
    } finally {
      setFreePortLoading(false);
    }
  };

  const isAdmin = state.user?.role === 'admin';
  const canOpenFolder = typeof window !== 'undefined' && window.electronAPI?.openDataFolder;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 bg-white min-h-[calc(100vh-4rem)] border-l border-r border-slate-200 shadow-sm">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm mb-6"
        aria-label="Back to Home"
      >
        <MdArrowBack className="text-lg" aria-hidden />
        Back to Home
      </Link>
      {/* Document header — SEO-rich for BOM compare documentation, ERP, PLM */}
      <header className="mb-10 pb-6 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <MdOutlineHelp className="text-blue-600" aria-hidden />
          User Guide &amp; Documentation
        </h1>
        <p className="text-sm text-slate-500 mb-2 font-medium">
          BOM Compare documentation — PLM to PLM · PLM to ERP · ERP to ERP — any BOM compare
        </p>
        <p className="text-gray-600 text-base leading-relaxed max-w-2xl mb-3">
          This guide describes how to compare Bills of Material (BOMs), configure column mappings, and use saved presets for consistent validation across PLM, ERP, and other sources.
        </p>
        <p className="text-gray-700 text-sm leading-relaxed max-w-2xl">
          <strong>Works with exports from:</strong> SAP, Teamcenter, Windchill, Oracle ERP, Microsoft Dynamics, Infor, NetSuite, Epicor, Arena PLM, Enovia, Aras, and any system that exports BOMs as CSV, Excel, JSON, or PLMXML. Use for SAP BOM compare, Teamcenter BOM comparison, Windchill to ERP, or any cross-system BOM validation.
        </p>
      </header>

      {/* Comparison possibilities — which systems and combinations */}
      <section id="comparison-possibilities" className="mb-10">
        <h2 className={headingStyle}>Comparison possibilities — which systems</h2>
        <p className={paraStyle}>
          You can compare <strong>any two BOMs</strong>: same system (e.g. two exports from SAP), different systems (e.g. PLM vs ERP), or any mix. Export each BOM as CSV, Excel, JSON, or PLMXML (PLMXML as <strong>Source BOM</strong> only), then run the compare. The tool does not require both files to come from the same vendor.
        </p>
        <h3 className={subheadingStyle}>Types of comparisons</h3>
        <ul className={listStyle}>
          <li><strong>PLM to PLM:</strong> Siemens Teamcenter vs PTC Windchill, Windchill vs Arena PLM, Dassault Enovia vs Aras Innovator, Oracle Agile PLM vs SAP PLM, etc.</li>
          <li><strong>PLM to ERP:</strong> Teamcenter to SAP ERP/S/4HANA, Windchill to Oracle ERP Cloud, Arena to Microsoft Dynamics, PLM export to Infor, NetSuite, Epicor, Sage, IFS, Acumatica.</li>
          <li><strong>ERP to ERP:</strong> SAP to Oracle ERP, SAP to NetSuite, Microsoft Dynamics to Infor, or any two ERP BOM exports.</li>
        </ul>
        <h3 className={subheadingStyle}>Systems supported (export as CSV, Excel, JSON, or PLMXML)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">PLM</h4>
            <p className="text-gray-700">Siemens Teamcenter, PTC Windchill, Arena PLM, Dassault Enovia, Aras Innovator, Oracle Agile PLM, SAP PLM.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-2">ERP</h4>
            <p className="text-gray-700">SAP ERP / S/4HANA, Oracle ERP Cloud, Microsoft Dynamics, Infor, NetSuite, Epicor, Sage, IFS, Acumatica.</p>
          </div>
        </div>
        <p className="text-gray-600 text-sm mt-3">
          Plus any other system that can export BOMs in these formats. Use Mapping Manager to align column names between different systems.
        </p>
      </section>

      {/* Quick reference card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-10 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-2">Configuring column mappings</h2>
        <p className="text-gray-700 text-sm mb-3 leading-relaxed">
          Administrators create and manage column mappings in <strong>Mapping Manager</strong> (navigation bar). Each mapping defines which <strong>Source BOM</strong> column corresponds to which <strong>Target BOM</strong> column, and which columns act as <strong>keys</strong> for row matching. One mapping is designated <strong>active</strong>; the compare workflow uses it when &quot;Use saved mapping preset&quot; is enabled.
        </p>
        <Link to="/admin/mapping" className={`${linkStyle} text-sm`}>
          Open Mapping Manager →
        </Link>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-10 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Installation &amp; troubleshooting</h2>
        <p className="text-gray-700 text-sm mb-3 leading-relaxed">
          <strong>How to run (choose one):</strong>
        </p>
        <ul className="text-gray-700 text-sm mb-3 space-y-2 list-disc list-inside ml-2">
          <li><strong>BOMCompareTool.exe</strong> — Normal Windows way: just double-click. No install; the app starts and the browser opens. If something goes wrong (e.g. port in use), a <strong>popup message</strong> will tell you what to do.</li>
          <li><strong>run.bat</strong> — Installs Python dependencies (first time) and starts the app. Use when the exe is not included or you prefer Python. Requires Python 3.9+ on your PATH.</li>
          <li><strong>RUN.bat</strong> — For the full source project only: installs backend and frontend deps and runs both servers. Requires Python and Node.js.</li>
        </ul>
        <p className="text-gray-700 text-sm mb-3 leading-relaxed">
          <strong>Why run.bat and not only the exe?</strong> Windows packages are exe-based: click the exe and it sets everything up; any issue shows a popup. run.bat is for when the exe isn’t in the package or you prefer running from Python.
        </p>
        <p className="text-gray-700 text-sm mb-3 leading-relaxed">
          Full steps and port troubleshooting: <strong>docs/INSTALLATION.md</strong> (or INSTALLATION.pdf in the package).
        </p>
        <p className="text-gray-700 text-sm mb-0 leading-relaxed">
          <strong>Port in use?</strong> Backend: set <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">FLASK_RUN_PORT=5001</code> or <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">BOM_PORT=5001</code>, or free port 5000. Frontend: accept the alternate port (e.g. 3001) when <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">npm start</code> prompts.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-10 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><MdFolderOpen className="text-indigo-600" aria-hidden /> Data folder</h2>
        <p className="text-gray-700 text-sm mb-3 leading-relaxed">
          Uploads, logs, and demo samples are stored in this folder. You can open it to inspect or back up files.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="block flex-1 min-w-0 bg-slate-200 px-3 py-2 rounded text-xs break-all font-mono text-slate-800">
            {dataDir || 'C:\\Users\\<your username>\\AppData\\Roaming\\BOM Compare Tool\\data'}
          </code>
          {canOpenFolder && dataDir && (
            <button
              type="button"
              onClick={handleOpenDataFolder}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              <MdFolderOpen aria-hidden /> Open folder
            </button>
          )}
        </div>
        {!canOpenFolder && dataDir && (
          <p className="text-gray-500 text-xs mt-2">Open folder is available in the desktop app. Copy the path above and paste it into Windows Explorer if needed.</p>
        )}
        <p className="text-gray-500 text-xs mt-2">Replace &lt;your username&gt; with your Windows user name. When connected, the exact path is shown above; it may be under AppData\Roaming or Local. The folder may be empty until you run a compare, upload files, or the app writes logs.</p>
      </div>

      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-10 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><MdStop className="text-amber-600" aria-hidden /> Free port (admin)</h2>
          <p className="text-gray-700 text-sm mb-3 leading-relaxed">
            If the app fails to start because &quot;Port 5000 is already in use&quot;, you can stop the process using that port. Close the app first if it is running, then use the utility below or open <Link to="/admin/utilities" className={linkStyle}>Utilities</Link> from the menu.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={freePortNum}
              onChange={(e) => setFreePortNum(Number(e.target.value) || 5000)}
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={handleFreePort}
              disabled={freePortLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition disabled:opacity-60"
            >
              <MdStop aria-hidden /> {freePortLoading ? 'Stopping…' : 'Stop process on this port'}
            </button>
          </div>
          {freePortResult && (
            <p className={`text-sm mt-2 ${freePortResult.startsWith('Stopped') ? 'text-green-700' : 'text-red-700'}`}>{freePortResult}</p>
          )}
        </div>
      )}

      <hr className="border-gray-200 my-8" />

      <section id="compare" className={sectionStyle}>
        <h2 className={headingStyle}><MdCompareArrows aria-hidden /> 1. Running a BOM comparison</h2>
        <p className={paraStyle}>
          The <strong>Source BOM</strong> denotes the first file (e.g. PLM or source system). The <strong>Target BOM</strong> denotes the second file (e.g. SAP or target system). The tool aligns rows by key columns and reports matches, differences, and rows present in only one file.
        </p>
        <h3 className={subheadingStyle}>Steps</h3>
        <ul className={listStyle}>
          <li>On <Link to="/compare" className={linkStyle}>BOM Compare</Link>, upload the <strong>Source BOM</strong> and <strong>Target BOM</strong> using the file selectors.</li>
          <li>Enable <strong>Use saved mapping preset</strong> to use the active mapping from Mapping Manager; leave unchecked to use auto-detected column matching.</li>
          <li>Click <strong>Validate BOMs</strong> (or press Ctrl+Enter). Results and summary metrics appear below.</li>
        </ul>
        <h3 className={subheadingStyle}>Supported file formats</h3>
        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="text-left p-3 font-medium text-gray-800">Format</th><th className="text-left p-3 font-medium text-gray-800">Source BOM</th><th className="text-left p-3 font-medium text-gray-800">Target BOM</th></tr></thead>
            <tbody className="bg-white">
              <tr className="border-t border-gray-100"><td className="p-3">CSV</td><td className="p-3">Supported</td><td className="p-3">Supported</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">Excel (.xlsx)</td><td className="p-3">Supported</td><td className="p-3">Supported</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">JSON</td><td className="p-3">Supported</td><td className="p-3">Supported</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">PLMXML</td><td className="p-3">Supported</td><td className="p-3">Not supported</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="mapper" className={sectionStyle}>
        <h2 className={headingStyle}><MdOutlineSchema aria-hidden /> 2. Configuring the mapper</h2>
        <p className={paraStyle}>
          The mapper defines the correspondence between <strong>Source BOM</strong> and <strong>Target BOM</strong> columns and designates which columns are <strong>keys</strong> (used to match rows) versus <strong>non-keys</strong> (compared and displayed only).
        </p>

        <h3 className={subheadingStyle}>2.1 Accessing Mapping Manager</h3>
        <p className={paraStyle}>
          Select <strong>Mapping Manager</strong> from the navigation bar. Create and edit permissions require an administrator role; all users may use the active preset on the compare page.
        </p>

        <h3 className={subheadingStyle}>2.2 Creating a mapping</h3>
        <ul className={listStyle}>
          <li>Choose <strong>Create Mapping</strong>, then <strong>UI Mapping</strong> or <strong>Manual Mapping</strong>.</li>
          <li><strong>UI Mapping:</strong> Upload sample BOM A and BOM B files. For each pair, select the BOM A column and the BOM B column. Mark columns that uniquely identify a row (e.g. Part Number, Material Number) with <strong>Use as Key</strong>.</li>
          <li><strong>Manual Mapping:</strong> Enter mapping lines in the form <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">BOM A column → BOM B column</code>, then parse and designate keys. Save to store the mapping.</li>
        </ul>

        <h3 className={subheadingStyle}><HiOutlineKey className="inline" aria-hidden /> 2.3 Key vs. non-key columns</h3>
        <p className={paraStyle}>
          <strong>Key columns</strong> are used to match rows between the Source and Target BOMs (e.g. same part number indicates the same line item). At least one key is required; multiple keys (e.g. Part + Plant + Revision) are supported for composite matching.
        </p>
        <p className={paraStyle}>
          <strong>Non-key columns</strong> are compared and displayed after matching. They do not participate in row alignment. If no key is explicitly selected, the first column pair in the mapping is used as the key (default behavior).
        </p>

        <h3 className={subheadingStyle}>2.4 Default presets</h3>
        <p className={paraStyle}>
          When no saved mappings exist, the application seeds five default presets (1 through 5 key columns). The single-key preset (Part Number ↔ Material Number) is active by default. Administrators may change the active mapping or create custom mappings.
        </p>

        <h3 className={subheadingStyle}>2.5 Setting the active preset</h3>
        <ul className={listStyle}>
          <li>In <strong>Manage Mappings</strong>, set <strong>Active</strong> for the mapping to use. Only one mapping may be active at a time. The active mapping cannot be deleted.</li>
          <li>On the <Link to="/compare" className={linkStyle}>BOM Compare</Link> page, enable <strong>Use saved mapping preset</strong> and run <strong>Validate BOMs</strong>. The comparison uses the active mapping’s keys and column list.</li>
        </ul>
      </section>

      <section id="results" className={sectionStyle}>
        <h2 className={headingStyle}><HiOutlineViewGrid aria-hidden /> 3. Results and filtering</h2>
        <p className={paraStyle}>
          After a run, summary counts are shown: <strong>Total</strong>, <strong>Matched</strong>, <strong>Different</strong>, <strong>{'Source BOM only'}</strong>, <strong>{'Target BOM only'}</strong>. Click a count to filter the results table. Use the search field to filter by any column value; use <strong>Columns ▾</strong> to show or hide columns. The <strong>ℹ</strong> action on a row opens the full Source and Target BOM detail for that line.
        </p>
      </section>

      <section id="ignored" className={sectionStyle}>
        <h2 className={headingStyle}>4. Reviewing ignored items</h2>
        <p className={paraStyle}>
          Rows that lack key values or are duplicates, and columns not present in both files, may be excluded from the comparison. Use <strong>Review Ignored Items</strong> to inspect reasons. If the comparison reports no matching rows, open this section to verify that key column names in your files match the mapping (e.g. exact spelling and casing).
        </p>
      </section>

      <section id="export" className={sectionStyle}>
        <h2 className={headingStyle}><FiDownload aria-hidden /> 5. Export</h2>
        <p className={paraStyle}>
          Use <strong>Export CSV</strong> or <strong>Export PDF</strong> in the toolbar to download the current (filtered) comparison results.
        </p>
      </section>

      <section className={sectionStyle}>
        <h2 className={headingStyle}>Quick reference</h2>
        <div className={tableWrap}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="text-left p-3 font-medium text-gray-800">Task</th><th className="text-left p-3 font-medium text-gray-800">Procedure</th></tr></thead>
            <tbody className="bg-white">
              <tr className="border-t border-gray-100"><td className="p-3">Run comparison</td><td className="p-3">BOM Compare → Upload A &amp; B → Validate BOMs</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">Configure mapper</td><td className="p-3">Mapping Manager → Create / Manage → Set Active</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">Use saved preset</td><td className="p-3">Enable &quot;Use saved mapping preset&quot; on BOM Compare</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">Filter results</td><td className="p-3">Click summary pills or use search and column visibility</td></tr>
              <tr className="border-t border-gray-100"><td className="p-3">Diagnose no matches</td><td className="p-3">Review Ignored Items; confirm key column names match mapping</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
        For installation and deployment, refer to the installation documentation provided with the product.
      </footer>
    </div>
  );
}
