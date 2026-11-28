export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'tashflow26@gmail.com',
  'palmmetric1@gmail.com',
  'palmmatric1@gmail.com',
  'tashfilartwork@gmail.com',
] as const;

export const BOOTSTRAPPED_ADMIN_UIDS = [
  'jPgFPc8KbsXaPrdkyrbCQSFDMOP2',
  '39H76y4E55g5yX2uY0lE5bQ3a393',
] as const;

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAPPED_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === normalized
  );
}

export function isBootstrappedAdminUid(uid?: string | null): boolean {
  if (!uid) return false;
  const clean = uid.trim();
  return BOOTSTRAPPED_ADMIN_UIDS.some((allowed) => allowed === clean);
}

export function isVerifiedAdminIdentity(params: {
  uid?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  tokenEmailVerified?: boolean;
  hasGoogleProvider?: boolean;
  isAnonymous?: boolean;
}): { allowed: boolean; isBootstrapped: boolean; denialReason: 'unverified' | 'not_admin' | null } {
  if (params.isAnonymous) {
    return { allowed: false, isBootstrapped: false, denialReason: 'not_admin' };
  }
  const uidAllowed = isBootstrappedAdminUid(params.uid);
  const emailAllowed = isBootstrappedAdminEmail(params.email);
  const verified = Boolean(
    params.emailVerified ||
      params.tokenEmailVerified ||
      uidAllowed ||
      (params.hasGoogleProvider && Boolean(params.email && params.email.trim()))
  );
  if (!verified) {
    return { allowed: false, isBootstrapped: false, denialReason: 'unverified' };
  }
  if (uidAllowed || emailAllowed) {
    return { allowed: true, isBootstrapped: true, denialReason: null };
  }
  return { allowed: false, isBootstrapped: false, denialReason: 'not_admin' };
}
