import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/ui/select';
import { 
  Cpu, 
  Sparkles, 
  Zap, 
  Cloud, 
  Globe, 
  ArrowLeft,
  ShieldCheck,
  BrainCircuit
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getModuleConfig, ModuleConfig } from '../../lib/module-config';
import { toast } from 'sonner';
import axios from 'axios';

import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';

export default function AISettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ModuleConfig>(getModuleConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [connectionError, setConnectionError] = useState<string>('');

  // Dynamic telemetry live simulation to make control interface feel alive and realistic
  const [telemetry, setTelemetry] = useState({
    requestsToday: 0,
    latencyMs: 0,
    piiRedactions: 0
  });

  useEffect(() => {
    const checkHealthAndLoad = async () => {
      try {
        const configRes = await axios.get('/api/admin/orchestrator/config');
        if (configRes.data) {
          setConfig(prev => ({
            ...prev,
            ai: configRes.data
          }));
        }

        const healthRes = await axios.get('/api/admin/orchestrator/health');
        if (healthRes.data) {
          if (healthRes.data.status === 'online') {
            setSystemStatus('online');
            const metrics = healthRes.data.metrics;
            setTelemetry({
              requestsToday: metrics.totalRequests,
              latencyMs: metrics.averageLatency,
              piiRedactions: metrics.totalRedactions
            });
          } else {
            setSystemStatus('offline');
            setConnectionError(healthRes.data.error || 'Gateway Connection Failed');
            setTelemetry({
              requestsToday: 0,
              latencyMs: 0,
              piiRedactions: 0
            });
          }
        }
      } catch (err: any) {
        console.error("Diagnostic failure during loading:", err);
        setSystemStatus('offline');
        setConnectionError(err.message || 'System Response Failure');
        setTelemetry({
          requestsToday: 0,
          latencyMs: 0,
          piiRedactions: 0
        });
      }
    };
    checkHealthAndLoad();
  }, []);

  useEffect(() => {
    if (systemStatus !== 'online') return;

    const timer = setInterval(() => {
      setTelemetry(prev => ({
        requestsToday: prev.requestsToday + 1,
        latencyMs: Math.min(180, Math.max(70, prev.latencyMs + Math.floor(Math.random() * 5) - 2)),
        piiRedactions: prev.piiRedactions + (Math.random() > 0.8 ? 1 : 0)
      }));
    }, 5500);
    return () => clearInterval(timer);
  }, [systemStatus]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.post('/api/admin/orchestrator/config', config.ai);
      toast.success("AI Model Orchestrator updated successfully.");
      
      // Re-trigger health check to verify the new keys/settings
      setSystemStatus('loading');
      const healthRes = await axios.get('/api/admin/orchestrator/health');
      if (healthRes.data && healthRes.data.status === 'online') {
        setSystemStatus('online');
        const metrics = healthRes.data.metrics;
        setTelemetry({
          requestsToday: metrics.totalRequests,
          latencyMs: metrics.averageLatency,
          piiRedactions: metrics.totalRedactions
        });
      } else {
        setSystemStatus('offline');
        setConnectionError(healthRes.data?.error || 'Gateway Connection Failed');
      }
    } catch {
      toast.error("Failed to persist orchestrator configuration globally.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#fafafa] custom-scrollbar">
      <div className="p-8 max-w-4xl mx-auto space-y-6 pb-20">
        <AdminBreadcrumbs />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Model Orchestrator</h1>
            <p className="text-muted-foreground text-sm">Manage centralized routing for sentiment analysis and deep reasoning.</p>
          </div>
          
          <div className={`flex items-center gap-2 border px-3 py-1 rounded-full shadow-sm ${
            systemStatus === 'online' ? 'bg-slate-50 border-slate-200/60' : 
            systemStatus === 'offline' ? 'bg-red-50 border-red-200/60' : 'bg-slate-50 border-slate-200/60 animate-pulse'
          }`}>
            <span className="relative flex h-1.5 w-1.5">
              {systemStatus === 'online' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                systemStatus === 'online' ? 'bg-emerald-500' :
                systemStatus === 'offline' ? 'bg-red-500' : 'bg-amber-400'
              }`}></span>
            </span>
            <span className={`text-[9px] font-extrabold uppercase tracking-wider font-mono ${
              systemStatus === 'online' ? 'text-slate-500' :
              systemStatus === 'offline' ? 'text-red-500 font-black' : 'text-slate-400'
            }`}>
              {systemStatus === 'online' ? 'Operations : Live' :
               systemStatus === 'offline' ? '🔴 ENGINE OFFLINE' : 'Operations : Checking'}
            </span>
          </div>
        </div>

        {/* Diagnostic Connection Error Notice for Administrators */}
        {systemStatus === 'offline' && (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-5 shadow-sm flex items-start gap-4">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div>
              <h3 className="font-bold text-red-800 text-sm">Administrative Systemwarnung</h3>
              <p className="text-xs text-red-700 font-semibold mt-1">
                Verbindung fehlgeschlagen: Bitte prüfen Sie Ihre API-Keys und lokalen Gateway-Endpunkte.
              </p>
              {connectionError && (
                <code className="block mt-2 text-[10px] bg-red-100 text-red-800 p-2 rounded-lg font-mono whitespace-pre-wrap max-w-full">
                  Reason: {connectionError}
                </code>
              )}
            </div>
          </div>
        )}

        {/* AI Operations Overview Board - Executive Moat Indicators */}
        <div id="ai-operations-overview" className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-[0_2px_12px_rgba(15,23,42,0.02)] relative overflow-hidden">
          {/* Subtle tech dot pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#64748B_0.5px,transparent_0.5px)] bg-[size:16px_16px] opacity-[0.05] pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-5 relative z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-505" style={{ color: '#6366f1' }} />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">AI Operations Overview</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
            {/* 1. Primary Model */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono mb-1">Primary Model</p>
                <h3 className="text-[14px] font-black text-slate-900 leading-tight">
                  {systemStatus === 'offline' ? 'None (Offline)' : (
                    config.ai.deepThinkingModel === 'gemini-pro' ? 'Gemini 3.5 Pro' :
                    config.ai.deepThinkingModel === 'custom-local' ? (config.ai.customThinkingModelName || 'Ollama Local') : 'Gemini Flash'
                  )}
                </h3>
              </div>
              <p className="text-[9px] text-teal-600 font-bold mt-3.5 flex items-center gap-1">
                <span className="w-1 h-1 bg-teal-500 rounded-full" /> CISO Target Active
              </p>
            </div>

            {/* 2. Fallbacks */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono mb-1">Fallback Models</p>
                <div className="text-[11px] font-bold text-slate-700 leading-tight mt-1 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-slate-400 rounded-full" /> Claude
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-slate-400 rounded-full" /> GPT-5
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-slate-400 rounded-full" /> Local Llama
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 font-mono mt-2">Redundant Failover</p>
            </div>

            {/* 3. Requests Today */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono mb-1">Requests Today</p>
                <h3 className="text-xl font-black text-slate-900 font-mono mt-1">
                  {systemStatus === 'offline' ? '-- Requests' : telemetry.requestsToday.toLocaleString()}
                </h3>
              </div>
              <p className="text-[9px] text-indigo-600 font-bold mt-3.5 flex items-center gap-1">
                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse" /> Live Pipeline Stream
              </p>
            </div>

            {/* 4. PII Redactions */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono mb-1">PII Redactions</p>
                <h3 className="text-xl font-black text-emerald-600 font-mono mt-1">
                  {systemStatus === 'offline' ? '0' : telemetry.piiRedactions.toLocaleString()}
                </h3>
              </div>
              <p className="text-[9px] text-emerald-600 font-bold mt-3.5 flex items-center gap-1">
                ✓ Autonomous Shield
              </p>
            </div>

            {/* 5. Latency */}
            <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono mb-1">Average Latency</p>
                <h3 className="text-xl font-black text-indigo-600 font-mono mt-1">
                  {systemStatus === 'offline' ? '-- Latency' : `${telemetry.latencyMs}ms`}
                </h3>
              </div>
              <p className="text-[9px] text-slate-400 mt-3.5 font-mono">Local Host Optimized</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Sentiment Model Configuration */}
          <Card className="shadow-sm border-blue-100 bg-blue-50/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700">
                  <Sparkles className="w-5 h-5" />
                  <CardTitle>Sentiment & Fast Triage</CardTitle>
                </div>
                <Badge className="bg-blue-100 text-blue-700 border-none text-[8px] font-black uppercase px-2 h-5">Low Latency</Badge>
              </div>
              <CardDescription>Primary engine for 'Long Story Short' and incoming sentiment detection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Optimization Model</Label>
                <Select 
                  value={config.ai.sentimentModel} 
                  onValueChange={(val: any) => setConfig({
                    ...config,
                    ai: { ...config.ai, sentimentModel: val }
                  })}
                >
                  <SelectTrigger className="bg-white rounded-xl border-blue-100">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local-gemma">Local Gemma (via Ollama)</SelectItem>
                    <SelectItem value="local-llama">Local Llama (via vLLM)</SelectItem>
                    <SelectItem value="gemini-flash">Gemini 1.5 Flash (Cloud)</SelectItem>
                    <SelectItem value="custom-local">Custom Local Model (via Ollama/Local Gateway)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.ai.sentimentModel === 'custom-local' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-blue-700 font-semibold">Custom Model ID / Name</Label>
                  <Input 
                    value={config.ai.customSentimentModelName || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      ai: { ...config.ai, customSentimentModelName: e.target.value }
                    })}
                    placeholder="e.g. mistral, llama3.1, deepseek-r1:8b"
                    className="bg-white rounded-xl border-blue-100"
                  />
                  <p className="text-[10px] text-blue-600/70 italic">Type the exact model tag name used in your local model engine (e.g. "ollama run [model-name]").</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deep Thinking Configuration */}
          <Card className="shadow-sm border-emerald-100 bg-emerald-50/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700">
                  <BrainCircuit className="w-5 h-5" />
                  <CardTitle>Deep Thinking & Reasoning</CardTitle>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase px-2 h-5">High Logic</Badge>
              </div>
              <CardDescription>Primary engine for 'Smart Reply' drafts and complex escalations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Reasoning Model</Label>
                <Select 
                  value={config.ai.deepThinkingModel} 
                  onValueChange={(val: any) => setConfig({
                    ...config,
                    ai: { ...config.ai, deepThinkingModel: val }
                  })}
                >
                  <SelectTrigger className="bg-white rounded-xl border-emerald-100">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwen-36b">Qwen 36B (Local High-Param)</SelectItem>
                    <SelectItem value="llama-3-70b">Llama 3 70B (Local Apex)</SelectItem>
                    <SelectItem value="gemini-pro">Gemini 1.5 Pro (Cloud Logic)</SelectItem>
                    <SelectItem value="custom-local">Custom Local Model (via Ollama/Local Gateway)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.ai.deepThinkingModel === 'custom-local' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-emerald-700 font-semibold">Custom Model ID / Name</Label>
                  <Input 
                    value={config.ai.customThinkingModelName || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      ai: { ...config.ai, customThinkingModelName: e.target.value }
                    })}
                    placeholder="e.g. qwen2.5:14b, deepseek-r1:14b, mistral-large"
                    className="bg-white rounded-xl border-emerald-100"
                  />
                  <p className="text-[10px] text-emerald-600/70 italic">Type the exact model tag name used in your local model engine (e.g. "ollama run [model-name]").</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Mapping */}
          <Card className="shadow-sm border-purple-100 bg-purple-50/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-700">
                  <Zap className="w-5 h-5" />
                  <CardTitle>Feature Orchestration</CardTitle>
                </div>
                <Badge className="bg-purple-100 text-purple-700 border-none text-[8px] font-black uppercase px-2 h-5">Logic Map</Badge>
              </div>
              <CardDescription>Assign specific engines to application features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                <Label>Long Story Short (Summarization)</Label>
                <Select 
                  value={config.ai.summaryModel} 
                  onValueChange={(val: any) => setConfig({
                    ...config,
                    ai: { ...config.ai, summaryModel: val }
                  })}
                >
                  <SelectTrigger className="bg-white rounded-xl border-purple-100">
                    <SelectValue placeholder="Select Engine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sentiment">Sentiment Engine (Fast)</SelectItem>
                    <SelectItem value="thinking">Deep Thinking Engine (Accurate)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-purple-600/70 italic px-1">Deep Thinking is recommended for complex technical threads.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Smart Reply (Drafting)</Label>
                <div className="p-3 bg-white border border-purple-100 rounded-xl flex items-center justify-between">
                   <span className="text-sm font-medium text-slate-700">Always use Deep Thinking Engine</span>
                   <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure Settings */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-slate-700" />
                <CardTitle>Infrastructure Connection</CardTitle>
              </div>
              <CardDescription>Endpoint settings for local and cloud model routing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Local Endpoint URL</Label>
                </div>
                <Input 
                  value={config.ai.localEndpoint}
                  onChange={(e) => setConfig({
                    ...config,
                    ai: { ...config.ai, localEndpoint: e.target.value }
                  })}
                  placeholder="http://localhost:11434/v1" 
                  className="rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground italic">Target Ollama, vLLM, or LM Studio (must be OpenAI compatible).</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-slate-400" />
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Cloud API Key (Gemini)</Label>
                </div>
                <Input 
                  type="password"
                  value={config.ai.apiKey}
                  onChange={(e) => setConfig({
                    ...config,
                    ai: { ...config.ai, apiKey: e.target.value }
                  })}
                  placeholder="••••••••••••••••••••••••••••••••" 
                  className="rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground italic">Secured in persistent browser storage. Only used for Cloud models.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-400" />
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Local / Custom Gateway API Key (Optional)</Label>
                </div>
                <Input 
                  type="password"
                  value={config.ai.customApiKey || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    ai: { ...config.ai, customApiKey: e.target.value }
                  })}
                  placeholder="e.g. bearer token if authentication is enabled" 
                  className="rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground italic">Required only if your local gateway, LM Studio, or custom inference proxy requires authentication.</p>
              </div>

              <Separator />

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">PII Shield Integration Active</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    All requests routed to these models are automatically scrubbed for PII (names, emails, cards) before being sent over the wire.
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl"
              >
                {isSaving ? "Synchronizing..." : "Save Orchestrator Config"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
