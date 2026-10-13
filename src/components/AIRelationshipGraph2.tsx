import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import * as d3 from 'd3';
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  Sparkles, 
  Maximize2, 
  X, 
  BookOpen, 
  ClipboardList, 
  Server, 
  Users, 
  Link2, 
  Building, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight,
  TrendingUp,
  Info,
  Trash2
} from 'lucide-react';
import { 
  kbRelationshipService, 
  KBRelationship, 
  NodeType, 
  RelationshipType 
} from '../services/kbRelationshipService';
import { KBArticle } from '../types';
import { toast } from 'sonner';

// Color map for node types
export const NODE_COLORS: Record<NodeType, { bg: string; text: string; border: string; bullet: string }> = {
  Article: { bg: 'bg-blue-550', text: 'text-white', border: 'border-blue-700', bullet: '#3B82F6' },
  SOP: { bg: 'bg-emerald-550', text: 'text-white', border: 'border-emerald-700', bullet: '#10B981' },
  System: { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-900', bullet: '#475569' },
  Team: { bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-800', bullet: '#7C3AED' },
  Integration: { bg: 'bg-amber-500', text: 'text-slate-900', border: 'border-amber-600', bullet: '#F59E0B' },
  Vendor: { bg: 'bg-orange-550', text: 'text-white', border: 'border-orange-700', bullet: '#F97316' },
  Ticket: { bg: 'bg-rose-550', text: 'text-white', border: 'border-rose-700', bullet: '#EF4444' }
};

export const RELATION_LABELS: Record<RelationshipType, string> = {
  depends_on: 'Depends On',
  related_to: 'Related To',
  causes: 'Causes Fault',
  solves: 'Solves',
  references: 'References',
  owned_by: 'Owned By',
  used_by: 'Used By'
};

interface GraphNode extends d3.SimulationNodeDatum {
  id: string; // name
  name: string;
  type: NodeType;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<any> {
  id: string;
  source: any;
  target: any;
  type: RelationshipType;
  confidence: number;
}

interface AIRelationshipGraph2Props {
  currentArticle?: KBArticle | null;
  onSelectArticle?: (articleTitle: string) => void;
  miniMode?: boolean;
}

export function AIRelationshipGraph2({ currentArticle, onSelectArticle, miniMode = false }: AIRelationshipGraph2Props) {
  const [relationships, setRelationships] = useState<KBRelationship[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Graph visual interaction states
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  // Filter settings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Record<NodeType, boolean>>({
    Article: true,
    SOP: true,
    System: true,
    Team: true,
    Integration: true,
    Vendor: true,
    Ticket: true
  });
  const [selectedRelations, setSelectedRelations] = useState<Record<RelationshipType, boolean>>({
    depends_on: true,
    related_to: true,
    causes: true,
    solves: true,
    references: true,
    owned_by: true,
    used_by: true
  });

  // Impact Analysis state query
  const [impactQuery, setImpactQuery] = useState('');
  const [activeImpactAnalysis, setActiveImpactAnalysis] = useState<string | null>(null);

  // Manual relationship creation form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [newSourceType, setNewSourceType] = useState<NodeType>('System');
  const [newTarget, setNewTarget] = useState('');
  const [newTargetType, setNewTargetType] = useState<NodeType>('System');
  const [newRelType, setNewRelType] = useState<RelationshipType>('depends_on');

  // Multi-article auto AI extraction
  const [selectedArticleToExtract, setSelectedArticleToExtract] = useState<string>('');

  // Sizing ref
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 480 });
  
  // Setup subscription
  useEffect(() => {
    const unsub = kbRelationshipService.subscribeToRelationships((data) => {
      setRelationships(data);
    });
    return () => unsub();
  }, []);

  // Update starting defaults for form when current article changes
  useEffect(() => {
    if (currentArticle) {
      setNewSource(currentArticle.title);
      setNewSourceType('Article');
      setImpactQuery(currentArticle.title);
    }
  }, [currentArticle]);

  // Handle container resize when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (svgRef.current) {
          const bbox = svgRef.current.parentElement?.getBoundingClientRect();
          setDimensions({
            width: (bbox?.width || 700) - 20,
            height: (bbox?.height || 480) - 10
          });
        }
      }, 250);
    }
  }, [isOpen]);

  // Compute unique Nodes from relationships list
  const allNodes = useMemo(() => {
    const nodesMap = new Map<string, NodeType>();
    relationships.forEach(rel => {
      nodesMap.set(rel.sourceName, rel.sourceType);
      nodesMap.set(rel.targetName, rel.targetType);
    });

    const list: { id: string; name: string; type: NodeType }[] = [];
    nodesMap.forEach((type, name) => {
      list.push({ id: name, name, type });
    });
    return list;
  }, [relationships]);

  // Filter links and nodes based on checkbox filters & search
  const filteredLinksData = useMemo(() => {
    return relationships.filter(rel => {
      const sourceMatch = selectedTypes[rel.sourceType];
      const targetMatch = selectedTypes[rel.targetType];
      const relationMatch = selectedRelations[rel.type];
      
      const searchMatch = searchQuery === '' || 
        rel.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rel.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rel.type.toLowerCase().includes(searchQuery.toLowerCase());

      return sourceMatch && targetMatch && relationMatch && searchMatch;
    });
  }, [relationships, selectedTypes, selectedRelations, searchQuery]);

  // Nodes included after filtering links
  const filteredNodesData = useMemo(() => {
    const activeNodesSet = new Set<string>();
    filteredLinksData.forEach(l => {
      activeNodesSet.add(l.sourceName);
      activeNodesSet.add(l.targetName);
    });

    // If search is active, also add node that directly matches search even if no links match
    if (searchQuery !== '') {
      allNodes.forEach(node => {
        if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          activeNodesSet.add(node.name);
        }
      });
    }

    return allNodes.filter(n => activeNodesSet.has(n.name));
  }, [allNodes, filteredLinksData, searchQuery]);

  // BFS Traversal for Realtime Impact Analysis (2 hops)
  const impactedNodesSet = useMemo(() => {
    if (!activeImpactAnalysis) return new Set<string>();
    
    const set = new Set<string>();
    const queue: string[] = [activeImpactAnalysis];
    set.add(activeImpactAnalysis);

    for (let hop = 0; hop < 2; hop++) {
      const levelSize = queue.length;
      if (levelSize === 0) break;
      
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift()!;
        
        relationships.forEach(rel => {
          let neighbor: string | null = null;
          if (rel.sourceName.toLowerCase() === current.toLowerCase()) {
            neighbor = rel.targetName;
          } else if (rel.targetName.toLowerCase() === current.toLowerCase()) {
            neighbor = rel.sourceName;
          }
          
          if (neighbor && !set.has(neighbor)) {
            set.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
    return set;
  }, [activeImpactAnalysis, relationships]);

  // Split impacted nodes lists for visual display panel
  const impactSummaryLists = useMemo(() => {
    const sops: string[] = [];
    const articles: string[] = [];
    const teams: string[] = [];
    const integrations: string[] = [];
    const vendors: string[] = [];
    const tickets: string[] = [];
    const systems: string[] = [];

    impactedNodesSet.forEach(nodeName => {
      if (nodeName.toLowerCase() === activeImpactAnalysis?.toLowerCase()) return; // skip starting trigger node

      // Find node type
      const node = allNodes.find(n => n.name === nodeName);
      if (!node) return;

      if (node.type === 'SOP') sops.push(nodeName);
      else if (node.type === 'Article') articles.push(nodeName);
      else if (node.type === 'Team') teams.push(nodeName);
      else if (node.type === 'Integration') integrations.push(nodeName);
      else if (node.type === 'Vendor') vendors.push(nodeName);
      else if (node.type === 'Ticket') tickets.push(nodeName);
      else if (node.type === 'System') systems.push(nodeName);
    });

    return { sops, articles, teams, integrations, vendors, tickets, systems };
  }, [impactedNodesSet, allNodes, activeImpactAnalysis]);

  // Run SVG Force physics simulation
  const [nodesState, setNodesState] = useState<GraphNode[]>([]);
  const [linksState, setLinksState] = useState<GraphLink[]>([]);

  useEffect(() => {
    if (filteredNodesData.length === 0) {
      setNodesState([]);
      setLinksState([]);
      return;
    }

    // Map source and target ids back
    const simNodes: GraphNode[] = filteredNodesData.map(node => ({ ...node }));
    const simLinks: GraphLink[] = filteredLinksData.map((rel, idx) => ({
      id: rel.id,
      source: rel.sourceName,
      target: rel.targetName,
      type: rel.type,
      confidence: rel.confidence || 0.85
    }));

    const sim = d3.forceSimulation<GraphNode>(simNodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simLinks).id(d => d.id).distance(280))
      .force("charge", d3.forceManyBody().strength(-1200))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", d3.forceCollide().radius(100));

    sim.on("tick", () => {
      setNodesState([...simNodes]);
      setLinksState([...simLinks]);
    });

    // Let physics settle fully
    for (let i = 0; i < 150; i++) sim.tick();

    return () => {
      sim.stop();
    };
  }, [filteredNodesData, filteredLinksData, dimensions.width, dimensions.height]);

  // Background drag to pan listeners
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName?.toLowerCase() === 'svg' || target.id === 'graph-bg') {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Node Drag physics setup
  const handleNodeDragStart = (e: ReactMouseEvent, node: GraphNode) => {
    e.stopPropagation();
    // Anchor node
    node.fx = node.x;
    node.fy = node.y;
    
    const onNodeDragMove = (moveEvent: globalThis.MouseEvent) => {
      const zoom = zoomScale;
      // account for translation and scaling
      node.fx = (moveEvent.clientX - panOffset.x - d3.select(svgRef.current).node()!.getBoundingClientRect().left) / zoom;
      node.fy = (moveEvent.clientY - panOffset.y - d3.select(svgRef.current).node()!.getBoundingClientRect().top) / zoom;
      setNodesState([...nodesState]);
    };

    const onNodeDragEnd = () => {
      node.fx = null;
      node.fy = null;
      window.removeEventListener('mousemove', onNodeDragMove);
      window.removeEventListener('mouseup', onNodeDragEnd);
    };

    window.addEventListener('mousemove', onNodeDragMove);
    window.addEventListener('mouseup', onNodeDragEnd);
  };

  // AI discovery action trigger
  const handleAIMineRelationships = async () => {
    const titleToUse = currentArticle?.title;
    const contentToUse = currentArticle?.content;

    if (!titleToUse || !contentToUse) {
      toast.error("Please select or open an article first in the main editor panel.");
      return;
    }

    setLoading(true);
    toast.loading("Analyzing article content with Gemini 3.5 Pro to extract relations...", { id: 'ai-ext' });
    
    try {
      const extracted = await kbRelationshipService.extractRelationshipsFromAI(
        titleToUse,
        contentToUse,
        currentArticle.id
      );

      if (extracted.length === 0) {
        toast.dismiss('ai-ext');
        toast.info("AI analyzed the article but found no new explicit system/team relationships.");
        setLoading(false);
        return;
      }

      let addedCount = 0;
      for (const rel of extracted) {
        // Avoid adding duplicate identical relations
        const dup = relationships.find(r => 
          r.sourceName.toLowerCase() === rel.sourceName.toLowerCase() && 
          r.targetName.toLowerCase() === rel.targetName.toLowerCase() &&
          r.type === rel.type
        );
        if (!dup) {
          await kbRelationshipService.addRelationship(rel);
          addedCount++;
        }
      }

      toast.dismiss('ai-ext');
      toast.success(`Gemini extracted ${extracted.length} relationships! ${addedCount} brand-new dependencies added to the graph continuously.`);
      
      // Auto-focus the node that we analyzed
      setActiveImpactAnalysis(titleToUse);
      setImpactQuery(titleToUse);
    } catch (e: any) {
      toast.dismiss('ai-ext');
      toast.error(`Auto-Discovery failed: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual Creation
  const handleAddNewRelationship = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSource.trim() || !newTarget.trim()) {
      toast.error("Source and Target nodes must have non-empty names.");
      return;
    }

    try {
      await kbRelationshipService.addRelationship({
        sourceName: newSource.trim(),
        sourceType: newSourceType,
        targetName: newTarget.trim(),
        targetType: newTargetType,
        type: newRelType,
        confidence: 1.0,
        detectedBy: 'Manual'
      });
      toast.success("Relationship logged and mapped in real time.");
      setShowAddForm(false);
      setNewTarget('');
    } catch (err) {
      toast.error("Failed to add relationship.");
    }
  };

  // Delete relationship line
  const handleDeleteRel = async (id: string) => {
    try {
      await kbRelationshipService.deleteRelationship(id);
      toast.message("Dependency link dissociated.");
    } catch (e) {
      toast.error("Failed to dissociate relationship.");
    }
  };

  const nodeIcon = (type: NodeType) => {
    switch (type) {
      case 'Article': return <BookOpen className="w-3.5 h-3.5" />;
      case 'SOP': return <ClipboardList className="w-3.5 h-3.5" />;
      case 'System': return <Server className="w-3.5 h-3.5" />;
      case 'Team': return <Users className="w-3.5 h-3.5" />;
      case 'Integration': return <Link2 className="w-3.5 h-3.5" />;
      case 'Vendor': return <Building className="w-3.5 h-3.5" />;
      case 'Ticket': return <AlertCircle className="w-3.5 h-3.5" />;
      default: return <HelpCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <>
      {/* 1. SIDEBAR COMPACT WIDGET (MINI MODE OR COMPACT VIEW) */}
      {miniMode ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3 shadow-2xs hover:shadow-xs transition-all duration-300">
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-150">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 leading-none">
              <Network className="w-4 h-4 text-indigo-650" /> AI Relationship Graph 2.0
            </h4>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Active</span>
            </div>
          </div>

          <div 
            onClick={() => setIsOpen(true)}
            className="h-[140px] bg-white border border-slate-200 rounded-xl relative cursor-pointer hover:border-indigo-350 overflow-hidden flex items-center justify-center transition-all group"
          >
            {/* Display static schematic render of nodes */}
            <div className="absolute inset-0 opacity-10 bg-grid-slate-200" />
            
            <svg className="w-full h-full p-2.5" viewBox="0 0 200 130">
              {/* Fake aesthetic lines */}
              <line x1="100" y1="65" x2="45" y2="35" stroke="#E2E8F0" strokeWidth="1.5" />
              <line x1="100" y1="65" x2="155" y2="35" stroke="#E2E8F0" strokeWidth="1.5" />
              <line x1="100" y1="65" x2="55" y2="95" stroke="#E2E8F0" strokeWidth="1.5" />
              <line x1="100" y1="65" x2="145" y2="95" stroke="#E2E8F0" strokeWidth="1.5" />

              <circle cx="100" cy="65" r="13" fill="#6366F1" className="opacity-90" />
              <text x="100" y="68" textAnchor="middle" fill="white" className="text-[5.5px] font-extrabold uppercase pointer-events-none">MFA AD</text>

              <circle cx="45" cy="35" r="10" fill="#10B981" />
              <text x="45" y="38" textAnchor="middle" fill="white" className="text-[4.5px] font-semibold pointer-events-none">SOP-22</text>

              <circle cx="155" cy="35" r="10" fill="#475569" />
              <text x="155" y="38" textAnchor="middle" fill="white" className="text-[4.5px] font-semibold pointer-events-none">SSO</text>

              <circle cx="55" cy="95" r="10" fill="#F59E0B" />
              <text x="55" y="98" textAnchor="middle" fill="white" className="text-[4px] font-semibold pointer-events-none">Slack</text>

              <circle cx="145" cy="95" r="10" fill="#EF4444" />
              <text x="145" y="98" textAnchor="middle" fill="white" className="text-[4.5px] font-semibold pointer-events-none">Ticket</text>
            </svg>

            {/* Hover overlay button to zoom in */}
            <div className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
              <span className="bg-white text-slate-800 text-[10.5px] font-black uppercase px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-md">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-500" /> Expand Graph 2.0
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button 
              onClick={() => setIsOpen(true)}
              className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 h-8 rounded-lg text-[10px] font-extrabold uppercase transition-all shadow-3xs flex items-center justify-center gap-1.5 text-slate-700"
            >
              <Network className="w-3 h-3 text-indigo-500" /> Live Explorer
            </button>
            {currentArticle && (
              <button 
                onClick={handleAIMineRelationships}
                disabled={loading}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 h-8 rounded-lg text-[10px] font-extrabold uppercase transition-all flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-indigo-600" /> extract AI
              </button>
            )}
          </div>
          {currentArticle && (
            <p className="text-[9.5px] text-slate-400 text-center font-bold">
              Analyze <span className="text-slate-700">"{currentArticle.title}"</span> for model linkages
            </p>
          )}
        </div>
      ) : (
        /* STANDARD RENDER: DIRECTLY INTEGRATED LIST */
        <div className="space-y-4">
          {/* We do not render the full graph on the main page standard body, instead we have the beautiful full-screen explore view triggers */}
        </div>
      )}

      {/* 2. FULLSCREEN DIALOG EXPLORER MODULE */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl h-full w-full max-w-7xl flex flex-col border border-slate-200 animate-in fade-in-50 zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header section with branding & core triggers */}
            <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                  <Network className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Enterprise Knowledge Graph 2.0 <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">AI Orchestrated</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-bold">Continuous visual relationship mapping, impact analysis, and knowledge discovery.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {currentArticle && (
                  <button 
                    onClick={handleAIMineRelationships}
                    disabled={loading}
                    className="bg-indigo-650 hover:bg-indigo-800 text-white h-10 px-4 rounded-xl text-xs font-bold gap-2 shadow-sm flex items-center transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI Discovery on Selected</span>
                  </button>
                )}
                
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-white hover:bg-slate-55 shadow-xs border h-10 px-4 rounded-xl text-xs font-bold gap-1.5 flex items-center transition-all text-slate-700"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  <span>Manual Link</span>
                </button>

                <button 
                  onClick={() => {
                    setZoomScale(1);
                    setPanOffset({ x: 0, y: 0 });
                    setSelectedNode(null);
                    setActiveImpactAnalysis(null);
                    setSearchQuery('');
                  }}
                  title="Reset graph canvas"
                  className="p-2 bg-white hover:bg-slate-55 border rounded-xl text-slate-500 hover:text-slate-800 h-10 w-10 flex items-center justify-center transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl h-10 w-10 flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main content grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-full">
              
              {/* Left filter bar & Search (3-cols) */}
              <div className="lg:col-span-3 border-r border-slate-200 bg-slate-50/50 p-5 space-y-5 overflow-y-auto">
                
                {/* Search */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Nodes & Connections</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Type component to highlight..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9.5 pr-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Real-time Impact Analysis Traversal (Ask VPN etc) */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-905">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[11.5px] font-black uppercase tracking-tight">Traversal & Impact Analysis</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-normal font-medium">Identify impacted dependencies in real-time. Type a starting node (e.g. "VPN") to traverse the graph.</p>
                  
                  <div className="space-y-1.5">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="What documentation is impacted if..."
                        value={impactQuery}
                        onChange={(e) => setImpactQuery(e.target.value)}
                        className="w-full bg-white border border-amber-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (impactQuery.trim() === '') {
                            toast.warning("Specify a starting node to run impact analysis.");
                            return;
                          }
                          // Try to matches cases or let BFS handle it
                          setActiveImpactAnalysis(impactQuery.trim());
                        }}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white h-7.5 rounded-lg text-[10.5px] font-extrabold uppercase transition-all flex items-center justify-center gap-1"
                      >
                        Run Query
                      </button>
                      {activeImpactAnalysis && (
                        <button 
                          onClick={() => {
                            setActiveImpactAnalysis(null);
                            setImpactQuery('');
                          }}
                          className="bg-white hover:bg-slate-50 border border-amber-200 text-slate-700 h-7.5 px-2.5 rounded-lg text-[10px] font-bold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {activeImpactAnalysis && (
                    <div className="text-[10px] text-amber-700 space-y-0.5 pt-1.5 border-t border-amber-200">
                      <p className="font-extrabold uppercase tracking-tight">Analyzing start point:</p>
                      <p className="font-bold underline text-slate-800 truncate">"{activeImpactAnalysis}"</p>
                      <p className="font-semibold text-[9.5px] text-amber-600 mt-1">Found {impactedNodesSet.size - 1} direct/indirect affected entity nodes inside 2-hop radius.</p>
                    </div>
                  )}
                </div>

                {/* Filter Node Types */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Filter className="w-3 h-3" /> Filter Node Types</label>
                    <button 
                      onClick={() => {
                        const allOn = Object.values(selectedTypes).every(v => v);
                        setSelectedTypes({
                          Article: !allOn, SOP: !allOn, System: !allOn, Team: !allOn, Integration: !allOn, Vendor: !allOn, Ticket: !allOn
                        });
                      }}
                      className="text-[9.5px] font-extrabold text-indigo-650 uppercase"
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="space-y-1 bg-white p-3 rounded-2xl border">
                    {(Object.keys(selectedTypes) as NodeType[]).map(type => (
                      <label key={type} className="flex items-center gap-2.5 px-1 py-0.5 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-md">
                        <input 
                          type="checkbox" 
                          checked={selectedTypes[type]}
                          onChange={(e) => setSelectedTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                          className="rounded text-indigo-650 focus:ring-indigo-505 border-slate-300 w-3.5 h-3.5"
                        />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_COLORS[type].bullet }} />
                        <span className="flex-1 text-slate-650">{type}s</span>
                        <span className="text-[9px] text-slate-400 font-extrabold bg-slate-100 px-1.5 py-0.2 rounded-md">
                          {allNodes.filter(n => n.type === type).length}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filter Relationship Types */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Filter className="w-3 h-3" /> Filter Relationships</label>
                    <button 
                      onClick={() => {
                        const allOn = Object.values(selectedRelations).every(v => v);
                        setSelectedRelations({
                          depends_on: !allOn, related_to: !allOn, causes: !allOn, solves: !allOn, references: !allOn, owned_by: !allOn, used_by: !allOn
                        });
                      }}
                      className="text-[9.5px] font-extrabold text-indigo-650 uppercase"
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="space-y-1 bg-white p-3 rounded-2xl border">
                    {(Object.keys(selectedRelations) as RelationshipType[]).map(rel => (
                      <label key={rel} className="flex items-center gap-2.5 px-1 py-0.5 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-md">
                        <input 
                          type="checkbox" 
                          checked={selectedRelations[rel]}
                          onChange={(e) => setSelectedRelations(prev => ({ ...prev, [rel]: e.target.checked }))}
                          className="rounded text-indigo-650 focus:ring-indigo-505 border-slate-300 w-3.5 h-3.5"
                        />
                        <span className="text-slate-650">{RELATION_LABELS[rel]}</span>
                        <span className="text-[9px] text-slate-400 font-extrabold bg-slate-105 px-1.5 py-0.2 rounded-md">
                          {relationships.filter(r => r.type === rel).length}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>

              {/* Central Graph Canvas (6-cols) */}
              <div className="lg:col-span-6 border-r border-slate-200 relative flex flex-col h-full bg-slate-50/30">
                
                {/* Visual Canvas Panel */}
                <div 
                  className="flex-1 w-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-xs px-3 py-2.5 rounded-2xl border shadow-2xs text-xs space-y-1 border-slate-200/80">
                    <p className="font-extrabold uppercase text-[9.5px] tracking-wide text-indigo-600">Canvas Navigation</p>
                    <p className="text-[10.5px] text-slate-400 font-semibold">• Drag background to Pan</p>
                    <p className="text-[10.5px] text-slate-400 font-semibold">• Drag circle nodes to Pin positions</p>
                    <p className="text-[10.5px] text-slate-400 font-semibold">• Use sidebar query to inspect impact</p>
                  </div>

                  {/* Zoom controls float button */}
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
                    <button 
                      onClick={() => setZoomScale(z => Math.min(z + 0.1, 2.5))}
                      className="w-8 h-8 rounded-lg bg-white border hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-3xs transition-all"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setZoomScale(z => Math.max(z - 0.1, 0.4))}
                      className="w-8 h-8 rounded-lg bg-white border hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-3xs transition-all"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setZoomScale(1);
                        setPanOffset({ x: 0, y: 0 });
                      }}
                      className="w-8 h-8 rounded-lg bg-white border hover:bg-slate-50 text-slate-600 flex-col items-center justify-center shadow-3xs transition-all text-[8px] font-extrabold leading-none flex"
                    >
                      1:1
                    </button>
                  </div>

                  {/* Canvas SVG render */}
                  <svg 
                    ref={svgRef}
                    className="w-full h-full bg-slate-50/20"
                    id="graph-bg"
                  >
                    <defs>
                      <marker id="arrow-standard" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
                      </marker>
                      <marker id="arrow-depends" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366F1" />
                      </marker>
                      <marker id="arrow-causes" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
                      </marker>
                      <marker id="arrow-solves" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
                      </marker>
                    </defs>

                    <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomScale})`}>
                      {/* 1. DRAW EDGES / LINKS LINES */}
                      {linksState.map((link) => {
                        const sourceNode = typeof link.source === 'object' ? link.source : null;
                        const targetNode = typeof link.target === 'object' ? link.target : null;

                        if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) {
                          return null;
                        }

                        const isHighlighted = searchQuery !== '' && (
                          sourceNode.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          targetNode.name.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        // Color of line depends on type
                        let strokeColor = '#94A3B8';
                        let marker = 'url(#arrow-standard)';
                        let styleDash: string | undefined = undefined;

                        if (link.type === 'depends_on') {
                          strokeColor = '#6366F1';
                          marker = 'url(#arrow-depends)';
                        } else if (link.type === 'causes') {
                          strokeColor = '#EF4444';
                          marker = 'url(#arrow-causes)';
                        } else if (link.type === 'solves') {
                          strokeColor = '#10B981';
                          marker = 'url(#arrow-solves)';
                        } else if (link.type === 'related_to') {
                          strokeColor = '#475569';
                          styleDash = '4,4';
                        } else if (link.type === 'references') {
                          strokeColor = '#94A3B8';
                          styleDash = '1,3';
                        } else if (link.type === 'owned_by') {
                          strokeColor = '#7C3AED';
                        } else if (link.type === 'used_by') {
                          strokeColor = '#3B82F6';
                        }

                        // Gold line if part of highlighted Active Impact analysis paths
                        const isImpactPath = activeImpactAnalysis && (
                          impactedNodesSet.has(sourceNode.name) && 
                          impactedNodesSet.has(targetNode.name)
                        );

                        if (isImpactPath) {
                          strokeColor = '#D97706';
                        }

                        return (
                          <g key={link.id} className="transition-all">
                            <line
                              x1={sourceNode.x}
                              y1={sourceNode.y}
                              x2={targetNode.x}
                              y2={targetNode.y}
                              stroke={strokeColor}
                              strokeWidth={isImpactPath ? "3" : isHighlighted ? "2" : "1.5"}
                              strokeDasharray={styleDash}
                              markerEnd={marker}
                              opacity={activeImpactAnalysis ? (isImpactPath ? 0.95 : 0.2) : 0.75}
                            />
                            {/* Small text tag on relation line */}
                            {zoomScale >= 0.85 && (
                              <text
                                x={((sourceNode.x || 0) + (targetNode.x || 0)) / 2}
                                y={((sourceNode.y || 0) + (targetNode.y || 0)) / 2 - 4}
                                textAnchor="middle"
                                fill={isImpactPath ? '#D97706' : '#64748B'}
                                className="text-[6.5px] font-extrabold tracking-tight"
                                opacity={activeImpactAnalysis ? (isImpactPath ? 0.9 : 0.1) : 0.7}
                              >
                                {RELATION_LABELS[link.type]}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* 2. DRAW NODE CIRCLES */}
                      {nodesState.map((node) => {
                        if (node.x === undefined || node.y === undefined) return null;

                        const isImpacted = activeImpactAnalysis && impactedNodesSet.has(node.name);
                        const isSearchFocused = searchQuery !== '' && node.name.toLowerCase().includes(searchQuery.toLowerCase());
                        const isSelected = selectedNode === node.name;

                        // Is this the starting query point for Impact?
                        const isImpactRoot = activeImpactAnalysis && node.name.toLowerCase() === activeImpactAnalysis.toLowerCase();

                        // Node style settings
                        const colorSettings = NODE_COLORS[node.type];
                        const r = 18;

                        return (
                          <g 
                            key={node.id} 
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNode(node.name);
                              setImpactQuery(node.name);
                            }}
                            onDoubleClick={(e) => {
                              // Deep trigger callback
                              if (node.type === 'Article' && onSelectArticle) {
                                onSelectArticle(node.name);
                                toast.info(`Navigated document view to model: "${node.name}"`);
                              }
                            }}
                            onMouseDown={(e) => handleNodeDragStart(e, node)}
                            className="cursor-pointer group select-none transition-transform active:scale-95"
                            opacity={activeImpactAnalysis ? (isImpacted ? 1.0 : 0.25) : 1.0}
                          >
                            {/* Gold outer pulse ring if node is in active impact path */}
                            {isImpacted && (
                              <circle 
                                r={r + 6} 
                                fill="none"
                                stroke={isImpactRoot ? "#B45309" : "#F59E0B"}
                                strokeWidth="2.5"
                                className={isImpactRoot ? "animate-pulse" : ""}
                                opacity="0.65"
                              />
                            )}

                            {/* Standard black filter trigger border or normal background */}
                            <circle 
                              r={r} 
                              fill={isSearchFocused ? '#D97706' : (node.type === 'System' ? '#1E293B' : colorSettings.bullet)}
                              className="shadow-md transition-all group-hover:scale-110"
                              stroke={isSearchFocused ? '#FEF3C7' : '#FFFFFF'}
                              strokeWidth={isSelected ? "3" : "1.8"}
                            />

                            {/* Node Type Icon */}
                            <g fill="white" stroke="white" transform="translate(-7, -7)" className="pointer-events-none">
                              {node.type === 'Article' && <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                              {node.type === 'SOP' && <path d="M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                              {node.type === 'System' && <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                              {node.type === 'Team' && <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 8H9 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                              {node.type === 'Integration' && <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                              {node.type === 'Vendor' && <path d="M3 21h18 M9 21V9a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v12l2-3" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                              {node.type === 'Ticket' && <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" />}
                            </g>

                            {/* Node text label */}
                            <text
                              y={r + 14}
                              textAnchor="middle"
                              fill="#0F172A"
                              className="text-[8.5px] font-black transition-all group-hover:scale-105 select-none pointer-events-none drop-shadow-xs bg-white/80"
                            >
                              {node.name.length > 20 ? `${node.name.substring(0, 18)}...` : node.name}
                            </text>
                            
                            {/* Tiny node subtag */}
                            <text
                              y={r + 21}
                              textAnchor="middle"
                              fill="#64748B"
                              className="text-[6px] font-extrabold uppercase select-none pointer-events-none leading-none"
                            >
                              {node.type}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>

                  {/* Empty state disclaimer if no items match filter */}
                  {nodesState.length === 0 && (
                    <div className="absolute inset-x-8 top-1/3 text-center bg-white border p-6 rounded-2xl shadow-3xs max-w-sm mx-auto space-y-2">
                      <Network className="w-8 h-8 text-slate-350 mx-auto animate-pulse" />
                      <p className="text-xs font-black text-slate-700 uppercase">Filtered network empty</p>
                      <p className="text-[11px] text-slate-400 font-bold">Try toggling filter types, clearing search, or creating custom links using the "Manual Link" form.</p>
                    </div>
                  )}
                </div>

                {/* Sub banner with details */}
                <div className="h-13 border-t bg-white px-5 flex items-center justify-between text-xs font-bold text-slate-500">
                  <div className="flex gap-4">
                    <span>Active directory nodes: <strong className="text-slate-800">{nodesState.length}</strong></span>
                    <span>Total mapped pathways: <strong className="text-slate-800">{linksState.length}</strong></span>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-650 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Double-click an Article node to view its text</span>
                  </div>
                </div>

              </div>

              {/* Right Context Panel (3-cols) */}
              <div className="lg:col-span-3 bg-white p-5 space-y-5 overflow-y-auto">
                
                {/* Manual placement form if active */}
                {showAddForm ? (
                  <form onSubmit={handleAddNewRelationship} className="p-4.5 bg-slate-50 border border-slate-205 rounded-2xl space-y-3.5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 leading-none">
                        <Plus className="w-4 h-4 text-indigo-505" /> Add Mapped Link
                      </h4>
                      <button 
                        type="button" 
                        onClick={() => setShowAddForm(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Source Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. AWS Multi-Factor"
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Source Node Type</label>
                      <select 
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value as NodeType)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                      >
                        <option value="Article">Article</option>
                        <option value="SOP">SOP</option>
                        <option value="System">System</option>
                        <option value="Team">Team</option>
                        <option value="Integration">Integration</option>
                        <option value="Vendor">Vendor</option>
                        <option value="Ticket">Ticket</option>
                      </select>
                    </div>

                    <div className="space-y-1 bg-indigo-50/50 p-1.5 rounded-xl text-center">
                      <label className="text-[9px] font-black uppercase text-indigo-805 block">Relationship</label>
                      <select 
                        value={newRelType}
                        onChange={(e) => setNewRelType(e.target.value as RelationshipType)}
                        className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-indigo-700 font-extrabold"
                      >
                        {Object.entries(RELATION_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Target Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Identity Management Team"
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Target Node Type</label>
                      <select 
                        value={newTargetType}
                        onChange={(e) => setNewTargetType(e.target.value as NodeType)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                      >
                        <option value="Article">Article</option>
                        <option value="SOP">SOP</option>
                        <option value="System">System</option>
                        <option value="Team">Team</option>
                        <option value="Integration">Integration</option>
                        <option value="Vendor">Vendor</option>
                        <option value="Ticket">Ticket</option>
                      </select>
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-9 rounded-xl text-xs font-black uppercase tracking-tight transition-all"
                    >
                      Publish Link Mapping
                    </button>
                  </form>
                ) : null}

                {/* Impact Traversal Results Lists (Realtime computed from search starting point!) */}
                {activeImpactAnalysis ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-205 space-y-3">
                    <h4 className="text-[11px] font-black uppercase text-amber-900 tracking-tight flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> traversed cascade log
                    </h4>

                    {/* SOP list */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Related SOPs ({impactSummaryLists.sops.length})</span>
                      {impactSummaryLists.sops.length > 0 ? (
                        <div className="space-y-1">
                          {impactSummaryLists.sops.map(n => (
                            <div key={n} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border text-[11px] font-extrabold text-slate-700">
                              <ClipboardList className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{n}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9.5px] font-semibold text-slate-400 pl-1">No downstream SOPs.</p>
                      )}
                    </div>

                    {/* Article list */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Related Articles ({impactSummaryLists.articles.length})</span>
                      {impactSummaryLists.articles.length > 0 ? (
                        <div className="space-y-1">
                          {impactSummaryLists.articles.map(n => (
                            <div key={n} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border text-[11px] font-extrabold text-slate-700">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{n}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9.5px] font-semibold text-slate-400 pl-1">No downstream Articles.</p>
                      )}
                    </div>

                    {/* Teams list */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Related Teams ({impactSummaryLists.teams.length})</span>
                      {impactSummaryLists.teams.length > 0 ? (
                        <div className="space-y-1">
                          {impactSummaryLists.teams.map(n => (
                            <div key={n} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border text-[11px] font-extrabold text-slate-700">
                              <Users className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                              <span className="truncate">{n}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9.5px] font-semibold text-slate-400 pl-1">No owning or utilizing teams affected.</p>
                      )}
                    </div>

                    {/* Integrations list */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Related Integrations ({impactSummaryLists.integrations.length})</span>
                      {impactSummaryLists.integrations.length > 0 ? (
                        <div className="space-y-1">
                          {impactSummaryLists.integrations.map(n => (
                            <div key={n} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border text-[11px] font-extrabold text-slate-700">
                              <Link2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate">{n}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9.5px] font-semibold text-slate-400 pl-1">No secondary integrations mapped.</p>
                      )}
                    </div>

                    {/* Systems list */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Affected Systems ({impactSummaryLists.systems.length})</span>
                      {impactSummaryLists.systems.length > 0 ? (
                        <div className="space-y-1">
                          {impactSummaryLists.systems.map(n => (
                            <div key={n} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border text-[11px] font-extrabold text-slate-700">
                              <Server className="w-3.5 h-3.5 text-slate-550 shrink-0" />
                              <span className="truncate">{n}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9.5px] font-semibold text-slate-400 pl-1 flex items-center gap-1">None</p>
                      )}
                    </div>

                  </div>
                ) : null}

                {/* Node Detail Inspector panel */}
                <div className="border border-slate-200 rounded-2xl p-4.5 space-y-3 bg-slate-50/50">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> Node Inspector
                    </h4>
                    {selectedNode && (
                      <button 
                        onClick={() => setSelectedNode(null)}
                        className="text-[9px] font-extrabold text-slate-400 hover:text-slate-650"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {selectedNode ? (
                    (() => {
                      const nodeType = allNodes.find(n => n.name === selectedNode)?.type || 'System';
                      const relationshipsConnected = relationships.filter(r => 
                        r.sourceName === selectedNode || r.targetName === selectedNode
                      );

                      return (
                        <div className="space-y-3.5">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-850 flex items-center justify-center shrink-0">
                              {nodeIcon(nodeType)}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-[12px] font-black text-slate-800 leading-tight break-words">{selectedNode}</h5>
                              <p className="text-[9.5px] text-indigo-650 font-extrabold uppercase mt-0.5">{nodeType} Directory Node</p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Associated Paths ({relationshipsConnected.length})</span>
                            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                              {relationshipsConnected.map(rel => {
                                const isSource = rel.sourceName === selectedNode;
                                return (
                                  <div key={rel.id} className="text-[10.5px] bg-white border border-slate-150 p-2 rounded-xl group relative">
                                    <div className="flex items-center justify-between text-[9px] text-slate-405 mb-1 border-b pb-0.5">
                                      <span className={rel.detectedBy === 'AI' ? 'text-indigo-600 font-extrabold flex items-center gap-0.5' : 'text-slate-500 font-bold'}>
                                        {rel.detectedBy === 'AI' && <Sparkles className="w-2.5 h-2.5" />}
                                        {rel.detectedBy} Mapped ({(rel.confidence * 100).toFixed(0)}%)
                                      </span>
                                      
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRel(rel.id); }}
                                        title="Delete relationship"
                                        className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1 font-semibold text-slate-700 min-w-0 flex-wrap">
                                      <span className="truncate max-w-[80px] text-slate-900">{rel.sourceName}</span>
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                      <span className="highlight font-black underline text-indigo-650">{RELATION_LABELS[rel.type]}</span>
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                      <span className="truncate max-w-[80px] text-slate-900">{rel.targetName}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setActiveImpactAnalysis(selectedNode);
                                setImpactQuery(selectedNode);
                              }}
                              className="flex-1 bg-white hover:bg-slate-50 border text-slate-700 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight flex items-center justify-center gap-1 shadow-3xs"
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Analyze Impact
                            </button>
                            {nodeType === 'Article' && onSelectArticle && (
                              <button 
                                onClick={() => {
                                  onSelectArticle(selectedNode);
                                  setIsOpen(false);
                                  toast.info(`Opened document: "${selectedNode}"`);
                                }}
                                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight"
                              >
                                View Text
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-4 space-y-1.5">
                      <HelpCircle className="w-7 h-7 text-slate-300 mx-auto" />
                      <p className="text-[10px] text-slate-400 font-extrabold uppercase">No Node Selected</p>
                      <p className="text-[9.5px] text-slate-400 font-medium">Click any circle node on the graph canvas to inspect its details, upstream dependencies, and connected pathways.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
