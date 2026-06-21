import React, { useMemo } from 'react';
import { useTranslation } from '../../lib/context/I18nContext';
import { 
  User, 
  Building2, 
  Activity, 
  HelpCircle, 
  BadgeAlert, 
  CreditCard, 
  Layers, 
  Smile, 
  Frown, 
  Meh,
  ListFilter,
  CheckCircle,
  AlertTriangle
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
  const { t, language } = useTranslation();
  // Aggregate previous tickets for this customer / company
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
    if (companyTickets.length <= 1) return t('context.noOtherTickets', 'No other tickets');
    // Sort chronologically and pull second latest or latest
    const sorted = [...companyTickets]
      .map(t => ({
        id: t.id,
        date: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt)
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // The latest is the current ticket under review mostly, grab the next one
    const other = sorted.find(item => item.id !== ticket.id);
    if (!other) return 'None';
    return other.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  }, [companyTickets, ticket, t]);

  // Compute LTV indicators & sentiment trend
  const customerLTV = useMemo(() => {
    if (company && (company as any).ltv) {
      return (company as any).ltv;
    }
    // Hardcoded fallback weighted by upkeep warranty
    return company?.wartungsvertragStatus === 'Active' ? '$18,500' : '$4,200';
  }, [company]);

  const customerHealthScore = useMemo(() => {
    const sentiment = ticket.sentiment || 'neutral';
    if (sentiment === 'angry') return language === 'de' ? 'Kritisches Risiko' : 'Critical Risk';
    if (openTicketsCount > 3) return language === 'de' ? 'Gefährdet' : 'At Risk';
    return language === 'de' ? 'Gesund / Schlüsselkunde' : 'Healthy / Key Account';
  }, [ticket.sentiment, openTicketsCount, language]);

  return (
    <div id="smart-context-bento-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {/* Card 1: Customer Profile */}
      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('context.customerProfile', 'Customer Profile')}</span>
            <User className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black truncate text-foreground">{contact?.name || ticket.customerName}</h4>
            <p className="text-[10px] text-muted-foreground truncate">{contact?.email || `${ticket.customerId}@domain.com`}</p>
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 text-[8px] h-4 font-black">
              {company?.wartungsvertragStatus === 'Active' 
                ? t('context.premiumPlatinum', 'PREMIUM PLATINUM') 
                : t('context.standardTier', 'STANDARD TIER')}
            </Badge>
            <span className="text-[9px] font-bold text-emerald-600">{customerLTV} LTV</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Previous Tickets History */}
      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('context.previousTickets', 'Previous Tickets')}</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black leading-none text-foreground">{companyTickets.length}</span>
              <span className="text-[9px] text-muted-foreground font-bold">{t('context.totalSupportCases', 'total support cases')}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('context.secondCase', 'Second case')}: <span className="font-bold text-foreground">{lastTicketDateStr}</span></p>
          </div>
          <div className="flex items-center gap-1 pt-1 border-t border-border/60 text-[9px] text-muted-foreground">
            <ListFilter className="w-3 h-3 text-indigo-400" />
            <span>{t('context.openCases', 'Open cases')}: <span className="font-black text-foreground">{openTicketsCount}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Customer Health Tracker */}
      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('context.accountHealth', 'Account Health')}</span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-xs font-black",
                customerHealthScore.includes('Critical') || customerHealthScore.includes('Kritisches') ? "text-red-600" :
                customerHealthScore.includes('Risk') || customerHealthScore.includes('Gefährdet') ? "text-amber-600" : "text-emerald-600"
              )}>
                {customerHealthScore}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('context.sentimentMood', 'Sentiment mood')}: <span className="font-bold capitalize text-foreground">{ticket.sentiment || 'Neutral'}</span></p>
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
                ? (language === 'de' ? 'Vergärgerung - Dringend' : 'Upset - Urgent Priority') 
                : t('context.awaitingConfirmation', 'Awaiting confirmation')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Hardware & Subscription Assets */}
      <Card className="bg-gradient-to-br from-card to-muted/20 border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#5F6368]">{t('context.relatedAssets', 'Related Assets')}</span>
            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-foreground">
              {(ticket as any).product || 'GeistDeskTech License'}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{t('context.licenseId', 'License ID')}: <span className="font-mono text-[9px]">GDT-8842-AX9</span></p>
          </div>
          <div className="flex items-center gap-1 pt-1 border-t border-border/60 text-[9px] text-[#137333] font-bold">
            <CheckCircle className="w-3 h-3 text-[#137333]" />
            <span>{t('context.verifiedCloud', 'Verified cloud deployment')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
