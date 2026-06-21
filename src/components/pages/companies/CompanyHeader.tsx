import React from 'react';
import { 
  Building2, 
  Globe, 
  Mail, 
  Calendar, 
  User, 
  Edit3, 
  MoreHorizontal,
  FileText,
  BadgeAlert,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { HydratedCompany } from './utils';
import { useTranslation } from '../../../lib/context/I18nContext';

interface CompanyHeaderProps {
  company: HydratedCompany;
  onEditCompanyClick: () => void;
  onViewContractClick: () => void;
}

export default function CompanyHeader({
  company,
  onEditCompanyClick,
  onViewContractClick
}: CompanyHeaderProps) {
  const { t } = useTranslation();
  // Initials for avatar fallback
  const initials = (company.name || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      {/* Top Breadcrumbs and Action row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
          <span className="hover:text-foreground cursor-pointer transition-colors">{t('nav.companies', 'Companies')}</span>
          <span>&gt;</span>
          <span className="text-foreground font-bold">{company.name}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 rounded-xl border-muted-foreground/15 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Button 
            onClick={onEditCompanyClick}
            variant="outline" 
            size="sm" 
            className="h-9 rounded-xl border-muted-foreground/15 text-foreground hover:bg-muted font-bold text-xs gap-1.5 px-4 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {t('companies.editCompany', 'Edit Company')}
          </Button>
        </div>
      </div>

      {/* Main Grid: Info + Support Contract Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Avatar + Details (grows to span 2 cols on wide view) */}
        <div className="lg:col-span-2 bg-background border border-muted rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start">
          {/* Company Logo Container */}
          <div className="w-24 h-24 rounded-2xl bg-primary text-white text-3xl font-black tracking-tight flex items-center justify-center shadow-inner shrink-0 relative overflow-hidden group border border-primary/20">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          {/* Details Column */}
          <div className="space-y-4 flex-1 min-w-0">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                  {company.name}
                </h2>
                <Badge variant="secondary" className="h-5 px-2 bg-muted text-muted-foreground font-extrabold uppercase text-[9px] tracking-wider rounded-md border-none">
                  {company.tier}
                </Badge>
              </div>

              {/* Grid of contact details */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 text-xs text-muted-foreground font-semibold">
                {company.website && (
                  <a 
                    href={`https://${company.website}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {company.website}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                )}
                {company.domain && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {company.domain}
                  </div>
                )}
                {company.branche && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {company.branche}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Date and Contract Owner */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 border-t border-muted text-xs text-muted-foreground font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/50">{t('companies.customerSince', 'Customer since:')}</span>
                <span className="text-foreground font-bold">{company.customerSince || 'Jan 12, 2021'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/50">{t('companies.accountOwner', 'Account Owner:')}</span>
                <div className="flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded-full text-foreground font-bold">
                  <span className="h-4 w-4 rounded-full bg-primary/25 text-[9px] font-black flex items-center justify-center text-primary uppercase shrink-0">
                    {company.accountOwner.charAt(0)}
                  </span>
                  <span>{company.accountOwner}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Support Contract Card */}
        <div className="bg-background border border-muted rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">
                {t('companies.supportContract', 'Support Contract')}
              </span>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-black">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {t('companies.active', 'ACTIVE')}
              </div>
            </div>

            {/* Contract breakdown */}
            <div className="grid grid-cols-2 gap-y-2.5 text-xs font-semibold">
              <div className="text-muted-foreground">{t('companies.plan', 'Plan')}</div>
              <div className="text-foreground font-bold text-right">{company.contractPlan}</div>

              <div className="text-muted-foreground">{t('companies.sla', 'SLA')}</div>
              <div className="text-foreground font-bold text-right">{company.contractSla}</div>

              <div className="text-muted-foreground">{t('companies.renewalDate', 'Renewal date')}</div>
              <div className="text-foreground font-bold text-right text-muted-foreground/90">{company.contractRenewalDate}</div>
            </div>
          </div>

          <Button 
            onClick={onViewContractClick}
            variant="outline" 
            size="sm" 
            className="w-full mt-4 h-9 rounded-xl border-muted text-foreground hover:bg-muted/80 font-bold text-xs"
          >
            {t('companies.viewContract', 'View Contract')}
          </Button>
        </div>

      </div>
    </div>
  );
}
