import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function CompleteProfileScreen() {
  const { configured, completeProfile, profile, profileComplete, session } = useAuth();
  const metadata = session?.user.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const [firstName, setFirstName] = useState(profile?.firstName ?? metadata.first_name ?? nameParts[0] ?? '');
  const [lastName, setLastName] = useState(
    profile?.lastName ?? metadata.last_name ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
  );
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? metadata.date_of_birth ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? metadata.display_name ?? metadata.username ?? '');
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
      await completeProfile({ firstName, lastName, dateOfBirth, displayName });
      router.replace('/(tabs)' as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Finish profile</Text>
      <Text style={styles.copy}>
        First name, last name, and date of birth stay private. Your display name is the only profile identifier other people see.
      </Text>
      <View style={styles.nameRow}>
        <View style={styles.nameField}>
          <Field value={firstName} onChangeText={setFirstName} label="First name" autoComplete="given-name" />
        </View>
        <View style={styles.nameField}>
          <Field value={lastName} onChangeText={setLastName} label="Last name" autoComplete="family-name" />
        </View>
      </View>
      <Field
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        label="Date of birth"
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        value={displayName}
        onChangeText={setDisplayName}
        label="Display name"
        placeholder="poopi_fan"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.helper}>Use 3–24 letters, numbers, or underscores. This name must be unique.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={submitting} style={styles.primaryButton} onPress={submit}>
        {submitting ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.primaryText}>Enter Poopi</Text>}
      </Pressable>
    </ScrollView>
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
    flexGrow: 1,
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    paddingVertical: 36,
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
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameField: {
    flex: 1,
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
  helper: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -4,
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
