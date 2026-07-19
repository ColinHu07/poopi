import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScorePill } from '@/components/app/ScorePill';
import { AuthRequired } from '@/components/app/AuthRequired';
import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette, shadow } from '@/components/app/tokens';
import type { Bathroom, UserRating } from '@/src/data/types';
import { getComparisonCandidates, recordComparison } from '@/src/services/bathroomApi';
import { useAuth } from '@/src/providers/AuthProvider';

type RankedItem = { bathroom: Bathroom; rating: UserRating; score: number; rank: number };

export default function RankScreen() {
  const { session } = useAuth();
  const [ranked, setRanked] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRanked();
  }, []);

  async function loadRanked() {
    setLoading(true);
    try {
      setRanked(await getComparisonCandidates());
    } finally {
      setLoading(false);
    }
  }

  async function choose(winnerId: string, loserId: string) {
    setSaving(true);
    try {
      await recordComparison(winnerId, loserId);
      await loadRanked();
    } finally {
      setSaving(false);
    }
  }

  const left = ranked[0]?.bathroom;
  const right = ranked[1]?.bathroom;

  if (!session) {
    return (
      <AuthRequired
        title="Rank your bathroom visits"
        description="Log in to build your personal ranking, compare bathrooms, and keep your history synced across devices."
      />
    );
  }

  return (
    <Screen kicker="Personal score" title="Your rankings" right={<ScorePill label="top" value={ranked[0]?.score} />}>
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
            <Text style={styles.compareTitle}>Which was better?</Text>
            <TagChip label={saving ? 'Saving' : 'Elo update'} tone="info" />
          </View>
          <View style={styles.pairRow}>
            <Choice bathroom={left} onPress={() => choose(left.id, right.id)} />
            <Text style={styles.versus}>VS</Text>
            <Choice bathroom={right} onPress={() => choose(right.id, left.id)} />
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>One visit logged</Text>
          <Text style={styles.emptyText}>Log one more bathroom to unlock this-or-that comparisons.</Text>
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

function Choice({ bathroom, onPress }: { bathroom: Bathroom; onPress: () => void }) {
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
    fontWeight: '800',
    marginTop: 4,
  },
  empty: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
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
