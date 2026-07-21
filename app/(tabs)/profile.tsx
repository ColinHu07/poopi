import { SymbolView } from 'expo-symbols';
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
import {
  deleteVisitObservation,
  getOwnSubmittedBathrooms,
  getOwnVisitHistory,
  getProfileSummary,
  type ProfileSummary,
} from '@/src/services/bathroomApi';
import { formatReviewAge, SENTIMENT_LABELS } from '@/src/lib/reviewPresentation';

export default function ProfileScreen() {
  const { isAnonymous, session, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [history, setHistory] = useState<Array<{ visit: Visit; bathroom: Bathroom }>>([]);
  const [submittedBathrooms, setSubmittedBathrooms] = useState<Bathroom[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ visit: Visit; bathroom: Bathroom }>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
      Promise.all([getOwnVisitHistory(), getOwnSubmittedBathrooms()]).then(([items, submitted]) => {
        if (cancelled) return;
        setHistory(items);
        setSubmittedBathrooms(submitted);
      });
      return () => {
        cancelled = true;
      };
    }, [isAnonymous, session]),
  );

  const topTags = [...new Set(profile?.favoriteTags ?? [])].slice(0, 6) as FeatureTag[];
  const reviewedBathroomIds = new Set(history.map(({ bathroom }) => bathroom.id));
  const unfinishedBathrooms = submittedBathrooms.filter((bathroom) => !reviewedBathroomIds.has(bathroom.id));

  async function deleteRating() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteVisitObservation(deleteTarget.visit.id, deleteTarget.bathroom.id);
      setHistory((items) => items.filter(({ visit }) => visit.id !== deleteTarget.visit.id));
      setSubmittedBathrooms((items) =>
        items.some((bathroom) => bathroom.id === deleteTarget.bathroom.id)
          ? items
          : [deleteTarget.bathroom, ...items],
      );
      setProfile(await getProfileSummary());
      setDeleteTarget(undefined);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this rating.');
    } finally {
      setDeleting(false);
    }
  }

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
                  <View key={visit.id} style={styles.historyCard}>
                    <Link
                      href={{ pathname: '/modal', params: { bathroomId: bathroom.id } }}
                      asChild>
                      <Pressable accessibilityRole="link" style={styles.historyLink}>
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
                              ? `${visit.ratingTags.length} labels saved · tap to edit`
                              : 'No labels yet · tap to edit'}
                          </Text>
                        </View>
                      </Pressable>
                    </Link>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete your rating for ${bathroom.name}`}
                      hitSlop={4}
                      onPress={() => {
                        setDeleteError('');
                        setDeleteTarget({ visit, bathroom });
                      }}
                      style={({ pressed }) => [styles.historyDelete, pressed && styles.pressed]}>
                      <SymbolView
                        name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                        size={18}
                        tintColor={palette.coral}
                        fallback={<Text style={styles.deleteFallback}>×</Text>}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.panelNumber}>Your reviews live here</Text>
                <Text style={styles.panelText}>After you rate a bathroom, reopen it here to change scores, labels, notes, or privacy.</Text>
              </View>
            )}
            {deleteTarget ? (
              <View style={styles.deleteConfirm}>
                <Text style={styles.deleteConfirmTitle}>Delete your {deleteTarget.bathroom.name} rating?</Text>
                <Text style={styles.deleteConfirmCopy}>The rating, labels, and note will be removed. The bathroom will remain available to rate again.</Text>
                {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
                <View style={styles.deleteActions}>
                  <Pressable disabled={deleting} onPress={() => setDeleteTarget(undefined)} style={styles.keepButton}>
                    <Text style={styles.keepButtonText}>Keep it</Text>
                  </Pressable>
                  <Pressable disabled={deleting} onPress={deleteRating} style={styles.confirmDeleteButton}>
                    {deleting ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.confirmDeleteText}>Delete rating</Text>}
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Section>

          {unfinishedBathrooms.length ? (
            <Section title="Bathrooms you added">
              <View style={styles.historyStack}>
                {unfinishedBathrooms.map((bathroom) => (
                  <Link
                    key={bathroom.id}
                    href={{ pathname: '/modal', params: { bathroomId: bathroom.id } }}
                    asChild>
                    <Pressable accessibilityRole="link" style={styles.addedCard}>
                      <BathroomPhoto
                        compact
                        fallbackLabel={bathroom.name}
                        photo={bathroom.photos[0]}
                        style={styles.historyPhoto}
                      />
                      <View style={styles.historyBody}>
                        <Text style={styles.historyName} numberOfLines={1}>{bathroom.name}</Text>
                        <Text style={styles.historyLabels} numberOfLines={2}>
                          {bathroom.address || 'Address not confirmed'}
                        </Text>
                      </View>
                      <Text style={styles.finishRating}>Rate now →</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </Section>
          ) : null}

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
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.cocoaSoft,
    backgroundColor: palette.surface,
    padding: 7,
    paddingRight: 9,
  },
  historyLink: {
    flex: 1,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addedCard: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#8fcfc0',
    backgroundColor: palette.mint,
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
  historyDelete: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteFallback: {
    color: palette.coral,
    fontSize: 22,
    fontWeight: '900',
  },
  finishRating: {
    color: palette.jade,
    fontSize: 12,
    fontWeight: '900',
  },
  deleteConfirm: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ffc4b5',
    backgroundColor: palette.coralSoft,
    padding: 14,
    gap: 8,
  },
  deleteConfirmTitle: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: '900',
  },
  deleteConfirmCopy: {
    color: palette.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  deleteError: {
    color: palette.coralDark,
    fontSize: 12,
    fontWeight: '800',
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  keepButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.65,
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
