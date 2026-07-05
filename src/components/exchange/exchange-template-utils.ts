import {
  getModuleConfig,
  saveModuleConfig,
  type ExchangeCustomTemplate,
} from '../../lib/module-config';
import { isExchangeDevSeedEnabled } from './exchange-dev-seed';

/** Dynamic placeholder tokens e.g. {{customer_name}}, {{ticket_id}} */
export const EXCHANGE_TEMPLATE_VAR_PATTERN = /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g;

export type ExchangeTemplate = ExchangeCustomTemplate;

export interface CreateExchangeTemplateInput {
  title: string;
  tags: string[];
  description: string;
  acceptedTypes?: string[];
  uploadLimit?: string;
}

export function extractTemplateVariables(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    const matches = text.match(EXCHANGE_TEMPLATE_VAR_PATTERN) ?? [];
    matches.forEach((token) => found.add(token));
  }
  return Array.from(found);
}

export function sanitizeTemplateText(value: string): string {
  return value.trim();
}

export function parseTemplateTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function validateCreateTemplateInput(input: CreateExchangeTemplateInput): string | null {
  if (!sanitizeTemplateText(input.title)) {
    return 'titleRequired';
  }
  if (!sanitizeTemplateText(input.description)) {
    return 'descriptionRequired';
  }
  const invalidTokens = (input.description.match(/\{\{[^}]+\}\}/g) ?? []).filter(
    (token) => !/^\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}$/.test(token),
  );
  if (invalidTokens.length > 0) {
    return 'invalidPlaceholder';
  }
  return null;
}

/** Loads workspace exchange templates from module config (PostgreSQL-backed). */
export function loadCustomTemplates(): ExchangeTemplate[] {
  return getModuleConfig().exchangeCustomTemplates ?? [];
}

/** Persists workspace exchange templates to module config (PostgreSQL-backed). */
export async function saveCustomTemplates(templates: ExchangeTemplate[]): Promise<void> {
  const config = getModuleConfig();
  await saveModuleConfig({ ...config, exchangeCustomTemplates: templates });
}

export function buildExchangeTemplate(input: CreateExchangeTemplateInput): ExchangeTemplate {
  const title = sanitizeTemplateText(input.title);
  const description = sanitizeTemplateText(input.description);
  const tags = input.tags.map((tag) => tag.trim()).filter(Boolean);

  return {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    tags,
    description,
    acceptedTypes: input.acceptedTypes?.length ? input.acceptedTypes : ['ZIP', 'LOG', 'TXT'],
    uploadLimit: input.uploadLimit?.trim() || '2GB',
    variables: extractTemplateVariables(title, description),
    createdAt: new Date().toISOString(),
  };
}

/** Seed demo rows in development only so Schnellfilter badge counts align with visible table rows. */
export function buildExpiringSoonSeedItems(): ExchangeItemRowSeed[] {
  if (!isExchangeDevSeedEnabled()) return [];

  const offsetsHours = [23, 30, 36, 42, 48, 120, 144];
  return offsetsHours.map((hours, index) => {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return {
      id: `seed-expiring-${index + 1}`,
      name: `Expiring credential bundle #${index + 1}`,
      recipient: `operator${index + 1}@acme.com`,
      company: 'Acme Global Solutions',
      ticketId: `TKT-E${100 + index}`,
      status: 'Active',
      expires: `in ${hours <= 48 ? `${hours}h` : `${Math.round(hours / 24)}d`}`,
      expiresAt,
      views: 0,
      type: index % 2 === 0 ? 'secret' : 'request',
      size: '—',
      createdAt: new Date(),
    };
  });
}

export interface ExchangeItemRowSeed {
  id: string;
  name: string;
  recipient: string;
  company: string;
  ticketId: string;
  status: string;
  expires: string;
  expiresAt?: Date | null;
  views: number;
  type: string;
  size?: string;
  createdAt: Date;
  uploadedFilename?: string;
  uploadedFilenames?: string[];
  relatedTicketId?: string;
  relatedTicketSubject?: string;
  description?: string;
  allowedTypes?: string[];
  recipientEmails?: string[];
}
