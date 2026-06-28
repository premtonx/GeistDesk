import { useState } from 'react';
import {
  Building2,
  ChevronRight,
  GitBranch,
  Lock,
  Shield,
  Ticket,
  Vault,
  ArrowLeftRight,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { useTranslation } from '../../lib/context/I18nContext';
import type { AiGovernanceGraphData, AiGovernanceNode } from '../../types/aiOrchestrator';

const MODULE_ICONS: Record<string, typeof Ticket> = {
  module_tickets: Ticket,
  module_vault: Vault,
  module_exchange: ArrowLeftRight,
};

interface AiGovernanceGraphProps {
  data: AiGovernanceGraphData;
}

function GovernanceNodeCard({
  node,
  onSelect,
  accent,
}: {
  node: AiGovernanceNode;
  onSelect: (node: AiGovernanceNode) => void;
  accent?: string;
}) {
  const { t } = useTranslation();
  const Icon = MODULE_ICONS[node.id] ?? (node.type === 'policy' ? Building2 : node.type === 'root' ? Shield : GitBranch);

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={`group text-left w-full rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${accent ?? ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {t(node.labelKey, node.id.replace(/_/g, ' '))}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{node.type}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0 mt-1" />
      </div>

      {node.restrictions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {node.restrictions.map((r) => (
            <Badge key={r} variant="outline" className="text-[9px] font-semibold border-slate-200">
              <Lock className="w-2.5 h-2.5 mr-0.5" />
              {r}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {node.safetyLayers.map((layer) => (
          <Badge key={layer} className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-100" variant="outline">
            {layer}
          </Badge>
        ))}
        {node.approvalGates.slice(0, 2).map((gate) => (
          <Badge key={gate} className="text-[9px] bg-amber-50 text-amber-800 border-amber-100" variant="outline">
            {gate}
          </Badge>
        ))}
      </div>
    </button>
  );
}

export function AiGovernanceGraph({ data }: AiGovernanceGraphProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AiGovernanceNode | null>(null);

  const root = data.nodes.find((n) => n.id === 'governance_root');
  const policy = data.nodes.find((n) => n.id === 'workspace_policy');
  const modules = data.nodes.filter((n) => n.type === 'module');

  return (
    <>
      <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" aria-hidden>
          <line x1="50%" y1="88" x2="50%" y2="128" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="50%" y1="200" x2="16.6%" y2="240" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="50%" y1="200" x2="50%" y2="240" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="50%" y1="200" x2="83.4%" y2="240" stroke="#94a3b8" strokeWidth="1.5" />
        </svg>

        <div className="relative flex flex-col items-center gap-6">
          {root && (
            <div className="w-full max-w-md">
              <GovernanceNodeCard node={root} onSelect={setSelected} accent="border-indigo-200 bg-indigo-50/30" />
            </div>
          )}

          {policy && (
            <div className="w-full max-w-lg">
              <GovernanceNodeCard node={policy} onSelect={setSelected} accent="border-violet-200" />
            </div>
          )}

          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <GovernanceNodeCard key={mod.id} node={mod} onSelect={setSelected} />
            ))}
          </div>
        </div>
      </div>

      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{t(selected.labelKey, selected.id)}</SheetTitle>
                <SheetDescription>
                  {t('aiOrchestrator.commandCenter.governance.panelSubtitle', 'Routing rules, prompts, and cost profile')}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-5">
                <section>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    {t('aiOrchestrator.commandCenter.governance.routingRules', 'Routing Rules')}
                  </h4>
                  <ul className="space-y-1.5">
                    {selected.detail.routingRules.map((rule) => (
                      <li key={rule} className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 font-mono text-xs">
                        {rule}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    {t('aiOrchestrator.commandCenter.governance.prompts', 'Active Prompts')}
                  </h4>
                  <ul className="space-y-1">
                    {selected.detail.promptSummaries.map((p) => (
                      <li key={p} className="text-sm text-slate-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    {t('aiOrchestrator.commandCenter.governance.costProfile', 'Cost Profile')}
                  </h4>
                  <p className="text-sm font-semibold text-slate-800">{selected.detail.costProfile}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selected.detail.models.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] font-mono">{m}</Badge>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
