import { StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';
import type { AccessType, FeatureTag } from '@/src/data/types';

export const FEATURE_LABELS: Record<FeatureTag, string> = {
  wheelchair_accessible: 'Wheelchair',
  step_free: 'Step-free',
  baby_changing: 'Baby change',
  adult_changing: 'Adult change',
  family_room: 'Family room',
  all_gender: 'All-gender',
  single_stall: 'Single-stall',
  menstrual_products: 'Products',
  sharps_disposal: 'Sharps',
  soap: 'Soap',
  dryer_or_towels: 'Dryer/towels',
  hook_or_shelf: 'Hook/shelf',
  mirror: 'Mirror',
  lock_works: 'Good lock',
  clean: 'Clean',
  smells_good: 'Smells good',
  stinks: 'Stinks',
  comfortable: 'Comfortable',
  roomy_stall: 'Roomy stall',
  wide_seat: 'Wide seat',
  urinal_only: 'Urinal only',
  bidet: 'Bidet',
  private: 'Private',
  safe: 'Safe',
  well_lit: 'Well-lit',
  long_line: 'Long line',
  out_of_order: 'Out of order',
};

export const ACCESS_LABELS: Record<AccessType, string> = {
  public: 'Public',
  customers_only: 'Customers',
  purchase_required: 'Purchase',
  paid: 'Paid',
  code_required: 'Code',
  staff_permission: 'Ask staff',
  members_only: 'Members',
  unknown: 'Unknown',
};

interface TagChipProps {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'info';
}

export function TagChip({ label, tone = 'neutral' }: TagChipProps) {
  return (
    <View style={[styles.chip, toneStyles[tone]]}>
      <Text style={[styles.label, toneTextStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});

const toneStyles = StyleSheet.create({
  neutral: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
  },
  good: {
    backgroundColor: palette.mint,
    borderColor: '#b6dfd4',
  },
  warn: {
    backgroundColor: palette.goldSoft,
    borderColor: '#efd28b',
  },
  info: {
    backgroundColor: palette.skySoft,
    borderColor: '#b7d7f5',
  },
});

const toneTextStyles = StyleSheet.create({
  neutral: {
    color: palette.ink,
  },
  good: {
    color: palette.jade,
  },
  warn: {
    color: palette.gold,
  },
  info: {
    color: palette.sky,
  },
});
