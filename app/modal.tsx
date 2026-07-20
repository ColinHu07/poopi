import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthRequired } from '@/components/app/AuthRequired';
import { BathroomCard } from '@/components/app/BathroomCard';
import { RatingLabelPicker } from '@/components/app/RatingLabelPicker';
import { Section, Screen } from '@/components/app/Screen';
import { palette } from '@/components/app/tokens';
import type { Bathroom, RatingLabel, Sentiment } from '@/src/data/types';
import { useAuth } from '@/src/providers/AuthProvider';
import { DEFAULT_MAP_CENTER, getBathroomById, getNearbyBathrooms, logVisit } from '@/src/services/bathroomApi';

const SENTIMENTS: Array<{ id: Sentiment; label: string }> = [
  { id: 'liked', label: 'Liked' },
  { id: 'fine', label: 'Fine' },
  { id: 'disliked', label: 'Disliked' },
];

export default function ModalScreen() {
  const { bathroomId } = useLocalSearchParams<{ bathroomId?: string }>();
  const { isAnonymous, loading: authLoading, session } = useAuth();
  const [bathroom, setBathroom] = useState<Bathroom | undefined>();
  const [candidates, setCandidates] = useState<Bathroom[]>([]);
  const [query, setQuery] = useState('');
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [selectedTags, setSelectedTags] = useState<RatingLabel[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return candidates;
    return candidates.filter((candidate) =>
      [candidate.name, candidate.address, candidate.neighborhood, candidate.city]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [candidates, query]);

  useEffect(() => {
    if (!bathroomId) {
      setBathroom(undefined);
      loadNearbyCandidates();
    } else {
      setLoading(true);
      getBathroomById(bathroomId)
        .then(setBathroom)
        .finally(() => setLoading(false));
    }
  }, [bathroomId]);

  async function loadNearbyCandidates() {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      let center = DEFAULT_MAP_CENTER;
      if (permission.status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      }
      setCandidates(await getNearbyBathrooms(center));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load nearby bathrooms.');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!bathroom) {
      return;
    }
    if (!sentiment) {
      setError('Choose an overall rating before saving your visit.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await logVisit({
        bathroomId: bathroom.id,
        sentiment,
        publicNote: note || 'Logged a new visit.',
        tags: selectedTags,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save visit.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <Screen kicker="New visit" title="Getting ready">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.safetyCopy}>Loading your account...</Text>
        </View>
      </Screen>
    );
  }

  if (!session || isAnonymous) {
    return (
      <AuthRequired
        title="Log in to rate bathrooms"
        description="Ratings are tied to your account so your labels, notes, and rankings stay yours."
      />
    );
  }

  if (!bathroomId) {
    return (
      <Screen kicker="New rating" title="Which bathroom did you use?">
        <Text style={styles.pickerIntro}>Choose a nearby bathroom, then add your rating and optional labels.</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search bathrooms to rate"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search names or addresses"
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            value={query}
          />
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.jade} />
            <Text style={styles.safetyCopy}>Finding nearby bathrooms...</Text>
          </View>
        ) : error ? (
          <View style={styles.safetyBox}>
            <Text style={styles.safetyTitle}>Couldn’t load nearby bathrooms</Text>
            <Text style={styles.safetyCopy}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={loadNearbyCandidates} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : filteredCandidates.length ? (
          <View style={styles.candidateList}>
            {filteredCandidates.map((candidate) => (
              <BathroomCard
                key={candidate.id}
                bathroom={candidate}
                compact
                onPress={() => router.setParams({ bathroomId: candidate.id })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.safetyBox}>
            <Text style={styles.safetyTitle}>No matching bathroom yet</Text>
            <Text style={styles.safetyCopy}>Try a shorter name or return to the map and select the bathroom first.</Text>
          </View>
        )}
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen kicker="New visit" title="Loading bathroom">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.safetyCopy}>Loading bathroom...</Text>
        </View>
      </Screen>
    );
  }

  if (!bathroom) {
    return (
      <Screen kicker="New visit" title="Bathroom unavailable">
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>Cannot rate this bathroom yet</Text>
          <Text style={styles.safetyCopy}>Return to the map and choose another bathroom.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen kicker="New visit" title={bathroom.name}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/modal' as any)}
        style={styles.changeButton}>
        <Text style={styles.changeButtonText}>← Choose a different bathroom</Text>
      </Pressable>
      <Section title="Overall rating">
        <View style={styles.segmented}>
          {SENTIMENTS.map((item) => {
            const active = item.id === sentiment;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  setSentiment(item.id);
                  setError('');
                }}
                style={({ pressed }) => [
                  styles.segment,
                  active && styles.activeSegment,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.segmentText, active && styles.activeSegmentText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {!sentiment ? <Text style={styles.ratingHint}>Pick one to unlock bathroom labels.</Text> : null}
      </Section>

      <Section title="Labels">
        <RatingLabelPicker sentiment={sentiment} selected={selectedTags} onChange={setSelectedTags} />
      </Section>

      <Section title="Note">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Empty-room and signage photos only. Add what changed."
          placeholderTextColor={palette.muted}
          multiline
          style={styles.noteInput}
        />
      </Section>

      <View style={styles.safetyBox}>
        <Text style={styles.safetyTitle}>Photo moderation</Text>
        <Text style={styles.safetyCopy}>
          Uploads are intended for empty rooms, fixtures, and signs. Images with people, kids, faces, or sensitive
          reflections should be rejected or queued.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || !sentiment }}
        disabled={saving || !sentiment}
        style={({ pressed }) => [
          styles.submitButton,
          !sentiment && styles.disabledSubmitButton,
          pressed && sentiment && styles.pressed,
        ]}
        onPress={submit}>
        {saving ? <ActivityIndicator color="#fffaf6" /> : <Text style={styles.submitText}>Save visit</Text>}
      </Pressable>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pickerIntro: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  searchBox: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  searchIcon: {
    color: palette.muted,
    fontSize: 22,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: palette.ink,
    fontSize: 15,
  },
  candidateList: {
    gap: 10,
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryText: {
    color: '#fffaf6',
    fontSize: 14,
    fontWeight: '900',
  },
  changeButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  changeButtonText: {
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSegment: {
    backgroundColor: palette.mint,
    borderColor: '#b6dfd4',
  },
  segmentText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  activeSegmentText: {
    color: palette.jade,
  },
  ratingHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    color: palette.ink,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  safetyBox: {
    borderRadius: 8,
    backgroundColor: palette.coralSoft,
    borderWidth: 1,
    borderColor: '#ffc4b5',
    padding: 14,
    gap: 4,
  },
  safetyTitle: {
    color: palette.coral,
    fontSize: 16,
    fontWeight: '900',
  },
  safetyCopy: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  loading: {
    minHeight: 130,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSubmitButton: {
    backgroundColor: palette.muted,
    opacity: 0.52,
  },
  submitText: {
    color: '#fffaf6',
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
