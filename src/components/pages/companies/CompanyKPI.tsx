import React from 'react';
import { 
  Users, 
  Laptop, 
  Ticket, 
  Key, 
  CheckCircle2, 
  Coins, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { HydratedCompany } from './utils';
import { useTranslation } from '../../../lib/context/I18nContext';

interface CompanyKPIProps {
  company: HydratedCompany;
}

export default function CompanyKPI({ company }: CompanyKPIProps) {
  const { t } = useTranslation();
  const kpis = [
    {
      title: 'Users',
      value: company.usersCount,
      label: t('companies.contacts', 'Users'),
      icon: Users,
      iconColor: 'text-indigo-500 bg-indigo-500/5',
      trend: t('companies.trendUsers', '↑ 8 this month'),
      trendColor: 'text-emerald-500 bg-emerald-500/5'
    },
    {
      title: 'Assets',
      value: company.assetsCount,
      label: t('companies.assetOverview', 'Assets'),
      icon: Laptop,
      iconColor: 'text-[#34A853] bg-[#34A853]/5',
      trend: t('companies.trendAssets', '↑ 5 this month'),
      trendColor: 'text-emerald-500 bg-emerald-500/5'
    },
    {
      title: 'Open Tickets',
      value: company.openTicketsCount,
      label: `${t('companies.open', 'Open')} ${t('nav.tickets', 'Tickets')}`,
      icon: Ticket,
      iconColor: 'text-rose-500 bg-rose-500/5',
      trend: company.slaRisksCount > 0 
        ? `${t('companies.slaRiskFilter', 'SLA risk')} ↑ ${company.slaRisksCount}` 
        : t('companies.noImmediateRisks', 'No immediate risks'),
      trendColor: company.slaRisksCount > 0 ? 'text-amber-500 bg-amber-500/5' : 'text-slate-400 bg-slate-50'
    },
    {
      title: 'Vault Entries',
      value: company.vaultEntriesCount,
      label: t('companies.geistVaultSummary', 'Vault Entries'),
      icon: Key,
      iconColor: 'text-amber-500 bg-amber-500/5',
      trend: t('companies.trendVault', '↑ 3 expiring soon'),
      trendColor: 'text-amber-500 bg-amber-500/5'
    },
    {
      title: 'SLA Performance',
      value: company.slaPerformance,
      label: t('companies.slaPerf', 'SLA Performance'),
      icon: CheckCircle2,
      iconColor: 'text-emerald-500 bg-emerald-500/5',
      trend: t('companies.trendSla', '↑ 1.2% vs last 30d'),
      trendColor: 'text-emerald-500 bg-emerald-500/5'
    },
    {
      title: 'Monthly Spend',
      value: company.monthlySpend,
      label: t('companies.monthlySpend', 'Monthly Spend'),
      icon: Coins,
      iconColor: 'text-purple-500 bg-purple-500/5',
      trend: t('companies.trendSpend', '↑ 12% vs last month'),
      trendColor: 'text-emerald-500 bg-emerald-500/5'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <Card 
            key={index} 
            className="border border-muted-foreground/10 hover:border-primary/25 cursor-pointer hover:shadow-md transition-all rounded-2xl bg-background overflow-hidden select-none"
          >
            <CardContent className="p-4 flex flex-col justify-between h-full gap-2.5">
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl shrink-0 ${kpi.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <p className="text-xl font-black text-foreground tracking-tight leading-none">
                  {kpi.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 font-extrabold uppercase tracking-wider">
                  {kpi.label}
                </p>
              </div>

              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit flex items-center gap-1 ${kpi.trendColor}`}>
                {kpi.trend}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
