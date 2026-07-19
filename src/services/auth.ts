import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  isValidDateOfBirth,
  normalizeDisplayName,
  validateSignupInput,
  type ProfileRecord,
  type SignupInput,
} from '@/src/lib/profile';
import { requireSupabase, supabase } from '@/src/services/supabase';

export interface ProfileInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  displayName: string;
}

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  display_name: string;
  username: string;
  phone_e164: string | null;
  home_city: string;
};

export function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    dateOfBirth: row.date_of_birth ?? '',
    displayName: row.display_name,
    username: row.username,
    phoneE164: row.phone_e164,
    homeCity: row.home_city,
  };
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function getCurrentProfile(): Promise<ProfileRecord | null> {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, first_name, last_name, date_of_birth, display_name, username, phone_e164, home_city')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapProfile(data) : null;
}

export async function upsertProfile(input: ProfileInput): Promise<ProfileRecord> {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    throw new Error('You need to be signed in to update your profile.');
  }

  const displayName = normalizeDisplayName(input.displayName);
  if (!input.firstName.trim() || !input.lastName.trim()) {
    throw new Error('Enter your first and last name.');
  }
  if (!isValidDateOfBirth(input.dateOfBirth)) {
    throw new Error('Enter a valid date of birth as YYYY-MM-DD.');
  }
  if (!/^[a-z0-9_]{3,24}$/.test(displayName)) {
    throw new Error('Display name must use 3-24 letters, numbers, or underscores.');
  }

  const row = {
    id: user.id,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    date_of_birth: input.dateOfBirth,
    display_name: displayName,
    username: displayName,
  };

  const { data, error } = await client
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('id, first_name, last_name, date_of_birth, display_name, username, phone_e164, home_city')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('That display name is already taken. Try another one.');
    }
    throw error;
  }
  return mapProfile(data);
}

export async function signUp(input: SignupInput) {
  const validation = validateSignupInput(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0] ?? 'Check your signup details.');
  }

  const client = requireSupabase();
  const displayName = normalizeDisplayName(input.displayName);
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        date_of_birth: input.dateOfBirth,
        display_name: displayName,
        username: displayName,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.session) {
    await upsertProfile({
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      displayName,
    });
  }

  return data;
}

export async function signIn(input: { email: string; password: string }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) {
    throw error;
  }
  return data;
}

function getOAuthRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/`;
  }
  return Linking.createURL('/');
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirectUrl(),
    },
  });

  if (error) {
    throw error;
  }
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}
