import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Ticket as TicketType, TicketChecklistItem } from '../../types';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ticketService } from '../../services/ticketService';
import {
  countCompletedChecklistItems,
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

  const applyChecklist = useCallback(
    (next: TicketChecklistItem[]) => {
      setTasks(next);
      onChecklistUpdated?.(next);
    },
    [onChecklistUpdated],
  );

  const handleToggle = async (taskId: string) => {
    setBusyTaskId(taskId);
    try {
      const next = await ticketService.toggleTaskCompletion(ticket.id, taskId);
      applyChecklist(next);
    } catch (error) {
      console.error('[TasksTabContent] toggle failed:', error);
      toast.error(t('tickets.tasksTab.saveFailed', 'Could not update task status.'));
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAddTask = async () => {
    const trimmed = newTaskText.trim();
    if (!trimmed || isAdding) return;

    setIsAdding(true);
    try {
      const next = await ticketService.addChecklistTask(ticket.id, trimmed);
      applyChecklist(next);
      setNewTaskText('');
      toast.success(t('tickets.tasksTab.taskAdded', 'Task added to action plan.'));
    } catch (error) {
      console.error('[TasksTabContent] add failed:', error);
      toast.error(t('tickets.tasksTab.saveFailed', 'Could not update task status.'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async (taskId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    setBusyTaskId(taskId);
    try {
      const next = await ticketService.updateChecklistTask(ticket.id, taskId, trimmed);
      applyChecklist(next);
      setEditingTaskId(null);
      setEditingText('');
    } catch (error) {
      console.error('[TasksTabContent] edit failed:', error);
      toast.error(t('tickets.tasksTab.saveFailed', 'Could not update task status.'));
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    setBusyTaskId(taskId);
    try {
      const next = await ticketService.deleteChecklistTask(ticket.id, taskId);
      applyChecklist(next);
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setEditingText('');
      }
    } catch (error) {
      console.error('[TasksTabContent] delete failed:', error);
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
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t('tickets.tasksTab.title', 'Tasks Checklist Action Plan')}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {t('tickets.tasksTab.progress', '{{completed}} / {{total}} completed')
            .replace('{{completed}}', String(completedCount))
            .replace('{{total}}', String(totalCount))}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5">
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
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void handleAddTask()}
          disabled={!newTaskText.trim() || isAdding}
          className="h-9 shrink-0 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('tickets.tasksTab.addTask', 'Add Task')}
        </Button>
      </div>

      <div className="space-y-3">
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
                className="group flex items-start gap-3 p-4 bg-muted/20 hover:bg-muted/40 rounded-xl border border-border/60 transition-colors"
              >
                <input
                  type="checkbox"
                  id={`tab-task-${taskId}`}
                  className="mt-0.5 rounded border-gray-300 text-[#1A73E8] focus:ring-[#1A73E8] focus:ring-offset-0 h-4 w-4 cursor-pointer shrink-0 disabled:opacity-50"
                  checked={item.completed}
                  disabled={isBusy || isEditing}
                  onChange={() => {
                    if (item.id) void handleToggle(item.id);
                  }}
                />

                <div className="min-w-0 flex-1">
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
                    />
                  ) : (
                    <label
                      htmlFor={`tab-task-${taskId}`}
                      className={cn(
                        'text-xs leading-tight cursor-pointer font-semibold block',
                        item.completed
                          ? 'line-through text-muted-foreground/60 opacity-70'
                          : 'text-slate-700 dark:text-slate-300',
                      )}
                    >
                      {item.task}
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold text-[#1A73E8]"
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
                        className="h-7 w-7 text-slate-500 hover:text-[#1A73E8]"
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
                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
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
    </div>
  );
}
