import { FEATURE_TAGS, type FeatureTag } from './types';

const bathroomFeatures = new Set<string>(FEATURE_TAGS);

export function isBathroomFeature(value: string): value is FeatureTag {
  return bathroomFeatures.has(value);
}

export function normalizeBathroomFeatures(features: readonly string[]): FeatureTag[] {
  return [...new Set(features)].filter(isBathroomFeature);
}

