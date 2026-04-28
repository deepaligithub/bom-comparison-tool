/**
 * Central API client. Use this instead of raw axios for all backend calls.
 * - baseURL from appConfig (or same origin)
 * - Request headers (X-User-Plan, X-User-Role) set by AppContext when user logs in
 * - 402 responses (upgrade required) handled in one place
 */
import axios from 'axios';
import { appConfig } from '../config/appConfig';
import { HTTP_UPGRADE_REQUIRED } from '../constants/features';

const client = axios.create({
  baseURL: appConfig.apiBaseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Optional: global handler when backend returns 402 (upgrade required).
 * Set via set402Handler(fn). E.g. show a toast or open upgrade modal.
 */
let upgradeRequiredHandler = null;

export function set402Handler(handler) {
  upgradeRequiredHandler = typeof handler === 'function' ? handler : null;
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === HTTP_UPGRADE_REQUIRED && (data?.code === 'UPGRADE_REQUIRED' || data?.error)) {
      if (upgradeRequiredHandler) {
        upgradeRequiredHandler(data?.error || 'This feature is not available in your current version.');
      }
    }
    return Promise.reject(error);
  }
);

export default client;
