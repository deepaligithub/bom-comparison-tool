import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { FEATURE_KEYS, DEFAULT_FEATURES } from '../constants/features';
import { appConfig } from '../config/appConfig';
import { toastSuccess, toastError } from '../utils/toast';
import { FiUser, FiLock, FiFolder, FiAlertCircle } from 'react-icons/fi';

const DATA_FOLDER_HINT = 'C:\\Users\\<your username>\\AppData\\Roaming\\BOM Compare Tool\\data';

export default function LoginPage() {
  const { dispatch } = useContext(AppContext);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataDir, setDataDir] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/api/info').then((res) => {
      const dir = res.data?.dataDir?.trim();
      if (dir) setDataDir(dir);
    }).catch(() => {});
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/login', { username: username.trim(), password });
      const user = {
        username: data.username,
        role: data.role || 'user',
        plan: data.plan || 'free',
        features: data.features || { ...DEFAULT_FEATURES, [FEATURE_KEYS.USERS_PAGE]: data.role === 'admin' },
      };
      dispatch({ type: 'SET_USER', payload: user });
      apiClient.defaults.headers.common['X-User-Plan'] = user.plan;
      apiClient.defaults.headers.common['X-User-Role'] = user.role;
      toastSuccess(`Signed in as ${user.username}`);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.status === 401
        ? 'Invalid username or password'
        : 'Login failed. Please try again.';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="px-8 pt-10 pb-6">
            <div className="flex justify-center mb-6">
              <img src="/logo.svg" alt="" className="h-12 w-12" aria-hidden />
            </div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{appConfig.appName}</h1>
              {appConfig.tagline && (
                <p className="text-sm text-slate-500 mt-2 font-medium">{appConfig.tagline}</p>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-5">
              <div>
                <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <FiUser className="w-5 h-5" aria-hidden />
                  </span>
                  <input
                    id="login-username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    autoComplete="username"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Default: admin</p>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <FiLock className="w-5 h-5" aria-hidden />
                  </span>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    autoComplete="current-password"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Default: admin</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  <FiAlertCircle className="flex-shrink-0 mt-0.5 w-4 h-4" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition shadow-md hover:shadow-lg"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
            Default sign-in: username <strong className="text-slate-600">admin</strong>, password <strong className="text-slate-600">admin</strong>
          </div>
        </div>

        <div className="mt-5 bg-white/90 rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <FiFolder className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Where data is stored</h3>
              <p className="text-xs text-slate-600 leading-relaxed">Uploads, logs, and demo files are saved in the app data folder. When connected, the exact path is shown below.</p>
              <code className="block mt-1.5 text-xs font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg break-all">
                {dataDir || DATA_FOLDER_HINT}
              </code>
              {!dataDir && (
                <p className="text-xs text-slate-500 mt-1.5">Replace &lt;your username&gt; with your Windows user name. The folder may be under AppData\Roaming or Local. After sign-in, open Help to see or open the exact path.</p>
              )}
              <p className="text-xs text-slate-500 mt-1.5">The folder may be empty until you run a compare or upload files.</p>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-white/90 rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <span className="text-xs font-bold">BOM</span>
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Which systems can be compared</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compare BOMs from <strong>any system</strong> that can export to CSV, Excel, JSON, or PLMXML (source) — including internal tools and homegrown systems.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                Common examples include <strong>PLM↔PLM</strong>, <strong>PLM↔ERP</strong>, and <strong>ERP↔ERP</strong> compares across systems such as <strong>SAP</strong>, <strong>Siemens Teamcenter</strong>, <strong>PTC Windchill</strong>, <strong>Oracle</strong>, <strong>Microsoft Dynamics</strong>, and other PLM/ERP platforms.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-white/90 rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <FiAlertCircle className="w-5 h-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Port 5000 already in use?</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                Close other BOM Compare windows, or create <code className="bg-slate-100 px-1 rounded text-[11px]">Start BOM Compare.bat</code> next to the exe with:
              </p>
              <pre className="bg-slate-800 text-slate-100 text-[11px] rounded-lg px-3 py-2 overflow-x-auto font-mono">
                set BOM_PORT=5001{'\n'}"%~dp0bom-backend.exe"
              </pre>
              <p className="text-xs text-slate-500 mt-2">Then run the batch file instead of the exe.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
