export interface AuthIdentity {
  id: string;
  is_anonymous?: boolean;
}

export function isPermanentAccount(user: AuthIdentity | null | undefined): boolean {
  return Boolean(user && !user.is_anonymous);
}

export function canVoteInComparisons(user: AuthIdentity | null | undefined): boolean {
  return Boolean(user);
}

