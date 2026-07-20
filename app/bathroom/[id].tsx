import * as Location from 'expo-location';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BathroomPhoto } from '@/components/app/BathroomPhoto';
import { ScorePill } from '@/components/app/ScorePill';
import { Section, Screen } from '@/components/app/Screen';
import { ACCESS_LABELS, FEATURE_LABELS, TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { Bathroom, PublicBathroomReview } from '@/src/data/types';
import { useAuth } from '@/src/providers/AuthProvider';
import {
  createReport,
  getBathroomById,
  getPublicBathroomReviews,
  isBathroomSaved,
  toggleBathroomSaved,
} from '@/src/services/bathroomApi';
import {
  STATUS_LABELS,
  WAIT_LABELS,
  FRESHNESS_LABELS,
  confidenceLabel,
  confirmationLabel,
} from '@/src/lib/bathroomSummary';
import { distanceKm } from '@/src/lib/ranking';
import { getRatingLabelDefinition } from '@/src/data/ratingLabels';
import { buildWalkingDirectionsUrl, formatDistance, formatWalkingEta } from '@/src/lib/directions';
import {
  aggregateRatingLabels,
  formatReviewAge,
  REPORT_REASON_OPTIONS,
  SENTIMENT_LABELS,
} from '@/src/lib/reviewPresentation';

export default function BathroomDetailScreen() {
  const { id, reviewed } = useLocalSearchParams<{ id: string; reviewed?: string }>();
  const { isAnonymous, session } = useAuth();
  const [bathroom, setBathroom] = useState<Bathroom>();
  const [reviews, setReviews] = useState<PublicBathroomReview[]>([]);
  const [distanceMeters, setDistanceMeters] = useState<number>();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(reviewed === '1' ? 'Your review was saved and the community summary was refreshed.' : '');
  const [actionError, setActionError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const canContribute = Boolean(session && !isAnonymous);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getBathroomById(id),
      getPublicBathroomReviews(id),
      canContribute ? isBathroomSaved(id).catch(() => false) : Promise.resolve(false),
    ])
      .then(([nextBathroom, nextReviews, nextSaved]) => {
        if (cancelled) return;
        setBathroom(nextBathroom);
        setReviews(nextReviews);
        setSaved(nextSaved);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, canContribute]);

  useEffect(() => {
    if (!bathroom) return;
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (permission.status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setDistanceMeters(
            distanceKm(position.coords.latitude, position.coords.longitude, bathroom.latitude, bathroom.longitude) * 1000,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bathroom]);

  const commonLabels = useMemo(() => aggregateRatingLabels(reviews).slice(0, 10), [reviews]);

  async function toggleSaved() {
    if (!canContribute) {
      router.push('/sign-in' as any);
      return;
    }
    setActionLoading(true);
    setActionMessage('');
    setActionError(false);
    try {
      const nextSaved = await toggleBathroomSaved(id);
      setSaved(nextSaved);
      setActionMessage(nextSaved ? 'Saved to your private Saved list.' : 'Removed from your Saved list.');
    } catch (error) {
      setActionError(true);
      setActionMessage(error instanceof Error ? error.message : 'Unable to update your Saved list.');
    } finally {
      setActionLoading(false);
    }
  }

  async function report(reason: (typeof REPORT_REASON_OPTIONS)[number]) {
    if (!canContribute) {
      router.push('/sign-in' as any);
      return;
    }
    setActionLoading(true);
    setActionMessage('');
    setActionError(false);
    try {
      const details = [reason.details, reportDetails.trim()].filter(Boolean).join(' ');
      await createReport(id, reason.id, details);
      setReportOpen(false);
      setReportDetails('');
      setActionMessage('Report received. Thank you for helping keep this bathroom accurate.');
    } catch (error) {
      setActionError(true);
      setActionMessage(error instanceof Error ? error.message : 'Unable to submit the report.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Screen title="Loading bathroom">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.missing}>Loading recent reports and access notes...</Text>
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

  const directionsUrl = buildWalkingDirectionsUrl(
    { latitude: bathroom.latitude, longitude: bathroom.longitude, name: bathroom.name },
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  );
  const hasCommunityScore = (bathroom.scores.communityReviewCount ?? 0) > 0;
  const hasAnyScore = bathroom.scores.personal !== undefined || bathroom.scores.friends !== undefined || hasCommunityScore;
  const distanceLabel = formatDistance(distanceMeters ?? bathroom.distanceMeters);
  const etaLabel = formatWalkingEta(distanceMeters ?? bathroom.distanceMeters);

  return (
    <>
      <Stack.Screen options={{ title: bathroom.name }} />
      <Screen kicker={bathroom.neighborhood || bathroom.city || 'Bathroom details'} title={bathroom.name}>
        {actionMessage ? (
          <View style={[styles.successBox, actionError && styles.errorBox]}>
            <Text style={[styles.successText, actionError && styles.errorText]}>{actionMessage}</Text>
          </View>
        ) : null}

        <BathroomPhoto fallbackLabel={bathroom.name} photo={bathroom.photos[0]} style={styles.hero} />

        <View style={styles.locationSummary}>
          <Text style={styles.address}>{bathroom.address || 'Address not confirmed'}</Text>
          <Text style={styles.distance}>{[distanceLabel, etaLabel].filter(Boolean).join(' · ') || 'Distance unavailable'}</Text>
        </View>

        <View style={[styles.statusBanner, statusTone(bathroom.summary.operatingStatus)]}>
          <Text style={styles.statusTitle}>{STATUS_LABELS[bathroom.summary.operatingStatus]}</Text>
          <Text style={styles.statusMeta}>
            {confirmationLabel(bathroom.summary.lastConfirmedAt)} · {confidenceLabel(bathroom.summary.confidence)} confidence
          </Text>
        </View>

        {hasAnyScore ? (
          <View style={styles.scoreRow}>
            {bathroom.scores.personal !== undefined ? <ScorePill label="you" value={bathroom.scores.personal} /> : null}
            {bathroom.scores.friends !== undefined ? <ScorePill label="friends" value={bathroom.scores.friends} muted /> : null}
            {hasCommunityScore ? <ScorePill label="community" value={bathroom.scores.community} muted /> : null}
          </View>
        ) : (
          <View style={styles.noScoreBox}>
            <Text style={styles.noScoreTitle}>No community score yet</Text>
            <Text style={styles.noScoreText}>Be the first person to leave structured feedback.</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(directionsUrl)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Directions</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: actionLoading, selected: saved }}
            disabled={actionLoading}
            onPress={toggleSaved}
            style={[styles.secondaryButton, saved && styles.savedButton]}>
            {actionLoading ? <ActivityIndicator color={palette.jade} /> : <Text style={styles.secondaryButtonText}>{saved ? 'Saved ✓' : 'Save'}</Text>}
          </Pressable>
        </View>

        <Link
          href={canContribute ? { pathname: '/modal', params: { bathroomId: bathroom.id } } : ({ pathname: '/sign-in' } as any)}
          asChild>
          <Pressable style={styles.rateButton}>
            <Text style={styles.rateButtonText}>{canContribute ? 'Rate this bathroom' : 'Sign in to rate'}</Text>
          </Pressable>
        </Link>

        <Section title="Access and essentials">
          <View style={styles.factGrid}>
            <Fact label="Access" value={ACCESS_LABELS[bathroom.access]} />
            <Fact label="Cost" value={bathroom.priceNote} />
            <Fact label="Hours" value={bathroom.openingHours} />
            <Fact label="Data confidence" value={`${confidenceLabel(bathroom.summary.confidence)} · ${Math.round(bathroom.summary.confidence * 100)}%`} />
          </View>
        </Section>

        <Section title="Recent conditions">
          <View style={styles.factGrid}>
            <Fact label="Typical wait" value={bathroom.summary.medianWait ? WAIT_LABELS[bathroom.summary.medianWait] : 'Unknown'} />
            <Fact label="Cleanliness" value={formatDimension(bathroom.summary.cleanlinessScore)} />
            <Fact label="Smell" value={formatDimension(bathroom.summary.odorScore)} />
            <Fact label="Privacy" value={formatDimension(bathroom.summary.privacyScore)} />
            <Fact label="Public reviews" value={String(bathroom.summary.reviewCount)} />
            <Fact label="Freshness" value={FRESHNESS_LABELS[bathroom.summary.freshness]} />
          </View>
        </Section>

        {commonLabels.length ? (
          <Section title="What people mention">
            <View style={styles.tags}>
              {commonLabels.map((label) => (
                <TagChip
                  key={label.id}
                  label={`${label.label} · ${label.count}`}
                  tone={label.tone === 'positive' ? 'good' : 'warn'}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Bathroom features">
          <View style={styles.tags}>
            {bathroom.features.length ? (
              bathroom.features.map((tag) => <TagChip key={tag} label={FEATURE_LABELS[tag]} tone="neutral" />)
            ) : (
              <TagChip label="No confirmed features yet" tone="neutral" />
            )}
          </View>
        </Section>

        <Section title={`Recent public reviews · ${reviews.length}`}>
          {reviews.length ? (
            <View style={styles.reviewStack}>
              {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
            </View>
          ) : (
            <View style={styles.noteBox}>
              <Text style={styles.note}>No public reviews yet. Ratings set to friends or private stay hidden here.</Text>
            </View>
          )}
        </Section>

        <Section title="Directions note">
          <View style={styles.noteBox}>
            <Text style={styles.note}>{bathroom.directionsNote || 'No directions note yet.'}</Text>
          </View>
        </Section>

        <Section title="Report a problem">
          <Pressable
            accessibilityRole="button"
            onPress={() => (canContribute ? setReportOpen((value) => !value) : router.push('/sign-in' as any))}
            style={styles.reportToggle}>
            <Text style={styles.reportToggleText}>{canContribute ? 'Report incorrect or unsafe information' : 'Sign in to report a problem'}</Text>
          </Pressable>
          {reportOpen ? (
            <View style={styles.reportBox}>
              <Text style={styles.reportHelp}>Choose the issue. Reports are private and go to moderation.</Text>
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Optional details"
                placeholderTextColor={palette.muted}
                multiline
                style={styles.reportInput}
              />
              <View style={styles.reportReasons}>
                {REPORT_REASON_OPTIONS.map((reason) => (
                  <Pressable
                    key={`${reason.id}-${reason.label}`}
                    accessibilityRole="button"
                    disabled={actionLoading}
                    onPress={() => report(reason)}
                    style={styles.reportReason}>
                    <Text style={styles.reportReasonText}>{reason.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Section>

        <Section title="Sources">
          {bathroom.sourceRefs.length ? (
            bathroom.sourceRefs.map((source) => (
              <View key={`${source.sourceName}-${source.sourceId}`} style={styles.sourceRow}>
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceName}>{source.sourceName.replace(/_/g, ' ')}</Text>
                  <Text style={styles.sourceMeta} numberOfLines={2}>{source.sourceId} · {source.license}</Text>
                </View>
                <TagChip label={`${Math.round(source.confidence * 100)}%`} tone="info" />
              </View>
            ))
          ) : (
            <View style={styles.noteBox}><Text style={styles.note}>Community submitted; source details are not confirmed yet.</Text></View>
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

function ReviewCard({ review }: { review: PublicBathroomReview }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewSentiment}>{SENTIMENT_LABELS[review.sentiment]}</Text>
        <Text style={styles.reviewAge}>{formatReviewAge(review.observedAt)}</Text>
      </View>
      <View style={styles.reviewMetrics}>
        {review.cleanlinessRating ? <TagChip label={`Clean ${review.cleanlinessRating}/5`} tone="neutral" /> : null}
        {review.odorRating ? <TagChip label={`Smell ${review.odorRating}/5`} tone="neutral" /> : null}
        {review.privacyRating ? <TagChip label={`Privacy ${review.privacyRating}/5`} tone="neutral" /> : null}
        {review.waitBucket ? <TagChip label={WAIT_LABELS[review.waitBucket]} tone="info" /> : null}
        {review.observedStatus && review.observedStatus !== 'unknown' ? (
          <TagChip label={STATUS_LABELS[review.observedStatus]} tone="warn" />
        ) : null}
      </View>
      {review.ratingTags.length ? (
        <View style={styles.reviewMetrics}>
          {review.ratingTags.slice(0, 8).map((label) => {
            const definition = getRatingLabelDefinition(label);
            return <TagChip key={label} label={definition.label} tone={definition.tone === 'positive' ? 'good' : 'warn'} />;
          })}
        </View>
      ) : null}
      {review.publicNote ? <Text style={styles.reviewNote}>{review.publicNote}</Text> : null}
      <Text style={styles.anonymousCopy}>Anonymous public bathroom review</Text>
    </View>
  );
}

function formatDimension(value: number | undefined): string {
  return value === undefined ? 'Not rated yet' : `${value.toFixed(1)} / 5`;
}

function statusTone(status: Bathroom['summary']['operatingStatus']) {
  if (status === 'open') return styles.statusOpen;
  if (status === 'closed' || status === 'out_of_order') return styles.statusClosed;
  return styles.statusUnknown;
}

const styles = StyleSheet.create({
  hero: { height: 260, borderRadius: 10, backgroundColor: palette.line },
  loading: { minHeight: 140, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', gap: 10 },
  missing: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  successBox: { borderRadius: 10, borderWidth: 1, borderColor: '#b6dfd4', backgroundColor: palette.mint, padding: 13 },
  successText: { color: palette.jade, fontSize: 13, lineHeight: 19, fontWeight: '900' },
  errorBox: { borderColor: '#ffc4b5', backgroundColor: palette.coralSoft },
  errorText: { color: palette.coral },
  locationSummary: { gap: 4 },
  address: { color: palette.ink, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  distance: { color: palette.muted, fontSize: 13, fontWeight: '800' },
  statusBanner: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 4 },
  statusOpen: { backgroundColor: palette.mint, borderColor: '#b6dfd4' },
  statusClosed: { backgroundColor: palette.coralSoft, borderColor: '#ffc4b5' },
  statusUnknown: { backgroundColor: palette.goldSoft, borderColor: '#efd28b' },
  statusTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  statusMeta: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  noScoreBox: { borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, gap: 4 },
  noScoreTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  noScoreText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, minHeight: 50, borderRadius: 10, backgroundColor: palette.jade, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fffaf6', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minWidth: 110, minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  savedButton: { borderColor: '#b6dfd4', backgroundColor: palette.mint },
  secondaryButtonText: { color: palette.jade, fontSize: 15, fontWeight: '900' },
  rateButton: { minHeight: 52, borderRadius: 10, backgroundColor: palette.coral, alignItems: 'center', justifyContent: 'center' },
  rateButtonText: { color: '#fffaf6', fontSize: 16, fontWeight: '900' },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { width: '48%', minHeight: 76, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 12 },
  factLabel: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  factValue: { color: palette.ink, fontSize: 15, fontWeight: '900', marginTop: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noteBox: { borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14 },
  note: { color: palette.ink, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  reviewStack: { gap: 10 },
  reviewCard: { borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, gap: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  reviewSentiment: { color: palette.jade, fontSize: 16, fontWeight: '900' },
  reviewAge: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  reviewMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reviewNote: { color: palette.ink, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  anonymousCopy: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  reportToggle: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#ffc4b5', backgroundColor: palette.coralSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  reportToggleText: { color: palette.coral, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  reportBox: { borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 12, gap: 10 },
  reportHelp: { color: palette.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  reportInput: { minHeight: 72, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, padding: 12, color: palette.ink, fontSize: 14, textAlignVertical: 'top' },
  reportReasons: { gap: 7 },
  reportReason: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: palette.line, justifyContent: 'center', paddingHorizontal: 12 },
  reportReasonText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 12 },
  sourceCopy: { flex: 1 },
  sourceName: { color: palette.ink, fontSize: 15, fontWeight: '900', textTransform: 'capitalize' },
  sourceMeta: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 3 },
});
