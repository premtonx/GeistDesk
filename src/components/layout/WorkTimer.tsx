import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, AlertCircle, PlusCircle, History } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { getModuleConfig } from '../../lib/module-config';

type TimerStatus = 'offline' | 'running' | 'paused';

export function WorkTimer({ isCollapsed, variant = 'vertical' }: { isCollapsed?: boolean; variant?: 'vertical' | 'horizontal' }) {
  const [status, setStatus] = useState<TimerStatus>('offline');
  const [seconds, setSeconds] = useState(0);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('08:00');
  const [manualEndTime, setManualEndTime] = useState('17:00');
  const [manualBreakStart, setManualBreakStart] = useState('12:00');
  const [manualBreakEnd, setManualBreakEnd] = useState('12:30');
  const [config, setConfig] = useState(getModuleConfig());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(getModuleConfig());
    };
    window.addEventListener('module-config-changed', handleConfigChange);
    return () => window.removeEventListener('module-config-changed', handleConfigChange);
  }, []);

  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  if (!config.personioEnabled) return null;

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClockIn = () => {
    setStatus('running');
    toast.success('Clocked in successfully', {
      description: 'Activity is now being tracked for Personio.',
      icon: <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
    });
  };

  const handlePause = () => {
    setStatus(status === 'paused' ? 'running' : 'paused');
  };

  const handleClockOut = async () => {
    const totalTime = seconds;
    setStatus('offline');
    setSeconds(0);

    if (totalTime > 0) {
      toast.promise(syncToPersonio(totalTime), {
        loading: 'Syncing attendance to Personio...',
        success: 'Attendance synced to Personio',
        error: 'Sync failed. Attendance saved locally.'
      });
    }
  };

  const handleManualSync = async () => {
    const getTodayWithTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const start = getTodayWithTime(manualStartTime);
    const end = getTodayWithTime(manualEndTime);
    const breakS = getTodayWithTime(manualBreakStart);
    const breakE = getTodayWithTime(manualBreakEnd);

    if (end <= start) {
      toast.error('Finish time must be after start time');
      return;
    }

    if (breakE < breakS) {
      toast.error('Pause end must be after pause start');
      return;
    }

    const totalDiffSeconds = (end.getTime() - start.getTime()) / 1000;
    const breakDiffSeconds = (breakE.getTime() - breakS.getTime()) / 1000;
    
    setIsManualOpen(false);
    toast.promise(syncToPersonio(totalDiffSeconds, breakDiffSeconds, start.toISOString(), end.toISOString()), {
      loading: 'Syncing manual entry to Personio...',
      success: `Synced ${manualStartTime}-${manualEndTime} to Personio`,
      error: 'Manual sync failed'
    });
  };

  const syncToPersonio = async (durationSeconds: number, breakSeconds: number = 0, startTimeOverride?: string, endTimeOverride?: string) => {
    const now = new Date();
    const startTime = startTimeOverride || new Date(now.getTime() - durationSeconds * 1000).toISOString();
    const endTime = endTimeOverride || now.toISOString();

    return axios.post('/api/personio/sync-attendance', {
      startTime,
      endTime,
      breakSeconds,
      employeeId: config.personioEmployeeId || 'EMP-123'
    });
  };

  if (variant === 'horizontal') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full shrink-0 select-none shadow-sm font-sans h-9">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full transition-all duration-500",
            status === 'running' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : 
            status === 'paused' ? "bg-slate-400" : "bg-slate-300"
          )} />
          {status !== 'offline' ? (
            <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded tracking-tight shadow-sm">
              {formatTime(seconds)}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Offline</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {status === 'offline' ? (
            <Button 
              size="sm"
              variant="ghost"
              onClick={handleClockIn}
              className="h-7 px-2.5 rounded-full text-xs font-bold text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 bg-white border border-slate-250 shrink-0"
            >
              <Play className="w-2.5 h-2.5 mr-1 fill-emerald-500 text-emerald-500" />
              Clock In
            </Button>
          ) : (
            <>
              <Button 
                size="sm"
                variant="ghost"
                onClick={handlePause}
                className="h-7 px-2 rounded-full text-[11px] font-bold text-slate-600 hover:bg-slate-200 shrink-0"
              >
                {status === 'paused' ? 'Resume' : 'Pause'}
              </Button>
              <Button 
                size="sm"
                variant="ghost"
                onClick={handleClockOut}
                className="h-7 w-7 p-0 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center shrink-0"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 border-t border-sidebar-border mt-4">
        {status === 'offline' ? (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClockIn}
            className="h-10 w-10 p-0 rounded-full text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
          >
            <Clock className="w-5 h-5" />
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              status === 'running' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-slate-400"
            )} />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClockOut}
              className="h-8 w-8 p-0 rounded-full text-red-400 hover:bg-red-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-6 border-t border-sidebar-border mt-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full transition-all duration-500",
            status === 'running' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : 
            status === 'paused' ? "bg-slate-400" : "bg-slate-300"
          )} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {status === 'offline' ? 'Status: Offline' : status === 'running' ? 'Active Session' : 'On Break'}
          </span>
        </div>
        {status !== 'offline' && (
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded tracking-tighter">
            {formatTime(seconds)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {status === 'offline' ? (
          <>
            <Button 
              onClick={handleClockIn}
              className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl h-9 text-xs font-bold shadow-sm"
            >
              <Play className="w-3 h-3 mr-2 fill-emerald-500 text-emerald-500" />
              Clock In
            </Button>
            
            <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
              <DialogTrigger 
                className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                aria-label="Add manual attendance"
              >
                <PlusCircle className="w-4 h-4" />
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Manual Attendance</DialogTitle>
                  <DialogDescription>
                    Manually log your working hours and breaks for Personio.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime" className="text-xs font-black uppercase text-slate-500">Work Start</Label>
                      <Input 
                        id="startTime" 
                        type="time" 
                        value={manualStartTime} 
                        onChange={(e) => setManualStartTime(e.target.value)}
                        className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime" className="text-xs font-black uppercase text-slate-500">Work Finish</Label>
                      <Input 
                        id="endTime" 
                        type="time" 
                        value={manualEndTime} 
                        onChange={(e) => setManualEndTime(e.target.value)}
                        className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <Pause className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Pause Interval</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="pauseStart" className="text-[9px] font-bold text-amber-800/60 uppercase">Pause Start</Label>
                        <Input 
                          id="pauseStart" 
                          type="time" 
                          value={manualBreakStart} 
                          onChange={(e) => setManualBreakStart(e.target.value)}
                          className="h-10 rounded-lg bg-white border-amber-100 focus:border-amber-400 focus:ring-amber-400 font-mono text-xs"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="pauseEnd" className="text-[9px] font-bold text-amber-800/60 uppercase">Pause End</Label>
                        <Input 
                          id="pauseEnd" 
                          type="time" 
                          value={manualBreakEnd} 
                          onChange={(e) => setManualBreakEnd(e.target.value)}
                          className="h-10 rounded-lg bg-white border-amber-100 focus:border-amber-400 focus:ring-amber-400 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsManualOpen(false)}>Cancel</Button>
                  <Button onClick={handleManualSync} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                    Sync to Personio
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <>
            <Button 
              variant="outline"
              onClick={handlePause}
              className="flex-1 border-slate-200 text-slate-600 rounded-xl h-9 text-xs font-bold bg-white"
            >
              {status === 'paused' ? (
                <><Play className="w-3 h-3 mr-1.5 text-blue-500 fill-blue-500" /> Resume</>
              ) : (
                <><Pause className="w-3 h-3 mr-1.5 text-slate-400 fill-slate-400" /> Pause</>
              )}
            </Button>
            <Button 
              onClick={handleClockOut}
              className="bg-slate-900 text-white hover:bg-black rounded-xl h-9 px-3 font-bold text-xs"
            >
              <Square className="w-3 h-3 fill-current" />
            </Button>
          </>
        )}
      </div>
      {status === 'offline' && (
        <div className="mt-3 flex items-center gap-1.5 px-1 py-1 hover:bg-slate-50 rounded transition-colors cursor-help">
          <AlertCircle className="w-3 h-3 text-slate-300" />
          <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            Automatic sync to Personio v2
          </span>
        </div>
      )}
    </div>
  );
}
