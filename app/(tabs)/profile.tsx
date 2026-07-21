import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BathroomPhoto } from '@/components/app/BathroomPhoto';
import { Section, Screen } from '@/components/app/Screen';
import { AuthRequired } from '@/components/app/AuthRequired';
import { FEATURE_LABELS, TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { Bathroom, FeatureTag, Visit } from '@/src/data/types';
import { useAuth } from '@/src/providers/AuthProvider';
import { getOwnVisitHistory, getProfileSummary, type ProfileSummary } from '@/src/services/bathroomApi';
import { formatReviewAge, SENTIMENT_LABELS } from '@/src/lib/reviewPresentation';

export default function ProfileScreen() {
  const { isAnonymous, session, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [history, setHistory] = useState<Array<{ visit: Visit; bathroom: Bathroom }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfileSummary()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session || isAnonymous) return;
      let cancelled = false;
      getOwnVisitHistory().then((items) => {
        if (!cancelled) setHistory(items);
      });
      return () => {
        cancelled = true;
      };
    }, [isAnonymous, session]),
  );

  const topTags = [...new Set(profile?.favoriteTags ?? [])].slice(0, 6) as FeatureTag[];

  if (!session || isAnonymous) {
    return (
      <AuthRequired
        title="Bring your bathroom taste with you"
        description="Log in to rate bathrooms, manage your lists, and keep your contributions connected to your profile."
      />
    );
  }

  return (
    <Screen
      kicker="Your profile"
      title={profile?.displayName ? `@${profile.displayName}` : 'Profile'}>
      {loading || !profile ? (
        <View style={styles.panel}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.panelText}>Loading profile...</Text>
        </View>
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric label="ranked" value={profile.rankedCount} />
            <Metric label="visited" value={profile.visitedCount} />
            <Metric label="lists" value={profile.listsCount} />
          </View>

          <Section title="Your bathroom diary">
            {history.length ? (
              <View style={styles.historyStack}>
                {history.map(({ visit, bathroom }) => (
                  <Link
                    key={visit.id}
                    href={{ pathname: '/modal', params: { bathroomId: bathroom.id } }}
                    asChild>
                    <Pressable accessibilityRole="link" style={styles.historyCard}>
                      <BathroomPhoto
                        compact
                        fallbackLabel={bathroom.name}
                        photo={bathroom.photos[0]}
                        style={styles.historyPhoto}
                      />
                      <View style={styles.historyBody}>
                        <Text style={styles.historyName} numberOfLines={1}>{bathroom.name}</Text>
                        <Text style={styles.historyMeta}>
                          {SENTIMENT_LABELS[visit.sentiment]} · {formatReviewAge(visit.observedAt)}
                        </Text>
                        <Text style={styles.historyLabels} numberOfLines={1}>
                          {visit.ratingTags.length
                            ? `${visit.ratingTags.length} labels saved`
                            : 'No labels yet'}
                        </Text>
                      </View>
                      <Text style={styles.editReview}>Edit →</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.panelNumber}>Your reviews live here</Text>
                <Text style={styles.panelText}>After you rate a bathroom, reopen it here to change scores, labels, notes, or privacy.</Text>
              </View>
            )}
          </Section>

          <Section title="Signals">
            {topTags.length ? (
              <View style={styles.tags}>
                {topTags.map((tag) => (
                  <TagChip key={tag} label={FEATURE_LABELS[tag]} tone="info" />
                ))}
              </View>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.panelNumber}>Fresh account</Text>
                <Text style={styles.panelText}>Log visits to build your personal bathroom taste profile.</Text>
              </View>
            )}
          </Section>

          <Section title="Trust">
            <View style={styles.panel}>
              <Text style={styles.panelNumber}>{profile.confidenceBoosts}</Text>
              <Text style={styles.panelText}>source confirmations from your account</Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelNumber}>Strict</Text>
              <Text style={styles.panelText}>photos with people, kids, faces, or sensitive reflections stay out of public views</Text>
            </View>
          </Section>
        </>
      )}

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: palette.jadeDark,
    padding: 14,
  },
  metricValue: {
    color: palette.surface,
    fontSize: 28,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#efece2',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyStack: {
    gap: 10,
  },
  historyCard: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.cocoaSoft,
    backgroundColor: palette.surface,
    padding: 10,
  },
  historyPhoto: {
    width: 68,
    height: 68,
    borderRadius: 14,
  },
  historyBody: {
    flex: 1,
    gap: 3,
  },
  historyName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  historyMeta: {
    color: palette.jade,
    fontSize: 12,
    fontWeight: '900',
  },
  historyLabels: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  editReview: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '900',
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 6,
  },
  panelNumber: {
    color: palette.coral,
    fontSize: 22,
    fontWeight: '900',
  },
  panelText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  signOutButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: '900',
  },
});
