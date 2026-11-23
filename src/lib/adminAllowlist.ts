export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'tashflow26@gmail.com',
  'palmmetric1@gmail.com',
] as const;

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAPPED_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === normalized
  );
}
