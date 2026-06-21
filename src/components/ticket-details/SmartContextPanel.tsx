import React, { useMemo } from 'react';
import { useTranslation } from '../../lib/context/I18nContext';
import { 
  User, 
  Activity, 
  CreditCard, 
  Smile, 
  Frown, 
  Meh,
  ListFilter,
  CheckCircle,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Ticket as TicketType, Company, Contact } from '../../types';
import { cn } from '../../lib/utils';

interface SmartContextPanelProps {
  ticket: TicketType;
  contact: Contact | null;
  company: Company | null;
  allTickets: TicketType[];
}

export function SmartContextPanel({
  ticket,
  contact,
  company,
  allTickets
}: SmartContextPanelProps) {
  const { t } = useTranslation();

  const companyTickets = useMemo(() => {
    if (!ticket.companyId && !ticket.company) return [];
    return allTickets.filter(t => 
      (t.companyId && t.companyId === ticket.companyId) || 
      (t.company && t.company.toLowerCase() === ticket.company?.toLowerCase())
    );
  }, [ticket, allTickets]);

  const openTicketsCount = useMemo(() => {
    return companyTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
  }, [companyTickets]);

  const lastTicketDateStr = useMemo(() => {
    if (companyTickets.length <= 1) return t('tickets.context.noOtherTickets', 'No other tickets');
    const sorted = [...companyTickets]
      .map(t => ({
        id: t.id,
        date: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt)
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    const other = sorted.find(item => item.id !== ticket.id);
    if (!other) return t('tickets.context.none', 'None');
    return other.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  }, [companyTickets, ticket, t]);

  const customerLTV = useMemo(() => {
    if (company && (company as any).ltv) {
      return (company as any).ltv;
    }
    return company?.wartungsvertragStatus === 'Active' ? '$18,500' : '$4,200';
  }, [company]);

  const customerHealthScore = useMemo(() => {
    const sentiment = ticket.sentiment || 'neutral';
    if (sentiment === 'angry') return t('tickets.context.criticalRisk', 'Critical Risk');
    if (openTicketsCount > 3) return t('tickets.context.atRisk', 'At Risk');
    return t('tickets.context.healthyKeyAccount', 'Healthy / Key Account');
  }, [ticket.sentiment, openTicketsCount, t]);

  const sentimentLabel = useMemo(() => {
    const s = (ticket.sentiment || 'neutral').toLowerCase();
    if (s === 'angry' || s === 'negative') return t('tickets.context.sentimentAngry', 'Angry');
    if (s === 'positive') return t('tickets.context.sentimentPositive', 'Positive');
    if (s === 'frustrated') return t('tickets.context.sentimentNegative', 'Negative');
    return t('tickets.context.sentimentNeutral', 'Neutral');
  }, [ticket.sentiment, t]);

  return (
    <div id="smart-context-bento-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('tickets.context.customerProfile', 'Customer Profile')}</span>
            <User className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black truncate text-foreground">{contact?.name || ticket.customerName}</h4>
            <p className="text-[10px] text-muted-foreground truncate">{contact?.email || `${ticket.customerId}@domain.com`}</p>
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 text-[8px] h-4 font-black">
              {company?.wartungsvertragStatus === 'Active' 
                ? t('tickets.context.premiumPlatinum', 'PREMIUM PLATINUM') 
                : t('tickets.context.standardTier', 'STANDARD TIER')}
            </Badge>
            <span className="text-[9px] font-bold text-emerald-600">{customerLTV} {t('tickets.context.ltv', 'LTV')}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('tickets.context.previousTickets', 'Previous Tickets')}</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black leading-none text-foreground">{companyTickets.length}</span>
              <span className="text-[9px] text-muted-foreground font-bold">{t('tickets.context.totalSupportCases', 'total support cases')}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('tickets.context.secondCase', 'Second case')}: <span className="font-bold text-foreground">{lastTicketDateStr}</span></p>
          </div>
          <div className="flex items-center gap-1 pt-1 border-t border-border/60 text-[9px] text-muted-foreground">
            <ListFilter className="w-3 h-3 text-indigo-400" />
            <span>{t('tickets.context.openCases', 'Open cases')}: <span className="font-black text-foreground">{openTicketsCount}</span></span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('tickets.context.accountHealth', 'Account Health')}</span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-xs font-black",
                customerHealthScore.includes(t('tickets.context.criticalRisk', 'Critical')) || customerHealthScore.includes('Kritisch') ? "text-red-600" :
                customerHealthScore.includes(t('tickets.context.atRisk', 'Risk')) || customerHealthScore.includes('Gefährdet') ? "text-amber-600" : "text-emerald-600"
              )}>
                {customerHealthScore}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('tickets.context.sentimentMood', 'Sentiment mood')}: <span className="font-bold capitalize text-foreground">{sentimentLabel}</span></p>
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
            {ticket.sentiment === 'angry' ? (
              <Frown className="w-3.5 h-3.5 text-red-500" />
            ) : ticket.sentiment === 'positive' ? (
              <Smile className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Meh className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-[9px] font-bold uppercase tracking-tight text-foreground">
              {ticket.sentiment === 'angry' 
                ? t('tickets.context.upsetUrgent', 'Upset — Urgent Priority') 
                : t('tickets.context.awaitingConfirmation', 'Awaiting confirmation')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('tickets.context.relatedAssets', 'Related Assets')}</span>
            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-foreground">
              {(ticket as any).product || t('tickets.context.defaultProduct', 'GeistDeskTech License')}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{t('tickets.context.licenseId', 'License ID')}: <span className="font-mono text-[9px]">GDT-8842-AX9</span></p>
          </div>
          <div className="flex items-center gap-1 pt-1 border-t border-border/60 text-[9px] text-[#137333] font-bold">
            <CheckCircle className="w-3 h-3 text-[#137333]" />
            <span>{t('tickets.context.verifiedCloud', 'Verified cloud deployment')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
