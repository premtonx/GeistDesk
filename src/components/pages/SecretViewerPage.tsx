import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { vaultService } from '../../services/vaultService';
import { VaultItem } from '../../types';
import { isDemoExchangeId } from '../../components/exchange/exchange-status-utils';
import { 
  ShieldCheck, 
  Lock, 
  Trash2, 
  Copy, 
  Check, 
  ShieldAlert,
  Clock,
  Zap,
  ArrowRight,
  Upload
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { combine } from 'shamir-secret-sharing';

export default function SecretViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewed, setViewed] = useState(false);
  const [copying, setCopying] = useState(false);
  const [reconstructedContent, setReconstructedContent] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadItem();
    }
  }, [id]);

  const loadItem = async () => {
    setLoading(true);
    if (id && isDemoExchangeId(id)) {
      setItem(null);
      setLoading(false);
      return;
    }
    const data = await vaultService.getItem(id!);
    setItem(data);
    setLoading(false);
  };

  const handleReveal = async () => {
    if (!item || item.isBurned) return;

    setViewed(true);

    // Fetch decrypted material from the server exactly once. Read-once secrets
    // are burned server-side as part of this call.
    const revealed = await vaultService.revealItem(item.id);
    if (!revealed || revealed.preview) {
      toast.error("This secret has already been burned or has expired.");
      setItem({ ...item, isBurned: true });
      return;
    }

    if (revealed.content) {
      setReconstructedContent(revealed.content);
    } else if (revealed.shares && revealed.shares.length > 0) {
      try {
        const uint8Shares = revealed.shares.slice(0, 3).map(shareB64 => {
          const binary = atob(shareB64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        });

        const combinedUint8 = await combine(uint8Shares);
        const decoded = new TextDecoder().decode(combinedUint8);
        setReconstructedContent(decoded);
      } catch (err) {
        console.error("SSS Reconstruction Failed:", err);
      }
    }

    toast.info("This secret has been revealed and will self-destruct.");
  };

  const copyToClipboard = () => {
    const textToCopy = reconstructedContent || item?.content;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success("Copied to clipboard.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="flex -space-x-2 animate-pulse mb-4">
          <div className="w-3 h-8 bg-blue-500 rounded-full"></div>
          <div className="w-3 h-8 bg-blue-400 rounded-full"></div>
          <div className="w-3 h-8 bg-blue-300 rounded-full"></div>
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Decrypting Payload...</p>
      </div>
    );
  }

  if (!item || item.isBurned) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {id && isDemoExchangeId(id) ? 'Demo Link — Not Live' : 'Phantom Link Expired'}
        </h1>
        <p className="text-slate-500 max-w-md mb-8">
          {id && isDemoExchangeId(id)
            ? 'This dashboard row is seeded for Schnellfilter demos and has no vault payload. Create a real secret link to test burn-after-read.'
            : 'This data has already been burned or the link was invalid. Phantom links self-destruct immediately after viewing.'}
        </p>
        {!isDemoExchangeId(id ?? '') && (
          <Badge variant="outline" className="bg-white border-red-200 text-red-600 px-4 py-1">Code 410: Gone</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#E8F0FE] rounded-3xl flex items-center justify-center text-[#1A73E8]">
            <Lock className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Secure Payload Received</h1>
          <p className="text-sm text-slate-500">
            {item.expirationType === 'read' 
              ? "This secret will self-destruct as soon as you reveal it." 
              : "This secret will expire in 24 hours."}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!viewed ? (
            <motion.div 
              key="reveal"
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="p-12 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group hover:border-[#1A73E8] transition-colors cursor-pointer" onClick={handleReveal}>
                <Zap className="w-8 h-8 text-[#1A73E8] fill-current animate-pulse group-hover:scale-125 transition-transform" />
                <span className="text-sm font-bold text-[#1A73E8] uppercase tracking-widest">
                  {item.type === 'request' ? 'Open Secure Dropzone' : 'Click to Reveal'}
                </span>
              </div>
              
              <Button 
                onClick={handleReveal}
                className="w-full h-14 bg-[#1A73E8] hover:bg-[#1765cc] rounded-2xl font-bold"
              >
                {item.type === 'request' ? 'Enter Dropzone' : 'Reveal Secret'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {item.type === 'request' && !item.content ? (
                <div className="space-y-6">
                  <div className="p-12 rounded-3xl bg-[#E8F0FE]/30 border-2 border-dashed border-[#1A73E8]/30 flex flex-col items-center justify-center gap-4 group hover:border-[#1A73E8] transition-colors">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-[#1A73E8]">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900">Secure Dropzone Active</p>
                      <p className="text-xs text-slate-500 mt-1">Files uploaded here are encrypted with PQC-ECC before storage.</p>
                    </div>
                    <Input 
                      type="file" 
                      className="hidden" 
                      id="dropzone-file" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            const text = event.target?.result as string;
                            await vaultService.updateItem(item.id, { 
                              content: `FILE: ${file.name}\nCONTENT: ${text.slice(0, 500)}...`,
                              metadata: { ...item.metadata, filename: file.name }
                            });
                            toast.success("Payload delivered successfully to destination.");
                            loadItem();
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <label 
                      htmlFor="dropzone-file"
                      className="mt-2 px-6 py-3 bg-[#1A73E8] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-[#1765cc] transition-colors"
                    >
                      SELECT PAYLOAD
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl opacity-20 blur group-hover:opacity-40 transition-opacity" />
                    <div className="relative p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                       <p className="text-[10px] font-black uppercase tracking-widest text-[#1A73E8] mb-2">
                         {item.type === 'request' ? 'Uploaded Payload' : 'Secret Content'}
                       </p>
                       <pre className="text-sm font-mono text-slate-900 whitespace-pre-wrap break-all">
                         {reconstructedContent || item.content || "Payload burned."}
                       </pre>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                       className="flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2"
                       onClick={copyToClipboard}
                    >
                      {copying ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copying ? 'Copied' : 'Copy Text'}
                    </Button>
                    <div className="h-12 px-4 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                       <Trash2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-6">
           <div className="flex items-center gap-1.5 grayscale opacity-50">
             <ShieldCheck className="w-3 h-3 text-[#1A73E8]" />
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">PQC-ECC Shield</span>
           </div>
           <div className="flex items-center gap-1.5 grayscale opacity-50">
             <Clock className="w-3 h-3 text-[#1A73E8]" />
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Self Destruct</span>
           </div>
        </div>
      </motion.div>
      
      <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[.2em]">Powered by GeistDesk Phantom Vault</p>
    </div>
  );
}
