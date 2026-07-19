import { StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';
import type { AccessType, FeatureTag } from '@/src/data/types';

export const FEATURE_LABELS: Record<FeatureTag, string> = {
  wheelchair_accessible: 'Wheelchair',
  step_free: 'Step-free',
  accessible_stall: 'Accessible stall',
  grab_bars: 'Grab bars',
  automatic_door: 'Automatic door',
  baby_changing: 'Baby change',
  adult_changing: 'Adult change',
  family_room: 'Family room',
  all_gender: 'All-gender',
  single_stall: 'Single-stall',
  multiple_stalls: 'Multiple stalls',
  urinal_only: 'Urinal only',
  sharps_disposal: 'Sharps',
  hook_or_shelf: 'Hook/shelf',
  mirror: 'Mirror',
  bidet: 'Bidet',
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
