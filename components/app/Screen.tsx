import type { PropsWithChildren, ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from './tokens';

interface ScreenProps extends PropsWithChildren {
  title: string;
  kicker?: string;
  right?: ReactNode;
}

export function Screen({ title, kicker, right, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            {kicker ? (
              <View style={styles.kickerRow}>
                <View style={styles.kickerDot} />
                <Text style={styles.kicker}>{kicker}</Text>
              </View>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            <View style={styles.titleDash} />
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionTab} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  content: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: 20,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 220,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  kickerDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.coral,
  },
  kicker: {
    color: palette.jade,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 36,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  titleDash: {
    width: 42,
    height: 5,
    borderRadius: 5,
    backgroundColor: palette.butter,
    marginTop: 9,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionTab: {
    width: 7,
    height: 22,
    borderRadius: 5,
    backgroundColor: palette.coral,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
});
