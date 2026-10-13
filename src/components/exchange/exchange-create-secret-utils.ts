export type ExchangeExpirationPreset =
  | '1h'
  | '4h'
  | '12h'
  | '24h'
  | '3d'
  | '7d'
  | '14d'
  | '30d'
  | 'custom';

export const EXCHANGE_EXPIRATION_PRESETS: {
  id: ExchangeExpirationPreset;
  labelKey: string;
  defaultLabel: string;
  group: 'short' | 'extended' | 'custom';
}[] = [
  { id: '1h', labelKey: 'exchange.createSecret.expiration.1h', defaultLabel: '1 Hour', group: 'short' },
  { id: '4h', labelKey: 'exchange.createSecret.expiration.4h', defaultLabel: '4 Hours', group: 'short' },
  { id: '12h', labelKey: 'exchange.createSecret.expiration.12h', defaultLabel: '12 Hours', group: 'short' },
  { id: '24h', labelKey: 'exchange.createSecret.expiration.24h', defaultLabel: '24 Hours', group: 'short' },
  { id: '3d', labelKey: 'exchange.createSecret.expiration.3d', defaultLabel: '3 Days', group: 'extended' },
  { id: '7d', labelKey: 'exchange.createSecret.expiration.7d', defaultLabel: '7 Days', group: 'extended' },
  { id: '14d', labelKey: 'exchange.createSecret.expiration.14d', defaultLabel: '14 Days', group: 'extended' },
  { id: '30d', labelKey: 'exchange.createSecret.expiration.30d', defaultLabel: '30 Days', group: 'extended' },
  { id: 'custom', labelKey: 'exchange.createSecret.expiration.custom', defaultLabel: 'Custom date & time', group: 'custom' },
];

export const EXCHANGE_VIEW_QUOTA_PRESETS = [1, 2, 3, 5, 10] as const;

export type ExchangeCreateSecretFormState = {
  secretContent: string;
  secretType: string;
  maxViews: number;
  expirationPreset: ExchangeExpirationPreset;
  customExpiresAt: string;
  shareViaEmailOpen: boolean;
  recipientEmails: string;
  notifyOnView: boolean;
  ipRestrictionEnabled: boolean;
  ipAllowlist: string;
  passphraseEnabled: boolean;
  passphrase: string;
  domainWhitelistEnabled: boolean;
  allowedEmailDomains: string;
  deliveryOption: string;
  targetRecipient: string;
  targetTicketId: string;
  targetCompanyId: string;
  targetAssetId: string;
  mfaRequired: boolean;
};

export function parseRecipientEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export function parseAllowedDomains(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

export function resolveExpirationDate(
  preset: ExchangeExpirationPreset,
  customExpiresAt: string,
): Date | null {
  if (preset === 'custom') {
    if (!customExpiresAt) return null;
    const custom = new Date(customExpiresAt);
    return Number.isNaN(custom.getTime()) ? null : custom;
  }

  const now = new Date();
  const hours: Record<Exclude<ExchangeExpirationPreset, 'custom'>, number> = {
    '1h': 1,
    '4h': 4,
    '12h': 12,
    '24h': 24,
    '3d': 72,
    '7d': 168,
    '14d': 336,
    '30d': 720,
  };
  const addHours = hours[preset as Exclude<ExchangeExpirationPreset, 'custom'>];
  return new Date(now.getTime() + addHours * 60 * 60 * 1000);
}

export function buildCreateSecretPayload(state: ExchangeCreateSecretFormState) {
  const expiresAt = resolveExpirationDate(state.expirationPreset, state.customExpiresAt);
  const recipientEmails = parseRecipientEmails(state.recipientEmails);
  const allowedEmailDomains = parseAllowedDomains(state.allowedEmailDomains);

  return {
    maxViews: Math.max(1, state.maxViews),
    expirationType: 'quota' as const,
    expiresAt,
    metadata: {
      isQuantumSafe: true,
      pqcLevel: 3,
      secretType: state.secretType,
      deliveryOption: state.deliveryOption,
      relatedTicketId: state.targetTicketId || undefined,
      relatedCompanyId: state.targetCompanyId || undefined,
      relatedAssetId: state.targetAssetId || undefined,
      targetRecipient: state.targetRecipient || recipientEmails[0] || 'internal',
      maxViews: Math.max(1, state.maxViews),
      expirationPreset: state.expirationPreset,
      shareViaEmail: state.shareViaEmailOpen && recipientEmails.length > 0,
      recipientEmails,
      notifyOnView: state.notifyOnView,
      ipRestrictionEnabled: state.ipRestrictionEnabled,
      ipAllowlist: state.ipRestrictionEnabled ? state.ipAllowlist.trim() : undefined,
      passphraseEnabled: state.passphraseEnabled,
      domainWhitelistEnabled: state.domainWhitelistEnabled,
      allowedEmailDomains: state.domainWhitelistEnabled ? allowedEmailDomains : undefined,
      mfaRequired: state.mfaRequired,
    },
    passphrase: state.passphraseEnabled ? state.passphrase : undefined,
  };
}
