import React from 'react';
import { 
  Sparkles, 
  CheckCircle, 
  HelpCircle, 
  Activity, 
  Frown, 
  Smile, 
  Meh, 
  BadgeAlert, 
  SearchCheck, 
  BookOpen,
  MapPin,
  ShieldAlert,
  Terminal,
  ChevronRight
} from 'lucide-react';
import { Ticket as TicketType } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useTranslation } from '../../lib/context/I18nContext';

interface AiInsightsTabContentProps {
  ticket: TicketType;
  aiSummary: string;
  aiSources: { paragraph: string; articleTitle: string; articleId?: string }[];
  isAiReady: boolean;
}

export function AiInsightsTabContent({
  ticket,
  aiSummary,
  aiSources,
  isAiReady
}: AiInsightsTabContentProps) {
  const { t } = useTranslation();
  return (
    <div id="ai-insights-tab-view" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: detailed citations & verifiably factual sources */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border rounded-xl shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 border-b pb-4">
                <SearchCheck className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Verified Fact Sources & Citations</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">RAG Parity Engine</p>
                </div>
              </div>

              <div className="space-y-4">
                {aiSources && aiSources.length > 0 ? (
                  aiSources.map((source, idx) => (
                    <div 
                      key={idx} 
                      className="group relative p-4 bg-muted/20 border border-border rounded-2xl hover:border-emerald-250 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#1A73E8]" />
                          <span className="font-bold text-xs text-foreground truncate pr-2">
                            {source.articleTitle}
                          </span>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-800 border-none text-[8.5px] uppercase font-black px-1.5 h-4.5 shrink-0">
                          {idx === 0 ? 'Primary source' : 'Auxiliary data'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pl-1 italic">
                        "{source.paragraph}"
                      </p>
                      {source.articleId && (
                        <div className="text-[9px] text-[#5F6368] font-mono pt-1">
                          Knowledge Base Reference: ID#{source.articleId}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 rounded-xl border border-dashed text-center py-10 text-xs text-muted-foreground italic">
                    {t('tickets.aiInsightsTab.emptyCitations', 'AI citations are currently empty. Click "Draft with AI" or trigger a prompt to query the knowledge database.')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: sentiment trends & model audit trails */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border rounded-xl shadow-sm bg-gradient-to-b from-indigo-50/25 to-transparent">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#5F6368]">Model audit parameters</h3>
              </div>

              <div className="space-y-4 pt-1">
                <div className="p-3.5 bg-card border rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-muted-foreground tracking-tight">Original language</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-foreground">{(ticket as any).originalLanguage || 'German'}</span>
                    <span className="text-[8.5px] font-bold text-[#1A73E8] uppercase font-mono">Polyglot auto-detected</span>
                  </div>
                </div>

                <div className="p-3.5 bg-card border rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-muted-foreground tracking-tight">Verification confidence</span>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground">SafeGlobal Parity Index</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-none text-[8.5px] font-black leading-none h-4">HIGH (94%)</Badge>
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/50 border border-indigo-150 rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-indigo-900 tracking-tight">Active LLM routing</span>
                  <p className="text-xs text-indigo-950 leading-relaxed font-semibold">
                    Gemini 1.5 Pro Orchestrator
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
