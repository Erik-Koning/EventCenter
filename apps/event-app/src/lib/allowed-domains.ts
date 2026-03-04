/**
 * Allowed email domains for signup, signin, and invitations.
 * If empty, all domains are allowed.
 */
export const ALLOWED_DOMAINS: string[] = ["koning.ca", "scotiabank.com"];

/**
 * Specific email addresses allowed regardless of domain.
 */
export const ALLOWED_EMAILS: string[] = [
  "erik.p.koning@gmail.com",
  "aidkinn28@gmail.com",
];

/**
 * Check if an email's domain is in the allowed list.
 * Returns true if allowed, false if not.
 * Always returns true if ALLOWED_DOMAINS is empty.
 */
export function isAllowedDomain(email: string): boolean {
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  if (ALLOWED_DOMAINS.length === 0) return true;
  const domain = lower.split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
