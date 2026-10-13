import React from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, HelpCircle, FileText, Download, Calendar, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';

export function GeistVaultCompliance() {
  const frameworks = [
    {
      name: "SOC 2 Type II Compliance",
      code: "SOC2",
      description: "Trust Services Criteria for Security, Availability, Processing Integrity, and Confidentiality.",
      score: 96,
      status: "Compliant",
      lastAudit: "May 15, 2026",
      violations: 0,
      checks: [
        { label: "Decryption audits logged to security repository", status: "pass" },
        { label: "Master keys derived using Argond2id + localized salts", status: "pass" },
        { label: "Access approval rules enforced for AWS and Prod keys", status: "pass" },
        { label: "2FA authentication forced for vault entrance", status: "pass" }
      ]
    },
    {
      name: "ISO/IEC 27001:2023",
      code: "ISO27001",
      description: "International standard for managing information risk and implementing security controls.",
      score: 91,
      status: "Compliant",
      lastAudit: "Apr 28, 2026",
      violations: 1,
      checks: [
        { label: "30-day credential rotation checklist active", status: "warning", details: "3 ERP web keys overdue" },
        { label: "Temporary JIT sessions auto-extinguish", status: "pass" },
        { label: "Audit events log host, username, and active ticket id", status: "pass" },
        { label: "Dual approval required for emergency root keys", status: "pass" }
      ]
    },
    {
      name: "PCI-DSS v4.0 Tier 1",
      code: "PCI-DSS",
      description: "Controls for securing sensitive credit card payment processing environments.",
      score: 85,
      status: "Action Required",
      lastAudit: "Jun 01, 2026",
      violations: 2,
      checks: [
        { label: "Zero plain storage of credit-card database passwords", status: "pass" },
        { label: "Strict restricted access on DB category root credentials", status: "warning", details: "Unrestricted visibility detected on Acme-Billing" },
        { label: "Regular scanning of database endpoint connectivity", status: "pass" }
      ]
    }
  ];

  const handleExportReadiness = (framework: string) => {
    toast.success(`Exporting compliance package for ${framework}...`);
  };

  return (
    <div className="space-y-6">
      
      {/* Compliance Overview Summary card */}
      <Card className="border border-[#DADCE0] shadow-xs rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 bg-slate-50 border-b border-[#DADCE0]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                Sovereign Compliance Center
              </CardTitle>
              <CardDescription className="text-[11px] text-neutral-500">
                Track compliance audit status and readiness profiles for major security controls and SOC2/ISO standard definitions.
              </CardDescription>
            </div>
            <Button 
              onClick={() => handleExportReadiness("ALL")} 
              className="bg-[#1A73E8] hover:bg-[#1765cc] text-xs h-9 px-4 rounded-xl text-white font-bold max-w-fit"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Export Signed Audit Bundle
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Overall Security Grade</span>
              <p className="text-3xl font-bold text-emerald-600 mt-1">A+</p>
              <p className="text-[10px] text-emerald-800 font-medium mt-1">SOC 2 / ISO Validated</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-wide">Controls Monitored</span>
              <p className="text-3xl font-bold text-[#1E293B] mt-1">42</p>
              <p className="text-[10px] text-neutral-500 font-medium mt-1">Continuous active checks</p>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Active Violations</span>
              <p className="text-3xl font-bold text-amber-600 mt-1">3</p>
              <p className="text-[10px] text-amber-800 font-medium mt-1">No critical risks logged</p>
            </div>

            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Audit Readiness</span>
              <p className="text-3xl font-bold text-blue-600 mt-1">94%</p>
              <p className="text-[10px] text-blue-800 font-medium mt-1">Prepared for SOC2 H2</p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Framework Accordion Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {frameworks.map((f, idx) => (
          <Card key={idx} className="border border-[#DADCE0] shadow-sm rounded-3xl bg-white overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <Badge className={`text-[9px] uppercase font-bold h-5 px-1.5 border-none ${
                    f.status === 'Compliant' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {f.status}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-neutral-400">{f.code}</span>
                </div>
                <CardTitle className="text-md font-bold mt-2.5 text-[#1E293B]">{f.name}</CardTitle>
                <CardDescription className="text-[11px] leading-relaxed mt-1">{f.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[#5F6368]">Readiness Rating</span>
                    <span className={f.score > 90 ? "text-emerald-500" : "text-amber-500"}>{f.score}%</span>
                  </div>
                  <Progress value={f.score} className="h-2 rounded-full" />
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-50">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Core Controls Audit:</span>
                  <div className="space-y-2 text-[11px] font-medium text-slate-700">
                    {f.checks.map((chk, i) => (
                      <div key={i} className="flex gap-2 items-start leading-snug">
                        {chk.status === 'pass' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <span>{chk.label}</span>
                          {chk.details && <span className="text-[10px] text-neutral-400 block font-bold mt-0.5">* {chk.details}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="p-5 pt-0 mt-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-400">Last scan: {f.lastAudit}</span>
              <Button 
                onClick={() => handleExportReadiness(f.code)} 
                variant="ghost" 
                size="sm" 
                className="text-primary font-bold text-[11px] h-7 px-2 hover:bg-primary/5 rounded-lg"
              >
                Auditor Package <ExternalLink className="w-3 h-3 ml-1.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
