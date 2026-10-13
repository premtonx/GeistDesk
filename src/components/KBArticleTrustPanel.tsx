import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ThumbsUp, 
  ThumbsDown, 
  Link2, 
  FileWarning, 
  UserPlus, 
  Activity, 
  GitCommit, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  HelpCircle,
  Undo2,
  ListRestart
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  CartesianGrid 
} from 'recharts';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { KBArticle } from '../types';
import { 
  trustScoreService, 
  TrustScoreData, 
  TrustScoreInputs, 
  calculateTrustScoreMetrics, 
  generateScoreExplanation 
} from '../services/trustScoreService';
import { toast } from 'sonner';

interface KBArticleTrustPanelProps {
  article: KBArticle;
  onScoreUpdated?: (newScore: number) => void;
}

export function KBArticleTrustPanel({ article, onScoreUpdated }: KBArticleTrustPanelProps) {
  const [trustData, setTrustData] = useState<TrustScoreData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Editable Input parameters
  const [ageDays, setAgeDays] = useState(30);
  const [reviewDays, setReviewDays] = useState(15);
  const [helpful, setHelpful] = useState(50);
  const [unhelpful, setUnhelpful] = useState(2);
  const [successRate, setSuccessRate] = useState(90);
  const [brokenLinks, setBrokenLinks] = useState(0);
  const [missingRefs, setMissingRefs] = useState(0);
  const [contradictions, setContradictions] = useState(0);
  const [activityScore, setActivityScore] = useState(85);

  // Reload score data on active article change
  useEffect(() => {
    async function loadScore() {
      setIsLoading(true);
      const data = await trustScoreService.getTrustScore(article.id, article);
      if (data) {
        setTrustData(data);
        // Sync sliders state
        setAgeDays(data.inputs.articleAgeDays);
        setReviewDays(data.inputs.lastReviewDaysAgo);
        setHelpful(data.inputs.helpfulCount);
        setUnhelpful(data.inputs.unhelpfulCount);
        setSuccessRate(data.inputs.ticketSuccessRate);
        setBrokenLinks(data.inputs.brokenLinksCount);
        setMissingRefs(data.inputs.missingReferencesCount);
        setContradictions(data.inputs.contradictingArticlesCount);
        setActivityScore(data.inputs.ownerActivityScore);
      }
      setIsLoading(false);
    }
    loadScore();
  }, [article]);

  const handleRecalculate = () => {
    const freshInputs: TrustScoreInputs = {
      articleAgeDays: ageDays,
      lastReviewDaysAgo: reviewDays,
      helpfulCount: helpful,
      unhelpfulCount: unhelpful,
      ticketSuccessRate: successRate,
      brokenLinksCount: brokenLinks,
      missingReferencesCount: missingRefs,
      contradictingArticlesCount: contradictions,
      ownerActivityScore: activityScore
    };

    const { score, breakdown, level } = calculateTrustScoreMetrics(freshInputs);
    const explanation = generateScoreExplanation(freshInputs, score, trustData?.score);

    setTrustData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        score,
        level,
        breakdown,
        inputs: freshInputs,
        explanation
      };
    });

    toast.success(`Recalculated: score is now ${score}% (${level})`);
  };

  const handleSaveChanges = async () => {
    if (!trustData) return;
    setIsLoading(true);
    try {
      const freshInputs: TrustScoreInputs = {
        articleAgeDays: ageDays,
        lastReviewDaysAgo: reviewDays,
        helpfulCount: helpful,
        unhelpfulCount: unhelpful,
        ticketSuccessRate: successRate,
        brokenLinksCount: brokenLinks,
        missingReferencesCount: missingRefs,
        contradictingArticlesCount: contradictions,
        ownerActivityScore: activityScore
      };

      const result = await trustScoreService.updateTrustScore(
        article.id,
        freshInputs,
        trustData.score,
        trustData.history
      );

      if (result) {
        setTrustData(result.data as TrustScoreData);
        toast.success("Article confidence score updated and logged in metadata.");
        if (onScoreUpdated) {
          onScoreUpdated(result.score);
        }
        setIsEditing(false);
      } else {
        toast.error("Could not write security configurations.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error setting trust matrices.");
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelBadgeColor = (lvl: string) => {
    switch (lvl) {
      case 'Trusted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-250 font-black';
      case 'Review Recommended':
        return 'bg-amber-50 text-amber-700 border-amber-250 font-black';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-250 font-black animate-pulse';
    }
  };

  const getLevelTextColor = (lvl: string) => {
    switch (lvl) {
      case 'Trusted': return 'text-emerald-600';
      case 'Review Recommended': return 'text-amber-500';
      default: return 'text-rose-500 font-extrabold';
    }
  };

  // Convert history array to chart readable data
  const chartData = trustData?.history?.map((h, idx) => ({
    name: h.timestamp ? new Date(h.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : `Log #${idx+1}`,
    score: h.score
  })) || [];

  return (
    <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-xs p-5 select-none text-left space-y-6">
      
      {/* Mini Title Meta Row */}
      <div className="flex items-center justify-between border-b pb-3 border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600 animate-pulse" />
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Digital Sovereignty Trust Score</h3>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Real-time parameters tracking</span>
          </div>
        </div>

        {trustData && (
          <Badge className={cn("px-2.5 py-0.5 text-[10px] uppercase border", getLevelBadgeColor(trustData.level))}>
            {trustData.level}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
          <p className="text-xs font-black uppercase">Loading audit score...</p>
        </div>
      ) : !trustData ? (
        <div className="py-8 text-center text-slate-400 text-xs font-bold">
          Data matrices unavailable. Try saving this draft first.
        </div>
      ) : (
        <div className="space-y-6">

          {/* Metric Circular Dial and breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            
            {/* The circular meter */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50/70 rounded-2xl border border-slate-100 relative overflow-hidden">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Confidence</span>
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke={trustData.score >= 90 ? '#10B981' : trustData.score >= 70 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * trustData.score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute flex flex-col items-center leading-none">
                  <span className="text-2xl font-black text-slate-900">{trustData.score}%</span>
                </div>
              </div>
              <span className={cn("text-[10px] font-black uppercase tracking-wider mt-2.5", getLevelTextColor(trustData.level))}>
                {trustData.level}
              </span>
            </div>

            {/* Breakdown weights indicators */}
            <div className="md:col-span-8 space-y-3">
              <div className="text-xs space-y-2.5">
                
                {/* Freshness Progress bar (25%) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-500">Freshness (Max 25%)</span>
                    <span className="text-slate-800">{trustData.breakdown.freshness} / 25 pts</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${(trustData.breakdown.freshness / 25) * 100}%` }}></div>
                  </div>
                </div>

                {/* Feedback Progress bar (20%) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-500">Reader Feedback (Max 20%)</span>
                    <span className="text-slate-800">{trustData.breakdown.feedback} / 20 pts</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${(trustData.breakdown.feedback / 20) * 100}%` }}></div>
                  </div>
                </div>

                {/* Usage Success Progress bar (30%) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-500">Usage Success Rate (Max 30%)</span>
                    <span className="text-slate-800">{trustData.breakdown.usageSuccess} / 30 pts</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(trustData.breakdown.usageSuccess / 30) * 100}%` }}></div>
                  </div>
                </div>

                {/* Review Compliance Progress bar (25%) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-500">Review & Compliance (Max 25%)</span>
                    <span className="text-slate-800">{trustData.breakdown.reviewCompliance} / 25 pts</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-violet-500 h-full rounded-full transition-all duration-500" style={{ width: `${(trustData.breakdown.reviewCompliance / 25) * 100}%` }}></div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* AI Narrated Trust Explanation Box */}
          <div className="bg-indigo-50/40 p-4.5 rounded-xl border border-indigo-100/60 leading-relaxed text-xs">
            <div className="flex items-center gap-1.5 font-bold mb-1.5 text-indigo-950">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>AI Trust Audit Explanation</span>
            </div>
            <p className="text-slate-600 font-semibold text-[11.5px] leading-relaxed">
              {trustData.explanation}
            </p>
          </div>

          {/* Trend Graph Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-[10.5px] font-black text-slate-400 uppercase tracking-widest">
                <TrendingUp className="w-4 h-4 text-slate-350" />
                <span>Confidence History Trend</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Past Audit Checkpoints</span>
            </div>

            <div className="w-full h-32 border border-slate-100 bg-slate-50/20 p-2.5 rounded-xl">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEFF1" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#94A3B8' }} stroke="#E2E8F0" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700, fill: '#94A3B8' }} stroke="#E2E8F0" />
                  <Tooltip 
                    contentStyle={{ fontSize: 10, borderRadius: 8, padding: '4px 8px', border: '1px solid #E2E8F0' }}
                    labelStyle={{ fontWeight: 800, color: '#1E293B' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={1.5} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Auditing Configurations Form */}
          <div className="space-y-4 pt-1 border-t border-slate-150">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-black text-slate-400 uppercase tracking-wider">Metrics Parameter Auditing</span>
                <Badge className="bg-slate-100 text-slate-500 font-extrabold text-[9px] hover:bg-slate-100">Live Simulator</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 text-[10px] font-bold px-2 rounded-lg"
              >
                {isEditing ? "Hide Controls" : "Edit Score Parameters"}
              </Button>
            </div>

            {isEditing && (
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 p-4 space-y-4 text-xs font-bold animate-in slide-in-from-top-2 duration-150">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Article Age */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Article Age ({ageDays} days)</span>
                    </div>
                    <input 
                      type="range" min="0" max="365" step="5"
                      className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      value={ageDays}
                      onChange={(e) => setAgeDays(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Last Review Days */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Last Review ({reviewDays} days ago)</span>
                    </div>
                    <input 
                      type="range" min="0" max="180" step="2"
                      className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      value={reviewDays}
                      onChange={(e) => setReviewDays(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Helpful Count */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Helpful clicks ({helpful})</span>
                    </div>
                    <input 
                      type="range" min="0" max="500" step="5"
                      className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      value={helpful}
                      onChange={(e) => setHelpful(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Unhelpful Count */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Unhelpful clicks ({unhelpful})</span>
                    </div>
                    <input 
                      type="range" min="0" max="50" step="1"
                      className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      value={unhelpful}
                      onChange={(e) => setUnhelpful(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Ticket Success Rate */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Ticket Success ({successRate}%)</span>
                    </div>
                    <input 
                      type="range" min="50" max="100" step="1"
                      className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      value={successRate}
                      onChange={(e) => setSuccessRate(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Owner Activity Score */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Owner Activity Score ({activityScore}%)</span>
                    </div>
                    <input 
                      type="range" min="20" max="100" step="2"
                      className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      value={activityScore}
                      onChange={(e) => setActivityScore(parseInt(e.target.value))}
                    />
                  </div>

                </div>

                {/* Bullet infractions count */}
                <div className="border-t pt-3 border-slate-200/60 text-[10.5px] font-black uppercase text-slate-400 tracking-wider">
                  System Infraction & Penalty Checks
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-bold block">Broken Links ({brokenLinks})</span>
                    <div className="flex items-center gap-1 mt-1">
                      <button 
                        onClick={() => setBrokenLinks(prev => Math.max(0, prev - 1))}
                        className="w-6 h-6 rounded border bg-white flex items-center justify-center text-slate-600 cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <button 
                        onClick={() => setBrokenLinks(prev => prev + 1)}
                        className="w-6 h-6 rounded border bg-white flex items-center justify-center text-slate-600 cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-bold block">Missing Refs ({missingRefs})</span>
                    <div className="flex items-center gap-1 mt-1">
                      <button 
                        onClick={() => setMissingRefs(prev => Math.max(0, prev - 1))}
                        className="w-6 h-6 rounded border bg-white flex items-center justify-center text-slate-600 cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <button 
                        onClick={() => setMissingRefs(prev => prev + 1)}
                        className="w-6 h-6 rounded border bg-white flex items-center justify-center text-slate-600 cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-bold block">Conflicting Docs ({contradictions})</span>
                    <div className="flex items-center gap-1 mt-1">
                      <button 
                        onClick={() => setContradictions(prev => Math.max(0, prev - 1))}
                        className="w-6 h-6 rounded border bg-white flex items-center justify-center text-slate-600 cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <button 
                        onClick={() => setContradictions(prev => prev + 1)}
                        className="w-6 h-6 rounded border bg-white flex items-center justify-center text-slate-600 cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulator Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-200/65">
                  <Button
                    onClick={handleRecalculate}
                    className="flex-1 bg-slate-900 text-white hover:bg-slate-800 text-[10.5px] font-black h-8 rounded-lg cursor-pointer"
                  >
                    Simulate Score Change
                  </Button>
                  <Button
                    onClick={handleSaveChanges}
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 text-[10.5px] font-black h-8 rounded-lg cursor-pointer"
                  >
                    Deploy New Audit Matrix
                  </Button>
                </div>

              </div>
            )}
          </div>

          {/* Audit Logs / Confidence History Feed */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <span className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest block mb-2">Confidence Change Logs</span>
            <div className="max-h-36 overflow-y-auto space-y-2 pr-1 select-none">
              {trustData.history?.slice().reverse().map((h, index) => (
                <div key={index} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[11px] leading-relaxed relative text-slate-600 font-semibold flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                  <div>
                    <div className="flex justify-between items-center mb-1 text-[10px] text-slate-400 font-bold">
                      <span>{h.timestamp ? new Date(h.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'System Genesis'}</span>
                      <span className="font-extrabold text-indigo-600 bg-indigo-50 px-1 rounded">Score: {h.score}%</span>
                    </div>
                    <p className="text-slate-600 leading-snug">{h.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
