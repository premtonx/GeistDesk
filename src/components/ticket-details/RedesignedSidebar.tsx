import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Settings2, 
  Clock, 
  User, 
  Building2, 
  Tag, 
  Link2, 
  Unlink, 
  Key, 
  Activity, 
  MessageSquare, 
  Layers, 
  Scale, 
  Languages, 
  Angry, 
  Meh, 
  Smile,
  ShieldAlert,
  HelpCircle,
  PlusCircle,
  FolderOpen,
  MapPin,
  FileCheck2,
  Trash2,
  Plus,
  BookOpen,
  Send,
  UserCheck,
  X
} from 'lucide-react';
import { Ticket as TicketType, Company, Contact, KBArticle } from '../../types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { text } from 'd3';
import { SuggestedLink } from '../../services/neuralLinkService';

interface RedesignedSidebarProps {
  ticket: TicketType;
  contact: Contact | null;
  company: Company | null;
  allTickets: TicketType[];
  onUpdateTicketField: (data: Partial<TicketType>) => void;
  isAiReady: boolean;
  isAiDrafting: boolean;
  onDraftWithAI: () => void;
  onConvertToKB: () => void;
  suggestedNeuralLinks: SuggestedLink[];
  onLinkTicket: (id: string) => void;
  onUnlinkTicket: (id: string) => void;
  tagsInput: string;
  onChangeTagsInput: (val: string) => void;
  onAddTag: () => void;
  suggestedTags: string[];
  onInitiateHandoff?: (data: { agentName: string; agentId?: string }) => void;
  onCloseMobile?: () => void;
}

export function RedesignedSidebar({
  ticket,
  contact,
  company,
  allTickets,
  onUpdateTicketField,
  isAiReady,
  isAiDrafting,
  onDraftWithAI,
  onConvertToKB,
  suggestedNeuralLinks,
  onLinkTicket,
  onUnlinkTicket,
  tagsInput,
  onChangeTagsInput,
  onAddTag,
  suggestedTags,
  onInitiateHandoff,
  onCloseMobile
}: RedesignedSidebarProps) {
  // Collapsing Section States
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    copilot: false,
    properties: false,
    sla: false,
    customer: true,
    organization: true,
    tags: false,
    related: true,
    assets: true,
    history: true
  });

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Determine sentiment smiley
  const sentimentIcon = useMemo(() => {
    switch (ticket.sentiment || 'neutral') {
      case 'angry': return <Angry className="w-4 h-4 text-red-500 shrink-0" />;
      case 'positive': return <Smile className="w-4 h-4 text-emerald-500 shrink-0" />;
      default: return <Meh className="w-4 h-4 text-amber-500 shrink-0" />;
    }
  }, [ticket.sentiment]);

  return (
    <aside className="w-[325px] border-l border-border bg-muted/20 flex flex-col shrink-0 h-full overflow-hidden select-none">
      <div className="p-4 border-b flex items-center justify-between bg-card shrink-0 h-[56px]">
        <span className="font-bold text-sm text-foreground tracking-tight flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span>Eigenschaften Dispatch-Desk</span>
        </span>
        <div className="flex items-center gap-2">
          {onCloseMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden h-8 w-8 hover:bg-muted rounded-full"
              onClick={onCloseMobile}
            >
              <X className="w-4 h-4 text-slate-550" />
            </Button>
          )}
          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[8px] font-black uppercase">
            Dynamic RAG
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/60 p-4 space-y-4">
        
        {/* PROMINENT AGENT DISPATCH BOARD (ALWAYS VISIBLE AT THE TOP) */}
        <div id="prominent-agent-dispatch-board" className="bg-card border border-border shadow-xs rounded-xl p-3.5 space-y-3 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-primary" />
              <span>Agenten-Zuweisung</span>
            </span>
            {ticket.agentName ? (
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 text-[8.5px] font-bold py-0.5 px-2">
                Aktiv zugewiesen
              </Badge>
            ) : (
              <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 text-[8.5px] font-bold py-0.5 px-2">
                Nicht zugewiesen
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-dashed border-border/80">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
              ticket.agentName 
                ? "bg-primary/10 text-primary border-primary/20" 
                : "bg-slate-100 text-slate-400 border-slate-200"
            }`}>
              {ticket.agentName ? ticket.agentName.substring(0, 2).toUpperCase() : "?"}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-extrabold text-foreground truncate">
                {ticket.agentName || "Nicht zugewiesen"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {ticket.agentName ? "Verantwortlicher Bearbeiter" : "Klicken Sie unten, um das Ticket zuzuweisen"}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9.5px] font-black text-muted-foreground uppercase block">Dispatch-Agenten auswählen</label>
            <select 
              id="dispatch-agent-select"
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-slate-700 dark:text-slate-200"
              value={ticket.agentName || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  onUpdateTicketField({ agentId: undefined, agentName: undefined });
                } else if (onInitiateHandoff) {
                  onInitiateHandoff({ agentName: val });
                } else {
                  onUpdateTicketField({ agentName: val });
                }
              }}
            >
              <option value="">Nicht zugewiesen</option>
              {['Sarah Agent', 'Mike Lead', 'Dev Team'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[9.5px] font-black text-muted-foreground uppercase block">Dispatch-Fallstatus</label>
            <select 
              id="dispatch-status-select"
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-slate-700 dark:text-slate-200 capitalize"
              value={ticket.status}
              onChange={(e) => {
                onUpdateTicketField({ status: e.target.value as any });
              }}
            >
              {['open', 'pending', 'resolved', 'closed', 'qs', 'merged', 'trash'].map(st => {
                let label = st;
                if (st === 'open') label = 'offen';
                else if (st === 'pending') label = 'wartend';
                else if (st === 'resolved') label = 'gelöst';
                else if (st === 'closed') label = 'geschlossen';
                else if (st === 'qs') label = 'Qualitätssicherung';
                else if (st === 'merged') label = 'zusammengeschlossen';
                else if (st === 'trash') label = 'gelöscht';
                return (
                  <option key={st} value={st}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* SLA Help Escalation (Hilfe anfordern) */}
          <div className="space-y-1 pt-2">
            <label className="text-[9.5px] font-black text-muted-foreground uppercase block">SLA-Hilfeeskalation</label>
            <Button
              variant={ticket.isHelpRequested ? "destructive" : "outline"}
              size="sm"
              className={`w-full text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                ticket.isHelpRequested 
                  ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse" 
                  : "border-rose-200 text-rose-700 hover:bg-rose-50"
              }`}
              onClick={() => onUpdateTicketField({ isHelpRequested: !ticket.isHelpRequested })}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {ticket.isHelpRequested ? "Hilfeanforderung abbrechen" : "Hilfe anfordern"}
            </Button>
          </div>
        </div>

        {/* SECTION 1: AI COPILOT WORKSPACE (Highlight section!) */}
        <div className="space-y-2">
          <button 
            className="w-full flex items-center justify-between text-[10.5px] font-black uppercase tracking-widest text-[#5F6368] hover:text-foreground transition-colors py-1.5 focus:outline-none"
            onClick={() => toggleSection('copilot')}
          >
            <span className="flex items-center gap-1.5 text-indigo-700">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>KI-Copilot SmartHub</span>
            </span>
            {collapsed.copilot ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {!collapsed.copilot && (
            <div className="space-y-3 bg-gradient-to-br from-indigo-50/40 to-sky-50/20 dark:from-indigo-950/10 dark:to-sky-950/5 border border-indigo-150 rounded-2xl p-3.5 shadow-sm space-y-4">
              <div className="space-y-1">
                <h5 className="text-[10px] font-black text-indigo-900 uppercase">Vorgeschlagene KI-Strategie</h5>
                <p className="text-[11px] text-indigo-950 font-semibold italic border-l-2 border-indigo-300 pl-2 leading-tight">
                  "Microsoft Entra-Konfigurationsparität bestätigen. Einen höflichen Entwurf zur Bestätigung der Sicherheitsüberprüfung erstellen."
                </p>
              </div>

              {/* Action grid shortcuts */}
              <div className="space-y-2">
                <span className="text-[9px] font-black text-indigo-850 uppercase block">KI-Befehle mit einem Klick</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button 
                    className="bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black h-8 rounded-lg shadow-sm"
                    onClick={onDraftWithAI}
                    disabled={isAiDrafting || !isAiReady}
                  >
                    Antwort entwerfen
                  </Button>
                  <Button 
                    className="bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black h-8 rounded-lg shadow-sm"
                    onClick={onConvertToKB}
                    disabled={!isAiReady}
                  >
                    KB-Extraktion
                  </Button>
                </div>
              </div>

              {/* Verified Sources references */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-indigo-850 uppercase block">Verifizierte KB-Zitate</span>
                <div className="p-2 bg-white/70 rounded-xl border border-indigo-100/50 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-800 truncate pr-1">Microsoft Entra SSO Paritätsregel</span>
                  <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50/90 text-[8px] h-4 font-bold shrink-0">94% Konfidenz</Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: CORE PROPERTIES */}
        <div className="space-y-2 pt-4">
          <button 
            className="w-full flex items-center justify-between text-[10.5px] font-black uppercase tracking-widest text-[#5F6368] hover:text-foreground transition-colors py-1.5 focus:outline-none"
            onClick={() => toggleSection('properties')}
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-blue-500" />
              <span>Standard-Eigenschaften</span>
            </span>
            {collapsed.properties ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {!collapsed.properties && (
            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* Type selector */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-black text-muted-foreground uppercase">Ticket-Kategorie</label>
                <select 
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  value={ticket.type || 'incident'}
                  onChange={(e) => onUpdateTicketField({ type: e.target.value as any })}
                >
                  <option value="incident">Vorfall (Incident)</option>
                  <option value="question">Frage (Question)</option>
                  <option value="problem">Problem</option>
                  <option value="feature_request">Feature-Anfrage</option>
                </select>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-black text-muted-foreground uppercase">Lebenszyklus-Status</label>
                <select 
                  className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary capitalize"
                  value={ticket.status}
                  onChange={(e) => onUpdateTicketField({ status: e.target.value as any })}
                >
                  {['open', 'pending', 'resolved', 'closed', 'qs', 'merged', 'trash'].map(st => {
                    let label = st;
                    if (st === 'open') label = 'offen';
                    else if (st === 'pending') label = 'wartend';
                    else if (st === 'resolved') label = 'gelöst';
                    else if (st === 'closed') label = 'geschlossen';
                    else if (st === 'qs') label = 'Qualitätssicherung';
                    else if (st === 'merged') label = 'zusammengeschlossen';
                    else if (st === 'trash') label = 'gelöscht';
                    return (
                      <option key={st} value={st}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Focus Sentiment Display */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-black text-muted-foreground uppercase">Dynamische Stimmung</label>
                <div className="p-2.5 bg-card border border-border rounded-xl flex items-center justify-between">
                  <span className="capitalize text-xs font-bold text-foreground">
                    {ticket.sentiment === 'angry' ? 'Wütend' : ticket.sentiment === 'positive' ? 'Positiv' : 'Neutral'}
                  </span>
                  {sentimentIcon}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: REQUESTER INFORMATION */}
        <div className="space-y-2 pt-4">
          <button 
            className="w-full flex items-center justify-between text-[10.5px] font-black uppercase tracking-widest text-[#5F6368] hover:text-foreground transition-colors py-1.5 focus:outline-none"
            onClick={() => toggleSection('customer')}
          >
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-teal-500" />
              <span>Kundenkontext</span>
            </span>
            {collapsed.customer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {!collapsed.customer && (
            <div className="p-3.5 bg-card border rounded-xl space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7 border">
                  <AvatarFallback className="bg-teal-50 text-teal-700 text-[10px] font-bold">
                    {(contact?.name || ticket.customerName).charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h6 className="text-xs font-black text-foreground">{contact?.name || ticket.customerName}</h6>
                  <p className="text-[9px] text-muted-foreground truncate max-w-[180px]">{contact?.email || `${ticket.customerId}@mail.com`}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: TAG MANAGEMENT */}
        <div className="space-y-2 pt-4">
          <button 
            className="w-full flex items-center justify-between text-[10.5px] font-black uppercase tracking-widest text-[#5F6368] hover:text-foreground transition-colors py-1.5 focus:outline-none"
            onClick={() => toggleSection('tags')}
          >
            <span className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-purple-500" />
              <span>Metadaten-Tags</span>
            </span>
            {collapsed.tags ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {!collapsed.tags && (
            <div className="space-y-3.5 pt-1">
              <div className="flex flex-wrap gap-1">
                {ticket.tags && ticket.tags.length > 0 ? (
                  ticket.tags.map(tag => (
                    <Badge 
                      key={tag} 
                      className="bg-purple-100 text-purple-800 hover:bg-purple-100/90 hover:text-red-500 border-none text-[9px] font-bold px-2 py-0.5 gap-1 shrink-0 cursor-pointer"
                      onClick={() => onUpdateTicketField({ tags: ticket.tags.filter(t => t !== tag) })}
                    >
                      <span>#{tag}</span>
                      <span className="font-bold text-[8px] opacity-70">x</span>
                    </Badge>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">Keine manuellen Tags definiert.</span>
                )}
              </div>

              {/* Add tags */}
              <div className="relative">
                <Input 
                  placeholder="Tag eingeben..." 
                  className="h-8 text-xs rounded-xl focus:ring-purple-400 focus:border-purple-400 pr-8"
                  value={tagsInput}
                  onChange={(e) => onChangeTagsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagsInput.trim()) {
                      onAddTag();
                    }
                  }}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1 h-6 w-6 rounded-md text-purple-600 hover:bg-purple-50"
                  onClick={onAddTag}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* AI tag suggestions */}
              {suggestedTags && suggestedTags.length > 0 && (
                <div className="p-3 bg-purple-50/30 border border-purple-150 rounded-xl space-y-1.5">
                  <span className="text-[9px] font-black text-purple-800 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> KI-Label-Vorschläge
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {suggestedTags.filter(st => !ticket.tags.includes(st)).map(st => (
                      <button 
                        key={st}
                        className="text-[9px] font-black bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full transition-all"
                        onClick={() => onUpdateTicketField({ tags: [...ticket.tags, st] })}
                      >
                        +#{st}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 5: RELATED NEURAL LINKS */}
        <div className="space-y-2 pt-4">
          <button 
            className="w-full flex items-center justify-between text-[10.5px] font-black uppercase tracking-widest text-[#5F6368] hover:text-foreground transition-colors py-1.5 focus:outline-none"
            onClick={() => toggleSection('related')}
          >
            <span className="flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-[#1A73E8]" />
              <span>Verbundene Tickets ({ticket.linkedTicketIds?.length || 0})</span>
            </span>
            {collapsed.related ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {!collapsed.related && (
            <div className="space-y-2 pt-1 font-bold">
              {ticket.linkedTicketIds && ticket.linkedTicketIds.length > 0 ? (
                ticket.linkedTicketIds.map(id => (
                  <div 
                    key={id} 
                    className="p-2.0 bg-card border border-border rounded-xl flex items-center justify-between text-[11px] hover:border-indigo-150"
                  >
                    <span className="truncate pr-1 text-foreground">Inc: #{id.slice(-5).toUpperCase()}</span>
                    <button 
                      className="text-muted-foreground hover:text-red-500 p-0.5 rounded"
                      onClick={() => onUnlinkTicket(id)}
                    >
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-[10px] text-muted-foreground italic px-2 block">Keine aktiven Verknüpfungen.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
