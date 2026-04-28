/**
 * Feature flags and plan constants. Single source of truth for free/paid feature names.
 * Align with backend PAID_FEATURES and _features_for_plan().
 */

/** Plan values returned by API */
export const PLAN = Object.freeze({
  FREE: 'free',
  PAID: 'paid',
});

/** Feature keys returned in user.features */
export const FEATURE_KEYS = Object.freeze({
  EXPORT: 'export',
  MAPPING_MANAGER: 'mapping_manager',
  USERS_PAGE: 'users_page',
});

/** Default feature map when user or features are missing */
export const DEFAULT_FEATURES = Object.freeze({
  [FEATURE_KEYS.EXPORT]: false,
  [FEATURE_KEYS.MAPPING_MANAGER]: false,
  [FEATURE_KEYS.USERS_PAGE]: false,
});

/** HTTP status when a paid-only endpoint is called without paid plan */
export const HTTP_UPGRADE_REQUIRED = 402;
