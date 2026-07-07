export interface ProfileRecord {
  id: string;
  displayName: string;
  username: string;
  phoneE164: string | null;
  homeCity: string;
}

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  username: string;
  phone?: string;
}

export interface SignupValidation {
  valid: boolean;
  errors: Partial<Record<keyof SignupInput, string>>;
}

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

export function normalizePhoneE164(phone?: string): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    const internationalDigits = digits.slice(1).replace(/\D/g, '');
    return internationalDigits.length >= 8 && internationalDigits.length <= 15 ? `+${internationalDigits}` : null;
  }

  const nationalDigits = digits.replace(/\D/g, '');
  if (nationalDigits.length === 10) {
    return `+1${nationalDigits}`;
  }
  if (nationalDigits.length === 11 && nationalDigits.startsWith('1')) {
    return `+${nationalDigits}`;
  }
  return null;
}

export function validateSignupInput(input: SignupInput): SignupValidation {
  const errors: SignupValidation['errors'] = {};
  const username = normalizeUsername(input.username);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Enter a valid email.';
  }
  if (input.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }
  if (input.displayName.trim().length < 2) {
    errors.displayName = 'Add your name.';
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    errors.username = 'Use 3-24 letters, numbers, or underscores.';
  }
  if (input.phone?.trim() && !normalizePhoneE164(input.phone)) {
    errors.phone = 'Use a valid phone number.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function isProfileComplete(profile: Partial<ProfileRecord> | null | undefined): boolean {
  return Boolean(profile?.displayName?.trim() && profile?.username?.trim());
}
