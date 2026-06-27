import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Ticket, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal,
  X,
  Mail,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from './ui/popover';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { notificationService } from '../services/notificationService';
import { SystemNotification } from '../types';
import { useAuth } from '../lib/hooks';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export function NotificationHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  const isOlderThan24Hours = (createdAt: any) => {
    if (!createdAt) return false;
    const timestamp = createdAt.toDate ? createdAt.toDate().getTime() : new Date(createdAt).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - timestamp > oneDayMs;
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const totalUnread = unreadCount;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = notificationService.subscribeToNotifications(user.uid, setNotifications);
    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    try {
      // Optimistic state update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      await notificationService.markAsRead(id);
    } catch (err) {
      console.warn("DB update failed, using client state change:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      // Optimistic state update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications dismissed successfully!");
      await notificationService.markAllAsRead(user.uid);
    } catch (err) {
      console.warn("DB update failed, using client state change:", err);
    }
  };

  const getIcon = (category: string) => {
    switch (category) {
      case 'ticket': return <Ticket className="w-4 h-4" />;
      case 'security': return <ShieldAlert className="w-4 h-4" />;
      case 'system': return <Info className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getBgColor = (category: string, priority?: string) => {
    if (priority === 'high' || category === 'security') return 'bg-red-50 text-red-600 border-red-100';
    if (priority === 'medium' || category === 'ticket') return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-slate-50 text-slate-400 border-slate-100';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-[#5f6368] rounded-full hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 bg-white border-slate-200 shadow-2xl rounded-[2rem] overflow-hidden" align="end" sideOffset={8}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-900 leading-none">Notifications</h3>
            {totalUnread > 0 && (
              <Badge className="bg-slate-200 text-slate-600 border-none font-bold text-[10px]">
                {totalUnread} Total
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleMarkAllRead}
            disabled={totalUnread === 0}
            className="text-[10px] font-black uppercase tracking-widest text-[#1A73E8] hover:bg-[#1A73E8]/5 h-8 px-3 rounded-full disabled:opacity-40"
          >
            Clear All
          </Button>
        </div>

        {/* Scrollable container with fixed constraints and webkit styling */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 pr-0.5 [&::-webkit-scrollbar]:w-1 px-1 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          {notifications.filter(n => !n.read).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-10 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                <Bell className="w-8 h-8 opacity-20" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">When you receive ticket updates or system alerts, they'll appear here.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-50">
              {notifications.filter(n => !n.read).map((n) => (
                <div 
                  key={n.id}
                  className="p-5 transition-all hover:bg-slate-50/80 cursor-pointer group relative bg-white text-left"
                  onClick={async () => {
                    try {
                      // Mark as read immediately
                      setNotifications(prev => prev.map(note => note.id === n.id ? { ...note, read: true } : note));
                      await notificationService.markAsRead(n.id);
                    } catch (err) {
                      console.warn("DB update failed:", err);
                    }
                    
                    setIsOpen(false);

                    // Robust routing link determination:
                    let link = n.link;
                    // If no link, try parsing ticketId from message or title
                    if (!link && n.category === 'ticket') {
                      // Parse for "#xxxxxx" patterns
                      const match = n.title?.match(/#([a-zA-Z0-9-]+)/) || n.message?.match(/#([a-zA-Z0-9-]+)/);
                      if (match && match[1]) {
                        // Look inside general tickets to resolve full ID if short hash exists
                        link = `/tickets/${match[1]}`;
                      } else {
                        link = '/tickets';
                      }
                    }

                    if (link) {
                      navigate(link);
                    } else if (n.category === 'security') {
                      navigate('/admin/pii');
                    } else if (n.category === 'system') {
                      navigate('/admin/sovereignty');
                    } else {
                      navigate('/dashboard');
                    }
                  }}
                >
                  <div className="flex gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0",
                      getBgColor(n.category, n.priority)
                    )}>
                      {getIcon(n.category)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">{n.category}</span>
                           {n.priority === 'high' && <Badge className="h-3.5 px-1.5 text-[7px] font-black uppercase bg-red-100 text-red-600 border-none">Urgent</Badge>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">{n.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        setNotifications(prev => prev.map(note => note.id === n.id ? { ...note, read: true } : note));
                        await notificationService.markAsRead(n.id);
                        toast.success("Notification dismissed.");
                      } catch (err) {
                        console.warn("DB update failed:", err);
                      }
                    }}
                    className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black uppercase tracking-widest text-[#1A73E8] hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50/50 border-t border-slate-100">
           <Button 
             variant="ghost" 
             onClick={() => {
               setIsOpen(false);
               navigate('/audit');
             }}
             className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-[#1A73E8] hover:bg-transparent"
           >
              View Audit History
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
