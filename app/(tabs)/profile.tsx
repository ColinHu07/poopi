import { StyleSheet, Text, View } from 'react-native';

import { Section, Screen } from '@/components/app/Screen';
import { FEATURE_LABELS, TagChip } from '@/components/app/TagChip';
import { palette } from '@/components/app/tokens';
import { getProfileSummary } from '@/src/services/bathroomApi';

export default function ProfileScreen() {
  const profile = getProfileSummary();
  const topTags = [...new Set(profile.favoriteTags)].slice(0, 6);

  return (
    <Screen kicker={profile.handle} title={profile.displayName} right={<TagChip label={profile.city} tone="good" />}>
      <View style={styles.metrics}>
        <Metric label="ranked" value={profile.rankedCount} />
        <Metric label="visited" value={profile.visitedCount} />
        <Metric label="lists" value={profile.listsCount} />
      </View>

      <Section title="Signals">
        <View style={styles.tags}>
          {topTags.map((tag) => (
            <TagChip key={tag} label={FEATURE_LABELS[tag]} tone="info" />
          ))}
        </View>
      </Section>

      <Section title="Trust">
        <View style={styles.panel}>
          <Text style={styles.panelNumber}>{profile.confidenceBoosts}</Text>
          <Text style={styles.panelText}>source confirmations across imported and community records</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelNumber}>Queued</Text>
          <Text style={styles.panelText}>photos with faces, people, or sensitive reflections stay out of the feed</Text>
        </View>
      </Section>
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
    gap: 4,
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
});
