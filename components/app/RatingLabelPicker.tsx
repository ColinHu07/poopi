import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getRatingLabelDefinition,
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
  const [editorVisible, setEditorVisible] = useState(false);
  const [draft, setDraft] = useState<RatingLabel[]>([]);
  const [query, setQuery] = useState('');

  if (!sentiment) {
    return (
      <View style={styles.lockedPanel} accessibilityLiveRegion="polite">
        <Text style={styles.lockedTitle}>Labels unlock after your rating</Text>
        <Text style={styles.lockedCopy}>Choose Liked, Fine, or Disliked above before adding labels.</Text>
      </View>
    );
  }

  function openEditor() {
    setDraft(selected);
    setQuery('');
    setEditorVisible(true);
  }

  function cancelEditor() {
    setDraft(selected);
    setQuery('');
    setEditorVisible(false);
  }

  function saveEditor() {
    onChange(draft);
    setQuery('');
    setEditorVisible(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add bathroom labels${selected.length ? `, ${selected.length} selected` : ''}`}
        onPress={openEditor}
        style={({ pressed }) => [styles.editorRow, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'tag', android: 'sell', web: 'sell' }}
          size={22}
          tintColor={palette.muted}
          fallback={<Text style={styles.fallbackIcon}>#</Text>}
        />
        <View style={styles.editorCopy}>
          <Text style={styles.editorTitle}>{selected.length ? 'Edit labels' : 'Add labels'}</Text>
          <Text style={styles.editorSubtitle}>
            {selected.length ? `${selected.length} selected` : 'Good things and bad things'}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {selected.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedLabels}>
          {selected.map((label) => {
            const definition = getRatingLabelDefinition(label);
            return (
              <View
                key={label}
                style={[
                  styles.selectedPill,
                  definition.tone === 'positive' ? styles.positivePill : styles.negativePill,
                ]}>
                <Text
                  style={[
                    styles.selectedPillText,
                    definition.tone === 'positive' ? styles.positiveText : styles.negativeText,
                  ]}>
                  {definition.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      <RatingLabelEditor
        draft={draft}
        onCancel={cancelEditor}
        onChange={setDraft}
        onDone={saveEditor}
        onQueryChange={setQuery}
        query={query}
        visible={editorVisible}
      />
    </>
  );
}

function RatingLabelEditor({
  draft,
  onCancel,
  onChange,
  onDone,
  onQueryChange,
  query,
  visible,
}: {
  draft: RatingLabel[];
  onCancel: () => void;
  onChange: (labels: RatingLabel[]) => void;
  onDone: () => void;
  onQueryChange: (query: string) => void;
  query: string;
  visible: boolean;
}) {
  const [goodExpanded, setGoodExpanded] = useState(true);
  const [badExpanded, setBadExpanded] = useState(true);
  const goodLabels = useMemo(() => searchRatingLabels('positive', query), [query]);
  const badLabels = useMemo(() => searchRatingLabels('negative', query), [query]);

  function toggleLabel(label: RatingLabel) {
    onChange(draft.includes(label) ? draft.filter((item) => item !== label) : [...draft, label]);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="pageSheet"
      visible={visible}>
      <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}>
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Add bathroom labels</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onDone}>
            <Text style={styles.headerAction}>Done{draft.length ? ` (${draft.length})` : ''}</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search bathroom labels"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={onQueryChange}
            placeholder="Search labels"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.labelList}>
          <LabelSection
            emptyCopy="No matching good labels"
            expanded={query ? true : goodExpanded}
            labels={goodLabels}
            onToggleExpanded={() => setGoodExpanded((current) => !current)}
            onToggleLabel={toggleLabel}
            selected={draft}
            title="Good things"
            tone="positive"
          />
          <LabelSection
            emptyCopy="No matching bad labels"
            expanded={query ? true : badExpanded}
            labels={badLabels}
            onToggleExpanded={() => setBadExpanded((current) => !current)}
            onToggleLabel={toggleLabel}
            selected={draft}
            title="Bad things"
            tone="negative"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function LabelSection({
  emptyCopy,
  expanded,
  labels,
  onToggleExpanded,
  onToggleLabel,
  selected,
  title,
  tone,
}: {
  emptyCopy: string;
  expanded: boolean;
  labels: RatingLabelDefinition[];
  onToggleExpanded: () => void;
  onToggleLabel: (label: RatingLabel) => void;
  selected: RatingLabel[];
  title: string;
  tone: RatingLabelTone;
}) {
  const selectedCount = labels.filter((definition) => selected.includes(definition.id)).length;

  return (
    <View style={[styles.section, tone === 'positive' ? styles.positiveSection : styles.negativeSection]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggleExpanded}
        style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.toneDot, tone === 'positive' ? styles.positiveDot : styles.negativeDot]} />
          <Text style={styles.sectionTitle}>{title}</Text>
          {selectedCount ? <Text style={styles.sectionCount}>{selectedCount} selected</Text> : null}
        </View>
        <Text style={styles.sectionChevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>

      {expanded ? (
        labels.length ? (
          labels.map((definition) => (
            <LabelRow
              definition={definition}
              key={definition.id}
              onPress={() => onToggleLabel(definition.id)}
              selected={selected.includes(definition.id)}
            />
          ))
        ) : (
          <Text style={styles.emptyCopy}>{emptyCopy}</Text>
        )
      ) : null}
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
      onPress={onPress}
      style={({ pressed }) => [
        styles.labelRow,
        selected && (definition.tone === 'positive' ? styles.positiveSelectedRow : styles.negativeSelectedRow),
        pressed && styles.pressed,
      ]}>
      <Text style={styles.labelRowText}>{definition.label}</Text>
      <View
        style={[
          styles.checkCircle,
          selected &&
            (definition.tone === 'positive' ? styles.positiveCheckCircle : styles.negativeCheckCircle),
        ]}>
        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
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
  editorRow: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  fallbackIcon: {
    color: palette.muted,
    fontSize: 20,
    fontWeight: '900',
  },
  editorCopy: {
    flex: 1,
    gap: 3,
  },
  editorTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  editorSubtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    color: palette.muted,
    fontSize: 28,
    fontWeight: '400',
  },
  selectedLabels: {
    gap: 7,
    paddingTop: 10,
    paddingRight: 12,
  },
  selectedPill: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positivePill: {
    backgroundColor: palette.mint,
    borderColor: '#9fd5c7',
  },
  negativePill: {
    backgroundColor: palette.coralSoft,
    borderColor: '#ffc4b5',
  },
  selectedPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  positiveText: {
    color: palette.jade,
  },
  negativeText: {
    color: palette.coral,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  modalHeader: {
    minHeight: 62,
    borderBottomWidth: 2,
    borderBottomColor: palette.cocoaSoft,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 10,
  },
  modalTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerAction: {
    minWidth: 54,
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
  searchWrap: {
    minHeight: 48,
    marginHorizontal: 16,
    marginVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 7,
  },
  searchIcon: {
    color: palette.muted,
    fontSize: 20,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: palette.ink,
    fontSize: 14,
  },
  labelList: {
    paddingHorizontal: 14,
    paddingBottom: 32,
    gap: 14,
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionCount: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionChevron: {
    color: palette.muted,
    fontSize: 18,
    fontWeight: '900',
  },
  labelRow: {
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    gap: 12,
  },
  positiveSelectedRow: {
    backgroundColor: palette.mint,
  },
  negativeSelectedRow: {
    backgroundColor: palette.coralSoft,
  },
  labelRowText: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positiveCheckCircle: {
    borderColor: palette.jade,
    backgroundColor: palette.jade,
  },
  negativeCheckCircle: {
    borderColor: palette.coral,
    backgroundColor: palette.coral,
  },
  checkmark: {
    color: palette.surface,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  emptyCopy: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  pressed: {
    opacity: 0.65,
  },
});
