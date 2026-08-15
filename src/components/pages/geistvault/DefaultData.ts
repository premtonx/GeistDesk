export interface SeedItem {
  type: 'rdp' | 'vpn' | 'ssh' | 'web' | 'db' | 'api' | 'cloud' | 'cert' | 'email' | 'app' | 'license' | 'note';
  label: string;
  host: string;
  username: string;
  plainPass: string;
  notes: string;
  lastModifiedBy: string;
  offsetHours: number;
  favorite: boolean;
  vaultId: string;
  folderId?: string | null;
  status: 'healthy' | 'weak' | 'expiring' | 'breached';
  icon?: string;
  tags?: string[];
  strengthPercent?: number;
}

/** Labels of former client-side showcase rows. Used only to strip leftover demo items. */
export const SHOWCASE_SEED_LABELS: readonly string[] = [
  'AWS Production Master Root',
  'Docker Swarm Orchestration Hub',
  'Personal Amazon Business Portal',
  'GitHub Registry Production Token',
  'Acme Production Server',
  'Bastion Host — EU-West',
  'Stripe Live Secret Key',
  'Okta Admin Console',
  'Corporate VPN Pre-Shared Key',
  'PostgreSQL Database',
  'Support SMTP Relay',
];

export const SHOWCASE_SEED_CATEGORY_NAMES: readonly string[] = [
  'Kubernetes Nodes',
  'Slack Workspaces',
];

/** Branded enterprise showcase rows — never auto-inserted in production. */
export const BRANDED_SHOWCASE_CREDENTIALS: SeedItem[] = [
  {
    type: 'cloud',
    label: 'AWS Production Master Root',
    host: 'console.aws.amazon.com',
    username: 'root-admin@company.internal',
    plainPass: 'AwsPr0d-Mast3r!2026#Secure',
    notes: 'Corporate AWS Organizations root console. MFA enforced. Password strength audit: 98%.',
    lastModifiedBy: 'Cloud Ops',
    offsetHours: 1,
    favorite: true,
    vaultId: 'shared-company',
    status: 'healthy',
    icon: 'aws',
    tags: ['AWS', 'Production', 'Strength: 98%'],
    strengthPercent: 98,
  },
  {
    type: 'ssh',
    label: 'Docker Swarm Orchestration Hub',
    host: 'swarm.it-dept.company.internal',
    username: 'docker-deploy@company.internal',
    plainPass: 'D0cker-Swarm!Hub89#Deploy',
    notes: 'IT department container orchestration control plane. Password strength audit: 89%.',
    lastModifiedBy: 'Platform Team',
    offsetHours: 3,
    favorite: false,
    vaultId: 'it-dept',
    status: 'healthy',
    icon: 'docker',
    tags: ['Docker', 'Server', 'Strength: 89%'],
    strengthPercent: 89,
  },
  {
    type: 'web',
    label: 'Personal Amazon Business Portal',
    host: 'business.amazon.com',
    username: 'admin-personal@company.com',
    plainPass: 'Amzn-Biz76!Portal',
    notes: 'Personal procurement login for business purchases. Password strength audit: 76%.',
    lastModifiedBy: 'You',
    offsetHours: 6,
    favorite: false,
    vaultId: 'local',
    status: 'healthy',
    icon: 'amazon',
    tags: ['Amazon', 'Web Login', 'Strength: 76%'],
    strengthPercent: 76,
  },
  {
    type: 'api',
    label: 'GitHub Registry Production Token',
    host: 'ghcr.io',
    username: 'git-automation',
    plainPass: 'ghp_GitHubPr0d92!RegistryToken',
    notes: 'DevOps CI/CD registry automation token with package publish scope. Password strength audit: 92%.',
    lastModifiedBy: 'DevOps',
    offsetHours: 2,
    favorite: true,
    vaultId: 'devops',
    status: 'healthy',
    icon: 'github',
    tags: ['GitHub', 'API Key', 'Strength: 92%'],
    strengthPercent: 92,
  },
];

export const SEEDED_CREDENTIALS: SeedItem[] = [
  ...BRANDED_SHOWCASE_CREDENTIALS,
  {
    type: 'rdp',
    label: 'Acme Production Server',
    host: '192.168.1.10',
    username: 'administrator',
    plainPass: 'AdminSecureRDPPass1!',
    notes: 'Main target server for corporate administration. Holds backup deployment logs.',
    lastModifiedBy: 'Sarah James',
    offsetHours: 2,
    favorite: false,
    vaultId: 'local',
    status: 'healthy',
  },
  {
    type: 'ssh',
    label: 'Bastion Host — EU-West',
    host: 'bastion.eu-west.acme.internal',
    username: 'ops-jump',
    plainPass: 'Bastion-EU-2026!Secure',
    notes: 'Primary SSH jump box for EU production subnet access.',
    lastModifiedBy: 'Platform Ops',
    offsetHours: 4,
    favorite: true,
    vaultId: 'local',
    folderId: 'folder-seed-eu',
    status: 'healthy',
    tags: ['SSH', 'Production'],
  },
  {
    type: 'api',
    label: 'Stripe Live Secret Key',
    host: 'api.stripe.com',
    username: 'sk_live_demo',
    plainPass: 'sk_live_51DemoVaultEntry2026',
    notes: 'Payment gateway live secret — rotate quarterly.',
    lastModifiedBy: 'Finance Ops',
    offsetHours: 8,
    favorite: false,
    vaultId: 'local',
    status: 'healthy',
    tags: ['API', 'Finance'],
  },
  {
    type: 'web',
    label: 'Okta Admin Console',
    host: 'acme.okta.com',
    username: 'sso-admin@acme.com',
    plainPass: '',
    notes: 'Username-only SSO bootstrap record — password managed by IdP.',
    lastModifiedBy: 'Identity Team',
    offsetHours: 12,
    favorite: false,
    vaultId: 'local',
    status: 'healthy',
    tags: ['SSO', 'Username-only'],
  },
  {
    type: 'vpn',
    label: 'Corporate VPN Pre-Shared Key',
    host: 'vpn.acme.com',
    username: '',
    plainPass: 'Acme-VPN-PSK-2026-RotateQ2',
    notes: 'Shared tunnel key for remote workforce — password-only record.',
    lastModifiedBy: 'Network Ops',
    offsetHours: 18,
    favorite: false,
    vaultId: 'local',
    folderId: 'folder-seed-vpn',
    status: 'healthy',
    tags: ['VPN', 'Password-only'],
  },
  {
    type: 'db',
    label: 'PostgreSQL Database',
    host: 'db-prod.acme.com:5432',
    username: 'db_admin',
    plainPass: '123456',
    notes: 'Primary database instance clustering metadata for ERP workflows.',
    lastModifiedBy: 'Will Coyote',
    offsetHours: 26,
    favorite: false,
    vaultId: 'it-dept',
    status: 'weak',
  },
  {
    type: 'email',
    label: 'Support SMTP Relay',
    host: 'smtp.acme.com:587',
    username: 'support-relay@acme.com',
    plainPass: 'Smtp-Relay!2026',
    notes: 'Outbound transactional mail relay for GeistDesk notifications.',
    lastModifiedBy: 'Messaging Team',
    offsetHours: 5,
    favorite: false,
    vaultId: 'local',
    status: 'healthy',
    tags: ['Email', 'SMTP'],
  },
];

/** @deprecated Vault folders are seeded via `npm run seed` into PostgreSQL (`vault_folders`). */
export const SEEDED_FOLDERS: never[] = [];

export const MOCK_CHROME_EXTENSION = {
  status: 'Installed',
  chromeInstalled: true,
  edgeInstalled: true,
  firefoxInstalled: false,
  lastSync: 'Sync active',
};

export const MOCK_AUDIT_LOGS = [
  { action: 'Viewed', user: 'premtonxh@gmail.com', date: '2026-06-03 08:20:11', ip: '192.168.1.15', loc: 'London, UK' },
  { action: 'Copied', user: 'premtonxh@gmail.com', date: '2026-06-03 08:14:22', ip: '192.168.1.15', loc: 'London, UK' },
  { action: 'Rotated', user: 'sarah.james@acme.com', date: '2026-06-02 11:42:01', ip: '10.0.4.82', loc: 'New York, US' },
  { action: 'Edited', user: 'mike.chen@acme.com', date: '2026-06-01 16:30:15', ip: '10.0.5.11', loc: 'California, US' },
  { action: 'Created', user: 'will.coyote@acme.com', date: '2026-05-28 09:12:00', ip: '10.0.3.43', loc: 'Texas, US' },
];
