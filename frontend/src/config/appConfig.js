/**
 * App-wide configuration. Single source of truth for app name, API base URL, and upgrade contact.
 * Override at build time via REACT_APP_* env vars.
 */

const isAbsoluteUrl = (s) => typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('mailto:'));

/** Default upgrade URL if env not set or invalid */
const DEFAULT_UPGRADE_URL = 'mailto:support@example.com?subject=BOM%20Compare%20upgrade';

function getUpgradeUrl() {
  const u = process.env.REACT_APP_UPGRADE_URL?.trim();
  if (!u) return DEFAULT_UPGRADE_URL;
  if (isAbsoluteUrl(u)) return u;
  if (u.includes('@')) return `mailto:${u}`;
  return DEFAULT_UPGRADE_URL;
}

/** Optional selling price for paid plan (e.g. "$29/month", "€20/year"). Empty = not shown. */
function getSellingPrice() {
  const s = process.env.REACT_APP_PAID_PLAN_PRICE?.trim();
  return s || '';
}

/** Optional tagline (e.g. "Enterprise BOM comparison and validation"). Empty = not shown. */
function getTagline() {
  return process.env.REACT_APP_TAGLINE?.trim() || 'PLM to PLM · PLM to ERP · ERP to ERP — any BOM compare';
}

/** Version for display in footer / about. Override: REACT_APP_VERSION */
function getAppVersion() {
  return process.env.REACT_APP_VERSION?.trim() || '1.0.9';
}

/** Immutable app config. Do not mutate. */
export const appConfig = Object.freeze({
  /** Application display name */
  appName: process.env.REACT_APP_APP_NAME?.trim() || 'BOM Compare Tool',

  /** Display version (e.g. 1.0.9) */
  version: getAppVersion(),

  /** Short tagline for professional presentation. Override: REACT_APP_TAGLINE */
  tagline: getTagline(),

  /** Base URL for API requests. Empty = same origin (use dev proxy or same host in prod). */
  apiBaseURL: process.env.REACT_APP_API_URL?.trim() || '',

  /** Optional selling price for the paid plan. Shown in upgrade prompt when set. Override: REACT_APP_PAID_PLAN_PRICE */
  sellingPrice: getSellingPrice(),

  /** Upgrade / paid plan contact */
  upgradeContact: Object.freeze({
    url: getUpgradeUrl(),
    label: process.env.REACT_APP_UPGRADE_LABEL?.trim() || 'Contact to upgrade',
  }),
});

/** @deprecated Use appConfig.appName */
export const APP_NAME = appConfig.appName;

/** @deprecated Use appConfig.upgradeContact */
export const UPGRADE_CONTACT = appConfig.upgradeContact;
