import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScorePill } from '@/components/app/ScorePill';
import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette, shadow } from '@/components/app/tokens';
import { getComparisonCandidates, recordComparison, type RankedBathroom } from '@/src/services/bathroomApi';
import { useAuth } from '@/src/providers/AuthProvider';

export default function RankScreen() {
  const { focusBathroomId, fromReview } = useLocalSearchParams<{ focusBathroomId?: string; fromReview?: string }>();
  const { isAnonymous, session } = useAuth();
  const [ranked, setRanked] = useState<RankedBathroom[]>([]);
  const [left, setLeft] = useState<RankedBathroom>();
  const [right, setRight] = useState<RankedBathroom>();
  const [qualityGap, setQualityGap] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRanked();
  }, [focusBathroomId]);

  async function loadRanked() {
    setLoading(true);
    setError('');
    try {
      const next = await getComparisonCandidates(focusBathroomId);
      setRanked(next.ranked);
      setLeft(next.left);
      setRight(next.right);
      setQualityGap(next.qualityGap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your comparisons.');
    } finally {
      setLoading(false);
    }
  }

  async function choose(winnerId: string, loserId: string) {
    setSaving(true);
    setError('');
    try {
      await recordComparison(winnerId, loserId);
      if (fromReview === '1' && focusBathroomId) {
        router.replace({
          pathname: '/bathroom/[id]',
          params: { id: focusBathroomId, reviewed: '1', compared: '1' },
        });
        return;
      }
      await loadRanked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this comparison.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      kicker={fromReview === '1' ? 'Review saved' : session && !isAnonymous ? 'Personal score' : 'Guest comparison'}
      title={fromReview === '1' ? 'One quick comparison' : session && !isAnonymous ? 'Your rankings' : 'Compare bathrooms'}
      right={<ScorePill label="top" value={ranked[0]?.score} />}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!session || isAnonymous ? (
        <View style={styles.guestBox}>
          <Text style={styles.guestTitle}>No account needed</Text>
          <Text style={styles.guestCopy}>Your first vote creates a private guest identity. Log in later if you want rankings synced across devices.</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.emptyText}>Loading your rankings...</Text>
        </View>
      ) : ranked.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptyText}>No persisted bathrooms are available for comparison yet.</Text>
        </View>
      ) : left && right ? (
        <View style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <View style={styles.compareHeadingCopy}>
              <Text style={styles.compareTitle}>Which bathroom was better?</Text>
              <Text style={styles.compareCopy}>
                {qualityGap !== undefined && qualityGap <= 1
                  ? 'We picked a recent bathroom with a similar review so this choice can place your new score accurately.'
                  : 'We picked the closest unanswered match from your recent ratings.'}
              </Text>
            </View>
            <TagChip label={saving ? 'Saving' : 'Smart match'} tone="info" />
          </View>
          <View style={styles.pairRow}>
            <Choice disabled={saving} item={left} onPress={() => choose(left.bathroom.id, right.bathroom.id)} />
            <Text style={styles.versus}>VS</Text>
            <Choice disabled={saving} item={right} onPress={() => choose(right.bathroom.id, left.bathroom.id)} />
          </View>
          {fromReview === '1' && focusBathroomId ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.replace({ pathname: '/bathroom/[id]', params: { id: focusBathroomId, reviewed: '1' } })
              }
              style={styles.skipButton}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{ranked.length === 1 ? 'One visit logged' : 'You’re caught up'}</Text>
          <Text style={styles.emptyText}>
            {ranked.length === 1
              ? 'Log one more bathroom to unlock this-or-that comparisons.'
              : 'You have answered every useful comparison for this bathroom. Your personal scores are up to date.'}
          </Text>
          {fromReview === '1' && focusBathroomId ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.replace({ pathname: '/bathroom/[id]', params: { id: focusBathroomId, reviewed: '1' } })
              }
              style={styles.viewBathroomButton}>
              <Text style={styles.viewBathroomButtonText}>View bathroom</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.list}>
        {ranked.map(({ bathroom, rank, score, rating }) => (
          <View key={bathroom.id} style={styles.rankRow}>
            <Text style={styles.rankNumber}>{rank}</Text>
            <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.thumb} />
            <View style={styles.rankBody}>
              <Text style={styles.rankName} numberOfLines={1}>
                {bathroom.name}
              </Text>
              <Text style={styles.rankMeta}>
                {rating.comparisons
                  ? `${rating.comparisons} comparison${rating.comparisons === 1 ? '' : 's'}`
                  : 'New score · no comparisons yet'}
              </Text>
            </View>
            <ScorePill label="you" value={score} muted={rank > 3} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Choice({ disabled, item, onPress }: { disabled: boolean; item: RankedBathroom; onPress: () => void }) {
  const { bathroom } = item;
  const dimensions = [
    item.cleanlinessRating ? `Clean ${item.cleanlinessRating}` : null,
    item.odorRating ? `Smell ${item.odorRating}` : null,
    item.privacyRating ? `Privacy ${item.privacyRating}` : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${bathroom.name}, personal quality ${item.qualityScore} out of 10`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [styles.choice, disabled && styles.disabledChoice, pressed && styles.pressed]}
      onPress={onPress}>
      <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.choiceImage} />
      <View style={styles.choiceBody}>
        <Text style={styles.choiceName} numberOfLines={2}>{bathroom.name}</Text>
        <Text style={styles.choiceQuality}>{item.qualityScore.toFixed(1)} from your review</Text>
        {dimensions.length ? <Text style={styles.choiceDimensions}>{dimensions.join(' · ')}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  guestBox: { borderRadius: 18, borderWidth: 1.5, borderColor: '#8fcfc0', backgroundColor: palette.mint, padding: 15, gap: 3 },
  guestTitle: { color: palette.jade, fontSize: 14, fontWeight: '900' },
  guestCopy: { color: palette.ink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  errorBox: { borderRadius: 10, borderWidth: 1, borderColor: '#ffc4b5', backgroundColor: palette.coralSoft, padding: 13 },
  errorText: { color: palette.coral, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  compareCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: palette.cocoaSoft,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 14,
    ...shadow,
  },
  compareHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  compareHeadingCopy: { flex: 1, gap: 4 },
  compareTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  compareCopy: { color: palette.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  choice: {
    flex: 1,
    minHeight: 212,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: palette.paper,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  disabledChoice: { opacity: 0.65 },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  choiceImage: {
    height: 105,
    backgroundColor: palette.line,
  },
  choiceBody: { padding: 10, gap: 4 },
  choiceName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  choiceQuality: { color: palette.jade, fontSize: 12, fontWeight: '900' },
  choiceDimensions: { color: palette.muted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  versus: {
    color: palette.coral,
    fontSize: 14,
    fontWeight: '900',
  },
  skipButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  skipButtonText: { color: palette.muted, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  viewBathroomButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: palette.jade,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewBathroomButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  list: {
    gap: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 10,
  },
  rankNumber: {
    width: 28,
    color: palette.jade,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: palette.line,
  },
  rankBody: {
    flex: 1,
  },
  rankName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  rankMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  empty: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 18,
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
