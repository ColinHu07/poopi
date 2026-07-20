import type { Bathroom, BathroomFilters } from '@/src/data/types';

export function matchesBathroomFilters(bathroom: Bathroom, filters: BathroomFilters): boolean {
  if (filters.openNow && bathroom.summary.operatingStatus !== 'open') return false;
  if (filters.free && bathroom.feeRequired !== false) return false;
  if (filters.wheelchair && !bathroom.features.includes('wheelchair_accessible')) return false;
  if (filters.babyChanging && !bathroom.features.includes('baby_changing')) return false;
  if (filters.allGender && !bathroom.features.includes('all_gender')) return false;
  if (filters.singleStall && !bathroom.features.includes('single_stall')) return false;
  if (filters.customersOnly && bathroom.access !== 'customers_only') return false;
  if (filters.paid && bathroom.feeRequired !== true && bathroom.access !== 'paid') return false;
  if (filters.highConfidence && bathroom.confidence < 0.8) return false;
  return true;
}
