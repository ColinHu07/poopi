export interface ProfileRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  displayName: string;
  username: string;
  phoneE164: string | null;
  homeCity: string;
}

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  displayName: string;
}

export interface SignupValidation {
  valid: boolean;
  errors: Partial<Record<keyof SignupInput, string>>;
}

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

export const normalizeDisplayName = normalizeUsername;

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
  const displayName = normalizeDisplayName(input.displayName);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Enter a valid email.';
  }
  if (input.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }
  if (input.firstName.trim().length < 1 || input.firstName.trim().length > 50) {
    errors.firstName = 'Enter your first name.';
  }
  if (input.lastName.trim().length < 1 || input.lastName.trim().length > 50) {
    errors.lastName = 'Enter your last name.';
  }
  if (!isValidDateOfBirth(input.dateOfBirth)) {
    errors.dateOfBirth = 'Enter a valid date of birth as YYYY-MM-DD.';
  }
  if (!/^[a-z0-9_]{3,24}$/.test(displayName)) {
    errors.displayName = 'Use 3-24 letters, numbers, or underscores.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function isProfileComplete(profile: Partial<ProfileRecord> | null | undefined): boolean {
  return Boolean(
    profile?.firstName?.trim() &&
      profile?.lastName?.trim() &&
      profile?.dateOfBirth?.trim() &&
      profile?.displayName?.trim() &&
      profile?.username?.trim(),
  );
}

export function isValidDateOfBirth(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }
  const today = new Date();
  const todayIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  return value >= '1900-01-01' && value <= todayIso;
}
