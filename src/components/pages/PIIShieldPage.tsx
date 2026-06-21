import React from 'react';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { useTranslation } from '../../lib/context/I18nContext';
import { toast } from 'sonner';

export default function PIIShieldPage() {
  const { language } = useTranslation();
  const isDe = language !== 'en'; // Default to German unless strictly English
  const [enabled, setEnabled] = React.useState(true);
  
  const redactionRules = [
    { 
      id: 'email', 
      name: isDe ? 'E-Mail-Adressen' : 'Email Addresses', 
      description: isDe ? 'Erkennt und filtert persönliche und geschäftliche E-Mail-Muster.' : 'Detects and masks personal and corporate email patterns.', 
      enabled: true 
    },
    { 
      id: 'phone', 
      name: isDe ? 'Telefonnummern' : 'Phone Numbers', 
      description: isDe ? 'Internationale und lokale Telefonnummernformate.' : 'International and local phone number formats.', 
      enabled: true 
    },
    { 
      id: 'cc', 
      name: isDe ? 'Kreditkarten (PCI)' : 'Credit Card (PCI)', 
      description: isDe ? 'Durch den Luhn-Algorithmus validierte 13-16-stellige Kreditkartennummern.' : 'Luhn-validated 13-16 digit card numbers.', 
      enabled: true 
    },
    { 
      id: 'address', 
      name: isDe ? 'Physische Adressen' : 'Physical Addresses', 
      description: isDe ? 'Straßenadressen, Postleitzahlen und Städtenamen.' : 'Street addresses, zip codes, and city names.', 
      enabled: false 
    },
    { 
      id: 'ssn', 
      name: isDe ? 'Sensible IDs (SSN/USt-IdNr)' : 'Sensitive IDs (SSN/VAT)', 
      description: isDe ? 'Staatlich ausgegebene Identifikationsnummern.' : 'Government-issued identification numbers.', 
      enabled: true 
    },
  ];

  const handleToggleShield = (val: boolean) => {
    setEnabled(val);
    toast.success(
      isDe 
        ? `PII-Schutzschild ${val ? 'aktiviert' : 'deaktiviert'}` 
        : `PII Shield ${val ? 'activated' : 'deactivated'}`
    );
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info(
      isDe 
        ? 'Eigene Regeln erfordern Enterprise-Schreibrechte. Diese Demo-Konfiguration ist gesperrt.' 
        : 'Custom rules require Enterprise write access. This demo configuration is locked.'
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-4xl mx-auto pb-20">
        <AdminBreadcrumbs />

        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-6 h-6 text-emerald-500" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {isDe ? 'PII-Schutzschild' : 'PII Shield'}
              </h1>
            </div>
            <p className="text-slate-500">
              {isDe ? 'Autonome Daten-Filtersysteme und Datenschutz-Hürden.' : 'Autonomous data redaction and privacy guardrails.'}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
               {isDe ? 'Schutz-Status' : 'Shield Status'}
             </span>
             <Switch checked={enabled} onCheckedChange={handleToggleShield} />
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{isDe ? 'Filterlogik' : 'Redaction Logic'}</CardTitle>
                  <CardDescription>
                    {isDe ? 'Bestimmen Sie, welche Muster vor der Übertragung an das LLM geschrubbt werden.' : 'Determine which patterns are scrubbed before reaching the LLM.'}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none font-bold">
                  {isDe ? 'Live-Echtzeitscan' : 'Live Scanning'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-100">
                  {redactionRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                          {rule.enabled ? <EyeOff className="w-5 h-5 text-emerald-500" /> : <Eye className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{rule.name}</span>
                          <span className="text-xs text-slate-500">{rule.description}</span>
                        </div>
                      </div>
                      <Switch defaultChecked={rule.enabled} onCheckedChange={(checked) => {
                        toast.success(
                          isDe 
                            ? `${rule.name} wurde ${checked ? 'eingeschaltet' : 'ausgeschaltet'}`
                            : `${rule.name} was ${checked ? 'enabled' : 'disabled'}`
                        );
                      }} />
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold">{isDe ? 'Eigene Regex-Muster' : 'Custom Regex Patterns'}</CardTitle>
              <CardDescription>
                {isDe ? 'Fügen Sie proprietäre ID-Muster oder interne sensible Fachbegriffe hinzu.' : 'Add proprietary ID patterns or internal sensitive keywords.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddRule} className="flex gap-3">
                <Input placeholder={isDe ? 'Muster-Name (z.B. AWS Keys)' : 'Pattern Name (e.g. AWS Keys)'} className="rounded-xl" />
                <Input placeholder={isDe ? 'Regex-Muster' : 'Regex Pattern'} className="rounded-xl flex-1 font-mono text-xs" />
                <Button type="submit" className="rounded-xl font-bold px-6">{isDe ? 'Regel hinzufügen' : 'Add Rule'}</Button>
              </form>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
                   <AlertTriangle className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-widest text-[10px]">
                     {isDe ? 'Keine benutzerdefinierten Regeln angewendet' : 'No custom rules applied'}
                   </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-emerald-950 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg border border-emerald-900">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <Lock className="w-24 h-24" />
             </div>
             <div className="relative z-10 max-w-md">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                    {isDe ? 'COMPLIANCE-AUDIT' : 'Compliance Audit'}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{isDe ? 'Souveräne Datenspeicherung' : 'Sovereign Data Storage'}</h3>
                <p className="text-emerald-100/70 text-sm leading-relaxed mb-6">
                  {isDe 
                    ? 'GeistDesk-Redaktionsprotokolle werden in einem partitionierten, verschlüsselten Safe geladen. Es verlassen keinerlei PII Ihr lokales Netzwerk oder werden an Trainingscluster gesendet.'
                    : 'GeistDesk redactable logs are stored in a partitioned encrypted vault. No PII ever leaves your local network or is sent to training clusters.'}
                </p>
                <Button 
                  onClick={() => toast.info(isDe ? 'Redaktionsprotokolle sind sicher verschlüsselt.' : 'Redaction logs are securely encrypted.')}
                  variant="outline" 
                  className="rounded-xl border-emerald-700 bg-transparent text-white hover:bg-emerald-800 hover:text-white font-bold"
                >
                  {isDe ? 'Redaktionsprotokolle anzeigen' : 'View Redaction Logs'}
                </Button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
