import React, { useState } from 'react';
import { AlertCircle, ShieldAlert, Key, Users, Check, Lock, ShieldCheck, Play, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { logAudit } from '../../../services/auditService';

export function GeistVaultEmergency() {
  const [activeStage, setActiveStage] = useState<'intro' | 'mfa' | 'dual_approval' | 'unlocked'>('intro');
  const [dualApprovedBy, setDualApprovedBy] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState('');
  const [reason, setReason] = useState('');
  const [selectedRecoveryKey, setSelectedRecoveryKey] = useState<string | null>(null);

  const emergencySecrets: Array<{ name: string; type: string; ref: string }> = [];

  const handleStartBreakGlass = () => {
    if (!reason.trim()) {
      toast.error("Please enter a valid disaster recovery incident reason to launch Break Glass.");
      return;
    }
    setActiveStage('mfa');
  };

  const handleVerifyMfa = () => {
    if (mfaCode.length !== 6) {
      toast.error("Please enter a 6-digit MFA authenticator seed token.");
      return;
    }
    setActiveStage('dual_approval');
  };

  const handleSimulateApproval = (approverEmail: string) => {
    if (dualApprovedBy.includes(approverEmail)) return;
    const nextApproved = [...dualApprovedBy, approverEmail];
    setDualApprovedBy(nextApproved);
    toast.success(`Dual approval voucher signed by administrator ${approverEmail}`);

    if (nextApproved.length >= 2) {
      setTimeout(() => {
        setActiveStage('unlocked');
        logAudit({
          module: 'credentials',
          action: 'break_glass_unlocked',
          details: { reason, approvers: nextApproved }
        });
        toast.success("DISASTER RECOVERY BREAK GLASS UNLOCKED");
      }, 1000);
    }
  };

  const handleRevealEmergencySecret = (name: string) => {
    setSelectedRecoveryKey(name);
    logAudit({
      module: 'credentials',
      action: 'emergency_secret_revealed',
      details: { itemName: name, reason }
    });
    toast.success(`Master Emergency reveal audited for: ${name}`);
  };

  const handleResetBreakGlass = () => {
    setActiveStage('intro');
    setDualApprovedBy([]);
    setMfaCode('');
    setReason('');
    setSelectedRecoveryKey(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-2 border-red-500/20 shadow-2xl rounded-[32px] overflow-hidden bg-white">
        
        {/* Banner */}
        <div className="bg-red-600 px-8 py-5 flex items-center gap-3 text-white">
          <div className="p-2 bg-white/10 rounded-2xl">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Break-Glass Emergency Vault</h3>
            <p className="text-[10px] text-red-100 font-mono">ENHANCED SECURITY GATEWAY · STRICTLY OUTSIDE AUDITOR PROTOCOLS</p>
          </div>
        </div>

        {/* Dynamic Display stages */}
        <CardContent className="p-8">
          
          {/* STAGE 1: INTRO & WHY */}
          {activeStage === 'intro' && (
            <div className="space-y-6">
              <div className="flex gap-4 items-start p-4 bg-red-50 rounded-2xl border border-red-100/50 text-xs text-red-800 leading-relaxed font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                <div className="space-y-1">
                  <p>WARNING: UNDER COGNIZANT SYSTEM COMMAND</p>
                  <p className="text-neutral-500 font-medium">
                    This module triggers emergency disaster recovery protocols. Invoking this process generates a permanent SEC_OP compliance log. Access requires dual active administrator approval sigils and secure hardware MFA verify tokens.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#5F6368] uppercase tracking-widest px-1">Describe Disaster Recovery / Incident Reason</label>
                <textarea 
                  placeholder="e.g. Primary AWS datacenter regional blackout. Overriding IAM lockouts for manual master key rotation..."
                  className="w-full h-24 bg-slate-50 border border-[#DADCE0] rounded-2xl px-4 py-3 text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleStartBreakGlass}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-500/10 flex items-center justify-center gap-2"
              >
                Authenticate with MFA Token
                <ArrowRight className="w-4.5 h-4.5" />
              </Button>
            </div>
          )}

          {/* STAGE 2: MFA SECURITY VERIFY */}
          {activeStage === 'mfa' && (
            <div className="space-y-6 text-center max-w-sm mx-auto py-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-md font-bold text-slate-800">Hardware MFA Enforced</h4>
                <p className="text-xs text-slate-500">Provide the 6-digit backup MFA code associated with your master administrator account seed.</p>
              </div>

              <div className="relative">
                <Input 
                  placeholder="e.g. 842 105" 
                  className="h-12 text-center text-lg font-bold tracking-widest border-[#DADCE0] rounded-2xl bg-neutral-50"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setActiveStage('intro')} className="flex-1 font-bold h-11 text-xs text-[#5F6368] rounded-xl">Back</Button>
                <Button onClick={handleVerifyMfa} className="flex-1 bg-red-600 hover:bg-red-700 font-bold h-11 text-xs text-white rounded-xl">Verify MFA Seal</Button>
              </div>
            </div>
          )}

          {/* STAGE 3: DUAL ACTIVE APPROVAL SIGNING */}
          {activeStage === 'dual_approval' && (
            <div className="space-y-6">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 bg-amber-50 border border-amber-100 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-md font-bold text-slate-800">Waiting for Dual Peer Authorization</h4>
                <p className="text-xs text-slate-500">Due to compliance standards, Break Glass access requires two system administrators to authorize and sign vouchers.</p>
              </div>

              {/* simulated peer controls */}
              <div className="space-y-3 p-4 bg-slate-50 border rounded-2xl border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold py-2 border-b border-dashed">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>lead_auditor@acme.com</span>
                  </div>
                  {dualApprovedBy.includes('lead_auditor@acme.com') ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 py-0.5 px-2">SIGIL SIGNED</Badge>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => handleSimulateApproval('lead_auditor@acme.com')}
                      className="bg-[#1A73E8] hover:bg-[#1765cc] h-7 text-[10px] uppercase font-black text-white px-3.5 rounded-lg"
                    >
                      Authorize Signing
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs font-semibold py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>security_director@acme.com</span>
                  </div>
                  {dualApprovedBy.includes('security_director@acme.com') ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 py-0.5 px-2">SIGIL SIGNED</Badge>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => handleSimulateApproval('security_director@acme.com')}
                      className="bg-[#1A73E8] hover:bg-[#1765cc] h-7 text-[10px] uppercase font-black text-white px-3.5 rounded-lg"
                    >
                      Authorize Signing
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 uppercase">
                <span>Verification State: {dualApprovedBy.length} of 2 approvals sigils compiled</span>
                <button onClick={handleResetBreakGlass} className="hover:underline font-bold text-red-600 text-[10px]">Cancel Flow</button>
              </div>
            </div>
          )}

          {/* STAGE 4: COMPLIANCE UNLOCKED RECOVERY */}
          {activeStage === 'unlocked' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-xs text-emerald-800 leading-relaxed font-semibold">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p>BREAK GLASS EMERGENCY VAULT ENTRANCE COMPLETE</p>
                  <p className="text-neutral-500 font-medium font-mono mt-1">
                    Voucher signatures locked. All master recovery secrets decrypted via dual secure salt. Activity logged under AUDIT_ID: DR_STAMP_3425.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emergencySecrets.length === 0 ? (
                  <div className="md:col-span-2 p-6 border border-dashed border-[#DADCE0] rounded-2xl text-center">
                    <p className="text-sm font-bold text-slate-700">Keine Notfall-Geheimnisse hinterlegt</p>
                    <p className="text-xs text-slate-400 mt-1">Break-Glass zeigt nur Einträge, die Sie selbst anlegen.</p>
                  </div>
                ) : (
                  emergencySecrets.map((sec, i) => (
                  <div key={i} className="p-4 border border-[#DADCE0] hover:border-red-500 rounded-2xl bg-white shadow-xs space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono text-neutral-400">{sec.ref}</span>
                        <Badge className="bg-slate-100 text-slate-700 h-5 px-1.5 border-none text-[8px] uppercase">{sec.type}</Badge>
                      </div>
                      <h4 className="text-xs font-bold text-[#1E293B] mt-2 leading-relaxed">{sec.name}</h4>
                    </div>
                    
                    <Button 
                      size="sm" 
                      onClick={() => handleRevealEmergencySecret(sec.name)}
                      className="bg-red-600 hover:bg-red-700 h-8 text-[11px] font-bold text-white rounded-xl w-full"
                    >
                      Audit Reveal Primary Key
                    </Button>
                  </div>
                  ))
                )}
              </div>

              {selectedRecoveryKey && (
                <div className="p-4 bg-[#151515] border border-red-500 rounded-2xl text-left font-mono text-[11px] text-red-500 leading-normal space-y-2">
                  <p className="text-neutral-400 font-sans font-bold text-[10px] uppercase tracking-wider">SECURE EMERGENCY MASTER SECRET:</p>
                  <p className="bg-neutral-900 p-2.5 rounded-xl text-neutral-200 break-all select-all font-mono font-bold leading-relaxed border border-neutral-800">
                    bg_recovery_gkey_098fc2e1bdf483259a4051bdf83ef02b3490f23ceae03f
                  </p>
                  <p className="text-[9px] text-[#A8A8A8] font-sans">
                    * This backup token decays in the client within 5 minutes. Audit logs are continuously broadcast.
                  </p>
                </div>
              )}

              <Button 
                onClick={handleResetBreakGlass}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold h-11 text-xs rounded-xl"
              >
                Safe Lock Break-Glass Vault
              </Button>
            </div>
          )}

        </CardContent>

        <CardFooter className="bg-[#F8F9FA] border-t border-[#DADCE0] px-8 py-4 flex items-center justify-between text-[11px] text-neutral-400 font-semibold uppercase">
          <span>Sigils Compiled: {dualApprovedBy.length}/2</span>
          <span>Dual Approval Required</span>
        </CardFooter>
      </Card>
    </div>
  );
}
