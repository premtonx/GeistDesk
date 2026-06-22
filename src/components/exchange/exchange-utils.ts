import { cn } from '../../lib/utils';

export type ExchangeNavId =
  | 'overview'
  | 'secrets'
  | 'dropzones'
  | 'analysis'
  | 'templates'
  | 'activity'
  | 'security';

export type ExchangeQuickFilter =
  | 'active'
  | 'expiring'
  | 'shared'
  | 'received'
  | 'burned'
  | 'archived'
  | null;

export interface ExchangeItemRow {
  id: string;
  name: string;
  recipient: string;
  company: string;
  ticketId: string;
  status: string;
  expires: string;
  expiresAt?: Date | null;
  views: number;
  type: string;
  size?: string;
  createdAt: Date;
  aiStatus?: string;
}

export function exchangeStatusClass(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Viewed':
    case 'Uploaded':
    case 'Completed':
      return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'Burned':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Expired':
      return 'bg-rose-50 text-rose-700 border-rose-100';
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function exchangePanelClass(className?: string): string {
  return cn('rounded-2xl border border-slate-200/80 bg-white shadow-sm', className);
}
