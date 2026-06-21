import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, CheckCircle, XCircle, User, Zap, Hash, Database, Users, Shield, Ticket as TicketIcon } from 'lucide-react';
import { Ticket } from '../types';
import { ticketService } from '../services/ticketService';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  onSelectTicket: (id: string) => void;
  customers?: any[];
  vaultItems?: any[];
}

export function CommandPalette({ 
  isOpen, 
  onClose, 
  tickets, 
  onSelectTicket,
  customers = [
    { id: 'c1', name: 'Sarah James', company: 'Advanced Machinery' },
    { id: 'c2', name: 'Mike Chen', company: 'Global Tech Solutions' },
    { id: 'c3', name: 'Alex Rivera', company: 'FinStream' },
  ],
  vaultItems = [
    { id: 'v1', label: 'Production RDP', type: 'rdp' },
    { id: 'v2', label: 'AWS Console', type: 'web' },
    { id: 'v3', label: 'VPN Gateway', type: 'vpn' },
  ]
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedColumn, setSelectedColumn] = useState<'tickets' | 'customers' | 'vault'>('tickets');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedColumn('tickets');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(query.toLowerCase()) || 
    t.customerName.toLowerCase().includes(query.toLowerCase()) ||
    t.id.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    c.company.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  const filteredVault = vaultItems.filter(v => 
    v.label.toLowerCase().includes(query.toLowerCase()) || 
    v.type.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentListHeight = selectedColumn === 'tickets' ? filteredTickets.length : 
                                selectedColumn === 'customers' ? filteredCustomers.length : 
                                filteredVault.length;
      if (currentListHeight > 0) {
        setSelectedIndex(i => (i + 1) % currentListHeight);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentListHeight = selectedColumn === 'tickets' ? filteredTickets.length : 
                                selectedColumn === 'customers' ? filteredCustomers.length : 
                                filteredVault.length;
      if (currentListHeight > 0) {
        setSelectedIndex(i => (i - 1 + currentListHeight) % currentListHeight);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (selectedColumn === 'tickets') setSelectedColumn('customers');
      else if (selectedColumn === 'customers') setSelectedColumn('vault');
      setSelectedIndex(0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (selectedColumn === 'vault') setSelectedColumn('customers');
      else if (selectedColumn === 'customers') setSelectedColumn('tickets');
      setSelectedIndex(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedColumn === 'tickets' && filteredTickets[selectedIndex]) {
        onSelectTicket(filteredTickets[selectedIndex].id);
        onClose();
      } else {
        // Just close for others as they are mock/secondary for now
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
          />
          <div className="fixed inset-0 flex items-start justify-center pt-[10vh] pointer-events-none z-[201] px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-5xl bg-card rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-border overflow-hidden pointer-events-auto flex flex-col"
              onKeyDown={handleKeyDown}
            >
              <div className="flex items-center px-6 py-5 border-b bg-muted/30">
                <Search className="w-6 h-6 text-primary mr-4" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tickets, customers, or vault assets..."
                  className="flex-1 bg-transparent border-none outline-none text-lg font-medium text-foreground placeholder:text-muted-foreground mr-4"
                />
                <div className="flex items-center gap-2">
                   <div className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold border">
                     ESC
                   </div>
                   <div className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                     ⌘ K
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border min-h-[450px]">
                {/* Tickets Column */}
                <div className="flex flex-col">
                  <div className="px-5 py-3 bg-muted/50 border-b flex items-center gap-2">
                    <TicketIcon className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tickets</span>
                    <Badge variant="outline" className="ml-auto text-[9px] px-1.5 h-4">{filteredTickets.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredTickets.map((t, i) => (
                      <button
                        key={t.id}
                        onMouseEnter={() => {
                          setSelectedColumn('tickets');
                          setSelectedIndex(i);
                        }}
                        onClick={() => {
                          onSelectTicket(t.id);
                          onClose();
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all",
                          selectedColumn === 'tickets' && selectedIndex === i ? "bg-primary text-primary-foreground shadow-md scale-[1.02]" : "hover:bg-muted"
                        )}
                      >
                        <p className="text-xs font-bold truncate">{t.subject}</p>
                        <div className={cn("text-[10px] mt-1 flex items-center gap-2", selectedColumn === 'tickets' && selectedIndex === i ? "text-primary-foreground/80" : "text-muted-foreground")}>
                           <span className="font-bold">#{t.id.slice(0, 4)}</span>
                           <span>•</span>
                           <span className="truncate">{t.customerName}</span>
                        </div>
                      </button>
                    ))}
                    {filteredTickets.length === 0 && (
                      <div className="h-40 flex flex-col items-center justify-center text-center opacity-50 grayscale">
                        <TicketIcon className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-medium uppercase">No tickets found</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customers Column */}
                <div className="flex flex-col">
                  <div className="px-5 py-3 bg-muted/50 border-b flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customers</span>
                    <Badge variant="outline" className="ml-auto text-[9px] px-1.5 h-4">{filteredCustomers.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredCustomers.map((c, i) => (
                      <button
                        key={c.id}
                        onMouseEnter={() => {
                          setSelectedColumn('customers');
                          setSelectedIndex(i);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all",
                          selectedColumn === 'customers' && selectedIndex === i ? "bg-primary text-primary-foreground shadow-md scale-[1.02]" : "hover:bg-muted"
                        )}
                      >
                        <p className="text-xs font-bold truncate">{c.name}</p>
                        <p className={cn("text-[10px] mt-1", selectedColumn === 'customers' && selectedIndex === i ? "text-primary-foreground/80" : "text-muted-foreground")}>
                           {c.company}
                        </p>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="h-40 flex flex-col items-center justify-center text-center opacity-50 grayscale">
                        <Users className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-medium uppercase">No customers found</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vault Column */}
                <div className="flex flex-col">
                  <div className="px-5 py-3 bg-muted/50 border-b flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vault Items</span>
                    <Badge variant="outline" className="ml-auto text-[9px] px-1.5 h-4">{filteredVault.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredVault.map((v, i) => (
                      <button
                        key={v.id}
                        onMouseEnter={() => {
                          setSelectedColumn('vault');
                          setSelectedIndex(i);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all",
                          selectedColumn === 'vault' && selectedIndex === i ? "bg-primary text-primary-foreground shadow-md scale-[1.02]" : "hover:bg-muted"
                        )}
                      >
                        <p className="text-xs font-bold truncate">{v.label}</p>
                        <div className={cn("text-[10px] mt-1 flex items-center gap-2 font-bold uppercase", selectedColumn === 'vault' && selectedIndex === i ? "text-primary-foreground/80" : "text-muted-foreground")}>
                           <Database className="w-3 h-3" />
                           {v.type}
                        </div>
                      </button>
                    ))}
                    {filteredVault.length === 0 && (
                      <div className="h-40 flex flex-col items-center justify-center text-center opacity-50 grayscale">
                        <Shield className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-medium uppercase">No vault assets</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                       <span className="p-1 px-1.5 rounded bg-card border border-border text-[9px] font-bold uppercase tracking-widest shadow-sm">←</span>
                       <span className="p-1 px-1.5 rounded bg-card border border-border text-[9px] font-bold uppercase tracking-widest shadow-sm">→</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Switch Category</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                       <span className="p-1 px-1.5 rounded bg-card border border-border text-[9px] font-bold uppercase tracking-widest shadow-sm">↑</span>
                       <span className="p-1 px-1.5 rounded bg-card border border-border text-[9px] font-bold uppercase tracking-widest shadow-sm">↓</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Navigate Items</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-amber-500 fill-current" />
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest italic">Global Omnisearch Active</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
