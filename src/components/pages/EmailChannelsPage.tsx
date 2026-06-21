import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  ExternalLink, 
  Send, 
  Copy, 
  Check, 
  ChevronRight, 
  Settings, 
  Shield, 
  Zap,
  Globe,
  RefreshCw,
  MoreVertical,
  Trash2,
  AlertCircle,
  Activity,
  Info,
  AlertTriangle,
  Lock,
  Star,
  Search,
  Filter,
  ArrowLeft,
  Server,
  Cloud,
  Layers,
  Database,
  Languages,
  Sparkles,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../../components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs';
import { motion, AnimatePresence } from 'motion/react';

interface EmailChannel {
  id: string;
  name: string;
  email: string;
  group: string;
  status: 'verified' | 'pending' | 'failed';
  isPrimary: boolean;
  provider: 'gmail' | 'outlook' | 'custom';
  type: 'oauth' | 'forwarding' | 'direct';
  inbound: {
    method: 'forwarding' | 'imap';
    host?: string;
    port?: string;
    user?: string;
    secure?: boolean;
  };
  outbound: {
    method: 'system' | 'smtp';
    host?: string;
    port?: string;
    user?: string;
    secure?: boolean;
    useOAuth?: boolean;
  };
  signature?: string;
}

export default function EmailChannelsPage() {
  const [channels, setChannels] = useState<EmailChannel[]>([
    { 
      id: '1', 
      name: 'Global Support', 
      email: 'support@geistdesk.ai', 
      group: 'Technical Support', 
      status: 'verified', 
      isPrimary: true, 
      provider: 'gmail', 
      type: 'oauth',
      inbound: { method: 'forwarding' },
      outbound: { method: 'system', useOAuth: true },
      signature: '<p>Best regards,<br>The GeistDesk Team</p>'
    },
    { 
      id: '2', 
      name: 'Billing Department', 
      email: 'billing@geistdesk.ai', 
      group: 'Finance', 
      status: 'verified', 
      isPrimary: false, 
      provider: 'outlook', 
      type: 'oauth',
      inbound: { method: 'forwarding' },
      outbound: { method: 'system', useOAuth: true }
    },
    { 
      id: '3', 
      name: 'Enterprise VIP', 
      email: 'vip@geistdesk.ai', 
      group: 'Customer Success', 
      status: 'pending', 
      isPrimary: false, 
      provider: 'custom', 
      type: 'direct',
      inbound: { 
        method: 'imap',
        host: 'imap.geistdesk.ai',
        port: '993',
        user: 'vip@geistdesk.ai',
        secure: true
      },
      outbound: { 
        method: 'smtp',
        host: 'smtp.geistdesk.ai',
        port: '465',
        user: 'vip@geistdesk.ai',
        secure: true
      }
    },
  ]);

  const [editingChannel, setEditingChannel] = useState<EmailChannel | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDnsModalOpen, setIsDnsModalOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChannels = channels.filter(c => 
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSetPrimary = (id: string) => {
    setChannels(prev => prev.map(c => ({
      ...c,
      isPrimary: c.id === id
    })));
    toast.success("Primary support email updated");
  };

  const handleTestInbound = async () => {
    if (!editingChannel?.inbound.host) return;
    setIsTestLoading(true);
    try {
      const res = await axios.post('/api/mail/test-imap', editingChannel.inbound);
      toast.success(res.data.message, { icon: <CheckCircle className="w-4 h-4 text-emerald-500" /> });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "IMAP Test Failed");
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleTestOutbound = async () => {
    if (!editingChannel?.outbound.host) return;
    setIsTestLoading(true);
    try {
      const res = await axios.post('/api/mail/test-smtp', editingChannel.outbound);
      toast.success(res.data.message, { icon: <CheckCircle className="w-4 h-4 text-emerald-500" /> });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "SMTP Test Failed");
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleAutoDiscover = async () => {
    if (!editingChannel?.email) return;
    try {
      const res = await axios.post('/api/mail/auto-discover', { email: editingChannel.email });
      if (res.data.success) {
        setEditingChannel({
          ...editingChannel,
          inbound: { ...editingChannel.inbound, ...res.data.settings.imap },
          outbound: { ...editingChannel.outbound, ...res.data.settings.smtp }
        });
        toast.success("Server settings discovered!");
      }
    } catch (error) {
      toast.error("Discovery failed. Enter manually.");
    }
  };

  const handleSaveChannel = () => {
    if (!editingChannel) return;
    setChannels(prev => prev.map(c => c.id === editingChannel.id ? editingChannel : c));
    setEditingChannel(null);
    toast.success("Channel configuration updated");
  };

  const renderStatusBadge = (status: EmailChannel['status']) => {
    switch (status) {
      case 'verified': return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[9px] uppercase tracking-widest">Verified</Badge>;
      case 'pending': return <Badge className="bg-amber-50 text-amber-600 border-amber-100 font-bold text-[9px] uppercase tracking-widest">Pending</Badge>;
      case 'failed': return <Badge className="bg-rose-50 text-rose-600 border-rose-100 font-bold text-[9px] uppercase tracking-widest">Failed</Badge>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
      <div className="p-8 max-w-6xl mx-auto space-y-8 pb-32">
        <AdminBreadcrumbs />

        <AnimatePresence mode="wait">
          {!editingChannel ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Mail className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-black text-[#202124] tracking-tight uppercase">Support Channels</h1>
                  </div>
                  <p className="text-sm text-[#5F6368] ml-13">Configure inbound ticket ingestion and outbound delivery servers.</p>
                </div>
                <div className="flex items-center gap-3">
                   <Button 
                      onClick={() => setIsConnectModalOpen(true)}
                      className="rounded-full bg-[#1A73E8] hover:bg-[#1765cc] h-10 px-8 font-bold text-sm shadow-lg shadow-primary/20 transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Support Address
                    </Button>
                </div>
              </div>

              <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                   <div className="relative w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Search addresses..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9 rounded-full bg-white border-slate-200 text-xs font-medium"
                      />
                   </div>
                   <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-slate-500">
                        <Filter className="w-3 h-3 mr-2" /> Filter
                      </Button>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Support Identity</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Route To Group</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredChannels.map(channel => (
                        <tr key={channel.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setEditingChannel(channel)}>
                          <td className="px-6 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                {channel.provider === 'gmail' && <Globe className="w-4 h-4" />}
                                {channel.provider === 'outlook' && <Cloud className="w-4 h-4" />}
                                {channel.provider === 'custom' && <Server className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold flex items-center gap-2">
                                  {channel.name} 
                                  {channel.isPrimary && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                                </p>
                                <p className="text-xs text-slate-500">{channel.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold text-[10px] rounded-lg">
                              {channel.group}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {renderStatusBadge(channel.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2 pr-4">
                               <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetPrimary(channel.id);
                                }}
                                className={cn(
                                  "rounded-lg h-8 w-8 p-0 transition-all",
                                  channel.isPrimary ? "text-amber-400" : "text-slate-300 hover:text-amber-400"
                                )}
                               >
                                 <Star className={cn("w-4 h-4", channel.isPrimary && "fill-amber-400")} />
                               </Button>
                               <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                 <Settings className="w-4 h-4" />
                               </Button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="rounded-3xl border-slate-200 p-6 bg-emerald-50/30 border-dashed">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                       <Shield className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">Global Verification</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Ensure SPF, DKIM, and DMARC records are correctly propagated across the Sovereign domain.</p>
                    <Button variant="link" className="p-0 h-auto text-xs font-black uppercase text-emerald-600 mt-4 tracking-widest">
                       Verify DNS Topology
                    </Button>
                 </Card>
                 <Card className="rounded-3xl border-slate-200 p-6 bg-blue-50/30 border-dashed">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                       <Languages className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">Signature Studio</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Design a unified corporate signature with Polyglot Bridge support for real-time translation.</p>
                    <Button variant="link" className="p-0 h-auto text-xs font-black uppercase text-blue-600 mt-4 tracking-widest">
                       Enter Studio
                    </Button>
                 </Card>
                 <Card className="rounded-3xl border-slate-200 p-6 bg-slate-900 text-white relative overflow-hidden">
                    <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
                    <div className="relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                         <Activity className="w-5 h-5 text-amber-400" />
                      </div>
                      <h4 className="font-bold mb-1">Health Monitor</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">3/3 Active Connections. Last ingest attempt successful 2 minutes ago.</p>
                    </div>
                 </Card>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <Button variant="ghost" size="icon" onClick={() => setEditingChannel(null)} className="rounded-xl">
                      <ArrowLeft className="w-5 h-5" />
                   </Button>
                   <div>
                      <div className="flex items-center gap-3">
                         <h2 className="text-xl font-bold text-slate-900">{editingChannel.name}</h2>
                         {renderStatusBadge(editingChannel.status)}
                      </div>
                      <p className="text-sm text-slate-500">{editingChannel.email}</p>
                   </div>
                </div>
                <div className="flex gap-3">
                   <Button variant="outline" onClick={() => setEditingChannel(null)} className="rounded-xl font-bold px-6">Cancel</Button>
                   <Button onClick={handleSaveChannel} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20 bg-primary text-white">Save Configuration</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <Tabs defaultValue="identity" className="w-full">
                    <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-12 p-0 mb-8 overflow-x-auto flex-nowrap no-scrollbar">
                      <TabsTrigger value="identity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-8 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-primary mb-[-2px]">1. Identity & Routing</TabsTrigger>
                      <TabsTrigger value="processing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-8 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-primary mb-[-2px]">2. Mail Processor</TabsTrigger>
                      <TabsTrigger value="signature" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-8 h-12 font-bold text-xs uppercase tracking-widest text-slate-500 data-[state=active]:text-primary mb-[-2px]">3. Custom Signature</TabsTrigger>
                    </TabsList>

                    <TabsContent value="identity" className="space-y-6">
                       <Card className="rounded-[2rem] border-slate-200">
                          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                             <CardTitle className="text-lg font-bold">Public Presence</CardTitle>
                             <CardDescription>How this channel appears to customers.</CardDescription>
                          </CardHeader>
                          <CardContent className="p-8 space-y-6">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Name</Label>
                                   <Input 
                                      value={editingChannel.name} 
                                      onChange={(e) => setEditingChannel({...editingChannel, name: e.target.value})}
                                      className="rounded-xl border-slate-200 h-12 bg-slate-50 focus:bg-white transition-all font-bold" 
                                    />
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Support Email</Label>
                                   <Input 
                                      value={editingChannel.email} 
                                      onChange={(e) => setEditingChannel({...editingChannel, email: e.target.value})}
                                      className="rounded-xl border-slate-200 h-12 bg-slate-50 focus:bg-white transition-all" 
                                    />
                                </div>
                             </div>
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Route Incoming Mail To</Label>
                                <Select 
                                  value={editingChannel.group} 
                                  onValueChange={(val) => setEditingChannel({...editingChannel, group: val})}
                                >
                                   <SelectTrigger className="rounded-xl border-slate-200 h-12 bg-slate-50">
                                      <SelectValue placeholder="Select a support group" />
                                   </SelectTrigger>
                                   <SelectContent>
                                      <SelectItem value="Technical Support">Technical Support</SelectItem>
                                      <SelectItem value="Finance">Finance</SelectItem>
                                      <SelectItem value="Customer Success">Customer Success</SelectItem>
                                      <SelectItem value="Internal Ops">Internal Ops</SelectItem>
                                   </SelectContent>
                                </Select>
                             </div>
                          </CardContent>
                       </Card>
                    </TabsContent>

                    <TabsContent value="processing" className="space-y-8">
                       <Card className="rounded-[2rem] border-slate-200 overflow-hidden">
                          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
                             <div>
                                <CardTitle className="text-lg font-bold">Inbound (The intake)</CardTitle>
                                <CardDescription>How GeistDesk fetches new customer messages.</CardDescription>
                             </div>
                             <div className="flex p-1 bg-slate-200 rounded-xl">
                                <button 
                                  onClick={() => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, method: 'forwarding'}})}
                                  className={cn(
                                    "px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg",
                                    editingChannel.inbound.method === 'forwarding' ? "bg-white shadow text-primary" : "text-slate-500"
                                  )}
                                >Forwarding</button>
                                <button 
                                  onClick={() => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, method: 'imap'}})}
                                  className={cn(
                                    "px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg",
                                    editingChannel.inbound.method === 'imap' ? "bg-white shadow text-primary" : "text-slate-500"
                                  )}
                                >Direct Fetch</button>
                             </div>
                          </CardHeader>
                          <CardContent className="p-8">
                             {editingChannel.inbound.method === 'forwarding' ? (
                               <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-3xl space-y-4">
                                  <div className="flex items-start gap-4">
                                     <Info className="w-5 h-5 text-primary shrink-0" />
                                     <p className="text-xs text-slate-600 leading-relaxed">
                                        GeistDesk will generate a unique Sovereign ingestion address. Forward your support emails to this address to enable automatic threading and AI triage.
                                     </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                     <code className="block flex-1 p-3 bg-white border border-slate-200 rounded-xl text-[11px] font-mono text-primary font-bold">
                                        {editingChannel.id}-ingest@geistdesk-tickets.com
                                     </code>
                                     <Button variant="outline" className="rounded-xl border-slate-200 bg-white">
                                        <Copy className="w-4 h-4" />
                                     </Button>
                                  </div>
                               </div>
                             ) : (
                               <div className="space-y-6">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                     <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">IMAP Server</Label>
                                        <Input 
                                          placeholder="imap.example.com"
                                          value={editingChannel.inbound.host}
                                          onChange={(e) => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, host: e.target.value}})}
                                          className="rounded-xl border-slate-200 h-12 bg-slate-50"
                                        />
                                     </div>
                                     <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Port</Label>
                                        <Input 
                                          placeholder="993"
                                          value={editingChannel.inbound.port}
                                          onChange={(e) => setEditingChannel({...editingChannel, inbound: {...editingChannel.inbound, port: e.target.value}})}
                                          className="rounded-xl border-slate-200 h-12 bg-slate-50"
                                        />
                                     </div>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    onClick={handleTestInbound}
                                    className="w-full rounded-xl border-slate-200 h-12 font-bold text-xs"
                                  >
                                    <Zap className="w-4 h-4 mr-2" /> Test IMAP Connection
                                  </Button>
                               </div>
                             )}
                          </CardContent>
                       </Card>

                       <Card className="rounded-[2rem] border-slate-200 overflow-hidden">
                          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
                             <div>
                                <CardTitle className="text-lg font-bold">Outbound (The delivery)</CardTitle>
                                <CardDescription>How customer replies are dispatched.</CardDescription>
                             </div>
                             <div className="flex p-1 bg-slate-200 rounded-xl">
                                <button 
                                  onClick={() => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, method: 'system'}})}
                                  className={cn(
                                    "px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg",
                                    editingChannel.outbound.method === 'system' ? "bg-white shadow text-primary" : "text-slate-500"
                                  )}
                                >System SMTP</button>
                                <button 
                                  onClick={() => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, method: 'smtp'}})}
                                  className={cn(
                                    "px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg",
                                    editingChannel.outbound.method === 'smtp' ? "bg-white shadow text-primary" : "text-slate-500"
                                  )}
                                >Custom SMTP</button>
                             </div>
                          </CardHeader>
                          <CardContent className="p-8">
                             {editingChannel.outbound.method === 'system' ? (
                               <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                                  <div className="flex items-center gap-3 justify-between">
                                     <div className="flex items-center gap-3">
                                        <Globe className="w-5 h-5 text-slate-400" />
                                        <div>
                                           <p className="text-sm font-bold text-slate-900">Sovereign Global Delivery</p>
                                           <p className="text-xs text-slate-500">Replies are routed through GeistDesk's high-reputation SMTP pool.</p>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400">OAuth2</Label>
                                        <Switch 
                                          checked={editingChannel.outbound.useOAuth} 
                                          onCheckedChange={(val) => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, useOAuth: val}})}
                                        />
                                     </div>
                                  </div>
                               </div>
                             ) : (
                               <div className="space-y-6">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                     <div className="col-span-2 space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">SMTP Host</Label>
                                        <Input 
                                          placeholder="smtp.example.com"
                                          value={editingChannel.outbound.host}
                                          onChange={(e) => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, host: e.target.value}})}
                                          className="rounded-xl border-slate-200 h-12 bg-slate-50"
                                        />
                                     </div>
                                     <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">SMTP Port</Label>
                                        <Input 
                                          placeholder="465"
                                          value={editingChannel.outbound.port}
                                          onChange={(e) => setEditingChannel({...editingChannel, outbound: {...editingChannel.outbound, port: e.target.value}})}
                                          className="rounded-xl border-slate-200 h-12 bg-slate-50"
                                        />
                                     </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                     <Button 
                                       variant="outline" 
                                       onClick={handleAutoDiscover}
                                       className="rounded-xl border-slate-200 h-12 font-bold text-xs"
                                     >
                                        <Sparkles className="w-4 h-4 mr-2" /> Auto-Discover Settings
                                     </Button>
                                     <Button 
                                       variant="outline" 
                                       onClick={handleTestOutbound}
                                       className="flex-1 rounded-xl border-slate-200 h-12 font-bold text-xs"
                                     >
                                        <Zap className="w-4 h-4 mr-2" /> Test Outbound Connection
                                     </Button>
                                  </div>
                               </div>
                             )}
                          </CardContent>
                       </Card>
                    </TabsContent>

                    <TabsContent value="signature" className="space-y-6">
                       <Card className="rounded-[2rem] border-slate-200">
                          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
                             <div>
                                <CardTitle className="text-lg font-bold">Signature Studio</CardTitle>
                                <CardDescription>Craft your global support HTML signature.</CardDescription>
                             </div>
                             <div className="flex items-center gap-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Polyglot Bridge</Label>
                                <Switch />
                             </div>
                          </CardHeader>
                          <CardContent className="p-8">
                             <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white mb-4">
                                <ReactQuill 
                                  theme="snow"
                                  value={editingChannel.signature}
                                  onChange={(val) => setEditingChannel({...editingChannel, signature: val})}
                                  className="h-48"
                                />
                             </div>
                             <p className="text-[10px] text-slate-400 italic">This signature is appended dynamically to every reply sent from this channel.</p>
                          </CardContent>
                       </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-8">
                   <Card className="rounded-[2.5rem] border-slate-200 shadow-sm p-8 bg-white">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                         <Activity className="w-4 h-4" /> Sovereign Insights
                      </h3>
                      <div className="space-y-6">
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-600">Verification</span>
                            {renderStatusBadge(editingChannel.status)}
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-600">Health Monitor</span>
                            <span className="text-xs font-black text-emerald-500 uppercase flex items-center gap-2">
                               <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                               Operational
                            </span>
                         </div>
                         <Separator />
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-400">Security Guardrails</h4>
                            <div className="space-y-3">
                               <div className="flex items-center gap-3">
                                  <Check className="w-4 h-4 text-emerald-500" />
                                  <span className="text-xs font-medium text-slate-600">TLS 1.3 Encryption enforced</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  <Check className="w-4 h-4 text-emerald-500" />
                                  <span className="text-xs font-medium text-slate-600">OAuth2 Token isolation active</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs font-medium text-slate-600">Missing SPF include:geistdesk.ai</span>
                               </div>
                            </div>
                            <Button 
                              variant="outline" 
                              onClick={() => setIsDnsModalOpen(true)}
                              className="w-full rounded-xl border-slate-200 font-bold text-[10px] uppercase tracking-widest"
                            >
                               Manage DNS Hygiene
                            </Button>
                         </div>
                      </div>
                   </Card>

                   <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                      <div className="flex items-center gap-3 relative z-10">
                         <Bot className="w-6 h-6 text-primary" />
                         <span className="text-sm font-black uppercase tracking-tight">Intelligence</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed relative z-10">
                         GeistDesk is monitoring this mailbox. If credentials expire, a corrective task will be automatically dispatched to the System Admin.
                      </p>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Record Modals */}
        <Dialog open={isDnsModalOpen} onOpenChange={setIsDnsModalOpen}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl">
            <DialogHeader className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-2">
                 <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <AlertTriangle className="w-6 h-6" />
                 </div>
                 <DialogTitle className="text-xl font-black text-[#202124]">Domain Hygiene (DNS)</DialogTitle>
              </div>
              <DialogDescription className="text-sm font-medium">
                 Ensure your domain records are configured correctly to prevent replies from being flagged as spam.
              </DialogDescription>
            </DialogHeader>
            <div className="p-8 pt-4 space-y-6">
               <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">SPF Record (TXT)</Label>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                       <code className="text-xs font-mono text-emerald-600 font-bold">v=spf1 include:_spf.google.com include:hetzner.geistdesk.net ~all</code>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary transition-colors">
                          <Copy className="w-4 h-4" />
                       </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">DKIM Selector (geistdesk._domainkey)</Label>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                       <code className="text-[10px] font-mono text-slate-500 break-all leading-tight">v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv...</code>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary transition-colors">
                          <Copy className="w-4 h-4" />
                       </Button>
                    </div>
                  </div>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100">
               <Button onClick={() => setIsDnsModalOpen(false)} className="rounded-xl font-bold px-8">I've added these records</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
           <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2rem]">
              <DialogHeader className="p-8 pb-4 text-center">
                 <DialogTitle className="text-xl font-black text-slate-900">Connect Channel</DialogTitle>
                 <DialogDescription>Which provider are you using for this mailbox?</DialogDescription>
              </DialogHeader>
              <div className="p-8 pt-4 space-y-4">
                 <button className="w-full p-4 flex items-center justify-between bg-white border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Globe className="w-5 h-5" />
                       </div>
                       <div className="text-left">
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Google Workspace</p>
                          <p className="text-[11px] text-slate-500 font-medium">Connect via OAuth2 (Recommended)</p>
                       </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                 </button>
                 <button className="w-full p-4 flex items-center justify-between bg-white border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Cloud className="w-5 h-5" />
                       </div>
                       <div className="text-left">
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Microsoft 365</p>
                          <p className="text-[11px] text-slate-500 font-medium">Outlook & Exchange Online</p>
                       </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                 </button>
                 <Separator />
                 <button 
                  onClick={() => {
                    const newId = Math.random().toString(36).substr(2, 9);
                    const newChannel: EmailChannel = {
                        id: newId,
                        name: 'New Custom Channel',
                        email: '',
                        group: 'Technical Support',
                        status: 'pending',
                        isPrimary: false,
                        provider: 'custom',
                        type: 'direct',
                        inbound: { method: 'imap' },
                        outbound: { method: 'smtp' }
                    };
                    setChannels([...channels, newChannel]);
                    setEditingChannel(newChannel);
                    setIsConnectModalOpen(false);
                  }}
                  className="w-full p-4 flex items-center justify-between bg-white border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
                 >
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Settings className="w-5 h-5" />
                       </div>
                       <div className="text-left">
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Custom Server</p>
                          <p className="text-[11px] text-slate-500 font-medium">Self-hosted IMAP/SMTP</p>
                       </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                 </button>
              </div>
           </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
