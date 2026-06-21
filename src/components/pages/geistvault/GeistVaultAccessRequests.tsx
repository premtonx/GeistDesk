import React, { useState } from 'react';
import { ShieldCheck, HelpCircle, User, Clock, ArrowRight, Check, X, AlertCircle, Copy, Link, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { toast } from 'sonner';

export function GeistVaultAccessRequests() {
  const [activeTab, setActiveTab] = useState<'pending' | 'jit' | 'sharing'>('pending');
  const [shareLinkName, setShareLinkName] = useState('');
  const [shareLinkExpiry, setShareLinkExpiry] = useState('24h');
  const [generatedShareLink, setGeneratedShareLink] = useState('');
  
  const [pendingRequests, setPendingRequests] = useState([
    {
      id: "REQ-302",
      requester: "sarah.james@acme.com",
      credentialName: "Billing Postgres Main DB Admin",
      role: "Support Agent",
      reason: "Debugging broken payment callback log on ticket #8294",
      duration: "2 Hours",
      status: "pending",
      requestedAt: "10 minutes ago"
    },
    {
      id: "REQ-304",
      requester: "alex.sanders@acme.com",
      credentialName: "AWS Billing Prod Credentials",
      role: "Finance Admin",
      reason: "SOCI compliance expense audit reports check",
      duration: "8 Hours",
      status: "pending",
      requestedAt: "25 minutes ago"
    }
  ]);

  const [activeJITs, setActiveJITs] = useState([
    {
      id: "JIT-104",
      user: "lead_agent@acme.com",
      credentialName: "DigitalOcean API Root Token",
      timeLeft: "1h 42m",
      grantedBy: "security_director@acme.com",
      scope: "DigitalOcean Personal Token"
    },
    {
      id: "JIT-105",
      user: "sarah.james@acme.com",
      credentialName: "Cisco Core Gateway Access",
      timeLeft: "24m 10s",
      grantedBy: "system_admin@acme.com",
      scope: "VPN Access"
    }
  ]);

  const handleApprove = (reqId: string, name: string, requester: string) => {
    setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    
    // Add to active JITs
    const newJit = {
      id: `JIT-${Math.floor(Math.random() * 100) + 110}`,
      user: requester,
      credentialName: name,
      timeLeft: "2h 00m",
      grantedBy: "system_admin@acme.com",
      scope: "Temporary JIT Token"
    };
    setActiveJITs(prev => [...prev, newJit]);

    toast.success(`Access Request approved for ${requester}. Temporary token activated.`);
  };

  const handleDeny = (reqId: string, requester: string) => {
    setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    toast.error(`Access Request denied for ${requester}.`);
  };

  const handleGenerateShareLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareLinkName.trim()) {
      toast.error("Please enter a token label/URL reference path to share.");
      return;
    }
    const token = Math.random().toString(36).substring(2, 10);
    const mockUrl = `https://geistdesk.internal/vault/claim?token=BG_SECURE_${token}_EXP`;
    setGeneratedShareLink(mockUrl);
    toast.success("Zero-Knowledge Secure Link Generated.");
  };

  return (
    <div className="space-y-6">
      
      {/* Sub menu tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'pending', label: 'Pending Access Approvals', badge: pendingRequests.length },
          { id: 'jit', label: 'Just-In-Time Sessions Active', badge: activeJITs.length },
          { id: 'sharing', label: 'Secure Secret Sharing', badge: null }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === t.id 
                ? 'bg-[#E8F0FE] text-[#1A73E8]' 
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            {t.label}
            {t.badge !== null && (
              <Badge className={activeTab === t.id ? 'bg-[#1A73E8] text-white' : 'bg-neutral-200 text-neutral-600'}>
                {t.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* RENDER ACTIVE TAB BODY */}

      {/* 1. ACCESS REQUESTS */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length > 0 ? (
            pendingRequests.map(req => (
              <Card key={req.id} className="border border-[#DADCE0] shadow-xs rounded-2xl bg-white overflow-hidden">
                <CardHeader className="p-5 pb-3 bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-start space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">{req.requester}</h4>
                      <p className="text-[10px] text-neutral-500 font-semibold">{req.role} · Requested {req.requestedAt}</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 h-5 px-1.5 border-none text-[8px] uppercase">PENDING APPROVAL</Badge>
                </CardHeader>
                
                <CardContent className="p-5 space-y-3 text-xs leading-relaxed">
                  <div className="flex flex-col md:flex-row md:justify-between font-semibold gap-2 border-b border-slate-50 pb-2">
                    <span className="text-neutral-500">Target Credential: <strong className="text-[#1E293B]">{req.credentialName}</strong></span>
                    <span className="text-neutral-500 flex items-center gap-1.5 leading-snug">
                      <Clock className="w-3.5 h-3.5" />
                      Duration Requested: <strong className="text-[#1E293B]">{req.duration}</strong>
                    </span>
                  </div>
                  <p className="text-neutral-600 italic">
                    Reason: "{req.reason}"
                  </p>
                </CardContent>

                <CardFooter className="p-5 pt-0 flex gap-2.5 justify-end">
                  <Button 
                    onClick={() => handleDeny(req.id, req.requester)}
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-4 text-xs font-bold rounded-xl border-[#DADCE0]"
                  >
                    <X className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                    Deny Access
                  </Button>
                  <Button 
                    onClick={() => handleApprove(req.id, req.credentialName, req.requester)}
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4 text-xs font-bold rounded-xl text-white shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Approve JIT Token
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="h-44 flex flex-col items-center justify-center bg-white border border-[#DADCE0] border-dashed rounded-3xl text-center">
              <Check className="w-8 h-8 text-emerald-500 mb-2 p-1.5 bg-emerald-50 rounded-full" />
              <p className="text-sm font-bold text-slate-700">All caught up!</p>
              <p className="text-xs text-neutral-400">There are no pending third-party credential access authorization requests.</p>
            </div>
          )}
        </div>
      )}

      {/* 2. JIT RECOVERY SESSIONS ACTIVE */}
      {activeTab === 'jit' && (
        <div className="space-y-4">
          {activeJITs.length > 0 ? (
            activeJITs.map(jit => (
              <Card key={jit.id} className="border border-[#DADCE0] shadow-xs rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-neutral-800">{jit.credentialName}</h4>
                      <Badge className="bg-emerald-100 text-emerald-800 h-4 px-1.5 text-[8px] uppercase">JIT ELEVATION ACTIVE</Badge>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-semibold font-mono">
                      User: {jit.user} · Authorized By: {jit.grantedBy}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Auto Revoke countdown</span>
                      <p className="text-xs font-mono font-bold text-red-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        {jit.timeLeft}
                      </p>
                    </div>

                    <Button 
                      onClick={() => {
                        setActiveJITs(prev => prev.filter(p => p.id !== jit.id));
                        toast.success(`JIT access revoked manually for ${jit.user}`);
                      }} 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase font-black text-red-600 hover:text-white hover:bg-red-600 px-3 rounded-lg border border-red-200"
                    >
                      Revoke Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="h-44 flex flex-col items-center justify-center bg-white border border-[#DADCE0] border-dashed rounded-3xl text-center">
              <Clock className="w-8 h-8 text-neutral-400 mb-2" />
              <p className="text-sm font-bold text-slate-700">No active JIT tokens</p>
              <p className="text-xs text-neutral-400">All elevated access sessions have expired. Standby metrics normal.</p>
            </div>
          )}
        </div>
      )}

      {/* 3. SECRET SHARING SECURE URL GENERATION */}
      {activeTab === 'sharing' && (
        <Card className="border border-[#DADCE0] rounded-3xl bg-white overflow-hidden max-w-xl mx-auto shadow-sm">
          <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Link className="w-4.5 h-4.5 text-[#1A73E8]" />
              Secure Link Generator
            </CardTitle>
            <CardDescription className="text-xs">
              Generate localized secure URLs containing encrypted keys. Perfect for sharing with customers or linking via GeistExchange in tickets.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleGenerateShareLink} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest px-1">Describe Vault Item / Label to share</label>
                <Input 
                  placeholder="e.g. Acme API Staging Tokens"
                  className="h-11 border-[#DADCE0] text-xs bg-slate-50/50"
                  value={shareLinkName}
                  onChange={(e) => setShareLinkName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest px-1">Enforce Expiration</label>
                  <select 
                    value={shareLinkExpiry}
                    onChange={(e) => setShareLinkExpiry(e.target.value)}
                    className="w-full h-11 px-3 border border-[#DADCE0] bg-white rounded-xl text-xs focus:outline-none"
                  >
                    <option value="1h">Burn in 1 Hour</option>
                    <option value="24h">Burn in 24 Hours</option>
                    <option value="read">Burn on First Read</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest px-1">Target Delivery System</label>
                  <select className="w-full h-11 px-3 border border-[#DADCE0] bg-white rounded-xl text-xs focus:outline-none">
                    <option>Copy Link manually</option>
                    <option>Inject to related active ticket</option>
                    <option>Publish to GeistExchange</option>
                  </select>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 bg-[#1A73E8] hover:bg-[#1765cc] font-bold text-xs text-white rounded-xl shadow-md">
                Securely Package & Generate Link
              </Button>
            </form>

            {generatedShareLink && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-[9px] uppercase font-mono font-bold text-neutral-400">SECURE DISCOVERY COMPLETED LINK:</span>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={generatedShareLink} 
                    className="flex-1 font-mono text-xs h-10 select-all border-[#DADCE0] bg-white text-[#1A73E8]"
                  />
                  <Button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedShareLink);
                      toast.success("Secure transfer link copied!");
                    }}
                    className="h-10 w-10 p-0 bg-[#E8F0FE] text-[#1A73E8] hover:bg-[#D2E3FC] border-none rounded-xl"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-neutral-400">
                  * This link utilizes a client-side public decryption key that automatically burns according to policy rules.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
