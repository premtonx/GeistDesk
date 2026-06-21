import React, { useState } from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Terminal, 
  Globe, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  Network,
  ArrowRight,
  Fingerprint,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { logAudit } from '../../services/auditService';

export default function MCPHubPage() {
  const [activeBrain, setActiveBrain] = useState('gemini-3');
  const [showProxyDocs, setShowProxyDocs] = useState(false);

  const BRAINS = [
    { 
      id: 'gemini-3', 
      name: 'Gemini 3 Pro', 
      provider: 'Google GeistDesk Platform', 
      type: 'Managed Cloud', 
      status: 'active',
      latency: '240ms',
      security: 'Google Sovereign Cloud'
    },
    { 
      id: 'ollama-local', 
      name: 'Llama 3 (Local)', 
      provider: 'Ollama Instance', 
      type: 'On-Prem / Local', 
      status: 'disconnected',
      latency: '15ms',
      security: 'Isolated Intranet'
    },
    { 
      id: 'vllm-cluster', 
      name: 'DeepSeek 2.5', 
      provider: 'vLLM Cluster', 
      type: 'Enterprise GPU Pool', 
      status: 'warning',
      latency: '85ms',
      security: 'Self-Signed (Risk)'
    }
  ];

  const handleBrainSwap = (id: string) => {
    setActiveBrain(id);
    logAudit({
      module: 'system',
      action: 'MCP_BRAIN_SWAPPED',
      severity: 'high',
      details: { newBrain: id, method: 'MCP_ModelContextProtocol' }
    });
    toast.success(`MCP Handshake Successful: Switched Brain to ${id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA] p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10 pb-20">
        
        {/* MCP Strategy Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div className="bg-black text-white p-2 rounded-lg">
                   <Network className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">Protocol Standard</span>
                   <h1 className="text-4xl font-black text-black tracking-tight uppercase italic leading-none mt-1">MCP Hub</h1>
                </div>
             </div>
             <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
                <span className="font-black text-black">Model Context Protocol (MCP)</span> host implementation. Swap your "Brain" (LLM) while keeping GeistDesk "Hands" (Tools) intact.
             </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100 italic font-bold text-xs">
             <ShieldCheck className="w-4 h-4" />
             Verified MCP 1.2 Compliant
          </div>
        </header>

        {/* Model Selection (The Brains) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {BRAINS.map((brain) => (
             <motion.div
               key={brain.id}
               whileHover={{ y: -5 }}
               className={`relative h-full`}
             >
                <Card className={`h-full rounded-[2.5rem] border-2 transition-all p-8 flex flex-col justify-between ${
                  activeBrain === brain.id ? 'border-black bg-white shadow-xl' : 'border-slate-100 bg-slate-50/50 grayscale opacity-60'
                }`}>
                   <div>
                      <div className="flex items-center justify-between mb-6">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                            brain.id === 'gemini-3' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-600'
                         }`}>
                            <Cpu className="w-7 h-7" />
                         </div>
                         {activeBrain === brain.id && (
                           <Badge className="bg-black text-white text-[9px] font-black uppercase tracking-widest px-3">Active Brain</Badge>
                         )}
                      </div>
                      <h3 className="text-2xl font-black text-black tracking-tighter italic">{brain.name}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{brain.provider}</p>
                      
                      <div className="mt-8 space-y-3">
                         <div className="flex items-center justify-between py-2 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Latency</span>
                            <span className="text-xs font-black text-black">{brain.latency}</span>
                         </div>
                         <div className="flex items-center justify-between py-2 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Standard</span>
                            <Badge variant="outline" className="text-[8px] font-black uppercase">v2026.4</Badge>
                         </div>
                      </div>
                   </div>

                   <div className="mt-10">
                      {activeBrain === brain.id ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                           <CheckCircle2 className="w-4 h-4" /> Connected
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleBrainSwap(brain.id)}
                          className="w-full bg-slate-900 border-none rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest group"
                        >
                           Swap Brain <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      )}
                   </div>
                </Card>
             </motion.div>
           ))}
        </div>

        {/* vLLM Security Warning & mTLS Guide */}
        <div className="bg-red-50 border-2 border-red-100 rounded-[2.5rem] p-10 relative overflow-hidden">
           <div className="relative z-10 flex flex-col lg:flex-row gap-10 items-center">
              <div className="flex-1 space-y-6">
                 <div className="flex items-center gap-3 text-red-600">
                    <AlertTriangle className="w-8 h-8" />
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter">The vLLM Risk Protocol</h2>
                 </div>
                 <p className="text-red-900/70 text-sm leading-relaxed max-w-2xl font-medium">
                    Industry Standard Warning [2026]: vLLM's <code className="bg-red-200/50 px-1.5 py-0.5 rounded text-red-700 font-mono text-xs">--api-key</code> flag is thin. It leaves non-chat endpoints unauthenticated. Connecting a local LLM directly to GeistDesk without a Hardened Proxy is a <span className="font-black text-red-700 underline decoration-red-300">Level 4 Security Risk</span>.
                 </p>
                 <div className="flex flex-wrap gap-4">
                    <Button 
                      onClick={() => setShowProxyDocs(!showProxyDocs)}
                      className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-widest rounded-xl h-14 px-10 shadow-xl shadow-red-200/50"
                    >
                       Deploy Hardened mTLS Proxy
                    </Button>
                    <Button variant="outline" className="border-red-200 bg-white text-red-600 font-black uppercase text-[11px] tracking-widest rounded-xl h-14 px-10">
                       View Registry Logs
                    </Button>
                 </div>
              </div>
              <div className="lg:w-80 shrink-0">
                 <div className="bg-white border border-red-100 p-6 rounded-3xl shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proxy Health</h4>
                    <div className="space-y-3">
                       <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full w-4/5 bg-red-500" />
                       </div>
                       <p className="text-[10px] font-bold text-red-600 uppercase">Warning: Unencrypted Channel</p>
                    </div>
                 </div>
              </div>
           </div>
           
           <AnimatePresence>
              {showProxyDocs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-10 pt-10 border-t border-red-200"
                >
                   <div className="bg-slate-900 rounded-3xl p-8 space-y-6">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-white">
                            <Terminal className="w-5 h-5" />
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">Hardened Nginx Configuration (mTLS)</h3>
                         </div>
                         <Badge className="bg-white/10 text-white font-mono text-[9px]">geistdesk-proxy.conf</Badge>
                      </div>
                      <div className="bg-black/50 p-6 rounded-xl border border-white/5 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
                         <pre>{`server {
  listen 443 ssl;
  server_name my-local-llm.geistdesk;

  # Mandatory mTLS Enforcement
  ssl_client_certificate /etc/geistdesk/certs/ca.crt;
  ssl_verify_client on;

  location / {
    proxy_pass http://ollama:11434;
    proxy_set_header X-GeistDesk-Identity $ssl_client_s_dn;
    # Enforce header check for non-chat endpoints
    if ($request_uri ~* "/invocations") {
       auth_request /validate-geistdesk-token;
    }
  }
}`}</pre>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                         <Info className="w-5 h-5 text-blue-400" />
                         <p className="text-[11px] text-slate-400 font-medium">GeistDesk Hub automatically provides the client certificates for your 'Brain' connections. Simply download your organization <span className="text-white font-bold underline">Proxy Bundle</span> and mount it to your Nginx/Kong container.</p>
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>

        {/* MCP Resources / Hands */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <Card className="rounded-[2.5rem] border-slate-200 bg-white p-10 space-y-8">
              <div className="flex items-center gap-4">
                 <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                    <Terminal className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-black tracking-tight uppercase italic">The "Hands" (Context)</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Available tools shared via MCP across all Brains.</p>
                 </div>
              </div>

              <div className="space-y-4">
                 {[
                   { name: 'GEISTDESK_TICKET_MANAGER', desc: 'Read/Write access to the ticketing shard', s: 'Permitted' },
                   { name: 'SHAMIR_SECRET_RESOLVER', desc: 'Ephemeral secret reconstruction handler', s: 'Verified' },
                   { name: 'P_II_SHIELD_V4', desc: 'Real-time lexical redaction engine', s: 'Permitted' },
                   { name: 'AUDIT_LOG_WRITER', desc: 'Immutable governance record keeping', s: 'Verifiable' }
                 ].map((tool, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-black uppercase tracking-tight">{tool.name}</p>
                         <p className="text-[10px] text-slate-500 font-medium">{tool.desc}</p>
                      </div>
                      <Badge className={`${i === 1 ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'} border-none text-[8px] font-black uppercase px-2`}>
                         {tool.s}
                      </Badge>
                   </div>
                 ))}
              </div>
           </Card>

           <Card className="rounded-[2.5rem] border-none bg-gradient-to-br from-slate-900 to-black p-10 text-white relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10 space-y-6">
                 <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/10 mb-2">
                    <Fingerprint className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">Identity-Linked Inference</span>
                 </div>
                 <h3 className="text-3xl font-black italic tracking-tighter leading-tight">
                    Every token generated by your chosen Brain is cryptographically signed by GeistDesk.
                 </h3>
                 <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                    GeistDesk ensures that even if you use a local LLM, the output is verified against your organization\'s legal charter in real-time.
                 </p>
              </div>
              <div className="relative z-10 grid grid-cols-2 gap-6 mt-10">
                 <div>
                    <p className="text-slate-500 font-black uppercase text-[8px] tracking-[0.2em] mb-1">Active Handshake</p>
                    <p className="text-xl font-black font-mono">TLS_1.3_V2</p>
                 </div>
                 <div>
                    <p className="text-slate-500 font-black uppercase text-[8px] tracking-[0.2em] mb-1">Context Window</p>
                    <p className="text-xl font-black font-mono">128K_FUSED</p>
                 </div>
              </div>
              <div className="absolute right-[-40px] top-[-40px] opacity-20 blur-3xl w-60 h-60 bg-blue-500 rounded-full" />
           </Card>
        </div>

      </div>
    </div>
  );
}
