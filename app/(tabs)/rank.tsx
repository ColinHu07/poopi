import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScorePill } from '@/components/app/ScorePill';
import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette, shadow } from '@/components/app/tokens';
import { getBathroomById, getRankedBathrooms, recordComparison } from '@/src/services/bathroomApi';

const comparisonPairs = [
  ['hudson-yards', 'nypl-main'],
  ['falchi-building', 'mccarren-field-house'],
  ['whole-foods-union', 'port-authority'],
  ['bryant-park', 'hudson-yards'],
];

export default function RankScreen() {
  const [version, setVersion] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);
  const ranked = useMemo(() => getRankedBathrooms(), [version]);
  const pair = comparisonPairs[pairIndex % comparisonPairs.length];
  const left = getBathroomById(pair[0]);
  const right = getBathroomById(pair[1]);

  function choose(winnerId: string, loserId: string) {
    recordComparison(winnerId, loserId);
    setPairIndex((current) => current + 1);
    setVersion((current) => current + 1);
  }

  return (
    <Screen kicker="Personal score" title="Your rankings" right={<ScorePill label="top" value={ranked[0]?.score} />}>
      {left && right ? (
        <View style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareTitle}>This or that?</Text>
            <TagChip label="Elo update" tone="info" />
          </View>
          <View style={styles.pairRow}>
            <Choice bathroomId={left.id} onPress={() => choose(left.id, right.id)} />
            <Text style={styles.versus}>VS</Text>
            <Choice bathroomId={right.id} onPress={() => choose(right.id, left.id)} />
          </View>
        </View>
      ) : null}

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
                {Math.round(rating.rating)} rating · {rating.comparisons} comparisons
              </Text>
            </View>
            <ScorePill label="you" value={score} muted={rank > 3} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Choice({ bathroomId, onPress }: { bathroomId: string; onPress: () => void }) {
  const bathroom = getBathroomById(bathroomId);
  if (!bathroom) {
    return null;
  }
  return (
    <Pressable style={({ pressed }) => [styles.choice, pressed && styles.pressed]} onPress={onPress}>
      <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.choiceImage} />
      <Text style={styles.choiceName} numberOfLines={2}>
        {bathroom.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compareCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 14,
    ...shadow,
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compareTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  choice: {
    flex: 1,
    minHeight: 172,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  choiceImage: {
    height: 105,
    backgroundColor: palette.line,
  },
  choiceName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    padding: 10,
  },
  versus: {
    color: palette.coral,
    fontSize: 14,
    fontWeight: '900',
  },
  list: {
    gap: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
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
    borderRadius: 8,
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
    fontWeight: '700',
    marginTop: 3,
  },
});
