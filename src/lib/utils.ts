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

/**
 * Safely coerce any value into a string suitable for rendering as a JSX child.
 * React throws "Objects are not valid as a React child" when an object lands
 * directly inside JSX — this can happen when assignee/customer fields are
 * persisted as `{ name, id }` objects instead of primitives. Objects are
 * flattened to their most display-friendly scalar property.
 */
export function safeString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const scalar = obj.name ?? obj.displayName ?? obj.label ?? obj.email ?? obj.id ?? fallback;
    return scalar === null || scalar === undefined ? fallback : String(scalar);
  }
  return String(val);
}
