import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Globe, 
  Lock, 
  Database, 
  Cpu, 
  Sparkles, 
  Play, 
  Layers, 
  ExternalLink, 
  EyeOff, 
  Terminal,
  Server,
  Key,
  CheckCircle2,
  FileSpreadsheet,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { useTranslation } from '../../lib/context/I18nContext';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function SovereigntyCenterPage() {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const isDe = language === 'de';

  // Live telemetry mimicking the real-time activity of a sovereign nodes deployment
  const [telemetry, setTelemetry] = useState({
    aiRequests: 18241,
    dataSentOutside: 0,
    piiRedacted: 5012,
    complianceViolations: 0,
    encryptionStatus: 'Active',
    auditCoverage: 100,
    systemUptime: '99.99%',
    cpuLoad: 12
  });

  // Policy options
  const [policies, setPolicies] = useState({
    enforceGeofencing: true,
    blockExternalAPIs: true,
    immutableLogging: true,
    piiScrubbingLevel: 'strict'
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        aiRequests: prev.aiRequests + Math.floor(Math.random() * 2) + 1,
        piiRedacted: prev.piiRedacted + (Math.random() > 0.65 ? 1 : 0),
        cpuLoad: Math.min(35, Math.max(8, prev.cpuLoad + Math.floor(Math.random() * 5) - 2))
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleTogglePolicy = (policy: keyof typeof policies) => {
    setPolicies(prev => {
      const updated = { ...prev, [policy]: !prev[policy] };
      toast.success(
        isDe 
          ? `Souveränitäts-Richtlinie '${policy}' erfolgreich aktualisiert!` 
          : `Sovereignty safety policy '${policy}' successfully updated!`
      );
      return updated;
    });
  };

  const handleDownloadReport = () => {
    toast.success(
      isDe ? "Konformitätsnachweis-Auditbericht (PDF) generiert!" : "Compliance Sovereign Audit Attestation Report (PDF) downloaded successfully!"
    );
  };

  const recentIntercepts = [
    { id: 1, type: 'PII Scrubbing', item: 'Email masked', service: 'Context Router', state: 'Success', node: 'DE-WEST-1' },
    { id: 2, type: 'Geofencing', item: 'Request forced to DE Node', service: 'Sovereign Core', state: 'Enforced', node: 'DE-WEST-2' },
    { id: 3, type: 'Audit Log', item: 'Signed block hash generated', service: 'Ledger Engine', state: 'Immutable', node: 'DE-WEST-1' },
    { id: 4, type: 'Data Egress', item: 'Foreign LLM tracking blocked', service: 'Central Router', state: 'Blocked', node: 'DE-WEST-2' },
  ];

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#fafafa] custom-scrollbar">
      <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
        <AdminBreadcrumbs />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isDe ? 'Nationales Souveränitäts-Center' : 'Sovereignty Center'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isDe 
                ? 'Echtzeit-Überwachung der souveränen Datenresidenz, Verschlüsselungsprotokolle und Zero-Data-Leakage-Infrastruktur.'
                : 'Real-time telemetry of sovereign data residency, zero-leak enterprise controls, and encryption status.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              {isDe ? 'Audit-Zertifikat herunterladen' : 'Export Audit Certificate'}
            </button>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-full shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 font-mono">
                {isDe ? 'Betrieb: Autark (Souverän)' : 'Node: Autonomous (Sovereign)'}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Sovereign Multi-layered Hero Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          {/* AI Requests */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-[0_2px_10px_rgba(15,23,42,0.01)] flex flex-col justify-between hover:border-blue-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                  {isDe ? 'Abgefangene KI-Anfragen' : 'AI Requests'}
                </span>
                <Cpu className="w-4 h-4 text-blue-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {telemetry.aiRequests.toLocaleString()}
              </h3>
            </div>
            <p className="text-[9.5px] text-blue-600 font-bold mt-4 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> 
              {isDe ? 'Infrastruktur routing aktiv' : 'Routed locally'}
            </p>
          </div>

          {/* Data Sent Outside */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-[0_2px_10px_rgba(15,23,42,0.01)] flex flex-col justify-between hover:border-emerald-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                  {isDe ? 'Datenabfluss nach Außen' : 'Egress Leakage'}
                </span>
                <Globe className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-emerald-600 font-mono">
                {telemetry.dataSentOutside}
              </h3>
            </div>
            <p className="text-[9.5px] text-emerald-600 font-bold mt-4 flex items-center gap-1">
              ✓ {isDe ? 'Null-Abfluss garantiert' : 'Strict Local Enclave'}
            </p>
          </div>

          {/* PII Redacted */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-[0_2px_10px_rgba(15,23,42,0.01)] flex flex-col justify-between hover:border-indigo-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                  {isDe ? 'PII-Daten bereinigt' : 'PII Redacted'}
                </span>
                <EyeOff className="w-4 h-4 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-black text-indigo-600 font-mono">
                {telemetry.piiRedacted.toLocaleString()}
              </h3>
            </div>
            <p className="text-[9.5px] text-indigo-600 font-bold mt-4 flex items-center gap-1">
              ✓ {isDe ? 'PII-Schild aktiv' : 'PII Shield Encapsulated'}
            </p>
          </div>

          {/* Compliance Violations */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-[0_2px_10px_rgba(15,23,42,0.01)] flex flex-col justify-between hover:border-pink-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                  {isDe ? 'Compliance-Verstöße' : 'Violations'}
                </span>
                <AlertTriangle className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {telemetry.complianceViolations}
              </h3>
            </div>
            <p className="text-[9.5px] text-slate-500 font-bold mt-4 flex items-center gap-1">
              ✓ {isDe ? 'CISO-Konform' : 'Fully Compliant'}
            </p>
          </div>

          {/* Encryption Status */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-[0_2px_10px_rgba(15,23,42,0.01)] flex flex-col justify-between hover:border-amber-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                  {isDe ? 'Verschlüsselung' : 'Encryption Status'}
                </span>
                <Lock className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-amber-600 font-mono">
                {telemetry.encryptionStatus}
              </h3>
            </div>
            <p className="text-[9.5px] text-amber-600 font-bold mt-4 flex items-center gap-1">
              {isDe ? 'AES-256 + HSM' : 'AES-256 / RSA-4096'}
            </p>
          </div>

          {/* Audit Coverage */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-[0_2px_10px_rgba(15,23,42,0.01)] flex flex-col justify-between hover:border-purple-300 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-widest font-mono">
                  {isDe ? 'Audit-Abdeckung' : 'Audit Coverage'}
                </span>
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {telemetry.auditCoverage}%
              </h3>
            </div>
            <p className="text-[9.5px] text-purple-600 font-bold mt-4 flex items-center gap-1">
              ✓ {isDe ? 'Unveränderliche Kryptografie' : 'Immutable Hash Ledger'}
            </p>
          </div>
        </div>

        {/* Main Content Split: Residency Checklist & Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Data Residency Assurances (2/3 col on large screens) */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-slate-200/50 rounded-3xl bg-white shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#1A73E8]" />
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 font-mono">
                    {isDe ? 'Nachweise der souveränen Datenresidenz' : 'Sovereign Compliance & Integrity Assurances'}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {isDe 
                    ? 'Diese verifizierten Systemgarantien beweisen die Unabhängigkeit von externer Fremdverarbeitung.'
                    : 'Verified architectural invariants designed for direct compliance verification by internal CISOs and auditors.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-105">
                
                {/* 1. Residency */}
                <div className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        {isDe ? '✓ Datenresidenz Deutschland' : '✓ Germany Data Residency'}
                      </h4>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-bold">DE-WEST-1</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isDe 
                        ? 'Alle Datenbankaufzeichnungen, Vektorspeicher und Serverrechner befinden sich in deutschen Cloud-Sicherheitszonen.'
                        : 'Every database transaction, file buffer, vector block, and context cache remains strictly on local German nodes.'}
                    </p>
                  </div>
                </div>

                {/* 2. Self Hosted */}
                <div className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        {isDe ? '✓ Autarker Betrieb' : '✓ Isolated Sovereign Instance'}
                      </h4>
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-[8px] font-bold">PREMISE</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isDe 
                        ? 'GeistDesk läuft in einer isolierten, privaten Virtual Private Cloud (VPC), unabhängig von gemeinsam genutzten Hyperscalern.'
                        : 'Deployment is bound securely into a managed isolated container environment with strictly explicit networking inbound routing.'}
                    </p>
                  </div>
                </div>

                {/* 3. No External Processing */}
                <div className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        {isDe ? '✓ Keine externe Fremddatenverarbeitung' : '✓ Zero External Processing Leaks'}
                      </h4>
                      <Badge className="bg-purple-50 text-purple-700 border border-purple-100 text-[8px] font-bold">LOCAL-LLM</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isDe 
                        ? 'Keine Übertragung unverschlüsselter Textkörper oder Modell-Trainingsdaten an fremde Cloud-Provider.'
                        : 'Ensures that zero enterprise document fragments, prompt histories, or feedback logs are shipped out for model retraining.'}
                    </p>
                  </div>
                </div>

                {/* 4. Active Auditing */}
                <div className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        {isDe ? '✓ Aktive fälschungssichere Audit-Protokollierung' : '✓ Active Immutable Audit Logging'}
                      </h4>
                      <Badge className="bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE] text-[8px] font-bold">CRYPTO-HASH</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isDe 
                        ? 'Sämtliche Administrationsereignisse werden in einer kryptografisch verketteten Ledger-Logdatei permanent abgesichert.'
                        : 'Every administrative action produces a SHA-256 state signature recorded to a persistent, immutable security ledger.'}
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Intercepts List */}
            <Card className="border-slate-200/50 rounded-3xl bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-505" style={{ color: '#6366f1' }} />
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 font-mono">
                    {isDe ? 'Letzte Souveränitäts-Eingriffe' : 'Recent Sovereign Intercept Events'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] tracking-wider font-mono">
                        <th className="pb-2 font-black">{isDe ? 'Ereignis-Typ' : 'Guardrail Engine'}</th>
                        <th className="pb-2 font-black">{isDe ? 'Detail' : 'Action taken'}</th>
                        <th className="pb-2 font-black">{isDe ? 'Ziel-Modul' : 'Endpoint Context'}</th>
                        <th className="pb-2 font-black">{isDe ? 'Node ID' : 'Server cluster'}</th>
                        <th className="pb-2 text-right font-black">{isDe ? 'Status' : 'State'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentIntercepts.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/40">
                          <td className="py-2.5 font-bold text-slate-700">{e.type}</td>
                          <td className="py-2.5 text-slate-500 font-mono text-[11px]">{e.item}</td>
                          <td className="py-2.5 text-slate-500">{e.service}</td>
                          <td className="py-2.5 text-slate-400 font-mono text-[10px]">{e.node}</td>
                          <td className="py-2.5 text-right">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-705 border border-emerald-100/50 rounded-full font-extrabold text-[9px] uppercase tracking-wider">
                              {e.state}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Policies Control & Quick Actions (1/3 col on large screens) */}
          <div className="space-y-8">
            <Card className="border-slate-200/50 rounded-3xl bg-white shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1A73E8]" />
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 font-mono">
                    {isDe ? 'Sicherheits-Policen' : 'Infrastructural Policies'}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {isDe 
                    ? 'Regulieren Sie den autonomen lokalen Wirkungskreis im Betrieb.'
                    : 'Toggle dynamic edge limits to hardwire local compliance filters into the API gateway.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                
                {/* 1. Geofencing */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                      {isDe ? 'DE-Geofencing erzwingen' : 'Enforce Geofencing'}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {isDe ? 'Verweigere alle Routing-Nodes außerhalb von Deutschland.' : 'Deny any host nodes outside German borders.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePolicy('enforceGeofencing')}
                    className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer ${policies.enforceGeofencing ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${policies.enforceGeofencing ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 2. Block External APIs */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                      {isDe ? 'Externe Tracking-Schnittstellen blockieren' : 'Block External APIs'}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {isDe ? 'Keine anonymen Aufrufe an Werbedienste oder fremde Telemetrie.' : 'Block telemetry requests going to unauthorized addresses.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePolicy('blockExternalAPIs')}
                    className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer ${policies.blockExternalAPIs ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${policies.blockExternalAPIs ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 3. Immutable Logging */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                      {isDe ? 'Unveränderliche Protokolle' : 'Cryptographic Ledger'}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {isDe ? 'Konstantes Signieren jeder Protokollzeile via SHA-256.' : 'Sign transaction records using client-side keys.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePolicy('immutableLogging')}
                    className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer ${policies.immutableLogging ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${policies.immutableLogging ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Detailed Key Specifications Card Accent */}
                <div className="p-4.5 bg-[#EBF5FF] border border-[#BFDBFE] rounded-2xl text-[11px] text-[#1E40AF] leading-relaxed space-y-2">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#1E40AF] text-[10px]">
                    <Activity className="w-3.5 h-3.5" />
                    {isDe ? 'Souveräne Server-Telemetrie' : 'Isolation Attestation'}
                  </div>
                  <p>
                    {isDe 
                      ? 'Diese Server-Instanzen sind kryptografisch mit dem physischen Sicherheitsanker des Gehosteten Rechenzentrums verknüpft.' 
                      : 'Nodes undergo a continuous health loop verification to ensure there is active isolation on local execution engines.'}
                  </p>
                  <div className="pt-1.5 grid grid-cols-2 gap-2 text-[10px] border-t border-[#BFDBFE] text-[#1A73E8] font-mono">
                    <div>CPU Load: {telemetry.cpuLoad}%</div>
                    <div className="text-right">Uptime: {telemetry.systemUptime}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => navigate('/admin/pii')}
                    variant="outline"
                    className="w-full text-xs py-5 rounded-xl border border-slate-200 text-slate-700 font-bold tracking-tight hover:bg-slate-50"
                  >
                    {isDe ? 'PII-Schutzeinstellungen verwalten' : 'Adjust PII Guardrails'}
                  </Button>
                  <Button
                    onClick={() => navigate('/admin/legal')}
                    variant="outline"
                    className="w-full text-xs py-5 rounded-xl border border-slate-200 text-slate-700 font-bold tracking-tight hover:bg-slate-50"
                  >
                    {isDe ? 'Rechtliche Vorgaben (Legal Hub)' : 'Adjust Forbidden Topics'}
                  </Button>
                </div>

              </CardContent>
            </Card>

            <Card className="border-slate-200/50 rounded-3xl bg-white shadow-sm p-5 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                {isDe ? 'Enterprise-Eignung' : 'Enterprise Scale Certification'}
              </h4>
              <p className="text-xs text-slate-500 leading-normal">
                {isDe 
                  ? 'Entspricht den Anforderungen für sensible Infrastrukturen im Bundesbereich (BSI Kriterien) sowie der europäischen Datenschutz-Grundverordnung (EU-DSGVO).'
                  : 'Complies fully with EU Sovereign Cloud blueprints, German federal health regulatory laws (BSI security requirements), and strict GDPR standards.'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none px-2 py-0.5 rounded text-[8.5px] font-bold font-mono">GDPR COMPLIANT</Badge>
                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none px-2 py-0.5 rounded text-[8.5px] font-bold font-mono">EU SOVEREIGN</Badge>
                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none px-2 py-0.5 rounded text-[8.5px] font-bold font-mono">BSI COMPLIANT</Badge>
              </div>
            </Card>
          </div>

        </div>

      </div>
    </div>
  );
}
