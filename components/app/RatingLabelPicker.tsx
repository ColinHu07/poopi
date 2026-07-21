import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  searchRatingLabels,
  type RatingLabelDefinition,
  type RatingLabelTone,
} from '@/src/data/ratingLabels';
import type { RatingLabel, Sentiment } from '@/src/data/types';
import { palette } from './tokens';

interface RatingLabelPickerProps {
  sentiment: Sentiment | null;
  selected: RatingLabel[];
  onChange: (labels: RatingLabel[]) => void;
}

export function RatingLabelPicker({ sentiment, selected, onChange }: RatingLabelPickerProps) {
  if (!sentiment) {
    return (
      <View style={styles.lockedPanel} accessibilityLiveRegion="polite">
        <Text style={styles.lockedTitle}>Labels unlock after your rating</Text>
        <Text style={styles.lockedCopy}>Choose Loved it, It was fine, or Not for me above.</Text>
      </View>
    );
  }

  function toggleLabel(label: RatingLabel) {
    onChange(selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label]);
  }

  return (
    <View style={styles.checklist}>
      <View style={styles.checklistIntro}>
        <Text style={styles.checklistTitle}>Check everything that applied</Text>
        <Text style={styles.checklistCopy}>
          {selected.length ? `${selected.length} selected` : 'Labels are optional'} · good and bad can both be true.
        </Text>
      </View>
      <LabelSection
        labels={searchRatingLabels('positive', '')}
        onToggleLabel={toggleLabel}
        selected={selected}
        title="Good things"
        tone="positive"
      />
      <LabelSection
        labels={searchRatingLabels('negative', '')}
        onToggleLabel={toggleLabel}
        selected={selected}
        title="Bad things"
        tone="negative"
      />
    </View>
  );
}

function LabelSection({
  labels,
  onToggleLabel,
  selected,
  title,
  tone,
}: {
  labels: RatingLabelDefinition[];
  onToggleLabel: (label: RatingLabel) => void;
  selected: RatingLabel[];
  title: string;
  tone: RatingLabelTone;
}) {
  const selectedCount = labels.filter((definition) => selected.includes(definition.id)).length;

  return (
    <View style={[styles.section, tone === 'positive' ? styles.positiveSection : styles.negativeSection]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.toneDot, tone === 'positive' ? styles.positiveDot : styles.negativeDot]} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{selectedCount ? `${selectedCount} checked` : 'Optional'}</Text>
      </View>
      {labels.map((definition) => (
        <LabelRow
          definition={definition}
          key={definition.id}
          onPress={() => onToggleLabel(definition.id)}
          selected={selected.includes(definition.id)}
        />
      ))}
    </View>
  );
}

function LabelRow({
  definition,
  onPress,
  selected,
}: {
  definition: RatingLabelDefinition;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${definition.label}, ${selected ? 'checked' : 'not checked'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.labelRow,
        selected && (definition.tone === 'positive' ? styles.positiveSelectedRow : styles.negativeSelectedRow),
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.checkbox,
          selected &&
            (definition.tone === 'positive' ? styles.positiveCheckbox : styles.negativeCheckbox),
        ]}>
        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.labelRowText}>{definition.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lockedPanel: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.line,
    backgroundColor: palette.goldSoft,
    padding: 16,
    justifyContent: 'center',
    gap: 5,
  },
  lockedTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  lockedCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  checklist: {
    gap: 14,
  },
  checklistIntro: {
    gap: 3,
  },
  checklistTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  checklistCopy: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.line,
    overflow: 'hidden',
  },
  positiveSection: {
    backgroundColor: '#f2fbf7',
  },
  negativeSection: {
    backgroundColor: '#fff5f1',
  },
  sectionHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  toneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  positiveDot: {
    backgroundColor: palette.jade,
  },
  negativeDot: {
    backgroundColor: palette.coral,
  },
  sectionTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionCount: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  labelRow: {
    minHeight: 50,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 11,
  },
  positiveSelectedRow: {
    backgroundColor: palette.mint,
  },
  negativeSelectedRow: {
    backgroundColor: palette.coralSoft,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positiveCheckbox: {
    borderColor: palette.jade,
    backgroundColor: palette.jade,
  },
  negativeCheckbox: {
    borderColor: palette.coral,
    backgroundColor: palette.coral,
  },
  checkmark: {
    color: palette.surface,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },
  labelRowText: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.65,
  },
});
