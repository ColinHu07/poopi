import { Link, Redirect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function WelcomeScreen() {
  const { configured, loading, profileComplete, session } = useAuth();

  if (!loading && session && profileComplete) {
    return <Redirect href="/(tabs)" />;
  }
  if (!loading && session && !profileComplete) {
    return <Redirect href={'/complete-profile' as any} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.brandMark}>
        <Text style={styles.brandGlyph}>p</Text>
      </View>
      <Text style={styles.logo}>Poopi</Text>
      <Text style={styles.title}>Find the bathroom that will not betray you.</Text>
      <Text style={styles.copy}>
        Rank bathrooms, save access notes, and see real nearby restroom reports before you need them.
      </Text>

      {configured ? (
        <View style={styles.actions}>
          <Link href={'/sign-up' as any} asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryText}>Create account</Text>
            </Pressable>
          </Link>
          <Link href={'/sign-in' as any} asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Log in</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Supabase setup needed</Text>
          <Text style={styles.setupCopy}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, apply the schema, then restart Expo.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
    padding: 26,
    backgroundColor: palette.paper,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: palette.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b6dfd4',
  },
  brandGlyph: {
    color: palette.jade,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
  },
  logo: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: 0,
  },
  copy: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  actions: {
    gap: 10,
    marginTop: 10,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  setupCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 6,
  },
  setupTitle: {
    color: palette.coral,
    fontSize: 16,
    fontWeight: '900',
  },
  setupCopy: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
