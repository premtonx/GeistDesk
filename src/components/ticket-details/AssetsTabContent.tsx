import React, { useState, useEffect, useCallback } from 'react';
import { 
  Server, 
  ShieldCheck, 
  Key, 
  FileText,
  Send,
  Upload,
  Lock,
  Copy,
  Compass,
  Trash2
} from 'lucide-react';
import { Ticket as TicketType, VaultItem } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { vaultService } from '../../services/vaultService';
import { ticketService } from '../../services/ticketService';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';

interface AssetsTabContentProps {
  ticket: TicketType;
}

const SECRET_TYPE_KEYS = ['password', 'api_key', 'ssh_key', 'vpn', 'note'] as const;
const REQUEST_NAME_KEYS: Record<string, string> = {
  'Diagnostic Log Request': 'logRequest',
  'SQL Engine Pool Dump': 'dumpRequest',
  'Operational Screenshots': 'screenshotRequest',
};

function fmt(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
    template
  );
}

export function AssetsTabContent({ ticket }: AssetsTabContentProps) {
  const { t } = useTranslation();

  const secretTypeLabel = useCallback(
    (type: string) => t(`tickets.assetsTab.secretTypes.${type}`, type),
    [t]
  );

  const resolveRequestName = useCallback(
    (name?: string) => {
      if (!name) return t('tickets.assetsTab.dropzoneRequest', 'Cargo dropzone request');
      const key = REQUEST_NAME_KEYS[name];
      return key ? t(`tickets.assetsTab.${key}`, name) : name;
    },
    [t]
  );

  const [subView, setSubView] = useState<'exchange_workspace' | 'licensed_assets'>('exchange_workspace');
  const [currentTicketItems, setCurrentTicketItems] = useState<VaultItem[]>([]);
  const [isSendingSecret, setIsSendingSecret] = useState(false);
  const [secretContent, setSecretContent] = useState('');
  const [secretType, setSecretType] = useState('password');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const unsub = vaultService.subscribeToHistory((items) => {
      const filtered = items.filter(item => item.metadata?.relatedTicketId === ticket.id);
      setCurrentTicketItems(filtered);
    });
    return () => unsub();
  }, [ticket.id]);

  const handleDirectSendSecret = async () => {
    if (!secretContent.trim()) {
      toast.error(t('tickets.assetsTab.enterSecret', 'Please enter a secret to secure.'));
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
      toast.success(t('tickets.assetsTab.linkCreated', 'One-time security link produced.'));

      await ticketService.sendMessage(ticket.id, {
        content: fmt(t('tickets.assetsTab.secretSharedMsg', '🔒 [Security Exchange Event] Shared a secure credential ({{type}}) with client via GeistExchange. One-time link burned upon first access: {{url}}'), {
          type: secretTypeLabel(secretType),
          url,
        }),
        senderType: 'ai',
        senderName: 'GeistExchange Shield'
      });

      toast.success(t('tickets.assetsTab.secretAppended', 'Shared secret delivery link successfully appended on ticket conversation thread!'));
      setIsSendingSecret(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(t('tickets.assetsTab.linkFailed', 'Failed to generate secure link.'));
      setIsSendingSecret(false);
    }
  };

  const handleQuickRequestDropzone = async (type: 'logs' | 'dump' | 'screenshots') => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      let name = '';
      let acceptedTypes: string[] = [];
      let description = '';

      if (type === 'logs') {
        name = t('tickets.assetsTab.logRequest', 'Diagnostic log request');
        acceptedTypes = ['ZIP', 'LOG', 'TXT'];
        description = t('tickets.assetsTab.logRequestDesc', 'Please transmit router diagnostic error log archives safely.');
      } else if (type === 'dump') {
        name = t('tickets.assetsTab.dumpRequest', 'SQL engine pool dump');
        acceptedTypes = ['SQL', 'BAK', 'DUMP'];
        description = t('tickets.assetsTab.dumpRequestDesc', 'Submit database schemas and logs securely.');
      } else {
        name = t('tickets.assetsTab.screenshotRequest', 'Operational screenshots');
        acceptedTypes = ['PNG', 'JPG', 'PDF'];
        description = t('tickets.assetsTab.screenshotRequestDesc', 'Provide screenshots showing the error modal logs.');
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

      await ticketService.sendMessage(ticket.id, {
        content: fmt(t('tickets.assetsTab.uploadRequestedMsg', '📡 [Security Exchange Event] Requested secure diagnostics cargo ({{name}}) from client. Upload dropzone link: {{url}}'), {
          name,
          url,
        }),
        senderType: 'ai',
        senderName: 'GeistExchange Dropzone'
      });

      toast.success(fmt(t('tickets.assetsTab.uploadGenerated', 'Secure upload request generated and appended to ticket conversation! URL: {{url}}'), { url }));
    } catch (err) {
      console.error(err);
      toast.error(t('tickets.assetsTab.uploadFailed', 'Could not construct secure upload dropzone.'));
    }
  };

  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success(t('tickets.assetsTab.copiedClipboard', 'Copied to clipboard'));
  };

  const licensedAssets = React.useMemo(() => {
    const isMobile = (ticket.product || 'geistdesktech').toLowerCase().includes('mobile');
    return [
      {
        id: 'asset-1',
        title: isMobile
          ? t('tickets.assetsTab.mobileLicense', 'GeistDesk mobile license')
          : t('tickets.assetsTab.proCore', 'GeistDeskTech Pro Core'),
        serial: isMobile ? 'GDM-4491-BB10' : 'GDT-8842-AX9',
        type: t('tickets.assetsTab.softwareSubscription', 'Software subscription'),
        status: t('tickets.assetsTab.active', 'Active'),
        expiry: t('tickets.assetsTab.expiryDec2026', 'Dec 31, 2026')
      },
      {
        id: 'asset-2',
        title: t('tickets.assetsTab.sandboxPool', 'Central sandbox tenant pool'),
        serial: 'TEN-POOL-883',
        type: t('tickets.assetsTab.cloudEnvironment', 'Cloud environment'),
        status: t('tickets.assetsTab.active', 'Active'),
        expiry: t('tickets.assetsTab.onDemand', 'On demand')
      }
    ];
  }, [ticket, t]);

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit self-start gap-1">
        <button 
          onClick={() => setSubView('exchange_workspace')}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5",
            subView === 'exchange_workspace' ? "bg-white text-[#1A73E8] shadow-xs" : "text-[#5F6368] hover:text-slate-800"
          )}
        >
          <Lock className="w-3.5 h-3.5 text-[#1A73E8]" /> {t('tickets.assetsTab.secureActions', 'GeistExchange secure actions')}
        </button>
        <button 
          onClick={() => setSubView('licensed_assets')}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5",
            subView === 'licensed_assets' ? "bg-white text-[#1A73E8] shadow-xs" : "text-[#5F6368] hover:text-slate-800"
          )}
        >
          <Compass className="w-3.5 h-3.5" /> {t('tickets.assetsTab.licensedAssets', 'Licensed assets')} ({licensedAssets.length})
        </button>
      </div>

      {subView === 'exchange_workspace' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-xs font-black uppercase text-slate-[#5F6368] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#1A73E8]" /> {t('tickets.assetsTab.sendSecretTitle', 'Send secure secret to client')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('tickets.assetsTab.sendSecretDesc', 'Generate a post-quantum link that burns upon read. Delivery link is appended on the ticket conversation stream!')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('tickets.assetsTab.secretType', 'Secret type')}</label>
                    <select 
                      value={secretType}
                      onChange={(e) => setSecretType(e.target.value)}
                      className="w-full h-8 px-2 mt-1 bg-[#F8F9FA] border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      {SECRET_TYPE_KEYS.map((type) => (
                        <option key={type} value={type}>{secretTypeLabel(type)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('tickets.assetsTab.durationPolicies', 'Duration policies')}</label>
                    <div className="h-8 mt-1 border text-xs font-bold rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      {t('tickets.assetsTab.burnUponAccess', 'Burn upon access')}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">{t('tickets.assetsTab.secretValues', 'Secret values')}</label>
                  <Textarea 
                    placeholder={t('tickets.assetsTab.secretPlaceholder', 'Enter database keys, passcodes, internal links...')}
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
                      {copying ? t('tickets.assetsTab.copied', 'Copied') : t('tickets.assetsTab.copy', 'Copy')}
                    </Button>
                  </div>
                )}

                <Button 
                  onClick={handleDirectSendSecret}
                  disabled={isSendingSecret}
                  className="w-full bg-[#1A73E8] hover:bg-[#1665cb] text-white h-9 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {t('tickets.assetsTab.transmitCredential', 'Transmit shielded credential')}
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <CardHeader className="bg-slate-50/50 pb-4">
                <CardTitle className="text-xs font-black uppercase text-slate-[#5F6368] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-600" /> {t('tickets.assetsTab.secureUploads', 'Secure customer uploads request')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('tickets.assetsTab.secureUploadsDesc', 'Request files, server dumps or screen visuals directly. Delivery dropzone is uploaded on ticket timeline automatically.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('tickets.assetsTab.fastPresets', 'Fast presets')}</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleQuickRequestDropzone('logs')}
                      className="p-3 border rounded-xl hover:border-blue-500 hover:bg-slate-50 text-left space-y-1 group transition-all"
                    >
                      <FileText className="w-4 h-4 text-[#1A73E8] group-hover:scale-105 transition-transform" />
                      <p className="font-bold text-[11px] text-slate-900 leading-none mt-1">{t('tickets.assetsTab.requestLogs', 'Request logs')}</p>
                      <span className="text-[8.5px] text-slate-400">{t('tickets.assetsTab.collectZipLog', 'Collect ZIP, LOG')}</span>
                    </button>

                    <button 
                      onClick={() => handleQuickRequestDropzone('dump')}
                      className="p-3 border rounded-xl hover:border-purple-600 hover:bg-slate-50 text-left space-y-1 group transition-all"
                    >
                      <Server className="w-4 h-4 text-purple-600 group-hover:scale-105 transition-transform" />
                      <p className="font-bold text-[11px] text-slate-900 leading-none mt-1 text-ellipsis overflow-hidden whitespace-nowrap">{t('tickets.assetsTab.dbBackups', 'DB backups')}</p>
                      <span className="text-[8.5px] text-slate-400">{t('tickets.assetsTab.collectSql', 'Collect SQL dumps')}</span>
                    </button>

                    <button 
                      onClick={() => handleQuickRequestDropzone('screenshots')}
                      className="p-3 border rounded-xl hover:border-orange-600 hover:bg-slate-50 text-left space-y-1 group transition-all"
                    >
                      <Upload className="w-4 h-4 text-orange-600 group-hover:scale-105 transition-transform" />
                      <p className="font-bold text-[11px] text-slate-900 leading-none mt-1">{t('tickets.assetsTab.screenshots', 'Screenshots')}</p>
                      <span className="text-[8.5px] text-slate-400">{t('tickets.assetsTab.collectPng', 'Collect PNG, JPG')}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 mt-2 flex-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500 uppercase text-[9.5px]">{t('tickets.assetsTab.quantumSecure', 'Quantum secure dropping:')}</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] tracking-widest font-black uppercase px-2 h-4.5">ML-KEM</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {t('tickets.assetsTab.icapScanDesc', 'The upload engine forces deep ICAP malware scanning on ingress before files land in sovereign storage.')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <header className="px-6 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-[#5F6368] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> {t('tickets.assetsTab.activeSecurityLinks', 'Active security links on this ticket')}
              </h4>
              <span className="text-[10px] bg-blue-50 text-blue-700 h-5 px-2 rounded-full font-bold flex items-center leading-none uppercase">
                {currentTicketItems.length} {t('tickets.assetsTab.linksTracked', 'links tracked')}
              </span>
            </header>
            <CardContent className="p-0 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-5 py-3.5">{t('tickets.assetsTab.cargoTarget', 'Asset/cargo target')}</th>
                    <th className="px-5 py-3.5">{t('tickets.assetsTab.type', 'Type')}</th>
                    <th className="px-5 py-3.5">{t('tickets.assetsTab.status', 'Status')}</th>
                    <th className="px-5 py-3.5">{t('tickets.assetsTab.expiryRules', 'Expiry rules')}</th>
                    <th className="px-5 py-3.5 text-right">{t('tickets.assetsTab.interactive', 'Interactive')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold uppercase">
                  {currentTicketItems.length > 0 ? (
                    currentTicketItems.map(item => {
                      const isReq = item.type === 'request';
                      const label = isReq
                        ? resolveRequestName(item.metadata?.requestName)
                        : fmt(t('tickets.assetsTab.credentialsRecord', 'Credentials record: {{type}}'), {
                            type: secretTypeLabel(item.metadata?.secretType || 'password'),
                          });
                      const status = item.isBurned
                        ? t('tickets.assetsTab.burned', 'Burned')
                        : t('tickets.assetsTab.active', 'Active');
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
                              ? t('tickets.assetsTab.selfDestruct', 'Self-destruct upon single view')
                              : t('tickets.assetsTab.hoursLifecycle', '48 hours lifecycle')}
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
                                  toast.success(t('tickets.assetsTab.linkShredded', 'Link shredded.'));
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
                        {fmt(t('tickets.assetsTab.noActiveItems', 'No active secrets or dropzone files mapped to TKT-{{id}} yet.'), {
                          id: ticket.id.substring(0, 5).toUpperCase(),
                        })}
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
                    <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider">{t('tickets.assetsTab.serialKey', 'Serial / license key')}</span>
                    <span className="font-mono text-foreground font-bold">{asset.serial}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider">{t('tickets.assetsTab.expiryRenewal', 'Expiry / renewal')}</span>
                    <span className="font-semibold text-foreground">{asset.expiry}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[9px] text-[#137333] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('tickets.assetsTab.verifiedSubscription', 'Verified client subscription')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
