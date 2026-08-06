import FeatureFlags from 'backend/view_models/feature_flags';
import { atom, selector } from 'recoil';
import BackendSettingsClient from '../api/settings/client';
import { getFrontendConfig } from '../config/config';

export const DisabledFeatureFlags: FeatureFlags = {
  chorePlanning: false,
};

const frontendConfig = getFrontendConfig();
const settingsClient = new BackendSettingsClient(frontendConfig.BackendURL);

export const FeatureFlagsQuery = selector<FeatureFlags>({
  key: 'featureFlagsQuery',
  get: async () => {
    try {
      return await settingsClient.GetFeatureFlags();
    } catch (error) {
      console.error('Failed to load feature flags; disabling features:', error);
      return DisabledFeatureFlags;
    }
  },
});

export const FeatureFlagsState = atom<FeatureFlags>({
  key: 'featureFlagsState',
  default: FeatureFlagsQuery,
});
