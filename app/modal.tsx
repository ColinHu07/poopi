import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Section, Screen } from '@/components/app/Screen';
import { FEATURE_LABELS, TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import type { Bathroom, FeatureTag, Sentiment } from '@/src/data/types';
import { getBathroomById, logVisit } from '@/src/services/bathroomApi';

const SENTIMENTS: Array<{ id: Sentiment; label: string }> = [
  { id: 'liked', label: 'Liked' },
  { id: 'fine', label: 'Fine' },
  { id: 'disliked', label: 'Disliked' },
];

const QUICK_TAGS: FeatureTag[] = [
  'clean',
  'smells_good',
  'stinks',
  'comfortable',
  'wide_seat',
  'bidet',
  'safe',
  'well_lit',
  'baby_changing',
  'wheelchair_accessible',
  'all_gender',
  'single_stall',
  'urinal_only',
  'long_line',
];

export default function ModalScreen() {
  const { bathroomId } = useLocalSearchParams<{ bathroomId?: string }>();
  const [bathroom, setBathroom] = useState<Bathroom | undefined>();
  const [sentiment, setSentiment] = useState<Sentiment>('liked');
  const [selectedTags, setSelectedTags] = useState<FeatureTag[]>(['clean']);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bathroomId) {
      setLoading(false);
      return;
    }
    getBathroomById(bathroomId)
      .then(setBathroom)
      .finally(() => setLoading(false));
  }, [bathroomId]);

  function toggleTag(tag: FeatureTag) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((currentTag) => currentTag !== tag) : [...current, tag],
    );
  }

  async function submit() {
    if (!bathroom) {
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

  if (loading) {
    return (
      <Screen kicker="New visit" title="Loading">
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
          <Text style={styles.safetyTitle}>Cannot log this yet</Text>
          <Text style={styles.safetyCopy}>This bathroom needs to be imported into Poopi before it can be logged.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen kicker="New visit" title={bathroom.name}>
      <Section title="Score seed">
        <View style={styles.segmented}>
          {SENTIMENTS.map((item) => {
            const active = item.id === sentiment;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSentiment(item.id)}
                style={[styles.segment, active && styles.activeSegment]}>
                <Text style={[styles.segmentText, active && styles.activeSegmentText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Tags">
        <View style={styles.tags}>
          {QUICK_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <Pressable key={tag} onPress={() => toggleTag(tag)}>
                <TagChip label={FEATURE_LABELS[tag]} tone={active ? 'good' : 'neutral'} />
              </Pressable>
            );
          })}
        </View>
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

      <Pressable disabled={saving} style={styles.submitButton} onPress={submit}>
        {saving ? <ActivityIndicator color="#fffaf6" /> : <Text style={styles.submitText}>Save visit</Text>}
      </Pressable>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  submitText: {
    color: '#fffaf6',
    fontSize: 16,
    fontWeight: '900',
  },
});
