import { useEffect, useRef, useState, type FormEvent } from 'react';
import { 
  X, Terminal, Shield, Monitor, Play, Globe, CheckCircle2, AlertCircle,
  Network, Wifi, Link, ShieldCheck, Power, RefreshCw, Send, ArrowRight
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';

interface LauncherProps {
  isOpen?: boolean;
  onClose: () => void;
  credential: {
    type: string;
    label: string;
    username: string;
    host?: string;
    port?: string;
    domain?: string;
    gateway?: string;
    notes?: string;
    configData?: string;
  } | null;
}

export function GeistVaultSessionLauncher({ isOpen, onClose, credential }: LauncherProps) {
  const [step, setStep] = useState<'connecting' | 'active' | 'closed'>('connecting');
  const [progress, setProgress] = useState(0);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [vpnMetrics, setVpnMetrics] = useState({ ping: 0, rx: 0, tx: 0 });
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !credential) return;

    setStep('connecting');
    setProgress(0);
    setConnectionLogs([]);
    setTerminalLogs([]);
    setTerminalInput('');
    setVpnConnected(false);

    // Dynamic Connection Logs
    const logPool = [
      `Initializing encrypted proxy channel (TLS 1.3)...`,
      `Resolving target host: ${credential.host || 'local.domain.internal'}...`,
      `Quantum-Safe key handshake complete.`,
      `Authenticating user "${credential.username}" via Vault token...`,
      `JIT elevation active: Session scoped to standard agent role.`,
      `Session established successfully.`
    ];

    let currentLogIdx = 0;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('active');
          if (credential.type === 'ssh') {
            setTerminalLogs([
              `Welcome to GeistVault SSH Tunnel v3.2.0-LTS`,
              `Authorized access only. All sessions are cryptographically audited.`,
              `Last login: ${new Date().toLocaleString()} from vault-gateway.internal`,
              `Type "help" for a list of compliance & diagnostics actions.`,
              ` `,
              `geistdesk-agent@${credential.host || 'node'}:~$ `
            ]);
          } else if (credential.type === 'vpn') {
            setVpnConnected(true);
            setVpnMetrics({ ping: 14, rx: 120, tx: 85 });
          }
          return 100;
        }
        
        // Add log
        if (prev % 18 === 0 && currentLogIdx < logPool.length) {
          setConnectionLogs(prevLogs => [...prevLogs, logPool[currentLogIdx]]);
          currentLogIdx++;
        }
        return prev + 5;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isOpen, credential]);

  // Terminal Auto Scroll
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // VPN data generator
  useEffect(() => {
    if (step !== 'active' || credential?.type !== 'vpn' || !vpnConnected) return;

    const vpnInterval = setInterval(() => {
      setVpnMetrics({
        ping: Math.floor(Math.random() * 10) + 12,
        rx: Math.floor(Math.random() * 150) + 100,
        tx: Math.floor(Math.random() * 80) + 60
      });
    }, 2000);

    return () => clearInterval(vpnInterval);
  }, [step, vpnConnected, credential]);

  if (!isOpen || !credential) return null;

  const handleTerminalSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim().toLowerCase();
    const prompt = `geistdesk-agent@${credential.host || 'node'}:~$ ${terminalInput}`;
    
    let response: string[] = [];
    if (cmd === 'help') {
      response = [
        `Available terminal commands:`,
        `  help             - Show this dashboard assistance helper`,
        `  sysinfo          - Display server OS, CPU, memory, and disk parameters`,
        `  health_check     - Audit SSL certificates and API endpoints`,
        `  credentials      - Display linked credentials metadata (not secrets)`,
        `  disconnect       - Safely terminate this session`,
        `  clear            - Wipe active console logs`
      ];
    } else if (cmd === 'sysinfo') {
      response = [
        `System: Linux kernel 6.1.0-21-amd64 x86_64`,
        `Processor: AMD EPYC 7763 64-Core Processor (2 Cores allocated)`,
        `Memory: 3.84 GB / 8.00 GB used (48%)`,
        `Disk Space: 41.2 GB / 100 GB available (41% occupancy)`,
        `Uptime: 104 days, 14 hours, 21 minutes`
      ];
    } else if (cmd === 'health_check') {
      response = [
        `[AUDIT] Starting local diagnostic scan:`,
        `  ⚡ Host Connectivity: ONLINE [latency = 8.4ms]`,
        `  🔒 SSH Configuration: SECURE [Protocol 2, RSA 4096]`,
        `  📜 TLS Certificate: VALID [Expires in 84 days]`,
        `  🛡️ Integrity check: PASS [No anomalies detected]`
      ];
    } else if (cmd === 'credentials') {
      response = [
        `Linked Enterprise Context:`,
        `  - Name: ${credential.label}`,
        `  - Type: ${credential.type.toUpperCase()}`,
        `  - User ID: ${credential.username}`,
        `  - Target Gateway: ${credential.host || 'N/A'}`
      ];
    } else if (cmd === 'clear') {
      setTerminalLogs([`geistdesk-agent@${credential.host || 'node'}:~$ `]);
      setTerminalInput('');
      return;
    } else if (cmd === 'disconnect') {
      setStep('closed');
      toast.info("SSH Session terminated by user");
      return;
    } else {
      response = [`bash: command not found: ${terminalInput}. Type "help" for utility helper.`];
    }

    setTerminalLogs(prev => [
      ...prev.slice(0, prev.length - 1), // remove old prompt line
      prompt,
      ...response,
      ` `,
      `geistdesk-agent@${credential.host || 'node'}:~$ `
    ]);

    setTerminalInput('');
  };

  return (
    <div className="fixed inset-0 bg-[#202124]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl h-[600px] border-[#DADCE0] shadow-2xl rounded-3xl overflow-hidden flex flex-col bg-[#1E1E1E] text-white">
        
        {/* Header */}
        <div className="bg-[#2D2D2D] border-b border-[#3D3D3D] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[#1A73E8] rounded-xl flex items-center justify-center text-white">
              {credential.type === 'ssh' && <Terminal className="w-4 h-4" />}
              {credential.type === 'rdp' && <Monitor className="w-4 h-4" />}
              {credential.type === 'vpn' && <Shield className="w-4 h-4" />}
              {!['ssh', 'rdp', 'vpn'].includes(credential.type) && <Globe className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#F1F3F4]">{credential.label}</span>
                <Badge className="bg-[#3D3D3D] text-[#DADCE0] hover:bg-[#3D3D3D] text-[9px] px-1.5 h-4.5 uppercase">
                  {credential.type}
                </Badge>
              </div>
              <p className="text-[10px] text-[#A8A8A8] font-mono">
                {credential.username} @ {credential.host || 'localhost'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 px-3 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 flex flex-col relative bg-[#151515] overflow-y-auto">
          
          {/* 1. CONNECTING WINDOW */}
          {step === 'connecting' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center space-y-6">
              <div className="relative">
                <RefreshCw className="w-16 h-16 text-[#1A73E8] animate-spin-slow" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-xs text-white font-bold">{progress}%</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-md font-bold text-[#F1F3F4]">Negotiating Proxy Bridge...</h4>
                <p className="text-xs text-[#A8A8A8]">Initiating cryptographic peer connection via local secure service provider.</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#2D2D2D] h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-[#1A73E8] h-full transition-all duration-150" 
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* logs */}
              <div className="w-full bg-[#1E1E1E] border border-[#2D2D2D] rounded-xl p-3 min-h-[100px] text-left font-mono text-[10px] text-[#8CC84B] space-y-1">
                {connectionLogs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-neutral-500 font-bold">❯</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. ACTIVE CHANNELS */}
          {step === 'active' && (
            <div className="flex-1 flex flex-col">
              
              {/* BACKEND-SPECIFIC SCREENS */}
              
              {/* SSH Terminal Screen */}
              {credential.type === 'ssh' && (
                <div className="flex-1 flex flex-col font-mono text-xs p-6 overflow-y-auto bg-[#0C0C0C] text-[#D4D4D4]">
                  <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[300px]">
                    {terminalLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{log}</div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                  <form onSubmit={handleTerminalSubmit} className="mt-4 flex items-center border-t border-[#333333] pt-4 gap-2">
                    <span className="text-[#8CC84B]">geistdesk-agent@{credential.host || 'node'}:~$</span>
                    <Input 
                      className="flex-1 bg-transparent border-none focus-visible:ring-0 text-white font-mono p-0 h-auto"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      placeholder='type "help" for assistance...'
                      autoFocus
                    />
                    <Button type="submit" size="sm" className="bg-[#2D2D2D] hover:bg-[#3D3D3D] text-[10px] h-7 px-3 rounded-lg flex items-center gap-1.5 text-white font-bold uppercase">
                      Execute <Send className="w-3 h-3" />
                    </Button>
                  </form>
                </div>
              )}

              {/* RDP Desktop Sandbox Screen */}
              {credential.type === 'rdp' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 border-none relative overflow-hidden">
                  {/* Subtle Grid overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  
                  {/* Desktop Card Mockup */}
                  <div className="w-full max-w-2xl bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col h-[350px]">
                    <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-300 border-b border-slate-700 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-[#1A73E8]" />
                        <span>Remote Host Desktop Session — {credential.domain || 'SYSTEM'}\\{credential.username}</span>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] uppercase hover:bg-emerald-500/20">CONNECTED</Badge>
                    </div>

                    <div className="flex-1 flex items-center justify-center bg-[#1E293B]">
                      <div className="text-center p-6 space-y-4 max-w-md">
                        <div className="mx-auto w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-emerald-400 animate-pulse border border-white/20">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">Active RDP Tunnel Active</h4>
                          <p className="text-xs text-slate-400">Secure Remote Access established via GeistVault Gateway Tunnel (256-bit AES encryption).</p>
                        </div>
                        <div className="p-3 bg-slate-950/50 rounded-xl space-y-1.5 border border-slate-800 text-left font-mono text-[10px] text-slate-300">
                          <div className="flex justify-between"><span>Host:</span> <span className="font-bold text-white">{credential.host || '19d.abc.12'}</span></div>
                          <div className="flex justify-between"><span>Gateway IP:</span> <span className="font-bold text-white">{credential.gateway || 'tunnel01.us-east'}</span></div>
                          <div className="flex justify-between"><span>Active Since:</span> <span className="font-bold text-white">{new Date().toLocaleTimeString()}</span></div>
                        </div>
                        <Button 
                          onClick={() => {
                            toast.success("Opening native system RDP client protocol via workspace handler...");
                          }} 
                          size="sm" 
                          className="bg-[#1A73E8] hover:bg-[#1765cc] text-xs h-8 px-4 rounded-xl text-white font-bold"
                        >
                          Relaunch in Native Client <ArrowRight className="w-3.5 h-3.5 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VPN Tunnel Connector Screen */}
              {credential.type === 'vpn' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-950 relative overflow-hidden">
                  <div className="w-full max-w-sm bg-[#1E1E1E] border border-[#2D2D2D] rounded-3xl p-6 shadow-2xl relative z-10 text-center space-y-6">
                    <div className="flex justify-between items-center pb-4 border-b border-[#2D2D2D]">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">VPN Tunnel</span>
                      <Badge className={vpnConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-neutral-800 text-neutral-400 h-5"}>
                        {vpnConnected ? "ACTIVE" : "STANDBY"}
                      </Badge>
                    </div>

                    {/* Connect Button */}
                    <div className="flex flex-col items-center py-4 space-y-3">
                      <button 
                        onClick={() => {
                          setVpnConnected(!vpnConnected);
                          toast.info(vpnConnected ? "Disconnecting VPN tunnel..." : "Connecting VPN tunnel...");
                        }}
                        className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all ${
                          vpnConnected 
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]" 
                            : "bg-neutral-800 border-neutral-700 text-neutral-400"
                        }`}
                      >
                        <Power className="w-8 h-8" />
                      </button>
                      <span className="text-xs font-bold">{vpnConnected ? "Tunnel Connected" : "Tunnel Disonnected"}</span>
                    </div>

                    {/* Tunnel Metrics */}
                    {vpnConnected ? (
                      <div className="grid grid-cols-3 gap-2 p-3 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-xs text-neutral-300 font-mono">
                        <div className="space-y-1 border-r border-neutral-800">
                          <p className="text-[9px] text-neutral-500 font-bold uppercase">PING</p>
                          <p className="font-bold text-white flex items-center justify-center gap-1">
                            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            {vpnMetrics.ping}ms
                          </p>
                        </div>
                        <div className="space-y-1 border-r border-neutral-800">
                          <p className="text-[9px] text-neutral-500 font-bold uppercase">RX DOWN</p>
                          <p className="font-bold text-white uppercase">{vpnMetrics.rx} Mbps</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-neutral-500 font-bold uppercase">TX UP</p>
                          <p className="font-bold text-white uppercase">{vpnMetrics.tx} Mbps</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500 font-medium">Click power toggle to initiate routing channel.</p>
                    )}

                    <div className="space-y-1 p-3.5 bg-[#151515] rounded-2xl text-[10px] text-left font-mono text-neutral-400">
                      <div className="flex justify-between"><span>Gateway IP:</span> <span className="text-white">{credential.host || 'vpn.acme.com'}</span></div>
                      <div className="flex justify-between"><span>Configuration:</span> <span className="text-white">{credential.configData ? "WireGuard Profile" : "Standard OpenVPN"}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Web Browser Autofill Frame */}
              {!['ssh', 'rdp', 'vpn'].includes(credential.type) && (
                <div className="flex-1 flex flex-col p-6 bg-neutral-900 overflow-y-auto">
                  <div className="w-full max-w-xl mx-auto bg-[#1E1E1E] border border-[#2D2D2D] rounded-3xl p-6 shadow-2xl text-center space-y-6">
                    <div className="w-12 h-12 bg-[#1A73E8]/10 text-[#1A73E8] rounded-2xl flex items-center justify-center mx-auto border border-[#1A73E8]/20">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-md font-bold text-white">Open Web Console</h4>
                      <p className="text-xs text-[#A8A8A8]">
                        Instantly fill target credentials and launch the dashboard in a secure browser workspace sandbox tab.
                      </p>
                    </div>

                    <div className="p-4 bg-[#151515] rounded-2xl border border-[#2D2D2D] text-left space-y-4 font-mono text-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-[#2D2D2D]">
                        <span className="text-neutral-500">Destination URL:</span>
                        <span className="text-white font-bold lowercase flex items-center gap-1.5">
                          {credential.host || 'https://console.acme.com'}
                          <Link className="w-3.5 h-3.5 text-neutral-500" />
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Secured Autofill ID:</span>
                        <span className="text-white font-bold">{credential.username}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-center pt-2">
                      <Button 
                        onClick={() => {
                          toast.success("Autofill script injected successfully!");
                          window.open(credential.host?.startsWith('http') ? credential.host : `https://${credential.host || 'google.com'}`, '_blank');
                          onClose();
                        }}
                        className="bg-[#1A73E8] hover:bg-[#1765cc] text-xs h-10 px-6 rounded-xl font-bold text-white"
                      >
                        Browser Inject & Launch
                      </Button>
                      <Button 
                        onClick={() => {
                          navigator.clipboard.writeText(credential.username);
                          toast.success("Username copied to clipboard!");
                        }}
                        variant="ghost" 
                        className="text-neutral-400 hover:text-white text-xs"
                      >
                        Copy Identity
                      </Button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 3. TERMINATED WINDOW */}
          {step === 'closed' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="h-16 w-16 bg-[#2D2D2D] rounded-full flex items-center justify-center text-neutral-500">
                <CheckCircle2 className="w-8 h-8 text-[#34A853]" />
              </div>
              <h4 className="text-md font-bold text-white">Session Terminated</h4>
              <p className="text-xs text-[#A8A8A8] max-w-xs">
                Your sovereign credential bridge was closed successfully. Ephemeral access credentials have been destroyed in the local gateway.
              </p>
              <Button onClick={onClose} size="sm" className="bg-[#1A73E8] hover:bg-[#1765cc] font-bold text-xs h-9 px-6 rounded-xl text-white mt-4">
                Return to Vault
              </Button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[#2D2D2D] border-t border-[#3D3D3D] px-6 py-3.5 flex justify-between items-center text-[10px] text-[#A8A8A8] font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Auditor Level Connection: AUDIT_STAMP_MD5_AES</span>
          </div>
          <div>
            IP Routing: Gateway [10.252.8.4] · Host [{credential.host || '127.0.0.1'}]
          </div>
        </div>
      </Card>
    </div>
  );
}
