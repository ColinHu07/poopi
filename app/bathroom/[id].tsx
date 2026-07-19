import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BathroomPhoto } from '@/components/app/BathroomPhoto';
import { ScorePill } from '@/components/app/ScorePill';
import { Section, Screen } from '@/components/app/Screen';
import { ACCESS_LABELS, FEATURE_LABELS, TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { Bathroom } from '@/src/data/types';
import { useAuth } from '@/src/providers/AuthProvider';
import { getBathroomById } from '@/src/services/bathroomApi';
import {
  STATUS_LABELS,
  WAIT_LABELS,
  FRESHNESS_LABELS,
  confidenceLabel,
  confirmationLabel,
} from '@/src/lib/bathroomSummary';

export default function BathroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [bathroom, setBathroom] = useState<Bathroom | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBathroomById(id)
      .then((nextBathroom) => {
        if (!cancelled) {
          setBathroom(nextBathroom);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen title="Loading bathroom">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.missing}>Loading access notes...</Text>
        </View>
      </Screen>
    );
  }

  if (!bathroom) {
    return (
      <Screen title="Bathroom not found">
        <Text style={styles.missing}>That bathroom is not available in Poopi yet.</Text>
      </Screen>
    );
  }

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bathroom.latitude},${bathroom.longitude}`;
  const hasCommunityScore = (bathroom.scores.communityReviewCount ?? 0) > 0;
  const hasAnyScore = bathroom.scores.personal !== undefined || bathroom.scores.friends !== undefined || hasCommunityScore;

  return (
    <>
      <Stack.Screen options={{ title: bathroom.name }} />
      <Screen kicker={bathroom.neighborhood || bathroom.city} title={bathroom.name}>
        <BathroomPhoto photo={bathroom.photos[0]} style={styles.hero} />

        {hasAnyScore ? (
          <View style={styles.scoreRow}>
            {bathroom.scores.personal !== undefined ? <ScorePill label="you" value={bathroom.scores.personal} /> : null}
            {bathroom.scores.friends !== undefined ? <ScorePill label="friends" value={bathroom.scores.friends} muted /> : null}
            {hasCommunityScore ? <ScorePill label="all" value={bathroom.scores.community} muted /> : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(directionsUrl)}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Directions</Text>
          </Pressable>
          <Link
            href={session ? { pathname: '/modal', params: { bathroomId: bathroom.id } } : ({ pathname: '/sign-in' } as any)}
            asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{session ? 'Rate bathroom' : 'Sign in to rate'}</Text>
            </Pressable>
          </Link>
        </View>

        <Section title="Access">
          <View style={styles.factGrid}>
            <Fact label="Access" value={ACCESS_LABELS[bathroom.access]} />
            <Fact label="Cost" value={bathroom.priceNote} />
            <Fact label="Hours" value={bathroom.openingHours} />
            <Fact label="Confidence" value={`${confidenceLabel(bathroom.summary.confidence)} · ${Math.round(bathroom.summary.confidence * 100)}%`} />
          </View>
        </Section>

        <Section title="Recent conditions">
          <View style={styles.factGrid}>
            <Fact label="Status" value={STATUS_LABELS[bathroom.summary.operatingStatus]} />
            <Fact label="Typical wait" value={bathroom.summary.medianWait ? WAIT_LABELS[bathroom.summary.medianWait] : 'Unknown'} />
            <Fact label="Cleanliness" value={formatDimension(bathroom.summary.cleanlinessScore)} />
            <Fact label="Smell" value={formatDimension(bathroom.summary.odorScore)} />
            <Fact label="Privacy" value={formatDimension(bathroom.summary.privacyScore)} />
            <Fact label="Reviews" value={String(bathroom.summary.reviewCount)} />
            <Fact label="Freshness" value={FRESHNESS_LABELS[bathroom.summary.freshness]} />
          </View>
          <Text style={styles.confirmation}>{confirmationLabel(bathroom.summary.lastConfirmedAt)}</Text>
        </Section>

        <Section title="Bathroom features">
          <View style={styles.tags}>
            {bathroom.features.length ? (
              bathroom.features.map((tag) => (
                <TagChip key={tag} label={FEATURE_LABELS[tag]} tone="neutral" />
              ))
            ) : (
              <TagChip label="No tags yet" tone="neutral" />
            )}
          </View>
        </Section>

        <Section title="Notes">
          <View style={styles.noteBox}>
            <Text style={styles.note}>{bathroom.directionsNote || 'No directions note yet.'}</Text>
          </View>
        </Section>

        <Section title="Sources">
          {bathroom.sourceRefs.length ? (
            bathroom.sourceRefs.map((source) => (
              <View key={`${source.sourceName}-${source.sourceId}`} style={styles.sourceRow}>
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceName}>{source.sourceName.replace(/_/g, ' ')}</Text>
                  <Text style={styles.sourceMeta} numberOfLines={2}>
                    {source.sourceId} · {source.license}
                  </Text>
                </View>
                <TagChip label={`${Math.round(source.confidence * 100)}%`} tone="info" />
              </View>
            ))
          ) : (
            <View style={styles.noteBox}>
              <Text style={styles.note}>No source metadata yet.</Text>
            </View>
          )}
        </Section>
      </Screen>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function formatDimension(value: number | undefined): string {
  return value === undefined ? 'Not rated yet' : `${value.toFixed(1)} / 5`;
}

const styles = StyleSheet.create({
  hero: {
    height: 260,
    borderRadius: 8,
    backgroundColor: palette.line,
  },
  loading: {
    minHeight: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  missing: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmation: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fffaf6',
    fontSize: 15,
    fontWeight: '900',
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fact: {
    width: '48%',
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 12,
  },
  factLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  factValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
  },
  note: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 12,
  },
  sourceCopy: {
    flex: 1,
  },
  sourceName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  sourceMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
});
