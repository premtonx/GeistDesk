import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  HelpCircle, 
  Layers, 
  Server, 
  ShieldCheck, 
  Key, 
  FileText,
  BadgeAlert,
  Send,
  Upload,
  Lock,
  Copy,
  Check,
  Plus,
  Compass,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { Ticket as TicketType, VaultItem } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { vaultService } from '../../services/vaultService';
import { ticketService } from '../../services/ticketService';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface AssetsTabContentProps {
  ticket: TicketType;
}

export function AssetsTabContent({
  ticket
}: AssetsTabContentProps) {
  const { t, language } = useTranslation();
  
  // Navigation inside the Tab view
  const [subView, setSubView] = useState<'exchange_workspace' | 'licensed_assets'>('exchange_workspace');
  
  // States
  const [currentTicketItems, setCurrentTicketItems] = useState<VaultItem[]>([]);
  const [isSendingSecret, setIsSendingSecret] = useState(false);
  const [secretContent, setSecretContent] = useState('');
  const [secretType, setSecretType] = useState('password');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copying, setCopying] = useState(false);

  // Subscribe to Vault Items related to this specific ticket
  useEffect(() => {
    const unsub = vaultService.subscribeToHistory((items) => {
      // Filter for items targeting this ticket
      const filtered = items.filter(item => item.metadata?.relatedTicketId === ticket.id);
      setCurrentTicketItems(filtered);
    });
    return () => unsub();
  }, [ticket.id]);

  // Handle Send Secret from Ticket page directly
  const handleDirectSendSecret = async () => {
    if (!secretContent.trim()) {
      toast.error(language === 'de' ? "Bitte geben Sie ein Geheimnis ein." : "Please enter a secret to secure.");
      return;
    }

    try {
      setIsSendingSecret(true);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const secretId = await vaultService.createItem({
        type: 'secret',
        content: secretContent,
        shares: [],
        expirationType: 'read',
        expiresAt: expiresAt,
        metadata: {
          isQuantumSafe: true,
          pqcLevel: 3,
          secretType,
          relatedTicketId: ticket.id,
          targetRecipient: ticket.customerName || 'client'
        }
      });

      const url = `${window.location.origin}/v/${secretId}`;
      setGeneratedLink(url);
      setSecretContent('');
      toast.success(language === 'de' ? "Einmal-Sicherheitslink erstellt." : "One-time security link produced.");

      // Post of activity link on the ticket timeline automatically!
      await ticketService.sendMessage(ticket.id, {
        content: language === 'de'
          ? `🔒 [Sicherheits-Austausch] GeistExchange hat sichere Anmeldedaten (${secretType}) für den Kunden freigegeben. Der Einmal-Link verfällt sofort nach der ersten Ansicht: ${url}`
          : `🔒 [Security Exchange Event] Shared a secure credential (${secretType}) with client via GeistExchange. One-time link burned upon first access: ${url}`,
        senderType: 'ai',
        senderName: 'GeistExchange Shield'
      });
      
      toast.success(language === 'de'
        ? "Sicherheits-Link für das Geheimnis wurde erfolgreich an den Konversationsverlauf des Tickets angehängt!"
        : "Shared Secret delivery link successfully appended on ticket conversation thread!");
      setIsSendingSecret(false);
    } catch (err: any) {
      console.error(err);
      toast.error(language === 'de' ? "Fehler beim Generieren des sicheren Links." : "Failed to generate and map secret key.");
      setIsSendingSecret(false);
    }
  };

  // Fast preset dropzone request trigger
  const handleQuickRequestDropzone = async (type: 'logs' | 'dump' | 'screenshots') => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      let name = '';
      let acceptedTypes: string[] = [];
      let description = '';

      if (type === 'logs') {
        name = language === 'de' ? "Diagnoseprotokoll-Anforderung" : "Diagnostic Log Request";
        acceptedTypes = ['ZIP', 'LOG', 'TXT'];
        description = language === 'de'
          ? "Bitte übertragen Sie Router-Fehlerprotokollarchive sicher."
          : "Please transmit router diagnostic error log archives safely.";
      } else if (type === 'dump') {
        name = language === 'de' ? "Datenbank-Abbild-Anforderung" : "SQL Engine Pool Dump";
        acceptedTypes = ['SQL', 'BAK', 'DUMP'];
        description = language === 'de'
          ? "Übermitteln Sie Datenbankschemata und -protokolle sicher."
          : "Submit database schemas and logs securely.";
      } else {
        name = language === 'de' ? "Betriebliche Screenshots" : "Operational Screenshots";
        acceptedTypes = ['PNG', 'JPG', 'PDF'];
        description = language === 'de'
          ? "Stellen Sie Screenshots bereit, die die Fehlerprotokolle zeigen."
          : "Provide screenshots showing the error modal logs.";
      }

      const requestId = await vaultService.createItem({
        type: 'request',
        expirationType: 'time',
        expiresAt,
        metadata: {
          isQuantumSafe: true,
          pqcLevel: 3,
          requestName: name,
          description,
          relatedTicketId: ticket.id,
          acceptedTypes,
          uploadLimit: '2GB'
        }
      });

      const url = `${window.location.origin}/v/${requestId}`;
      
      // Append to timeline conversation automatically
      await ticketService.sendMessage(ticket.id, {
        content: language === 'de'
          ? `📡 [Sicherheits-Austausch] Sichere Diagnosedaten (${name}) vom Client über GeistExchange angefordert. Uploadlink: ${url}`
          : `📡 [Security Exchange Event] Requested secure diagnostics cargo (${name}) from client. Upload Dropzone Link: ${url}`,
        senderType: 'ai',
        senderName: 'GeistExchange Dropzone'
      });

      toast.success(language === 'de'
        ? `Sichere Upload-Anforderung generiert und an den Konversationsverlauf angehängt! URL: ${url}`
        : `Secure Upload Request generated & appended to ticket conversation flow! URL: ${url}`);
    } catch (err) {
      console.error(err);
      toast.error(language === 'de' ? "Sichere Upload-Anforderung konnte nicht erstellt werden." : "Could not construct Secure upload dropzone.");
    }
  };

  // Copy helper
  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success(language === 'de' ? "In die Zwischenablage kopiert." : "Copied to clipboard");
  };

  const licensedAssets = React.useMemo(() => {
    const isMobile = (ticket.product || 'geistdesktech').toLowerCase().includes('mobile');
    return [
      {
        id: 'asset-1',
        title: isMobile ? 'GeistDesk Mobile-Lizenz' : 'GeistDeskTech Pro Core',
        serial: isMobile ? 'GDM-4491-BB10' : 'GDT-8842-AX9',
        type: language === 'de' ? 'Software-Abonnement' : 'Software Subscription',
        status: language === 'de' ? 'Aktiv' : 'Active',
        expiry: language === 'de' ? '31. Dez 2026' : 'Dec 31, 2026'
      },
      {
        id: 'asset-2',
        title: language === 'de' ? 'Zentraler Sandbox-Tenant-Pool' : 'Central Sandbox Tenant Pool',
        serial: 'TEN-POOL-883',
        type: language === 'de' ? 'Cloud-Umgebung' : 'Cloud Environment',
        status: language === 'de' ? 'Aktiv' : 'Active',
        expiry: language === 'de' ? 'Auf Anfrage' : 'On-Demand'
      }
    ];
  }, [ticket, language]);

  return (
    <div className="space-y-6">
      
      {/* Segment switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit self-start gap-1">
        <button 
          onClick={() => setSubView('exchange_workspace')}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5",
            subView === 'exchange_workspace' ? "bg-white text-[#1A73E8] shadow-xs" : "text-[#5F6368] hover:text-slate-800"
          )}
        >
          <Lock className="w-3.5 h-3.5 text-[#1A73E8]" /> {language === 'de' ? "GeistExchange Sicherheitsaktionen" : "GeistExchange Secure Actions"}
        </button>
        <button 
          onClick={() => setSubView('licensed_assets')}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5",
            subView === 'licensed_assets' ? "bg-white text-[#1A73E8] shadow-xs" : "text-[#5F6368] hover:text-slate-800"
          )}
        >
          <Compass className="w-3.5 h-3.5" /> {language === 'de' ? "Lizenzierte Assets" : "Licensed Assets"} ({licensedAssets.length})
        </button>
      </div>

      {subView === 'exchange_workspace' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Direct Secret dispatch card */}
            <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-xs font-black uppercase text-slate-[#5F6368] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#1A73E8]" /> {language === 'de' ? "Sicheres Geheimnis an Client senden" : "Send Secure Secret to Client"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === 'de' 
                    ? "Generieren Sie einen Link, der nach einmaligem Lesen verfällt. Der Erstellungs-Link wird an den Konversationsverlauf angehängt!" 
                    : "Generate a post-quantum link that burns upon read. Delivery link is appended on the ticket conversation stream!"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{language === 'de' ? "Art des Geheimnisses" : "Secret Type"}</label>
                    <select 
                      value={secretType}
                      onChange={(e) => setSecretType(e.target.value)}
                      className="w-full h-8 px-2 mt-1 bg-[#F8F9FA] border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <option value="password">{language === 'de' ? 'Passwort' : 'Password'}</option>
                      <option value="api_key">{language === 'de' ? 'API-Schlüssel' : 'API Key'}</option>
                      <option value="ssh_key">{language === 'de' ? 'SSH-Schlüssel' : 'SSH Key'}</option>
                      <option value="vpn">{language === 'de' ? 'VPN-Datei' : 'VPN File'}</option>
                      <option value="note">{language === 'de' ? 'Sichere Notiz' : 'Secure Note'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{language === 'de' ? "Ablaufrichtlinien" : "Duration Policies"}</label>
                    <div className="h-8 mt-1 border text-xs font-bold rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      {language === 'de' ? 'NACH ZUGRIFF LÖSCHEN' : 'BURN UPON ACCESS'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">{language === 'de' ? "Geheimniswerte" : "Secret values"}</label>
                  <Textarea 
                    placeholder={language === 'de' ? "Geben Sie Datenbankschlüssel, Passwörter, interne Links ein..." : "Enter database keys, passcodes, internal links..."}
                    className="h-16 text-xs rounded-xl p-3 bg-[#F8F9FA] resize-none"
                    value={secretContent}
                    onChange={(e) => setSecretContent(e.target.value)}
                  />
                </div>

                {generatedLink && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2.5">
                    <span className="text-[10px] font-mono text-emerald-800 truncate">{generatedLink}</span>
                    <Button 
                      size="sm"
                      onClick={() => copyText(generatedLink)}
                      className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs text-white uppercase rounded-md font-bold px-3 shadow-none"
                    >
                      {copying ? (language === 'de' ? 'Kopiert' : 'Copied') : (language === 'de' ? 'Kopieren' : 'Copy')}
                    </Button>
                  </div>
                )}

                <Button 
                  onClick={handleDirectSendSecret}
                  disabled={isSendingSecret}
                  className="w-full bg-[#1A73E8] hover:bg-[#1665cb] text-white h-9 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {language === 'de' ? "Sichere Anmeldedaten übertragen" : "Transmit Shielded Credential"}
                </Button>
              </CardContent>
            </Card>

            {/* Direct cargo dropzone request tools */}
            <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-xs font-black uppercase text-slate-[#5F6368] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-600" /> {language === 'de' ? "Sichere Upload-Anforderungen" : "Secure Customer Uploads Request"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === 'de' 
                    ? "Fordern Sie Dateien, Backups oder Screenshots an. Der Upload-Link wird automatisch an den Konversationsverlauf angehängt." 
                    : "Request files, server dumps or screen visuals directly. Delivery dropzone is uploaded on ticket timeline automatically."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'de' ? "Schnellvorlagen" : "Fast presets containers"}</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleQuickRequestDropzone('logs')}
                      className="p-3 border rounded-xl hover:border-blue-500 hover:bg-slate-50 text-left space-y-1 group transition-all"
                    >
                      <FileText className="w-4 h-4 text-[#1A73E8] group-hover:scale-105 transition-transform" />
                      <p className="font-bold text-[11px] text-slate-900 leading-none mt-1">{language === 'de' ? "Logs anfordern" : "Request Logs"}</p>
                      <span className="text-[8.5px] text-slate-400">{language === 'de' ? "Sammle ZIP, LOG" : "Collect ZIP, LOG"}</span>
                    </button>

                    <button 
                      onClick={() => handleQuickRequestDropzone('dump')}
                      className="p-3 border rounded-xl hover:border-purple-600 hover:bg-slate-50 text-left space-y-1 group transition-all"
                    >
                      <Server className="w-4 h-4 text-purple-600 group-hover:scale-105 transition-transform" />
                      <p className="font-bold text-[11px] text-slate-900 leading-none mt-1 text-ellipsis overflow-hidden whitespace-nowrap">{language === 'de' ? "DB-Backups" : "DB Backups"}</p>
                      <span className="text-[8.5px] text-slate-400">{language === 'de' ? "Sammle SQL-Dumps" : "Collect SQL dumps"}</span>
                    </button>

                    <button 
                      onClick={() => handleQuickRequestDropzone('screenshots')}
                      className="p-3 border rounded-xl hover:border-orange-600 hover:bg-slate-50 text-left space-y-1 group transition-all"
                    >
                      <Upload className="w-4 h-4 text-orange-600 group-hover:scale-105 transition-transform" />
                      <p className="font-bold text-[11px] text-slate-900 leading-none mt-1">{language === 'de' ? "Screenshots" : "Screenshots"}</p>
                      <span className="text-[8.5px] text-slate-400">{language === 'de' ? "Sammle PNG, JPG" : "Collect PNG, JPG"}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 mt-2 flex-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500 uppercase text-[9.5px]">{language === 'de' ? "Quantensichere Übertragungsbox:" : "Quantum secure dropping:"}</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] tracking-widest font-black uppercase px-2 h-4.5">ML-KEM</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {language === 'de' 
                      ? "Die Upload-Engine erzwingt eine umfassende ICAP-Malwareprüfung eingehender Dateien, bevor diese im sovereign Speicher abgelegt werden." 
                      : "The upload engine forces deep ICAP malware scanning check on ingress before the files landing in sovereign storage."}
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Secure history relative to this ticket */}
          <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <header className="px-6 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-[#5F6368] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> {language === 'de' ? "Aktive Sicherheitslinks für dieses Ticket" : "Active security links on this ticket"}
              </h4>
              <span className="text-[10px] bg-blue-50 text-blue-700 h-5 px-2 rounded-full font-bold flex items-center leading-none uppercase">
                {currentTicketItems.length} {language === 'de' ? "Links nachverfolgt" : "links tracked"}
              </span>
            </header>
            <CardContent className="p-0 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-5 py-3.5">{language === 'de' ? "Asset-/Daten-Ziel" : "Asset/Cargo target"}</th>
                    <th className="px-5 py-3.5">{language === 'de' ? "Typ" : "Type"}</th>
                    <th className="px-5 py-3.5">{language === 'de' ? "Status" : "Status"}</th>
                    <th className="px-5 py-3.5">{language === 'de' ? "Ablaufregeln" : "Expiry Rules"}</th>
                    <th className="px-5 py-3.5 text-right">{language === 'de' ? "Interaktiv" : "Interactive"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold uppercase">
                  {currentTicketItems.length > 0 ? (
                    currentTicketItems.map(item => {
                      const isReq = item.type === 'request';
                      let label = '';
                      if (isReq) {
                        label = item.metadata?.requestName 
                          ? (language === 'de' && item.metadata.requestName === "Diagnostic Log Request" ? "Diagnoseprotokoll-Anforderung" : 
                             language === 'de' && item.metadata.requestName === "SQL Engine Pool Dump" ? "Datenbank-Abbild-Anforderung" :
                             language === 'de' && item.metadata.requestName === "Operational Screenshots" ? "Betriebliche Screenshots" : 
                             item.metadata.requestName)
                          : (language === 'de' ? "Daten-Dropzone-Anforderung" : "Cargo Dropzone request");
                      } else {
                        const translatedSecretType = item.metadata?.secretType === 'password' ? (language === 'de' ? 'Passwort' : 'Password') : 
                                                    item.metadata?.secretType === 'api_key' ? (language === 'de' ? 'API-Schlüssel' : 'API Key') : 
                                                    item.metadata?.secretType === 'ssh_key' ? (language === 'de' ? 'SSH-Schlüssel' : 'SSH Key') : 
                                                    item.metadata?.secretType === 'vpn' ? (language === 'de' ? 'VPN-Datei' : 'VPN File') : 
                                                    item.metadata?.secretType === 'note' ? (language === 'de' ? 'Sichere Notiz' : 'Secure Note') : 
                                                    item.metadata?.secretType || 'Password';
                        label = language === 'de' ? `Zugangsdaten-Eintrag: ${translatedSecretType}` : `Credentials record: ${translatedSecretType}`;
                      }
                      const status = item.isBurned 
                        ? (language === 'de' ? 'Verfallen' : 'Burned') 
                        : (language === 'de' ? 'Aktiv' : 'Active');
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-all font-semibold text-xs">
                          <td className="px-5 py-3 font-bold text-slate-900 text-xs normal-case">{label}</td>
                          <td className="px-5 py-3 text-slate-400 text-[10.5px] tracking-tight">{item.type}</td>
                          <td className="px-5 py-3 text-xs">
                            <Badge className={cn(
                              "text-[8.5px] uppercase border font-bold border-none",
                              item.isBurned ? "bg-red-150 text-red-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-500 text-[11px] normal-case">
                            {item.expirationType === 'read' 
                              ? (language === 'de' ? "Selbstzerstörung nach erster Ansicht" : "Self dest. upon single view") 
                              : (language === 'de' ? "48 Stunden Lebensdauer" : "48 Hours lifecycle")}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-[#1A73E8]"
                                onClick={() => copyText(`${window.location.origin}/v/${item.id}`)}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={async () => {
                                  await vaultService.deleteItem(item.id);
                                  toast.success(language === 'de' ? "Sicherheits-Link unwiderruflich gelöscht." : "Link shredded.");
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 italic text-[11px] normal-case">
                        {language === 'de' 
                          ? `Noch keine aktiven Geheimnisse oder Upload-Anforderungen für TKT-${ticket.id.substring(0, 5).toUpperCase()} hinterlegt.`
                          : `No active secrets or dropzone files mapped to TKT-${ticket.id.substring(0, 5).toUpperCase()} yet.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {licensedAssets.map(asset => (
            <Card key={asset.id} className="border-border rounded-xl shadow-sm hover:border-indigo-150 transition-all bg-white">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 bg-primary/5 rounded-lg border border-primary/15 flex items-center justify-center text-primary shrink-0">
                      <Key className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-foreground">{asset.title}</h4>
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">{asset.type}</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-[#137333] border-none text-[8.5px] uppercase font-black px-1.5 h-4.5 leading-none">
                    {asset.status}
                  </Badge>
                </div>

                <Separator className="bg-border/40" />

                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider">{language === 'de' ? "Seriennummer / Key" : "Serial / License Key"}</span>
                    <span className="font-mono text-foreground font-bold">{asset.serial}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider">{language === 'de' ? "Ablauf / Erneuerung" : "Expiry Renewal"}</span>
                    <span className="font-semibold text-foreground">{asset.expiry}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[9px] text-[#137333] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{language === 'de' ? "Verifiziertes Kunden-Abonnement" : "Verified Client Subscription"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
