import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function CompleteProfileScreen() {
  const { configured, completeProfile, profile, profileComplete, session } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [phone, setPhone] = useState(profile?.phoneE164 ?? '');
  const [homeCity, setHomeCity] = useState(profile?.homeCity ?? 'New York');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!configured || !session) {
    return <Redirect href={'/welcome' as any} />;
  }
  if (profileComplete) {
    return <Redirect href="/(tabs)" />;
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      await completeProfile({ displayName, username, phone, homeCity });
      router.replace('/(tabs)' as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Finish profile</Text>
      <Text style={styles.copy}>This keeps your bathroom rankings tied to you. Your first stats will all be zero.</Text>
      <Field value={displayName} onChangeText={setDisplayName} label="Display name" />
      <Field value={username} onChangeText={setUsername} label="Username" autoCapitalize="none" />
      <Field value={phone} onChangeText={setPhone} label="Phone (optional)" keyboardType="phone-pad" />
      <Field value={homeCity} onChangeText={setHomeCity} label="Home city" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={submitting} style={styles.primaryButton} onPress={submit}>
        {submitting ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.primaryText}>Enter Poopi</Text>}
      </Pressable>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor={palette.muted} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: palette.paper,
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    fontWeight: '900',
  },
  copy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 8,
  },
  field: {
    gap: 6,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    color: palette.ink,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '900',
  },
});
