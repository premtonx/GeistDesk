import React from 'react';
import { 
  Link2, 
  Unlink, 
  Sparkles, 
  ExternalLink, 
  PlusCircle, 
  Lock, 
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Ticket as TicketType } from '../../types';
import { SuggestedLink } from '../../services/neuralLinkService';
import { useTranslation } from '../../lib/context/I18nContext';

interface RelatedTicketsTabContentProps {
  ticket: TicketType;
  suggestedNeuralLinks: SuggestedLink[];
  isFindingNeuralLinks: boolean;
  onFindNeuralLinks: () => void;
  onLinkTicket: (id: string) => void;
  onUnlinkTicket: (id: string) => void;
  linkInput: string;
  onChangeLinkInput: (val: string) => void;
}

function fmt(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
    template
  );
}

export function RelatedTicketsTabContent({
  ticket,
  suggestedNeuralLinks,
  isFindingNeuralLinks,
  onFindNeuralLinks,
  onLinkTicket,
  onUnlinkTicket,
  linkInput,
  onChangeLinkInput
}: RelatedTicketsTabContentProps) {
  const { t } = useTranslation();

  return (
    <div id="related-tickets-tab-view" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border rounded-xl shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-foreground">
                    {t('tickets.relatedTab.activeLinkings', 'Active neural linkings')}
                  </h3>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg h-7 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
                  onClick={onFindNeuralLinks}
                  disabled={isFindingNeuralLinks}
                >
                  {isFindingNeuralLinks
                    ? t('tickets.relatedTab.scanning', 'Scanning...')
                    : t('tickets.relatedTab.scanContextLinks', 'Scan context links')}
                </Button>
              </div>

              {ticket.isMasterTicket && (
                <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-indigo-800">
                      {t('tickets.relatedTab.masterTicketController', 'Master ticket controller')}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-950 leading-relaxed font-semibold">
                    {fmt(t('tickets.relatedTab.masterTicketDesc', 'This support incident has been upgraded to a master ticket coordinating {{count}} linked sub-tickets.'), {
                      count: ticket.linkedTicketIds?.length || 0,
                    })}
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-1">
                {ticket.linkedTicketIds && ticket.linkedTicketIds.length > 0 ? (
                  ticket.linkedTicketIds.map(tid => (
                    <div 
                      key={tid} 
                      className="group p-3 bg-card border border-border rounded-xl hover:border-indigo-150 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Link2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-xs font-bold text-foreground truncate cursor-pointer hover:underline">
                          {fmt(t('tickets.relatedTab.ticketReference', 'Ticket reference: #{{id}}'), {
                            id: tid.slice(-5).toUpperCase(),
                          })}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-75 hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                        onClick={() => onUnlinkTicket(tid)}
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                ) : !ticket.masterTicketId ? (
                  <div className="p-6 rounded-xl border border-dashed text-center py-8 text-xs text-muted-foreground italic">
                    {t('tickets.relatedTab.noLinkages', 'No active neural ticket linkages established for this session.')}
                  </div>
                ) : null}

                {ticket.masterTicketId && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400 animate-pulse" />
                      <div className="flex flex-col">
                        <span className="text-[9.5px] uppercase font-black text-slate-500">
                          {t('tickets.relatedTab.linkedToParent', 'Linked to parent master')}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {fmt(t('tickets.relatedTab.parent', 'Parent: #{{id}}'), {
                            id: ticket.masterTicketId.slice(-5).toUpperCase(),
                          })}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                  {t('tickets.relatedTab.linkManually', 'Link and unify manually')}
                </label>
                <div className="relative">
                  <Input 
                    placeholder={t('tickets.relatedTab.linkPlaceholder', 'Enter manual ticket ID (e.g. #IT-0041 or uuid)...')}
                    className="h-10 text-xs rounded-xl border-border focus:ring-1 focus:ring-indigo-400 pr-10"
                    value={linkInput}
                    onChange={(e) => onChangeLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && linkInput.trim()) {
                        onLinkTicket(linkInput.replace('#', '').trim());
                        onChangeLinkInput('');
                      }
                    }}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1 h-8 w-8 text-indigo-500 rounded-lg"
                    onClick={() => {
                      if (linkInput.trim()) {
                        onLinkTicket(linkInput.replace('#', '').trim());
                        onChangeLinkInput('');
                      }
                    }}
                  >
                    <PlusCircle className="w-4.5 h-4.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border rounded-xl shadow-sm bg-gradient-to-b from-indigo-50/15 to-transparent">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#5F6368]">
                  {t('tickets.relatedTab.aiRecommendations', 'AI link recommendations')}
                </h3>
              </div>

              <div className="space-y-3">
                {suggestedNeuralLinks.length > 0 ? (
                  suggestedNeuralLinks.map(suggestion => (
                    <div 
                      key={suggestion.ticketId}
                      className="p-3 bg-white border border-indigo-100/60 rounded-xl space-y-2 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 truncate pr-2">{suggestion.subject}</span>
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100/90 text-[8.5px] font-black h-4.5">
                          {fmt(t('tickets.relatedTab.matchPercent', '{{percent}}% match'), {
                            percent: Math.round(suggestion.confidence * 100),
                          })}
                        </Badge>
                      </div>
                      <p className="text-[10.5px] text-indigo-700/70 italic leading-snug">&quot;{suggestion.reason}&quot;</p>
                      <Button 
                        className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[10px] font-bold h-7 rounded-lg shadow-sm"
                        onClick={() => onLinkTicket(suggestion.ticketId)}
                      >
                        {t('tickets.relatedTab.confirmMatch', 'Confirm match')}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground italic py-8">
                    {t('tickets.relatedTab.scanPrompt', 'Scan context links above to trigger real-time vector matches against historical support tickets.')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
