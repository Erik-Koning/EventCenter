/**
 * Allowed email domains for signup, signin, and invitations.
 * If empty, all domains are allowed.
 */
export const ALLOWED_DOMAINS: string[] = ["koning.ca"];

/**
 * Check if an email's domain is in the allowed list.
 * Returns true if allowed, false if not.
 * Always returns true if ALLOWED_DOMAINS is empty.
 */
export function isAllowedDomain(email: string): boolean {
  if (ALLOWED_DOMAINS.length === 0) return true;
  const domain = email.toLowerCase().split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
