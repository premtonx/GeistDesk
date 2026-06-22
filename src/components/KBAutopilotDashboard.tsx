import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Workflow, 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  User, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  Check, 
  Trash2, 
  TrendingUp, 
  ShieldCheck, 
  Cpu, 
  ExternalLink,
  ChevronRight,
  BookOpen,
  FileText,
  BadgeAlert,
  Sliders,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { autopilotService, AutopilotSuggestion, AutopilotMetrics } from '../services/autopilotService';
import { toast } from 'sonner';

interface KBAutopilotDashboardProps {
  onBackToKB: () => void;
  onArticlePublished?: () => void;
  /** When true, renders inline inside KB workspace (sidebar provides navigation). */
  embedded?: boolean;
}

export function KBAutopilotDashboard({ onBackToKB, onArticlePublished, embedded }: KBAutopilotDashboardProps) {
  const [suggestions, setSuggestions] = useState<AutopilotSuggestion[]>([]);
  const [metrics, setMetrics] = useState<AutopilotMetrics>({
    ticketsPrevented: 142,
    articleUsefulness: 94,
    deflectionRate: 42.5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutopilotSuggestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states for editing candidate
  const [editTitle, setEditTitle] = useState('');
  const [editProblem, setEditProblem] = useState('');
  const [editRootCause, setEditRootCause] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editSystems, setEditSystems] = useState('');

  useEffect(() => {
    // 1. Subscribe to real-time suggestions
    const unsubSuggestions = autopilotService.subscribeToSuggestions((data) => {
      // Sort so high confidence and pending suggestions are listed first
      const sorted = [...data].sort((a, b) => b.confidenceScore - a.confidenceScore);
      setSuggestions(sorted);
    });

    // 2. Subscribe to real-time autopilot global metrics
    const unsubMetrics = autopilotService.subscribeToMetrics((data) => {
      setMetrics(data);
    });

    return () => {
      unsubSuggestions();
      unsubMetrics();
    };
  }, []);

  const handleOpenDetail = (sug: AutopilotSuggestion) => {
    setSelectedSuggestion(sug);
    setEditTitle(sug.title);
    setEditProblem(sug.problemSummary);
    setEditRootCause(sug.rootCause);
    setEditSteps(sug.resolutionSteps);
    setEditOwner(sug.suggestedOwner);
    setEditSystems(sug.relatedSystems ? sug.relatedSystems.join(', ') : '');
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedSuggestion) return;
    setIsLoading(true);
    try {
      const updates = {
        title: editTitle,
        problemSummary: editProblem,
        rootCause: editRootCause,
        resolutionSteps: editSteps,
        suggestedOwner: editOwner,
        relatedSystems: editSystems.split(',').map(s => s.trim()).filter(Boolean)
      };

      const success = await autopilotService.updateSuggestion(selectedSuggestion.id, updates);
      if (success) {
        toast.success("Autopilot suggestion updated locally.");
        setSelectedSuggestion(prev => prev ? { ...prev, ...updates } : null);
        setIsEditing(false);
      } else {
        toast.error("Failed to update suggestion.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Internal service error updating draft.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (sugId: string) => {
    const sug = suggestions.find(s => s.id === sugId);
    if (!sug) return;

    const toastId = toast.loading(`Publishing "${sug.title}" to standard Knowledge Base...`);
    setIsLoading(true);
    try {
      const articleId = await autopilotService.publishSuggestion(sugId, sug.suggestedOwner, 'Troubleshooting');
      if (articleId) {
        toast.success("Autopilot approved! Candidate has been converted and published to KB.", { id: toastId });
        setSelectedSuggestion(null);
        if (onArticlePublished) onArticlePublished();
      } else {
        toast.error("Failed to compile knowledge article.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not complete review publishing pipeline.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (sugId: string) => {
    try {
      await autopilotService.rejectSuggestion(sugId);
      toast.success("Suggestion dismissed as non-critical.");
      if (selectedSuggestion?.id === sugId) {
        setSelectedSuggestion(null);
      }
    } catch (e) {
      toast.error("Error rejecting suggestion.");
    }
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 90) return { label: 'Optimal', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    if (score >= 75) return { label: 'Moderate', color: 'text-amber-600 bg-amber-50 border-amber-100' };
    return { label: 'Low', color: 'text-rose-600 bg-rose-50 border-rose-100' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return <Badge className="bg-emerald-100 text-emerald-800 border-none px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Published (✓)</Badge>;
      case 'Approved':
        return <Badge className="bg-blue-100 text-blue-800 border-none px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Approved</Badge>;
      case 'Rejected':
        return <Badge className="bg-slate-100 text-slate-500 border-none px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Archived (✗)</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800 border-none px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Needs Review</Badge>;
    }
  };

  return (
    <div className={cn(
      'flex-1 select-none animate-in fade-in duration-200',
      embedded ? 'space-y-6' : 'bg-slate-50/50 p-6 space-y-6',
    )}>
      
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[1.5rem] border border-slate-200/80 shadow-3xs">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-650 text-white hover:bg-indigo-750 border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
              Engine Level 4
            </Badge>
            <span className="text-[10.5px] font-extrabold text-emerald-600 flex items-center gap-1">
              <Workflow className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
              Autopilot Loop Synced
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Ticket-to-Knowledge Autopilot
          </h1>
          <p className="text-xs text-slate-500 font-semibold max-w-2xl leading-relaxed">
            Consolidate resolved tickets into structured articles using neural clustering. Review problem summaries, root-cause extractions, and publish vetted articles dynamically to slash ticket volumes.
          </p>
        </div>

        {!embedded ? (
          <div>
            <Button
              onClick={onBackToKB}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs h-10 px-4 rounded-xl border border-slate-250/20 cursor-pointer shadow-3xs"
            >
              Back to Article Desk
            </Button>
          </div>
        ) : null}
      </div>

      {/* Autopilot Real-time Operational Telemetry Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200/70 shadow-4xs flex items-center justify-between">
          <div className="text-left space-y-0.5">
            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Tickets Prevented</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{metrics.ticketsPrevented} Case Resolves</span>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1.5 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+14 cases deflection this week</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-55/70 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200/70 shadow-4xs flex items-center justify-between">
          <div className="text-left space-y-0.5">
            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Extracted Article Usefulness</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{metrics.articleUsefulness}% Optimal</span>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
              Based on client self-service logs
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-55/70 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200/70 shadow-4xs flex items-center justify-between">
          <div className="text-left space-y-0.5">
            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Deflection Rate</span>
            <span className="text-2xl font-black text-slate-950 tracking-tight">{metrics.deflectionRate}% Rate</span>
            <p className="text-[10px] text-indigo-650 font-bold flex items-center gap-1 mt-0.5">
              <span>Optimizing corporate response metrics</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-55/70 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Autopilot Body Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Knowledge Suggestions Queue Panel */}
        <div className="lg:col-span-8 bg-white rounded-[1.5rem] border border-slate-200/80 shadow-3xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-left">
            <div>
              <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider">
                Knowledge Suggestions Queue
              </h2>
              <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
                {suggestions.filter(s => s.reviewStatus !== 'Published' && s.reviewStatus !== 'Rejected').length} Pending Cluster Checkpoints Identified
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-white border px-2.5 py-1 rounded-lg">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Incubation Threshold: 2 resolved occurrences</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/30 border-b border-slate-100 text-slate-400 font-extrabold text-[10px] uppercase">
                  <th className="p-4 pl-6">Suggested Candidate</th>
                  <th className="p-4">Confidence Score</th>
                  <th className="p-4 text-center">Source Tickets</th>
                  <th className="p-4">Suggested Owner</th>
                  <th className="p-4">Review Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {suggestions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Workflow className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-800">No active knowledge suggestions found</p>
                        <p className="text-slate-400 text-xs mt-0.5">The Autopilot is waiting for resolved tickets to match neural criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  suggestions.map((sug) => {
                    const conf = getConfidenceLevel(sug.confidenceScore);
                    const isSelected = selectedSuggestion?.id === sug.id;
                    const isVetted = sug.reviewStatus === 'Published';

                    return (
                      <tr 
                        key={sug.id}
                        className={cn(
                          "group hover:bg-slate-50/50 transition-colors cursor-pointer",
                          isSelected && "bg-slate-55/80 border-l-2 border-indigo-650"
                        )}
                        onClick={() => handleOpenDetail(sug)}
                      >
                        <td className="p-4 pl-6 max-w-[200px]">
                          <div className="flex flex-col text-left space-y-0.5">
                            <span className={cn(
                              "font-black text-slate-900 text-[12.5px] truncate group-hover:text-indigo-650 transition-colors",
                              isVetted && "line-through text-slate-400"
                            )}>
                              {sug.title}
                            </span>
                            <span className="text-[9.5px] text-slate-400 uppercase font-black tracking-tight flex items-center gap-1">
                              <Sliders className="w-3 h-3 text-slate-350" />
                              {sug.relatedSystems?.slice(0, 2).join(', ') || 'Global Systems'}
                            </span>
                          </div>
                        </td>

                        {/* COLUMN 1: CONFIDENCE SCORE */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md border text-[10px] font-black tracking-wider",
                              conf.color
                            )}>
                              {sug.confidenceScore}%
                            </span>
                          </div>
                        </td>

                        {/* COLUMN 2: SOURCE TICKETS GROUP COUNT */}
                        <td className="p-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <Badge className="bg-indigo-50 hover:bg-indigo-100 text-indigo-750 border border-indigo-100 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                              <Layers className="w-3 h-3 text-indigo-500" />
                              {sug.sourceTickets?.length || 1} Incidents
                            </Badge>
                          </div>
                        </td>

                        {/* COLUMN 3: SUGGESTED OWNER */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-xs">{sug.suggestedOwner || 'Unassigned'}</span>
                          </div>
                        </td>

                        {/* COLUMN 4: REVIEW STATUS */}
                        <td className="p-4">
                          {getStatusBadge(sug.reviewStatus)}
                        </td>

                        {/* COLUMN 5: ROW ACTIONS */}
                        <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {sug.reviewStatus !== 'Published' && sug.reviewStatus !== 'Rejected' ? (
                              <>
                                <button
                                  onClick={() => handlePublish(sug.id)}
                                  className="h-8 w-8 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition-all shadow-3xs"
                                  title="Approve & Publish to standard KB"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(sug.id)}
                                  className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition-all shadow-3xs"
                                  title="Dismiss / Tag non-critical"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : sug.reviewStatus === 'Published' ? (
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 py-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Vetted
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 py-1">
                                Dismissed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Extraction & Approval Panel (Right Panel) */}
        <div className="lg:col-span-4 bg-white rounded-[1.5rem] border border-slate-200/80 shadow-3xs p-5 space-y-5 text-left flex flex-col justify-between">
          {!selectedSuggestion ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-24 px-4 space-y-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50/50 flex items-center justify-center border text-indigo-500">
                <Workflow className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider">Candidate Insights Workspace</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Select any suggestion queue row to audit extracted problem summaries, analyze root cause telemetry, edit metadata, and assign owners before publishing.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col justify-between h-full">
              
              {/* Card Meta details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Extracted Post-Mortem</span>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-700 border-none px-2 text-[9px] font-black">
                     {selectedSuggestion.confidenceScore}% Acc
                  </Badge>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-black uppercase text-slate-400">Suggested Title</label>
                      <input 
                        className="w-full text-xs font-bold border rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-black uppercase text-slate-400">Extracted Problem Summary</label>
                      <textarea 
                        rows={3}
                        className="w-full text-xs font-medium border rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editProblem}
                        onChange={(e) => setEditProblem(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-black uppercase text-slate-400">Extracted Root Cause</label>
                      <textarea 
                        rows={3}
                        className="w-full text-xs font-medium border rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editRootCause}
                        onChange={(e) => setEditRootCause(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-black uppercase text-slate-400">Remediation / Resolution Steps</label>
                      <textarea 
                        rows={4}
                        className="w-full text-xs font-mono border rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-normal"
                        value={editSteps}
                        onChange={(e) => setEditSteps(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-black uppercase text-slate-400">Assign Owner</label>
                        <input 
                          className="w-full text-xs font-bold border rounded-lg px-3 py-2 bg-slate-50"
                          value={editOwner}
                          onChange={(e) => setEditOwner(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-black uppercase text-slate-400">Systems (CSV)</label>
                        <input 
                          className="w-full text-xs font-bold border rounded-lg px-3 py-2 bg-slate-50"
                          value={editSystems}
                          onChange={(e) => setEditSystems(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={isLoading}
                        className="flex-1 bg-indigo-650 text-white hover:bg-indigo-750 text-xs font-black h-8.5 rounded-lg cursor-pointer"
                      >
                        Save Extracted Draft
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="h-8.5 text-xs font-bold"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs font-semibold">
                    <div className="bg-[#FAF9FF] p-3 rounded-xl border border-indigo-100/50">
                      <span className="text-[10px] font-black uppercase text-indigo-400 block mb-1">Clustered Subject Name</span>
                      <h3 className="text-sm font-black text-slate-900 leading-snug">{selectedSuggestion.title}</h3>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">Problem Summary (Extracted)</span>
                      <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg leading-relaxed text-[11.5px]">{selectedSuggestion.problemSummary}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">Root Cause (Extracted)</span>
                      <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg leading-relaxed text-[11.5px]">{selectedSuggestion.rootCause}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">Resolution Remediation Steps</span>
                      <div className="bg-slate-50 p-3 rounded-lg font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-600 border border-slate-200/50">
                        {selectedSuggestion.resolutionSteps}
                      </div>
                    </div>

                    {/* Sourced Incidents List inside Cluster */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">
                         Cluster Sourced Tickets ({selectedSuggestion.sourceTickets?.length || 1})
                      </span>
                      <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 border rounded-lg bg-[#FCFDFE]">
                        {selectedSuggestion.sourceTickets?.map((t, idx) => (
                          <div key={idx} className="p-2.5 text-[11px] flex items-center justify-between gap-2.5 hover:bg-slate-100/80 select-none">
                            <span className="font-extrabold text-blue-650 shrink-0">#{t.id.slice(-5)}</span>
                            <span className="text-slate-600 font-bold truncate flex-1 text-left">{t.subject}</span>
                            <span className="text-[9px] text-slate-400 font-bold shrink-0">{t.customerName?.slice(0, 10) || 'Client'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedSuggestion.reviewStatus !== 'Published' && (
                      <div className="flex gap-2 pt-4">
                        <Button
                          onClick={() => handlePublish(selectedSuggestion.id)}
                          disabled={isLoading}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 pb-0.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-250 animate-pulse" />
                          <span>Approve & Publish to KB</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsEditing(true)}
                          disabled={isLoading}
                          className="border-slate-250 hover:bg-slate-50 text-slate-700 font-bold text-xs h-9 rounded-xl px-3 cursor-pointer shadow-3xs"
                        >
                          Edit Draft
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
