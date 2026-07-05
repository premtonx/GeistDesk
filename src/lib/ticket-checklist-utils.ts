import type { TicketChecklistItem } from '../types';

export function generateChecklistTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createChecklistTask(
  task: string,
  source: TicketChecklistItem['source'] = 'manual',
): TicketChecklistItem {
  return {
    id: generateChecklistTaskId(),
    task: task.trim(),
    completed: false,
    source,
  };
}

export function normalizeChecklistItems(
  items: TicketChecklistItem[] | null | undefined,
): TicketChecklistItem[] {
  if (!items?.length) return [];

  return items.map((item, index) => ({
    id: item.id ?? `legacy-${index}-${generateChecklistTaskId()}`,
    task: item.task,
    completed: Boolean(item.completed),
    source: item.source ?? 'ai',
  }));
}

export function ensureChecklistTaskIds(items: TicketChecklistItem[]): TicketChecklistItem[] {
  return items.map((item) => ({
    ...item,
    id: item.id ?? generateChecklistTaskId(),
  }));
}

export function countCompletedChecklistItems(items: TicketChecklistItem[]): number {
  return items.filter((item) => item.completed).length;
}

export function withChecklistTaskIdsFromAi(
  items: Array<{ task: string; completed: boolean }>,
): TicketChecklistItem[] {
  return items.map((item) => ({
    id: generateChecklistTaskId(),
    task: item.task,
    completed: Boolean(item.completed),
    source: 'ai' as const,
  }));
}
