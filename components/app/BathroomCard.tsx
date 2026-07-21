import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BathroomPhoto } from './BathroomPhoto';
import { ACCESS_LABELS, FEATURE_LABELS, TagChip } from './TagChip';
import { palette, shadow } from './tokens';
import type { Bathroom } from '@/src/data/types';
import { FRESHNESS_LABELS, STATUS_LABELS, WAIT_LABELS, confidenceLabel } from '@/src/lib/bathroomSummary';
import { formatDistance, formatWalkingEta } from '@/src/lib/directions';

interface BathroomCardProps {
  bathroom: Bathroom;
  compact?: boolean;
  onPress?: () => void;
  selected?: boolean;
}

export function BathroomCard({ bathroom, compact, onPress, selected }: BathroomCardProps) {
  const primaryTags = bathroom.features.slice(0, compact ? 2 : 4);
  const hasCommunityScore = (bathroom.scores.communityReviewCount ?? 0) > 0;
  const content = (
    <>
      <BathroomPhoto
        compact={Boolean(compact)}
        fallbackLabel={bathroom.name}
        photo={bathroom.photos[0]}
        style={styles.image}
      />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {bathroom.name}
          </Text>
          {hasCommunityScore ? <Text style={styles.score}>{bathroom.scores.community.toFixed(1)}</Text> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {formatDistance(bathroom.distanceMeters)} · {formatWalkingEta(bathroom.distanceMeters)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {ACCESS_LABELS[bathroom.access]} · {bathroom.priceNote}
        </Text>
        <Text style={styles.conditions} numberOfLines={1}>
          {STATUS_LABELS[bathroom.summary.operatingStatus]} ·{' '}
          {bathroom.summary.medianWait ? WAIT_LABELS[bathroom.summary.medianWait] : 'Wait unknown'}
        </Text>
        <Text style={styles.trust} numberOfLines={1}>
          {FRESHNESS_LABELS[bathroom.summary.freshness]} data · {confidenceLabel(bathroom.summary.confidence)} confidence ·{' '}
          {bathroom.summary.reviewCount} {bathroom.summary.reviewCount === 1 ? 'review' : 'reviews'}
        </Text>
        <View style={styles.tagRow}>
          {primaryTags.map((tag) => (
            <TagChip key={tag} label={FEATURE_LABELS[tag]} tone="neutral" />
          ))}
        </View>
        {!compact && (
          <Text style={styles.note} numberOfLines={2}>
            {bathroom.directionsNote}
          </Text>
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasCommunityScore
            ? `${bathroom.name}, community score ${bathroom.scores.community.toFixed(1)}`
            : bathroom.name
        }
        onPress={onPress}
        style={({ pressed }) => [styles.card, compact && styles.compact, selected && styles.selected, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return (
    <Link href={{ pathname: '/bathroom/[id]', params: { id: bathroom.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${bathroom.name} bathroom details`}
        style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed]}>
        {content}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 11,
    ...shadow,
  },
  compact: {
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  image: {
    width: 88,
    minHeight: 112,
    borderRadius: 14,
    backgroundColor: palette.line,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  score: {
    minWidth: 46,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: palette.mint,
    color: palette.jade,
    textAlign: 'center',
    paddingVertical: 7,
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  conditions: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  trust: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  note: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  selected: {
    borderColor: palette.coral,
    borderWidth: 2,
    backgroundColor: '#fff3ec',
  },
});
