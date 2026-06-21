import React, { useMemo } from 'react';
import { 
  Building2, 
  Globe, 
  CreditCard, 
  Clock,
} from 'lucide-react';
import { Ticket as TicketType, Company, Contact } from '../../types';
import { CustomField } from '../../services/schemaService';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useTranslation } from '../../lib/context/I18nContext';

interface CustomerTabContentProps {
  ticket: TicketType;
  contact: Contact | null;
  company: Company | null;
  contactSchema: CustomField[];
  allTickets: TicketType[];
}

export function CustomerTabContent({
  ticket,
  contact,
  company,
  contactSchema,
  allTickets
}: CustomerTabContentProps) {
  const { t } = useTranslation();

  const personalHistory = useMemo(() => {
    return allTickets.filter(tkt => tkt.customerId === ticket.customerId && tkt.id !== ticket.id);
  }, [allTickets, ticket]);

  return (
    <div id="customer-tab-view" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border rounded-2xl shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-black shrink-0 shadow-sm border">
                  {(contact?.name || ticket.customerName).charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{contact?.name || ticket.customerName}</h3>
                  <p className="text-xs text-muted-foreground">{contact?.email || `${ticket.customerId}@domain.com`}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{t('tickets.customerTab.customerId', 'Customer ID')}: <span className="font-mono font-bold">{ticket.customerId}</span></p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-[10.5px] font-black uppercase tracking-wider text-muted-foreground">{t('tickets.customerTab.adminMetaFields', 'Administrative Meta Fields')}</h4>
                {contactSchema.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {contactSchema.map(field => {
                      const value = contact?.metadata?.[field.internalName] || t('tickets.customerTab.notConfigured', 'Not configured');
                      return (
                        <div key={field.id} className="p-2.5 bg-muted/30 border border-border/80 rounded-xl space-y-1">
                          <label className="text-[9.5px] font-black text-muted-foreground uppercase">{field.label}</label>
                          <p className="text-xs font-semibold text-foreground truncate">{String(value)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t('tickets.customerTab.noCustomMetadata', 'No custom metadata attributes declared on this account.')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border rounded-2xl shadow-sm">
            <CardContent className="p-6 space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{t('tickets.customerTab.clientHistory', 'Client History')}</h4>
              
              <div className="space-y-3">
                {personalHistory.length > 0 ? (
                  personalHistory.map(hist => (
                    <div key={hist.id} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between hover:border-gray-300 transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-primary hover:underline cursor-pointer block truncate">
                            {hist.subject}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground">ID: #{hist.id.slice(-5).toUpperCase()} • {t('tickets.customerTab.statusLabel', 'Status')}: <span className="font-bold">{hist.status}</span></span>
                        </div>
                      </div>
                      <Badge className="bg-slate-50 text-slate-605 border text-[8.5px] h-4.5 px-1.5 font-bold shrink-0">
                        {hist.createdAt?.toDate ? hist.createdAt.toDate().toLocaleDateString() : t('tickets.customerTab.today', 'Today')}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl border border-dashed text-center py-8 text-xs text-muted-foreground italic">
                    {t('tickets.customerTab.noLegacyCases', 'No other legacy cases recorded for this client.')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border rounded-2xl shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-foreground">{t('tickets.customerTab.organization', 'Organization')}</h3>
                </div>
                {company?.wartungsvertragStatus === 'Active' ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100/90 text-[9.5px] font-black uppercase">
                    {t('tickets.customerTab.platinumCare', 'Platinum Care')}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 text-[9.5px]">{t('tickets.customerTab.standardMaintenance', 'Standard maintenance')}</Badge>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{t('tickets.customerTab.companyName', 'Company Name')}:</span>
                  <span className="font-bold text-foreground">{company?.name || ticket.company || t('tickets.customerTab.unknownCorporation', 'Unknown Corporation')}</span>
                </div>
                <Separator className="bg-border/40" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {t('tickets.customerTab.domainWebsite', 'Domain website')}:</span>
                  <span className="font-semibold text-foreground truncate hover:underline cursor-pointer">{company?.website || 'enterprise-services.com'}</span>
                </div>
                <Separator className="bg-border/40" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> {t('tickets.customerTab.accountLtv', 'Account LTV')}:</span>
                  <span className="font-bold text-[#137333]">{(company as any)?.ltv || '$14,800'}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/40 border border-emerald-150 rounded-xl space-y-1">
                <h5 className="text-[10px] uppercase font-black text-emerald-800">{t('tickets.customerTab.warrantyStatus', 'Warranty Contract Status')}</h5>
                <p className="text-xs text-emerald-900 leading-normal font-semibold">
                  {t('tickets.customerTab.warrantyDesc', 'Valid SLA support levels. Expected first response within')} <span className="font-black">{t('tickets.customerTab.warrantyHours', '4 hours')}</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
