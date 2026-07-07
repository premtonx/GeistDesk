import { useMemo } from 'react';
import { BookOpen, Building2, Network, Server, Ticket, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { KBRelationship } from '../../services/kbRelationshipService';

interface KBKnowledgeGraphModalProps {
  open: boolean;
  onClose: () => void;
  articleTitle: string;
  relationships: KBRelationship[];
}

type GraphNode = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
};

const TYPE_COLORS: Record<string, string> = {
  Article: '#2563EB',
  SOP: '#7C3AED',
  System: '#0D9488',
  Team: '#EA580C',
  Integration: '#DB2777',
  Vendor: '#4F46E5',
  Ticket: '#DC2626',
};

export function KBKnowledgeGraphModal({
  open,
  onClose,
  articleTitle,
  relationships,
}: KBKnowledgeGraphModalProps) {
  const { nodes, edges } = useMemo(() => {
    const titleKey = articleTitle.toLowerCase();
    const relevant = relationships.filter(
      (rel) =>
        rel.sourceName.toLowerCase().includes(titleKey) ||
        rel.targetName.toLowerCase().includes(titleKey) ||
        titleKey.includes(rel.sourceName.toLowerCase()) ||
        titleKey.includes(rel.targetName.toLowerCase()),
    );

    const nodeMap = new Map<string, GraphNode>();
    const addNode = (name: string, type: string) => {
      const id = `${type}:${name}`;
      if (!nodeMap.has(id)) {
        const index = nodeMap.size;
        const angle = (index / Math.max(6, relevant.length + 1)) * Math.PI * 2;
        const radius = name === articleTitle ? 0 : 34;
        nodeMap.set(id, {
          id,
          label: name,
          type,
          x: 50 + Math.cos(angle) * radius,
          y: 50 + Math.sin(angle) * radius,
        });
      }
    };

    addNode(articleTitle, 'Article');
    for (const rel of relevant) {
      addNode(rel.sourceName, rel.sourceType);
      addNode(rel.targetName, rel.targetType);
    }

    const nodes = Array.from(nodeMap.values());
    const center = nodes.find((n) => n.label === articleTitle);
    if (center) {
      center.x = 50;
      center.y = 50;
    }

    const edges = relevant.map((rel) => ({
      id: rel.id,
      from: `${rel.sourceType}:${rel.sourceName}`,
      to: `${rel.targetType}:${rel.targetName}`,
      label: rel.type.replace(/_/g, ' '),
    }));

    return { nodes, edges };
  }, [articleTitle, relationships]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Network className="w-4 h-4 text-blue-600" />
                Knowledge Graph
              </DialogTitle>
              <DialogDescription>
                Interactive relationship map for &ldquo;{articleTitle}&rdquo;
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              aria-label="Close knowledge graph"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-slate-50 p-6">
          <div className="h-full rounded-2xl border border-slate-200 bg-white shadow-inner overflow-hidden">
            <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Knowledge graph">
              {edges.map((edge) => {
                const from = nodes.find((n) => n.id === edge.from);
                const to = nodes.find((n) => n.id === edge.to);
                if (!from || !to) return null;
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                return (
                  <g key={edge.id}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#CBD5E1" strokeWidth="0.5" />
                    <text x={mx} y={my} fontSize="2.2" fill="#64748B" textAnchor="middle">
                      {edge.label}
                    </text>
                  </g>
                );
              })}
              {nodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.label === articleTitle ? 5.5 : 4.2}
                    fill={TYPE_COLORS[node.type] || '#94A3B8'}
                  />
                  <text
                    x={node.x}
                    y={node.y + (node.label === articleTitle ? 9 : 8)}
                    textAnchor="middle"
                    fontSize="3.2"
                    fill="#334155"
                  >
                    {node.label.length > 28 ? `${node.label.slice(0, 25)}…` : node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="px-6 py-3 border-t bg-white flex flex-wrap gap-3 text-[10px] text-slate-500 shrink-0">
          <Legend icon={BookOpen} label="Article" />
          <Legend icon={Ticket} label="Ticket" />
          <Legend icon={Building2} label="Customer / Team" />
          <Legend icon={Server} label="System / Asset" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Legend({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
