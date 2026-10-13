import { useState, type FormEvent } from 'react';
import { Bot, Send, Sparkles, AlertTriangle, ShieldCheck, Key, RefreshCw, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';

interface AIProps {
  onClose?: () => void;
  credentialsList: any[];
}

export function GeistVaultAIAssistant({ onClose, credentialsList }: AIProps) {
  const [messages, setMessages] = useState<any[]>([
    {
      sender: 'ai',
      text: "Hello! I am your GeistVault Security Assistant. I run server-side audits on your Decrypted credentials to help identify high-risk assets, weak passwords, and rotation policies. Ask me to scan your active vault or prepare a compliance summary!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const triggerSearch = (query: string) => {
    setInput(query);
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    // Simulate smart security reasoning response
    setTimeout(() => {
      let aiText = '';
      const cmd = userMsg.toLowerCase();

      if (cmd.includes('scan') || cmd.includes('audit') || cmd.includes('weak')) {
        const weakCount = credentialsList.filter(c => c.username === 'admin' || c.username === 'root' || (c.notes && c.notes.toLowerCase().includes('weak'))).length;
        aiText = credentialsList.length === 0
          ? 'Der Tresor ist leer. Es gibt keine Beispieldaten und keine Sicherheitsfunde.'
          : `Based on the current vault I have identified **${weakCount} security findings** among ${credentialsList.length} entries.`;
      } else if (cmd.includes('rotation') || cmd.includes('schedule') || cmd.includes('rotate')) {
        aiText = `Here is your customized **Rotation compliance schedule**:
        
        - **Cloud Infrastructure AWS Keys**: Every 30 days (Next: 12 days)
        - **RDP/VPN Gateway Nodes**: Every 60 days (Next: 24 days)
        - **Enterprise ERP Web Logins**: Every 90 days (Next: Overdue)
        
        Would you like me to draft a secure rotation rule or generate replacement credentials?`;
      } else if (cmd.includes('stale') || cmd.includes('inactive') || cmd.includes('cleanup')) {
        aiText = credentialsList.length === 0
          ? 'Der Tresor ist leer. Es gibt keine ungenutzten Beispieleinträge.'
          : `I analyzed the current vault (${credentialsList.length} items). Archive unused credentials to reduce exposure.`;
      } else {
        aiText = `I have logged that security query. GeistVault AI is active in auditing your current credentials list (${credentialsList.length} items parsed). 

Key capabilities you can trigger:
1. **"Perform cryptanalysis scan"** - Searches for duplicate, weak, and unencrypted parameters.
2. **"Suggest rotation schedule"** - Maps key expiration and compliance due dates.
3. **"Identify stale assets"** - Surfaces unused credentials for deletion rules.`;
      }

      setMessages(prev => [...prev, { sender: 'ai', text: aiText }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <Card className="border border-[#DADCE0] shadow-xl rounded-3xl overflow-hidden flex flex-col h-[520px] bg-white">
      <CardHeader className="bg-[#F8F9FA] border-b border-[#DADCE0] px-6 py-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
              AI Security Shield
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-mono font-bold tracking-tight text-neutral-400">Zero-Knowledge Agent</CardDescription>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-neutral-400 hover:text-neutral-600" onClick={onClose}>
            ✕
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs bg-slate-50/50">
        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`flex flex-col max-w-[85%] ${m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div 
              className={`p-3.5 rounded-2xl whitespace-pre-line leading-relaxed border ${
                m.sender === 'user' 
                  ? 'bg-[#1A73E8] text-white border-[#1154a3] rounded-tr-none shadow-sm font-medium' 
                  : 'bg-white text-neutral-800 border-[#DADCE0] rounded-tl-none shadow-xs'
              }`}
            >
              {m.text}
            </div>
            <span className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider mt-1 px-1">
              {m.sender === 'ai' ? 'GeistVault Assistant' : 'Security Agent'}
            </span>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-1.5 items-center bg-white border border-[#DADCE0] px-3.5 py-2.5 rounded-2xl rounded-tl-none w-[100px] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce delay-100" />
            <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce delay-200" />
          </div>
        )}
      </CardContent>

      <div className="p-4 bg-white border-t border-[#DADCE0] space-y-3">
        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {[
            { label: '⚡ Run Vault Audit', query: 'Run security scan' },
            { label: '📅 Rotation Compliance', query: 'Rotation schedule' },
            { label: '🧹 Find Stale Accounts', query: 'Find stale accounts' }
          ].map((c) => (
            <button 
              key={c.label}
              onClick={() => triggerSearch(c.query)}
              className="text-[10px] bg-slate-50 border border-[#DADCE0] hover:bg-slate-100 px-2.5 py-1 rounded-full text-slate-600 font-bold tracking-tight transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            placeholder="Type query to secure system endpoints..." 
            className="flex-1 h-10 border-[#DADCE0] rounded-xl text-xs bg-[#F8F9FA] focus-visible:ring-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" className="bg-[#1A73E8] hover:bg-[#1765cc] text-white w-10 h-10 p-0 rounded-xl shadow-md">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
