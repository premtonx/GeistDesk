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
  vaultId: 'local' | 'shared';
  status: 'healthy' | 'weak' | 'expiring' | 'breached';
}

export const SEEDED_CREDENTIALS: SeedItem[] = [
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
    status: 'healthy'
  },
  {
    type: 'vpn',
    label: 'Acme VPN Gateway',
    host: 'vpn.acme.com',
    username: 'sarah.james',
    plainPass: 'VPNSecureGate88',
    notes: 'Global secure connection client gateway with automated failover tunnels.',
    lastModifiedBy: 'Mike Chen',
    offsetHours: 5,
    favorite: false,
    vaultId: 'local',
    status: 'healthy'
  },
  {
    type: 'web',
    label: 'GitHub - Acme',
    host: 'github.acme.com',
    username: 'devops@acme.com',
    plainPass: 'HubGitDevOpsPass',
    notes: 'Acme enterprise organization repositories and actions token registries.',
    lastModifiedBy: 'Sarah James',
    offsetHours: 24,
    favorite: false,
    vaultId: 'shared',
    status: 'healthy'
  },
  {
    type: 'db',
    label: 'PostgreSQL Database',
    host: 'db-prod.acme.com:5432',
    username: 'db_admin',
    plainPass: '123456', // Weak password trigger!
    notes: 'Primary database instance clustering metadata for ERP workflows.',
    lastModifiedBy: 'Will Coyote',
    offsetHours: 26,
    favorite: false,
    vaultId: 'shared',
    status: 'weak'
  },
  {
    type: 'web',
    label: 'AWS Production',
    host: 'console.aws.amazon.com',
    username: 'aws-prod-admin',
    plainPass: 'AWSAdminKey99',
    notes: 'Primary root master corporate console cloud computing space.',
    lastModifiedBy: 'Anna Bell',
    offsetHours: 48,
    favorite: false,
    vaultId: 'shared',
    status: 'expiring'
  },
  {
    type: 'api',
    label: 'Stripe API Key',
    host: 'api.stripe.com',
    username: 'sk_live_............',
    plainPass: 'sk_live_51Mxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    notes: 'Production payment integration server API token for client billing.',
    lastModifiedBy: 'John Doe',
    offsetHours: 72,
    favorite: false,
    vaultId: 'local',
    status: 'healthy'
  },
  {
    type: 'ssh',
    label: 'SSH - Web Server',
    host: 'web01.acme.com',
    username: 'ubuntu',
    plainPass: 'UbuntuKeyFileB64...',
    notes: 'Public web cluster entry nodes for CDN origin settings.',
    lastModifiedBy: 'Mike Chen',
    offsetHours: 96,
    favorite: false,
    vaultId: 'local',
    status: 'healthy'
  },
  {
    type: 'web',
    label: 'Microsoft 365 Admin',
    host: 'admin.microsoft.com',
    username: 'admin@acme.com',
    plainPass: 'Office356M365!',
    notes: 'Global active office cloud subscription workspace for core staff directory.',
    lastModifiedBy: 'Will Coyote',
    offsetHours: 120,
    favorite: false,
    vaultId: 'shared',
    status: 'healthy'
  }
];

export const MOCK_CHROME_EXTENSION = {
  status: 'Installed',
  chromeInstalled: true,
  edgeInstalled: true,
  firefoxInstalled: false,
  lastSync: 'Sync active'
};

export const MOCK_AUDIT_LOGS = [
  { action: 'Viewed', user: 'premtonxh@gmail.com', date: '2026-06-03 08:20:11', ip: '192.168.1.15', loc: 'London, UK' },
  { action: 'Copied', user: 'premtonxh@gmail.com', date: '2026-06-03 08:14:22', ip: '192.168.1.15', loc: 'London, UK' },
  { action: 'Rotated', user: 'sarah.james@acme.com', date: '2026-06-02 11:42:01', ip: '10.0.4.82', loc: 'New York, US' },
  { action: 'Edited', user: 'mike.chen@acme.com', date: '2026-06-01 16:30:15', ip: '10.0.5.11', loc: 'California, US' },
  { action: 'Created', user: 'will.coyote@acme.com', date: '2026-05-28 09:12:00', ip: '10.0.3.43', loc: 'Texas, US' }
];
