import { ReactElement } from 'react';
import FeatureFlags from 'backend/view_models/feature_flags';
import { useRecoilValue } from 'recoil';
import { FeatureFlagsState } from '../state/features';

interface FeatureGateProps {
  children: ReactElement;
  feature: keyof FeatureFlags;
}

export default function FeatureGate({ children, feature }: FeatureGateProps) {
  const featureFlags = useRecoilValue(FeatureFlagsState);

  if (!featureFlags[feature]) {
    return null;
  }

  return children;
}
