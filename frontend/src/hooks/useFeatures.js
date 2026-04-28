import { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { PLAN, FEATURE_KEYS, DEFAULT_FEATURES } from '../constants/features';

/**
 * Returns { plan, features, canExport, canUseMappingManager, isPaid } from current user.
 * Uses constants for feature keys so they stay aligned with backend.
 */
export function useFeatures() {
  const { state } = useContext(AppContext);
  const user = state?.user;
  const plan = user?.plan || PLAN.FREE;
  const features = user?.features || DEFAULT_FEATURES;
  return {
    plan,
    features,
    canExport: !!features[FEATURE_KEYS.EXPORT],
    canUseMappingManager: !!features[FEATURE_KEYS.MAPPING_MANAGER],
    isPaid: plan === PLAN.PAID,
  };
}
