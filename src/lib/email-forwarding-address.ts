/**
 * Shared help-{slug}@domain builder for onboarding UI and channel persistence.
 * Keep this module free of Node/postgres so the wizard can import it.
 */

export function forwardingLocalSlug(source: string, fallback = 'support'): string {
  const trimmed = String(source || '').trim();
  const local = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  return local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase() || fallback;
}

export function composeHelpForwardingAddress(slugSource: string, domain: string): string {
  const host = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\.$/, '');
  return `help-${forwardingLocalSlug(slugSource)}@${host || 'inbound.geistai.eu'}`;
}
