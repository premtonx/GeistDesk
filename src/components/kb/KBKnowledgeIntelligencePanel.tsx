import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  GitBranch,
  Network,
  BookOpen,
  Ticket,
  Building2,
  Server,
  ClipboardList,
  UserPlus,
  GitPullRequest,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface KBKnowledgeIntelligencePanelProps {
  article: {
    title?: string;
    owner?: string;
    reviewer?: string;
    trustScore?: number;
    category?: string;
    linkedTicket?: string;
  };
  onAskAi: () => void;
  onTrustScoreUpdated?: (score: number) => void;
  onGenerateRunbook: () => void;
  onCreatePlaybook: () => void;
  onAssignReviewer: () => void;
  onOpenPullRequest: () => void;
}

const WORKFLOW_STEPS = [
  { id: 'owner', label: 'Owner', status: 'complete' as const },
  { id: 'reviewer', label: 'Reviewer', status: 'complete' as const },
  { id: 'security', label: 'Security', status: 'active' as const },
  { id: 'compliance', label: 'Compliance', status: 'pending' as const },
];

const GRAPH_NODES = [
  { id: 'article', label: 'Article', x: 50, y: 50, type: 'primary' },
  { id: 'ticket', label: 'TKT-184', x: 20, y: 25, type: 'ticket' },
  { id: 'customer', label: 'Acme Corp', x: 80, y: 22, type: 'customer' },
  { id: 'asset', label: 'Azure AD', x: 25, y: 78, type: 'asset' },
  { id: 'sop', label: 'SSO SOP', x: 75, y: 75, type: 'sop' },
];

const GRAPH_EDGES = [
  ['article', 'ticket'],
  ['article', 'customer'],
  ['article', 'asset'],
  ['article', 'sop'],
  ['ticket', 'customer'],
] as const;

export function KBKnowledgeIntelligencePanel({
  article,
  onAskAi,
  onGenerateRunbook,
  onCreatePlaybook,
  onAssignReviewer,
  onOpenPullRequest,
}: KBKnowledgeIntelligencePanelProps) {
  const trustScore = article.trustScore ?? 92;
  const trustLabel = trustScore >= 90 ? 'Excellent' : trustScore >= 75 ? 'Good' : 'Review';

  return (
    <div className="space-y-4">
      <PanelCard title="AI Summary" icon={Sparkles}>
        <ul className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-blue-600 font-bold shrink-0">•</span>
            <span><strong className="text-slate-800">Key Takeaways:</strong> Federated SSO via Azure AD requires mapped security groups and rotated client secrets every 90 days.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600 font-bold shrink-0">•</span>
            <span><strong className="text-slate-800">Dependencies:</strong> Azure AD tenant, GeistDesk RBAC module, and active MFA enforcement policy.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600 font-bold shrink-0">•</span>
            <span><strong className="text-slate-800">Permissions:</strong> Global Admin or Identity Administrator role required for initial connector setup.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600 font-bold shrink-0">•</span>
            <span><strong className="text-slate-800">Limitations:</strong> SCIM auto-provisioning is not supported for external guest tenants in this release.</span>
          </li>
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-3 h-8 rounded-xl text-[11px] font-semibold border-blue-200 text-blue-700 hover:bg-blue-50"
          onClick={onAskAi}
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Ask AI about this article
        </Button>
      </PanelCard>

      <PanelCard title="Infrastructure & Trust" icon={ShieldCheck}>
        <div className="space-y-2 text-[11px]">
          <ValidationRow label="Reviewed" />
          <ValidationRow label="Technically Verified" />
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Enterprise Trust Score</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">
            {trustScore}/100 <span className="text-sm font-medium text-emerald-600">({trustLabel})</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <MetricCell label="Hallucination Risk" value="Low" tone="emerald" />
          <MetricCell label="Coverage" value="97%" tone="blue" />
          <MetricCell label="Freshness" value="94%" tone="blue" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-3 mb-1.5">AI Quality Analytics</p>
      </PanelCard>

      <PanelCard title="Review Workflow" icon={GitBranch}>
        <div className="space-y-0">
          {WORKFLOW_STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 relative">
              {idx < WORKFLOW_STEPS.length - 1 ? (
                <span className="absolute left-[7px] top-5 w-px h-6 bg-slate-200" />
              ) : null}
              <span
                className={cn(
                  'w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10',
                  step.status === 'complete' && 'bg-emerald-500 border-emerald-500',
                  step.status === 'active' && 'bg-blue-600 border-blue-600',
                  step.status === 'pending' && 'bg-white border-slate-300',
                )}
              />
              <span className={cn(
                'text-[11px] py-2',
                step.status === 'active' ? 'font-semibold text-slate-900' : 'text-slate-600',
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard title="Knowledge Graph" icon={Network}>
        <div className="relative h-[140px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            {GRAPH_EDGES.map(([from, to]) => {
              const a = GRAPH_NODES.find((n) => n.id === from)!;
              const b = GRAPH_NODES.find((n) => n.id === to)!;
              return (
                <line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#CBD5E1"
                  strokeWidth="0.8"
                />
              );
            })}
            {GRAPH_NODES.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.type === 'primary' ? 6 : 4.5}
                  fill={node.type === 'primary' ? '#2563EB' : '#94A3B8'}
                />
                <text
                  x={node.x}
                  y={node.y + (node.type === 'primary' ? 12 : 10)}
                  textAnchor="middle"
                  fontSize="4"
                  fill="#475569"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <GraphLegend icon={BookOpen} label="Article" />
          <GraphLegend icon={Ticket} label="Ticket" />
          <GraphLegend icon={Building2} label="Customer" />
          <GraphLegend icon={Server} label="Asset" />
        </div>
      </PanelCard>

      <PanelCard title="Smart Actions" icon={ClipboardList}>
        <div className="grid grid-cols-1 gap-1.5">
          <ActionButton label="Generate Runbook" onClick={onGenerateRunbook} />
          <ActionButton label="Create Incident Playbook" onClick={onCreatePlaybook} />
          <ActionButton label="Assign Reviewer" onClick={onAssignReviewer} icon={UserPlus} />
          <ActionButton label="Open Pull Request" onClick={onOpenPullRequest} icon={GitPullRequest} />
        </div>
      </PanelCard>
    </div>
  );
}

function PanelCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-blue-600" />
        <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ValidationRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-700">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      <span>{label}</span>
    </div>
  );
}

function MetricCell({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'blue' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center">
      <p className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={cn('text-xs font-semibold mt-0.5', tone === 'emerald' ? 'text-emerald-600' : 'text-blue-700')}>
        {value}
      </p>
    </div>
  );
}

function GraphLegend({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon?: typeof ClipboardList;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 justify-start rounded-xl text-[11px] font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
      onClick={onClick}
    >
      {Icon ? <Icon className="w-3.5 h-3.5 mr-2 text-slate-500" /> : null}
      {label}
    </Button>
  );
}
