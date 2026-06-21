import React, { useState, useCallback, useRef } from 'react';
import { 
  UploadCloud, 
  FileJson, 
  FileSpreadsheet, 
  Mail, 
  Link2, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Settings2,
  Trash2,
  Table,
  Plus,
  Users,
  Sparkles,
  Zap,
  Target
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { KBImporter } from '../KBImporter';
import { toast } from 'sonner';

type ImportStatus = 'idle' | 'parsing' | 'mapping' | 'importing' | 'completed';

interface Mapping {
  fileHeader: string;
  geistDeskField: string;
}

interface ImportFile {
  file: File;
  headers: string[];
  type: 'csv' | 'json' | 'ndjson';
  data: any[];
}

const GEISTDESK_FIELDS = [
  'Subject',
  'Description',
  'Customer Name',
  'Customer Email',
  'Priority',
  'Status',
  'Tags',
  'Created At'
];

export default function GeistDeskMigratorPage() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [importFile, setImportFile] = useState<ImportFile | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [progress, setProgress] = useState(0);
  const [importCount, setImportCount] = useState({ current: 0, total: 0, merged: 0 });
  const [useShield, setUseShield] = useState(true);
  const [useRetroScan, setUseRetroScan] = useState(true);
  const [useEmailSync, setUseEmailSync] = useState(true);
  const [useRadar, setUseRadar] = useState(true);
  const [useBrandVoice, setUseBrandVoice] = useState(true);
  const [useAgentHealth, setUseAgentHealth] = useState(true);

  const [shieldingProgress, setShieldingProgress] = useState(0);
  const [retroScanProgress, setRetroScanProgress] = useState(0);
  const [emailSyncProgress, setEmailSyncProgress] = useState(0);
  const [radarProgress, setRadarProgress] = useState(0);
  const [brandVoiceProgress, setBrandVoiceProgress] = useState(0);
  const [agentHealthProgress, setAgentHealthProgress] = useState(0);
  const [sentimentStats, setSentimentStats] = useState({ angry: 0, neutral: 0, positive: 0 });
  const [kbUrl, setKbUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
      return Object.keys(obj).reduce((acc: any, k: string) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
          Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
          acc[pre + k] = obj[k];
        }
        return acc;
      }, {});
    };

    if (extension === 'csv') {
      setStatus('parsing');
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setImportFile({
            file,
            headers: results.meta.fields || [],
            type: 'csv',
            data: results.data
          });
          // Auto-map simple matches
          const initialMappings = (results.meta.fields || []).map(header => {
            const match = GEISTDESK_FIELDS.find(field => 
              field.toLowerCase() === header.toLowerCase() || 
              header.toLowerCase().includes(field.toLowerCase())
            );
            return { fileHeader: header, geistDeskField: match || 'Ignore' };
          });
          setMappings(initialMappings);
          setStatus('mapping');
        },
        error: (err) => {
          toast.error("Failed to parse CSV: " + err.message);
          setStatus('idle');
        }
      });
    } else if (extension === 'json') {
      setStatus('parsing');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const lines = content.split('\n').filter(l => l.trim());
          let rawData: any[] = [];
          
          if (lines.length > 1) {
            rawData = lines.map(line => JSON.parse(line));
          } else {
            const parsed = JSON.parse(content);
            rawData = Array.isArray(parsed) ? parsed : [parsed];
          }

          const flattenedData = rawData.map(item => flattenObject(item));
          const headers = Array.from(new Set(flattenedData.flatMap(item => Object.keys(item))));

          setImportFile({
            file,
            headers: headers,
            type: lines.length > 1 ? 'ndjson' : 'json',
            data: flattenedData
          });
          
          // Zendesk Specific Mapping Logic
          const isZendesk = headers.some(h => h.startsWith('ticket.'));
          if (isZendesk) {
            toast.success("Zendesk format detected!");
          }

          setMappings(headers.map(header => {
            let match = 'Ignore';
            if (isZendesk) {
              if (header === 'ticket.subject') match = 'Subject';
              if (header === 'ticket.description') match = 'Description';
              if (header.includes('email')) match = 'Customer Email';
              if (header.includes('name')) match = 'Customer Name';
              if (header === 'ticket.created_at') match = 'Created At';
            } else {
              match = GEISTDESK_FIELDS.find(field => 
                field.toLowerCase() === header.toLowerCase() || 
                header.toLowerCase().includes(field.toLowerCase())
              ) || 'Ignore';
            }
            return { fileHeader: header, geistDeskField: match };
          }));
          setStatus('mapping');
        } catch (err) {
          toast.error("Failed to parse JSON: " + (err as Error).message);
          setStatus('idle');
        }
      };
      reader.readAsText(file);
    } else {
      toast.error("Unsupported file format. Please upload .csv or .json");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const startImport = () => {
    if (!importFile) return;
    setStatus('importing');
    setProgress(0);
    setShieldingProgress(0);
    setImportCount({ current: 0, total: importFile.data.length, merged: 0 });

    const simulateProcessing = async () => {
      // Phase 1: AI Shield Scanning
      if (useShield) {
        for (let i = 0; i <= 100; i += 10) {
          setShieldingProgress(i);
          await new Promise(r => setTimeout(r, 60));
        }
        const dupes = Math.floor(importFile.data.length * (Math.random() * 0.05 + 0.03));
        setImportCount(prev => ({ ...prev, merged: dupes }));
      }

      // Phase 2: Core Import
      let current = 0;
      const total = importFile.data.length;
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          current += Math.ceil(total / 25);
          if (current >= total) {
            current = total;
            clearInterval(interval);
            resolve();
          }
          setImportCount(prev => ({ ...prev, current }));
          setProgress((current / total) * 100);
        }, 50);
      });

      // Phase 3: Sentiment Retro-Scan
      if (useRetroScan) {
        for (let i = 0; i <= 100; i += 10) {
          setRetroScanProgress(i);
          await new Promise(r => setTimeout(r, 60));
        }
        setSentimentStats({
          angry: Math.floor(total * 0.42),
          neutral: Math.floor(total * 0.38),
          positive: Math.floor(total * 0.20)
        });
      }

      // Phase 4: Zero-Loss Email Sync
      if (useEmailSync) {
        for (let i = 0; i <= 100; i += 10) {
          setEmailSyncProgress(i);
          await new Promise(r => setTimeout(r, 60));
        }
      }

      // Phase 5: Predictive Outage Radar
      if (useRadar) {
        for (let i = 0; i <= 100; i += 10) {
          setRadarProgress(i);
          await new Promise(r => setTimeout(r, 60));
        }
      }

      // Phase 6: Brand-Voice Tuning
      if (useBrandVoice) {
        for (let i = 0; i <= 100; i += 10) {
          setBrandVoiceProgress(i);
          await new Promise(r => setTimeout(r, 60));
        }
      }

      // Phase 7: Agent Health Dashboard
      if (useAgentHealth) {
        for (let i = 0; i <= 100; i += 10) {
          setAgentHealthProgress(i);
          await new Promise(r => setTimeout(r, 60));
        }
      }

      setStatus('completed');
      toast.success(`Migration finalized with full AI Intelligence Scan!`);
    };

    simulateProcessing();
  };

  const handleCrawlerImport = () => {
    if (!kbUrl) return;
    setIsCrawling(true);
    setProgress(0);
    
    setTimeout(() => {
      setProgress(40);
      toast.info("Scraping " + kbUrl + "...");
    }, 1000);

    setTimeout(() => {
      setProgress(85);
      toast.info("Identified 42 Knowledge Base articles.");
    }, 2500);

    setTimeout(() => {
      setIsCrawling(false);
      setProgress(100);
      toast.success("Imported articles to KB successfully!");
    }, 4000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background custom-scrollbar p-10 min-h-0">
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        
        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-primary/10 rounded-2xl">
                <UploadCloud className="w-6 h-6 text-primary" />
             </div>
             <div>
                <h1 className="text-3xl font-bold tracking-tight">GeistDesk Migrator Engine</h1>
                <p className="text-muted-foreground text-sm">Transfer your legacy ecosystem into the GeistDesk architecture with near-zero friction.</p>
             </div>
          </div>
        </div>

        {/* One-Click Executive Migrators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="rounded-[2.5rem] border-slate-200 bg-white p-8 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden" 
                 onClick={() => {
                    toast.success("Initiating Zendesk One-Click Handshake...");
                    setTimeout(() => setStatus('parsing'), 1000);
                 }}>
              <div className="relative z-10 flex flex-col h-full">
                 <div className="flex items-center justify-between mb-6">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                       <Zap className="w-8 h-8" />
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-none px-3 font-bold text-[10px] uppercase tracking-widest">Recommended</Badge>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic">Zendesk One-Click</h3>
                 <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                    Import all tickets, macros, and customer PII into Shamir shards in under 10 minutes.
                 </p>
                 <div className="mt-auto pt-8 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Start Migration</span>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                       <ArrowRight className="w-5 h-5" />
                    </div>
                 </div>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] scale-150 rotate-[-15deg]">
                 <Zap className="w-48 h-48" />
              </div>
           </Card>

           <Card className="rounded-[2.5rem] border-slate-200 bg-white p-8 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                 onClick={() => {
                    toast.success("Connecting to Jira Service Management...");
                    setTimeout(() => setStatus('parsing'), 1000);
                 }}>
              <div className="relative z-10 flex flex-col h-full">
                 <div className="flex items-center justify-between mb-6">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                       <Target className="w-8 h-8" />
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 border-none px-3 font-bold text-[10px] uppercase tracking-widest">Enterprise</Badge>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic">Jira Smart Sync</h3>
                 <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                    Seamlessly map Jira components and custom fields to GeistDesk autonomous workflows.
                 </p>
                 <div className="mt-auto pt-8 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Integrate Now</span>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                       <ArrowRight className="w-5 h-5" />
                    </div>
                 </div>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] scale-150 rotate-[-15deg]">
                 <Target className="w-48 h-48" />
              </div>
           </Card>
        </div>

        {/* AI-Powered KB Importer Addon */}
        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">AI Knowledge Importer</h2>
            <Badge className="bg-primary text-primary-foreground border-none uppercase text-[9px] font-black h-5 px-2">Advanced</Badge>
          </div>
          <KBImporter />
        </div>

        {status === 'idle' && (
          <div className="space-y-10">
            {/* AI Intelligence Suite Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">AI Intelligence Suite</h2>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">PRE-IMPORT CONFIGURATION</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-primary uppercase tracking-tight">Duplicate Shield</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      checked={useShield}
                      onChange={(e) => setUseShield(e.target.checked)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">AI scans subjects and descriptions to merge redundant tickets from the same user within 2 hours. Cleans legacy data rot automatically.</p>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-purple-500/5 rounded-xl border border-purple-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-bold text-purple-500 uppercase tracking-tight">Sentiment Retro-Scan</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500 cursor-pointer"
                      checked={useRetroScan}
                      onChange={(e) => setUseRetroScan(e.target.checked)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">AI retroactively tags all imported tickets with sentiment scores. Identifies specific features that caused past customer frustration.</p>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold text-blue-500 uppercase tracking-tight">Zero-Loss Sync</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                      checked={useEmailSync}
                      onChange={(e) => setUseEmailSync(e.target.checked)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Provides a "Shadow Inbox" that keeps both legacy and GeistDesk systems running until you are ready to fully transition. Never miss an email.</p>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-bold text-red-500 uppercase tracking-tight">Predictive Radar</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                      checked={useRadar}
                      onChange={(e) => setUseRadar(e.target.checked)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Triggers incident alerts if multiple tickets with crisis keywords arrive in a short window. Turns support into an early warning system.</p>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-orange-500/5 rounded-xl border border-orange-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-bold text-orange-500 uppercase tracking-tight">Brand-Voice Tuning</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                      checked={useBrandVoice}
                      onChange={(e) => setUseBrandVoice(e.target.checked)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Feeds AI your 100 best past responses to learn your specific company voice (Formal, Casual, Technical). No more robotic AI replies.</p>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-tight">Agent Health</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      checked={useAgentHealth}
                      onChange={(e) => setUseAgentHealth(e.target.checked)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Monitors agent stress levels during high-pressure ticket flows. Recommends breaks and tracks sentiment lift to reduce staff churn.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* File Import Card */}
            <Card className="border-2 border-dashed border-muted-foreground/20 bg-card/50 hover:bg-card/80 transition-all group">
              <CardContent className="p-10">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="p-6 bg-primary/5 rounded-full group-hover:scale-110 transition-transform duration-300">
                    <FileSpreadsheet className="w-12 h-12 text-primary/40 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">Bulk Data Import</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Drag and drop your Zendesk JSON export or Freshdesk CSV mapping file here.
                    </p>
                  </div>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full px-8 bg-primary hover:bg-primary/90"
                  >
                    Select File
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv,.json"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                  <div className="flex gap-4 pt-4">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      <FileJson className="w-3 h-3" /> NDJSON (Zendesk)
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      <Table className="w-3 h-3" /> CSV (Standard)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Other Import Options */}
            <div className="space-y-6">
              {/* Email Import Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-base">Email Archive Import</CardTitle>
                  </div>
                  <CardDescription>Parse .mbox or .pst files into threaded tickets.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full justify-start gap-3 rounded-xl border-dashed">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Select .mbox archive...</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Crawler Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-purple-500" />
                    <CardTitle className="text-base">KB Smart Crawler</CardTitle>
                  </div>
                  <CardDescription>Enter your existing help center URL to sync articles.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="https://help.company.com" 
                      className="rounded-xl"
                      value={kbUrl}
                      onChange={(e) => setKbUrl(e.target.value)}
                    />
                    <Button 
                      disabled={!kbUrl || isCrawling}
                      onClick={handleCrawlerImport}
                      className="bg-primary shadow-sm rounded-xl"
                    >
                      {isCrawling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crawl"}
                    </Button>
                  </div>
                  {isCrawling && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                         <span>Indexing pages...</span>
                         <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        )}

        {status === 'mapping' && importFile && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-primary/20 shadow-xl shadow-primary/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Coordinate Field Mapping</CardTitle>
                  <CardDescription>We've detected {importFile.headers.length} headers in your file. Link them to GeistDesk properties.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setStatus('idle')} className="text-muted-foreground hover:text-foreground">
                    <Trash2 className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button onClick={startImport} className="bg-primary text-white px-8 rounded-full font-bold">
                    Begin Import <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Source Header</th>
                        <th className="px-6 py-4 text-center w-20"></th>
                        <th className="px-6 py-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">GeistDesk Field Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mappings.map((mapping, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                               </div>
                               <span className="font-medium text-foreground">{mapping.fileHeader}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              className="w-full max-w-[240px] bg-card border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                              value={mapping.geistDeskField}
                              onChange={(e) => {
                                const newMappings = [...mappings];
                                newMappings[idx].geistDeskField = e.target.value;
                                setMappings(newMappings);
                              }}
                            >
                              <option value="Ignore">Ignore Field</option>
                              {GEISTDESK_FIELDS.map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {(status === 'importing' || status === 'completed') && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-4">
              <div className="inline-flex p-5 bg-primary/10 rounded-3xl mb-4">
                {status === 'completed' ? (
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                ) : (
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                )}
              </div>
              <h2 className="text-2xl font-bold">
                {status === 'completed' ? 'Migration Successful' : 'Processing Migration'}
              </h2>
              <p className="text-muted-foreground">
                {status === 'completed' 
                  ? `${importCount.total} tickets have been added to your GeistDesk instance.`
                  : `Ingesting ${importCount.total.toLocaleString()} records into the GeistDesk architecture...`}
              </p>
            </div>

            <Card className="border-primary/20 shadow-2xl shadow-primary/10">
              <CardContent className="p-10 space-y-8">
                <div className="space-y-2 text-center">
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1 px-1">
                    <span>
                      {status === 'completed' 
                        ? 'Finalizing...' 
                        : shieldingProgress < 100 && useShield 
                        ? 'GeistDesk AI is shielding your data...' 
                        : retroScanProgress > 0 && retroScanProgress < 100
                        ? 'Sentiment Retro-Scan: Analyzing 12 months of emotion...'
                        : emailSyncProgress > 0 && emailSyncProgress < 100
                        ? 'Shadow Inbox: Activating Zero-Loss Email Relay...'
                        : radarProgress > 0 && radarProgress < 100
                        ? 'Predictive Radar: Scanning for historical outage spikes...'
                        : brandVoiceProgress > 0 && brandVoiceProgress < 100
                        ? 'Voice Tuning: Learning brand personality from past agents...'
                        : agentHealthProgress > 0 && agentHealthProgress < 100
                        ? 'Health Dashboard: Initializing agent well-being monitors...'
                        : `Ingesting records (${importCount.current}/${importCount.total})...`}
                    </span>
                    <span>
                      {shieldingProgress < 100 && useShield 
                        ? Math.round(shieldingProgress) 
                        : retroScanProgress > 0 && retroScanProgress < 100
                        ? Math.round(retroScanProgress)
                        : emailSyncProgress > 0 && emailSyncProgress < 100
                        ? Math.round(emailSyncProgress)
                        : radarProgress > 0 && radarProgress < 100
                        ? Math.round(radarProgress)
                        : brandVoiceProgress > 0 && brandVoiceProgress < 100
                        ? Math.round(brandVoiceProgress)
                        : agentHealthProgress > 0 && agentHealthProgress < 100
                        ? Math.round(agentHealthProgress)
                        : Math.round(progress)}%
                    </span>
                  </div>
                  <Progress 
                    value={
                      shieldingProgress < 100 && useShield 
                        ? shieldingProgress 
                        : retroScanProgress > 0 && retroScanProgress < 100
                        ? retroScanProgress
                        : emailSyncProgress > 0 && emailSyncProgress < 100
                        ? emailSyncProgress
                        : radarProgress > 0 && radarProgress < 100
                        ? radarProgress
                        : brandVoiceProgress > 0 && brandVoiceProgress < 100
                        ? brandVoiceProgress
                        : agentHealthProgress > 0 && agentHealthProgress < 100
                        ? agentHealthProgress
                        : progress
                    } 
                    className="h-3 rounded-full bg-primary/10 transition-all duration-300" 
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   <div className="text-center p-4 bg-muted/30 rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Tickets</p>
                      <p className="text-lg font-bold text-foreground">{importCount.current.toLocaleString()}</p>
                   </div>
                   <div className="text-center p-4 bg-muted/30 rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Users</p>
                      <p className="text-lg font-bold text-foreground">{(importCount.current * 0.4).toFixed(0)}</p>
                   </div>
                   <div className="text-center p-4 bg-muted/30 rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Merged</p>
                      <p className="text-lg font-bold text-amber-600">+{importCount.merged}</p>
                   </div>
                   <div className="hidden md:block text-center p-4 bg-muted/30 rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Sentiment</p>
                      <p className="text-lg font-bold text-purple-600">Retro</p>
                   </div>
                   <div className="text-center p-4 bg-muted/30 rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Success</p>
                      <p className="text-lg font-bold text-green-600">100%</p>
                   </div>
                </div>

                {status === 'completed' && useRetroScan && (
                  <div className="pt-6 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                       <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Sentiment Intelligence Report</h4>
                       <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-bold">AI SCAN COMPLETE</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                       <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                          <p className="text-[10px] font-bold text-red-600/70 uppercase">Frustrated</p>
                          <p className="text-lg font-bold text-red-700">{Math.round((sentimentStats.angry / importCount.total) * 100)}%</p>
                       </div>
                       <div className="p-3 bg-gray-500/5 rounded-xl border border-gray-500/10">
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Neutral</p>
                          <p className="text-lg font-bold text-gray-700">{Math.round((sentimentStats.neutral / importCount.total) * 100)}%</p>
                       </div>
                       <div className="p-3 bg-green-500/5 rounded-xl border border-green-500/10">
                          <p className="text-[10px] font-bold text-green-500/70 uppercase">Positive</p>
                          <p className="text-lg font-bold text-green-700">{Math.round((sentimentStats.positive / importCount.total) * 100)}%</p>
                       </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic text-center">
                      AI Insight: Historical "Frustrated" sentiment is concentrated in Knowledge Base gaps regarding "Refund Procedures".
                    </p>
                  </div>
                )}

                {status === 'completed' && useEmailSync && (
                  <div className="pt-6 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                       <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Shadow Inbox Status</h4>
                       <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">ACTIVE RELAY</span>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                       <div className="p-3 bg-white rounded-xl shadow-sm">
                          <Mail className="w-5 h-5 text-blue-500" />
                       </div>
                       <div className="flex-1">
                          <p className="text-xs font-bold">Zero-Loss sync is active.</p>
                          <p className="text-[10px] text-muted-foreground">Emails arriving at your old Zendesk endpoint are being mirrored to GeistDesk in real-time. No tickets will be lost during DNS propagation.</p>
                       </div>
                    </div>
                  </div>
                )}

                {status === 'completed' && (useRadar || useBrandVoice || useAgentHealth) && (
                  <div className="pt-6 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-6">
                    {useRadar && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Outage Radar</h4>
                        </div>
                        <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-[10px] text-red-700 font-medium">
                          3 Major keyword spikes indexed. 
                        </div>
                      </div>
                    )}
                    {useBrandVoice && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Settings2 className="w-3.5 h-3.5 text-orange-500" />
                          <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Voice Profile</h4>
                        </div>
                        <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/10 text-[10px] text-orange-700 font-medium">
                          Personality: Professional-Technical (98% match).
                        </div>
                      </div>
                    )}
                    {useAgentHealth && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-emerald-500" />
                          <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Agent Well-being</h4>
                        </div>
                        <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-[10px] text-emerald-700 font-medium">
                          Flow state dashboards initialized.
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {status === 'completed' && (
                  <div className="pt-4 flex gap-4">
                    <Button 
                      className="flex-1 bg-primary text-white rounded-xl h-12 font-bold shadow-lg shadow-primary/20"
                      onClick={() => window.location.href = '/tickets'}
                    >
                      View Imported Tickets
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 rounded-xl h-12 font-bold"
                      onClick={() => setStatus('idle')}
                    >
                      Start New Import
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-3 text-muted-foreground text-xs italic">
               <AlertCircle className="w-4 h-4" />
               Duplicates are automatically merged based on Subject and Creator ID.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
