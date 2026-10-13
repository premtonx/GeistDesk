import React, { useState, useEffect } from 'react';
import { vaultService } from '../../../services/vaultService';
import { VaultItem } from '../../../types';
import { 
  Users, 
  Mail, 
  Phone, 
  PhoneCall, 
  ExternalLink, 
  History, 
  Plus, 
  Server, 
  Laptop, 
  Network, 
  AppWindow, 
  FileText, 
  Calendar, 
  Key, 
  Eye, 
  EyeOff, 
  Brain, 
  Clock, 
  AlertTriangle, 
  Bot, 
  Sparkles, 
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Copy,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Contact, Ticket } from '../../../types';
import { CustomField } from '../../../services/schemaService';
import { cn } from '../../../lib/utils';
import { HydratedCompany } from './utils';
import { toast } from 'sonner';

interface CompanyOtherTabsProps {
  activeSubTab: string;
  company: HydratedCompany;
  employees: Contact[];
  contactSchema: CustomField[];
  ticketHistory: Ticket[];
  onAddContactClick: () => void;
  onSelectTicket?: (id: string) => void;
}

export default function CompanyOtherTabs({
  activeSubTab,
  company,
  employees,
  contactSchema,
  ticketHistory,
  onAddContactClick,
  onSelectTicket
}: CompanyOtherTabsProps) {
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [companyVaultItems, setCompanyVaultItems] = useState<VaultItem[]>([]);
  const [isAddingSecret, setIsAddingSecret] = useState(false);
  const [newSecretLabel, setNewSecretLabel] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretType, setNewSecretType] = useState('password');

  // Sync with Firestore for company vault items
  useEffect(() => {
    const unsub = vaultService.subscribeToHistory((items) => {
      // Filter items matching this company
      const filtered = items.filter(item => item.metadata?.relatedCompanyId === company.id);
      setCompanyVaultItems(filtered);
    });
    return () => unsub();
  }, [company.id]);

  const handleCompanyAddSecret = async () => {
    if (!newSecretLabel.trim() || !newSecretValue.trim()) {
      toast.error("Please fill in both label and secret content.");
      return;
    }
    try {
      setIsAddingSecret(true);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 168); // Expires in a week

      await vaultService.createItem({
        type: 'secret',
        content: newSecretValue,
        shares: [],
        expirationType: 'time',
        expiresAt: expiresAt,
        metadata: {
          isQuantumSafe: true,
          pqcLevel: 3,
          secretType: newSecretType,
          relatedCompanyId: company.id,
          requestName: newSecretLabel,
          targetRecipient: company.name
        }
      });

      toast.success(`Secret registered for ${company.name} profile workspace!`);
      setNewSecretLabel('');
      setNewSecretValue('');
      setIsAddingSecret(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Vulnerability failure: key cannot be synchronized.");
      setIsAddingSecret(false);
    }
  };
  
  const toggleKeyReveal = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCallContact = (contactName: string) => {
    toast.success(`Dialing direct connection call for ${contactName}`, {
      description: "Redirecting sound input pipeline stream to WebRTC gateway.",
      duration: 3000
    });
  };

  if (activeSubTab === 'contacts') {
    return (
      <Card className="border border-muted-foreground/10 rounded-2xl bg-background overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/10">
          <div>
            <CardTitle className="text-sm font-black text-foreground">Key Contacts & Employees</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Primary stakeholders and operational contacts who authorize support tickets.</p>
          </div>
          <Button 
            onClick={onAddContactClick}
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold text-xs h-9 px-4 border-muted-foreground/15 text-foreground hover:bg-muted"
          >
             <Plus className="w-4 h-4 mr-2" />
             Add Contact
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Direct Access</th>
                  <th className="px-5 py-3.5">Custom Attributes</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {employees.map(employee => (
                  <tr key={employee.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-xs">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm leading-none">{employee.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{employee.title || 'Stakeholder Team member'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                       <div className="flex flex-col gap-1 text-muted-foreground font-semibold">
                          <div className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer">
                            <Mail className="w-3.5 h-3.5 opacity-60" />
                            {employee.email}
                          </div>
                          {(employee.phoneWork || employee.phoneMobile) ? (
                            <div className="flex items-center gap-1.5 opacity-60">
                              <Phone className="w-3.5 h-3.5" />
                              {employee.phoneWork || employee.phoneMobile}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/42 italic">No registered phone number</span>
                          )}
                       </div>
                    </td>
                    <td className="px-5 py-3.5">
                       <div className="flex flex-wrap gap-1">
                          {contactSchema.filter(f => !f.system && employee.metadata?.[f.internalName]).map(field => (
                            <span key={field.id} className="text-[9px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-150 px-2 py-0.5 rounded uppercase">
                              {field.label}: {String(employee.metadata?.[field.internalName])}
                            </span>
                          ))}
                          {(!employee.metadata || Object.keys(employee.metadata).length === 0) && (
                            <span className="text-[10px] text-muted-foreground/45 italic">No custom attributes</span>
                          )}
                       </div>
                    </td>
                    <td className="px-5 py-3.5">
                       <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            onClick={() => handleCallContact(employee.name)}
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg border-emerald-100 bg-emerald-500/[0.03] text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all shadow-none cursor-pointer"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:bg-muted">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                       </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground italic font-semibold">
                      No contacts registered for this organization.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeSubTab === 'tickets') {
    return (
      <Card className="border border-muted-foreground/10 rounded-2xl bg-background overflow-hidden">
        <CardHeader className="pb-2 bg-muted/10">
          <CardTitle className="text-sm font-black text-foreground">Relational Support Log</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Comprehensive audit trail of support interactions requested by employees of this organization.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <th className="px-5 py-3.5 text-center">ID</th>
                  <th className="px-5 py-3.5">Subject & Request</th>
                  <th className="px-5 py-3.5">Priority</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Requester</th>
                  <th className="px-5 py-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs text-foreground font-semibold">
                {ticketHistory.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => onSelectTicket?.(ticket.id)}
                    className="hover:bg-muted/10 transition-colors cursor-pointer select-none"
                  >
                    <td className="px-5 py-3.5 font-mono text-muted-foreground text-center">#{ticket.id}</td>
                    <td className="px-5 py-3.5 max-w-sm truncate font-black text-foreground">{ticket.subject}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded uppercase",
                        ticket.priority === 'urgent' && "bg-rose-500/10 text-rose-500",
                        ticket.priority === 'high' && "bg-amber-500/10 text-amber-500",
                        ticket.priority === 'medium' && "bg-blue-500/10 text-blue-500",
                        ticket.priority === 'low' && "bg-slate-100 text-slate-500"
                      )}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded uppercase",
                        ticket.status === 'open' && "bg-emerald-500/10 text-emerald-500",
                        ticket.status === 'pending' && "bg-amber-500/10 text-amber-500",
                        ticket.status === 'resolved' && "bg-slate-100 text-slate-500",
                        ticket.status === 'closed' && "bg-slate-200 text-slate-600"
                      )}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-bold">{ticket.customerName}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                       {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
                {ticketHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground italic font-semibold">
                      No tickets recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeSubTab === 'assets') {
    return (
      <div className="space-y-6">
        <Card className="border border-muted-foreground/10 rounded-2xl bg-background">
          <CardHeader>
            <CardTitle className="text-sm font-black text-foreground">Managed Asset List</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Asset instances and remote software licenses integrated via auto-discovery pipelines.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <th className="px-5 py-3.5">Asset Hostname / Name</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Identifier / IP Address</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Last Scan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-foreground font-semibold">
                  {[
                    { name: 'Server-PROD-01', cat: 'Server', identifier: '10.250.12.18', status: 'Online', icon: Server, iconColor: 'text-indigo-500' },
                    { name: 'Server-PROD-02', cat: 'Server', identifier: '10.250.12.19', status: 'Online', icon: Server, iconColor: 'text-indigo-500' },
                    { name: 'Workstation-SARAH-PC', cat: 'Workstation', identifier: '10.250.15.54', status: 'Online', icon: Laptop, iconColor: 'text-emerald-500' },
                    { name: 'Workstation-COYOTE-RND', cat: 'Workstation', identifier: '10.250.15.112', status: 'Offline', icon: Laptop, iconColor: 'text-emerald-500' },
                    { name: 'CoreRouter-01', cat: 'Network Device', identifier: '192.168.10.1', status: 'Online', icon: Network, iconColor: 'text-amber-500' },
                    { name: 'SAP Finance Gateway', cat: 'Application', identifier: 'license-sap-3392', status: 'Online', icon: AppWindow, iconColor: 'text-purple-500' }
                  ].map((asset, idx) => {
                    const Icon = asset.icon;
                    return (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3.5 flex items-center gap-2.5 font-black text-foreground">
                          <Icon className={cn("w-4 h-4", asset.iconColor)} />
                          {asset.name}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{asset.cat}</td>
                        <td className="px-5 py-3.5 font-mono text-muted-foreground text-[11px]">{asset.identifier}</td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase",
                            asset.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 text-slate-500'
                          )}>
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground/80 font-medium">Synced 2 hours ago</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeSubTab === 'contracts') {
    return (
      <div className="space-y-6">
        <Card className="border border-muted-foreground/10 rounded-2xl bg-background max-w-4xl">
          <CardHeader>
            <CardTitle className="text-sm font-black text-foreground">SLA & Plan Provisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border border-muted rounded-xl p-6 bg-white shadow-inner relative space-y-4">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-extrabold border border-emerald-500/25">
                 Active Service Level Contract
              </div>
              
              <div className="border-b pb-4 space-y-1">
                <h3 className="text-lg font-black text-foreground">Support Contract & Service Level Addendum (SLA)</h3>
                <p className="text-xs text-muted-foreground">Authorized Entity: <span className="font-bold text-foreground">{company.name}</span></p>
                <p className="text-xs text-muted-foreground">Contract Status: <span className="font-bold text-emerald-500">ACTIVE - COMPLIANT WITH PRIORITY RESPONSE MATRIX</span></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs font-semibold py-2">
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Contract Reference</span>
                    <span className="text-foreground font-bold">GD-SLA-2026-0922</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Active Term</span>
                    <span className="text-foreground font-bold">12 Months (Auto-renewal)</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Support Plan Tier</span>
                    <span className="text-foreground font-bold">{company.contractPlan}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Target SLA Turnaround</span>
                    <span className="text-foreground font-bold">{company.contractSla}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Renewal Cycle Date</span>
                    <span className="text-foreground font-bold">{company.contractRenewalDate}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Committed Monthly Rate</span>
                    <span className="text-foreground font-bold">{company.monthlySpend}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-700 font-semibold border">
                <p className="font-bold text-slate-800 flex items-center gap-1.5"><Bot className="w-4 h-4 text-primary" /> Guarded SLA Priorities:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Priority Urgent (P1): Target response &lt; 30 mins, target resolution &lt; 2 hours with automated pager notification.</li>
                  <li>Priority High (P2): Target response &lt; 2 hours, target resolution &lt; 8 hours.</li>
                  <li>Priority Medium/Low: Target response within 24 standard business hours.</li>
                </ul>
              </div>

              <div className="pt-4 flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
                <span>Verification ID: b94a2-99ca-2bf3</span>
                <span>Digitally Sealed on {company.customerSince || 'Jan 12, 2021'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeSubTab === 'vault') {
    const combinedVaultList = [
      { id: 'static-company-1', key: 'database_production_credentials', type: 'Database Password', resource: 'postgres://production-db.acme.internal', psw: 'p@$$w0rd_SeCrEt_acme_99a', status: 'Active' },
      { id: 'static-company-2', key: 'azure_openai_api_secret', type: 'OAuth API Key', resource: 'https://acme-openai-azure.openai.azure.com', psw: 'sk-proj-AzUrEuXOpEnAiSeCrEtApIkEy99214', status: 'Active' },
      { id: 'static-company-5', key: 'ollama_local_api_secret', type: 'Local API Key', resource: 'http://localhost:11434', psw: 'local-ollama-token-if-configured', status: 'Active' },
      { id: 'static-company-3', key: 'saml_idp_x509_certificate', type: 'SAML Certificate', resource: 'SAML Auth Endpoint SSO', psw: 'BEGIN CERTIFICATE-----MIIFODCCBCCgAwIBAgIQ-----END CERTIFICATE', status: 'Active' },
      { id: 'static-company-4', key: 'smtp_relay_credentials', type: 'SMTP Password', resource: 'smtp.acme.domain:587', psw: 'smtp_mx_relay_secure_token', status: 'Active' },
      ...companyVaultItems.map(item => {
        const isReq = item.type === 'request';
        return {
          id: item.id,
          key: isReq ? (item.metadata?.requestName || 'Diagnostic dropzone link') : `Auth Key: ${item.metadata?.secretType || 'Password'}`,
          type: item.type === 'request' ? 'Secure Dropzone' : 'Shared Secret Link',
          resource: isReq ? 'Client Upload Request' : `${item.metadata?.targetRecipient || 'Client Shared'} key`,
          psw: item.type === 'request' ? `${window.location.origin}/v/${item.id}` : 'Encrypted key (Once read)',
          status: item.isBurned ? 'Burned' : 'Active',
          rawItem: item
        };
      })
    ];

    const copyDirectText = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Successfully copied key value to workspace clipboard.");
    };

    return (
      <div className="space-y-6">
        
        {/* KPI header banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-muted/20 border border-muted-foreground/10 p-5 rounded-2xl gap-4">
          <div>
            <h3 className="font-sans font-bold text-sm text-foreground flex items-center gap-1.5">
              <Lock className="w-4.5 h-4.5 text-primary" /> GeistExchange Company Workspace for {company.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Securely manage credentials audit registries, client logs uploads drops, and secure communication channels in single profile view.</p>
          </div>
          <Badge className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase tracking-widest px-3 h-6">
            Quantum ML-KEM Shielded
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main workspace registry table */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-muted-foreground/10 rounded-2xl bg-background overflow-hidden">
              <CardHeader className="bg-muted/10 pb-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-foreground">Sensitive Secrets & Transferred payloads</span>
                  <Badge className="bg-emerald-500/15 text-emerald-700 font-bold border-none text-[9px] uppercase px-2 h-5">
                    {combinedVaultList.length} total records
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/20 border-b text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        <th className="px-5 py-3.5">Record Identifier</th>
                        <th className="px-5 py-3.5">Payload Form</th>
                        <th className="px-5 py-3.5">Endpoint / Mappings</th>
                        <th className="px-5 py-3.5">Token / Secure Value</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-foreground font-semibold">
                      {combinedVaultList.map((rec) => (
                        <tr key={rec.id} className="hover:bg-muted/5 transition-colors text-xs">
                          <td className="px-5 py-3.5 font-bold text-foreground max-w-[150px] truncate">{rec.key}</td>
                          <td className="px-5 py-3.5">
                            <Badge variant="outline" className="text-[9px] border-none font-bold bg-muted uppercase px-2">
                              {rec.type}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[10.5px] text-muted-foreground max-w-[150px] truncate">{rec.resource}</td>
                          <td className="px-5 py-3.5 font-mono">
                            <div className="flex items-center gap-1.5">
                              {rec.id.startsWith('static-') ? (
                                <Input 
                                  type={revealedKeys[rec.id] ? 'text' : 'password'}
                                  value={rec.psw} 
                                  readOnly 
                                  className="font-mono bg-muted/40 text-[9.5px] max-w-[140px] h-7 border-none"
                                />
                              ) : (
                                <span className="text-[10px] text-primary underline truncate max-w-[140px] font-bold">{rec.psw}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              {rec.id.startsWith('static-') ? (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-sm text-foreground"
                                  onClick={() => toggleKeyReveal(rec.id)}
                                >
                                  {revealedKeys[rec.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </Button>
                              ) : null}
                              
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 rounded-sm text-[#1A73E8]"
                                onClick={() => copyDirectText(rec.psw)}
                                title="Copy credential payload value"
                              >
                                <Copy className="w-3.2 h-3.2" />
                              </Button>

                              {!rec.id.startsWith('static-') && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-sm text-red-500 hover:text-red-700"
                                  onClick={async () => {
                                    await vaultService.deleteItem(rec.id);
                                    toast.success("Shredded key element.");
                                  }}
                                  title="Purge record"
                                >
                                  <Trash2 className="w-3.2 h-3.2" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side panel to register new secret credentials for this company */}
          <div className="space-y-4">
            <Card className="border border-muted-foreground/10 rounded-2xl bg-background shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-primary" /> Register Company Secret
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div>
                  <label className="text-[9.5px] font-black uppercase text-slate-400">Record Name Label</label>
                  <Input 
                    placeholder="E.g. SFTP production gateway password"
                    value={newSecretLabel}
                    onChange={(e) => setNewSecretLabel(e.target.value)}
                    className="h-9 mt-1 bg-muted/20 text-xs font-semibold rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-black uppercase text-slate-400">Secret Type</label>
                  <select 
                    value={newSecretType}
                    onChange={(e: any) => setNewSecretType(e.target.value)}
                    className="w-full h-9 px-2 mt-1 bg-muted/20 border border-muted-foreground/10 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value="password">Password/Key</option>
                    <option value="api_key">API Access token</option>
                    <option value="certificate">SSL/PEM Certificate</option>
                    <option value="note">Secure Memo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9.5px] font-black uppercase text-slate-400">Secret Token Value</label>
                  <Input 
                    type="password"
                    placeholder="Raw private values..."
                    value={newSecretValue}
                    onChange={(e) => setNewSecretValue(e.target.value)}
                    className="h-9 mt-1 bg-muted/20 text-xs font-semibold rounded-xl"
                  />
                </div>

                <Button 
                  onClick={handleCompanyAddSecret}
                  disabled={isAddingSecret}
                  className="w-full bg-primary hover:bg-primary/95 text-white h-9 rounded-xl font-bold"
                >
                  {isAddingSecret ? 'Locking key...' : 'Register Secure Mapped Key'}
                </Button>
              </CardContent>
            </Card>

            {/* Quick dropzone dispatch panel */}
            <Card className="border border-muted-foreground/10 rounded-2xl bg-background p-4 text-xs space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-foreground uppercase text-[10px]">Secure Logistics Channel</span>
                <Badge variant="outline" className="border-none bg-blue-500/10 text-primary uppercase text-[8px] h-4.5 font-extrabold tracking-widest px-1.5 leading-none">
                  ACTIVE
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-snug">Need raw system error files or large backups? Generate client data request dropzones inside the primary GeistExchange tab targeting {company.name}.</p>
              
              <div className="flex gap-2 items-center text-[10px] text-primary font-bold bg-[#E8F0FE] p-1.5 px-3 rounded-lg w-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Checked under MLS-1024 Quantum Scan
              </div>
            </Card>
          </div>

        </div>

      </div>
    );
  }

  if (activeSubTab === 'insights') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.03] to-transparent rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Brain className="w-4 h-4 text-indigo-500" />
                Churn Health Predictor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-semibold">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Account Standby Strength</span>
                  <span className="text-emerald-500 font-extrabold">92% Reliable</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: '92%' }} />
                </div>
              </div>

              <div className="p-4 bg-white/50 border border-muted rounded-xl space-y-2 text-slate-700 leading-relaxed font-semibold">
                <p className="font-bold text-foreground">Account Health Summary Analysis:</p>
                <p className="text-[11px] text-muted-foreground italic">
                  "Based on ticket response times, high client satisfaction ratings, and long-term recurring active support contracts, Acme Global Solutions is categorized as a low churn risk. Continue automated macros on standard API requests to keep turnaround times low."
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#4285F4]/20 bg-gradient-to-br from-[#4285F4]/[0.03] to-transparent rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#4285F4]" />
                Common Issue Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-semibold">
              <div className="space-y-3">
                {[
                  { issue: 'Authentication / SSO config errors', freq: '40% of standard tickets', recommendation: 'Build SSO macro tutorial' },
                  { issue: 'Invoice delay questions', freq: '30% of billing inquiries', recommendation: 'Redirect queries to stripe gateway' },
                  { issue: 'API Configuration feedback', freq: '30% of tickets', recommendation: 'Provide webhook documentation' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-muted/20 border border-muted rounded-xl flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <p className="font-black text-foreground text-xs">{item.issue}</p>
                      <p className="text-[10px] text-muted-foreground">Recommendation: {item.recommendation}</p>
                    </div>
                    <Badge variant="outline" className="border-none bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded">
                      {item.freq}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.03] to-transparent rounded-2xl max-w-4xl">
          <CardHeader>
            <CardTitle className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Bot className="w-4 h-4 text-purple-500 animate-pulse" />
              Suggested Workflows & Automation Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-semibold">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-foreground">SSO Configuration Auto-Responder</h4>
                  <Badge className="bg-emerald-500 text-white border-none text-[8px] font-bold">READY TO DEPLOY</Badge>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Triggers an automated draft response explaining SAML authentication credentials whenever a client from this domain creates an auth-related ticket. Should save approx 2.5h/week.
                </p>
                <Button size="sm" className="h-7 rounded-lg text-[10px] font-extrabold uppercase bg-primary text-white">Deploy workflow</Button>
              </div>

              <div className="p-4 bg-white border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-foreground">Knowledge Base Gap Recognition</h4>
                  <Badge className="bg-amber-500 text-white border-none text-[8px] font-bold">OPPORTUNITY SCORE: 89%</Badge>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Identified 4 tickets about "API Webhook payload retry intervals" where no current KB Article exists. Generating a draft article about webhook failovers is highly advised.
                </p>
                <Button size="sm" variant="outline" className="h-7 rounded-lg text-[10px] font-extrabold uppercase border-primary/20 text-primary hover:bg-muted">Create Draft Article</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeSubTab === 'activity') {
    return (
      <Card className="border border-muted-foreground/10 rounded-2xl bg-background max-w-4xl">
        <CardHeader className="pb-2 bg-muted/10">
          <CardTitle className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-purple-500" />
            Full Historical Activity Event Stream
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Chronological stream of billing modifications, vault updates, email dispatch status, and authorization logs.</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative pl-6 border-l-2 border-slate-200/80 space-y-6">
            {[
              { time: 'Today, 10:24 AM', title: 'Ticket #443 opened', desc: 'Subject: Login not working. Created by Sarah James.', color: 'bg-primary' },
              { time: 'Yesterday, 04:15 PM', title: 'Password secret field modified', desc: 'Database credential vault record database_production_credentials updated by Mike Chen.', color: 'bg-amber-500' },
              { time: 'May 19, 11:30 AM', title: 'Contract renewal process completed', desc: `Support contractual rate updated to ${company.monthlySpend}. Plan validated as ${company.contractPlan}.`, color: 'bg-emerald-500' },
              { time: 'May 16, 09:20 AM', title: 'Auto-discovery asset sync executed', desc: 'Sovereign Discovery Engine populated 4 new workstation devices.', color: 'bg-indigo-505' },
              { time: 'May 10, 01:45 PM', title: 'Client satisfaction survey returned', desc: 'Wile E. Coyote responded to Ticket #399 with a positive rating: "Exceptional assistance with the detaching engine rocket launcher!" Rating: 5/5', color: 'bg-pink-500' },
              { time: 'May 02, 10:00 AM', title: 'Billing invoices parsed', desc: 'Automatic payment processed via banking integration successfully.', color: 'bg-slate-400' }
            ].map((ev, idx) => (
              <div key={idx} className="relative group">
                <div className={cn("absolute -left-[32px] top-1.5 h-4 w-4 rounded-full border-4 border-background", ev.color || "bg-primary")} />
                <span className="text-[10px] text-muted-foreground font-bold">{ev.time}</span>
                <h4 className="text-sm font-black text-foreground mt-0.5">{ev.title}</h4>
                <p className="text-xs text-muted-foreground/90 mt-1 font-semibold leading-relaxed max-w-3xl">{ev.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="py-12 text-center text-sm text-muted-foreground font-semibold italic">
      View state under construction.
    </div>
  );
}
