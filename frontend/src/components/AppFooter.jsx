import React from 'react';
import { Link } from 'react-router-dom';
import { appConfig } from '../config/appConfig';

/**
 * Subtle installation/version footer for high-end UI.
 * Fixed bottom-right when logged in; links to Help for installation details.
 */
export default function AppFooter() {
  return (
    <footer
      className="fixed bottom-0 right-0 z-30 px-4 py-2.5 flex items-center gap-3 text-xs font-medium text-slate-400"
      aria-label="Application version and installation info"
    >
      <span className="tracking-tight text-slate-500">
        {appConfig.appName} · v{appConfig.version}
      </span>
      <span className="text-slate-300/60" aria-hidden>|</span>
      <Link
        to="/help"
        className="text-slate-500 hover:text-teal-600 transition-colors focus:outline-none focus:underline"
      >
        Installation &amp; deployment
      </Link>
    </footer>
  );
}
