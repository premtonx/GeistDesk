import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Ticket as TicketType, TicketChecklistItem } from '../../types';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ticketService } from '../../services/ticketService';
import {
  countCompletedChecklistItems,
  createChecklistTask,
  normalizeChecklistItems,
} from '../../lib/ticket-checklist-utils';

interface TasksTabContentProps {
  ticket: TicketType;
  onChecklistUpdated?: (checklist: TicketChecklistItem[]) => void;
}

export function TasksTabContent({ ticket, onChecklistUpdated }: TasksTabContentProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TicketChecklistItem[]>(() => normalizeChecklistItems(ticket.aiChecklist));
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setTasks(normalizeChecklistItems(ticket.aiChecklist));
    setEditingTaskId(null);
    setEditingText('');
  }, [ticket.id, ticket.aiChecklist]);

  const completedCount = useMemo(() => countCompletedChecklistItems(tasks), [tasks]);
  const totalCount = tasks.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const applyChecklist = useCallback(
    (next: TicketChecklistItem[]) => {
      setTasks(next);
      onChecklistUpdated?.(next);
    },
    [onChecklistUpdated],
  );

  const handleToggle = async (taskId: string) => {
    const previous = tasks;
    const optimistic = tasks.map((item) =>
      item.id === taskId ? { ...item, completed: !item.completed } : item,
    );
    applyChecklist(optimistic);
    setBusyTaskId(taskId);

    try {
      const next = await ticketService.toggleTaskCompletion(ticket.id, taskId);
      applyChecklist(next);
    } catch (error) {
      console.error('[TasksTabContent] toggle failed:', error);
      applyChecklist(previous);
      toast.error(t('tickets.tasksTab.saveFailed', 'Could not update task status.'));
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAddTask = async () => {
    const trimmed = newTaskText.trim();
    if (!trimmed || isAdding) return;

    const optimisticTask = createChecklistTask(trimmed, 'manual');
    const previous = tasks;
    applyChecklist([...tasks, optimisticTask]);
    setNewTaskText('');
    setIsAdding(true);

    try {
      const next = await ticketService.addChecklistTask(ticket.id, trimmed);
      applyChecklist(next);
      toast.success(t('tickets.tasksTab.taskAdded', 'Task added to action plan.'));
    } catch (error) {
      console.error('[TasksTabContent] add failed:', error);
      applyChecklist(previous);
      setNewTaskText(trimmed);
      toast.error(t('tickets.tasksTab.saveFailed', 'Could not update task status.'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async (taskId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    const previous = tasks;
    const optimistic = tasks.map((item) => (item.id === taskId ? { ...item, task: trimmed } : item));
    applyChecklist(optimistic);
    setBusyTaskId(taskId);

    try {
      const next = await ticketService.updateChecklistTask(ticket.id, taskId, trimmed);
      applyChecklist(next);
      setEditingTaskId(null);
      setEditingText('');
    } catch (error) {
      console.error('[TasksTabContent] edit failed:', error);
      applyChecklist(previous);
      toast.error(t('tickets.tasksTab.saveFailed', 'Could not update task status.'));
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    const previous = tasks;
    const optimistic = tasks.filter((item) => item.id !== taskId);
    applyChecklist(optimistic);
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setEditingText('');
    }
    setBusyTaskId(taskId);

    try {
      const next = await ticketService.deleteChecklistTask(ticket.id, taskId);
      applyChecklist(next);
    } catch (error) {
      console.error('[TasksTabContent] delete failed:', error);
      applyChecklist(previous);
      toast.error(t('tickets.tasksTab.deleteFailed', 'Could not delete task.'));
    } finally {
      setBusyTaskId(null);
    }
  };

  const startEditing = (item: TicketChecklistItem) => {
    if (!item.id) return;
    setEditingTaskId(item.id);
    setEditingText(item.task);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {t('tickets.tasksTab.title', 'Tasks Checklist Action Plan')}
          </h3>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 font-mono text-[11px] px-2.5 py-1 rounded-full border',
            allComplete
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
          )}
        >
          <CheckCircle2 className={cn('w-3 h-3 mr-1.5', allComplete && 'text-emerald-600')} />
          {t('tickets.tasksTab.progress', '{{completed}} / {{total}} completed')
            .replace('{{completed}}', String(completedCount))
            .replace('{{total}}', String(totalCount))}
        </Badge>
      </div>

      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
            {t(
              'tickets.tasksTab.empty',
              'No action items yet. Add a custom task or run AI Full Analysis to generate a plan.',
            )}
          </p>
        ) : (
          tasks.map((item) => {
            const taskId = item.id ?? item.task;
            const isEditing = editingTaskId === item.id;
            const isBusy = busyTaskId === item.id;

            return (
              <div
                key={taskId}
                className="group relative flex items-start gap-3 p-4 bg-muted/20 hover:bg-muted/40 rounded-xl border border-border/60 transition-colors"
              >
                <input
                  type="checkbox"
                  id={`tab-task-${taskId}`}
                  className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-offset-0 h-4 w-4 cursor-pointer shrink-0 disabled:opacity-50"
                  checked={item.completed}
                  disabled={isBusy || isEditing}
                  onChange={() => {
                    if (item.id) void handleToggle(item.id);
                  }}
                />

                <div className="min-w-0 flex-1 pr-14">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && item.id) {
                          event.preventDefault();
                          void handleSaveEdit(item.id);
                        }
                        if (event.key === 'Escape') {
                          setEditingTaskId(null);
                          setEditingText('');
                        }
                      }}
                      className="h-8 text-xs font-semibold"
                      aria-label={t('tickets.tasksTab.edit', 'Edit')}
                    />
                  ) : (
                    <label
                      htmlFor={`tab-task-${taskId}`}
                      className={cn(
                        'text-xs leading-relaxed cursor-pointer font-semibold block transition-opacity',
                        item.completed
                          ? 'line-through text-muted-foreground/60 opacity-60'
                          : 'text-slate-700 dark:text-slate-300',
                      )}
                    >
                      {item.task}
                    </label>
                  )}
                </div>

                <div className="absolute right-3 top-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold text-violet-600 hover:text-violet-700"
                        disabled={isBusy || !editingText.trim()}
                        onClick={() => item.id && void handleSaveEdit(item.id)}
                      >
                        {t('tickets.tasksTab.save', 'Save')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold text-slate-500"
                        onClick={() => {
                          setEditingTaskId(null);
                          setEditingText('');
                        }}
                      >
                        {t('dialog.cancel', 'Cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        title={t('tickets.tasksTab.edit', 'Edit')}
                        aria-label={t('tickets.tasksTab.edit', 'Edit')}
                        disabled={isBusy}
                        onClick={() => startEditing(item)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title={t('tickets.tasksTab.delete', 'Delete')}
                        aria-label={t('tickets.tasksTab.delete', 'Delete')}
                        disabled={isBusy}
                        onClick={() => item.id && void handleDelete(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-900/50 px-3 py-2.5">
        <Input
          value={newTaskText}
          onChange={(event) => setNewTaskText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleAddTask();
            }
          }}
          placeholder={t('tickets.tasksTab.addPlaceholder', 'Describe an operational objective…')}
          className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs font-medium placeholder:text-slate-400"
          disabled={isAdding}
          aria-label={t('tickets.tasksTab.addPlaceholder', 'Describe an operational objective…')}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void handleAddTask()}
          disabled={!newTaskText.trim() || isAdding}
          className="h-9 shrink-0 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('tickets.tasksTab.addTaskBilingual', 'Aufgabe hinzufügen / Add Task')}
        </Button>
      </div>
    </div>
  );
}
