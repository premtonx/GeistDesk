import { Company, Ticket } from '../../../types';

export interface HydratedCompany extends Company {
  tier: 'Enterprise' | 'Pro' | 'Standard';
  healthScore: number;
  healthStatus: 'Healthy' | 'Warning' | 'SLA Risk' | 'Contract Expiring';
  openTicketsCount: number;
  slaRisksCount: number;
  accountOwner: string;
  contractPlan: string;
  contractSla: string;
  contractRenewalDate: string;
  contractStatus: 'ACTIVE' | 'EXPIRED';
  usersCount: number;
  assetsCount: number;
  vaultEntriesCount: number;
  slaPerformance: string;
  monthlySpend: string;
  customerSince: string;
}

export function hydrateCompany(company: Company | null, ticketHistory: Ticket[]): HydratedCompany | null {
  if (!company) return null;
  const nameLower = (company.name || '').toLowerCase();
  
  // Decide tier
  const tier = (company as any).tier || 
    (nameLower.includes('global') || nameLower.includes('solutions') || nameLower.includes('cyberdyne') || nameLower.includes('umbrella') || nameLower.includes('corp') ? 'Enterprise' : 
     nameLower.includes('finstream') || nameLower.includes('initech') ? 'Pro' : 'Standard');
  
  // Decide health score & status
  const healthScore = (company as any).healthScore !== undefined ? Number((company as any).healthScore) :
    (nameLower.includes('cyberdyne') ? 42 : 
     nameLower.includes('umbrella') ? 30 : 
     nameLower.includes('acme') ? 92 : 
     nameLower.includes('initech') ? 94 : 85);

  const healthStatus = (company as any).healthStatus || 
    (healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Warning' : healthScore >= 40 ? 'SLA Risk' : 'Contract Expiring');

  // Relational ticket dynamics
  const openTicketsCount = ticketHistory.filter(t => t.status !== 'resolved' && t.status !== 'closed' && t.status !== 'trash').length || 
    (nameLower.includes('acme') ? 4 : nameLower.includes('cyberdyne') ? 2 : nameLower.includes('finstream') ? 2 : nameLower.includes('globex') ? 1 : 0);

  const slaRisksCount = ticketHistory.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length ||
    (nameLower.includes('cyberdyne') ? 2 : 0);

  return {
    ...company,
    tier,
    healthScore,
    healthStatus,
    openTicketsCount,
    slaRisksCount,
    accountOwner: (company as any).accountOwner || (nameLower.includes('cyberdyne') || nameLower.includes('umbrella') ? 'Mike Chen' : 'Sarah James'),
    contractPlan: (company as any).contractPlan || (tier === 'Enterprise' ? 'Enterprise Plus' : tier === 'Pro' ? 'Pro Support' : 'Standard Support'),
    contractSla: (company as any).contractSla || (tier === 'Enterprise' ? '4h response' : tier === 'Pro' ? '8h response' : '24h response'),
    contractRenewalDate: (company as any).contractRenewalDate || 'Jan 12, 2027 (218 days)',
    contractStatus: (company as any).contractStatus || (company.wartungsvertragStatus === 'Active' ? 'ACTIVE' : 'EXPIRED'),
    usersCount: (company as any).usersCount !== undefined ? Number((company as any).usersCount) : (tier === 'Enterprise' ? 142 : tier === 'Pro' ? 45 : 12),
    assetsCount: (company as any).assetsCount !== undefined ? Number((company as any).assetsCount) : (tier === 'Enterprise' ? 87 : tier === 'Pro' ? 32 : 5),
    vaultEntriesCount: (company as any).vaultEntriesCount !== undefined ? Number((company as any).vaultEntriesCount) : (tier === 'Enterprise' ? 23 : tier === 'Pro' ? 12 : 3),
    slaPerformance: (company as any).slaPerformance || (tier === 'Enterprise' ? '99.8%' : tier === 'Pro' ? '98.5%' : '95.0%'),
    monthlySpend: (company as any).monthlySpend || (tier === 'Enterprise' ? '€4,520' : tier === 'Pro' ? '€2,100' : '€450'),
    customerSince: (company as any).customerSince || 'Jan 12, 2021',
  };
}
