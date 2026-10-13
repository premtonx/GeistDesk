import type { ExchangeItemRowSeed } from './exchange-template-utils';

/** True only in development — mock exchange rows must never appear in production builds. */
export function isExchangeDevSeedEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

const DEV_MOCK_UPLOADS: ExchangeItemRowSeed[] = [
  {
    id: 'upload-mock-1',
    name: 'log_router_error_dump.zip',
    recipient: 'john.doe@example.com',
    company: 'CyberDyne Systems',
    ticketId: 'TKT-108',
    status: 'Uploaded',
    expires: '2 days ago',
    expiresAt: null,
    views: 3,
    type: 'request',
    size: '142 MB',
    createdAt: new Date(Date.now() - 3600000 * 5),
  },
  {
    id: 'upload-mock-2',
    name: 'production_db_dump.sql',
    recipient: 'engineering-review@geistdesk.com',
    company: 'Acme Global Solutions',
    ticketId: 'TKT-443',
    status: 'Completed',
    expires: 'Expired',
    expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    views: 1,
    type: 'request',
    size: '1.2 GB',
    createdAt: new Date(Date.now() - 3600000 * 24),
  },
  {
    id: 'upload-mock-3',
    name: 'firewall-screenshot-failure.png',
    recipient: 'security-leads@intel.com',
    company: 'Intel Corp',
    ticketId: 'TKT-882',
    status: 'Active',
    expires: 'in 10d',
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    views: 0,
    type: 'request',
    size: '4.8 MB',
    createdAt: new Date(),
  },
];

export function getDevMockUploads(): ExchangeItemRowSeed[] {
  return isExchangeDevSeedEnabled() ? DEV_MOCK_UPLOADS : [];
}

export function isDevSeedExchangeId(id: string): boolean {
  return isExchangeDevSeedEnabled() && (id.startsWith('seed-expiring-') || id.startsWith('upload-mock'));
}
