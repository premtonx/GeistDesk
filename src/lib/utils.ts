import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely extract a single uppercase initial for avatars.
 * Guards against `null`, `undefined`, non-string values and whitespace-only
 * strings — the crash came from `.charAt` being called on non-string values
 * (e.g. a numeric/object assignee field persisted by the generic DB layer).
 */
export function getInitials(val: unknown): string {
  if (typeof val !== 'string' || !val.trim()) return '?';
  return val.trim().charAt(0).toUpperCase();
}
