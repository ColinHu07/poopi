import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Section, Screen } from '@/components/app/Screen';
import { AuthRequired } from '@/components/app/AuthRequired';
import { FEATURE_LABELS, TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { FeatureTag } from '@/src/data/types';
import { useAuth } from '@/src/providers/AuthProvider';
import { getProfileSummary, type ProfileSummary } from '@/src/services/bathroomApi';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfileSummary()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  const topTags = [...new Set(profile?.favoriteTags ?? [])].slice(0, 6) as FeatureTag[];

  if (!session) {
    return (
      <AuthRequired
        title="Bring your bathroom taste with you"
        description="Log in to rate bathrooms, manage your lists, and keep your contributions connected to your profile."
      />
    );
  }

  return (
    <Screen
      kicker={profile?.handle ?? '@new'}
      title={profile?.displayName ?? 'Profile'}
      right={<TagChip label={profile?.city ?? 'New York'} tone="good" />}>
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
    borderRadius: 8,
    backgroundColor: palette.ink,
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
  panel: {
    borderRadius: 8,
    borderWidth: 1,
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
    borderRadius: 8,
    borderWidth: 1,
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
