import React from 'react';
import { Frown, Meh, Smile } from 'lucide-react';
import { AccountHealthStatus } from '../../lib/account-health';
import { cn } from '../../lib/utils';

interface AccountHealthSmileyProps {
  status: AccountHealthStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
} as const;

export function AccountHealthSmiley({ status, className, size = 'md' }: AccountHealthSmileyProps) {
  const iconClass = cn(SIZE_CLASS[size], className);

  if (status === 'good') {
    return <Smile className={cn(iconClass, 'text-emerald-500')} aria-hidden />;
  }
  if (status === 'bad') {
    return <Frown className={cn(iconClass, 'text-red-500')} aria-hidden />;
  }
  return <Meh className={cn(iconClass, 'text-amber-500')} aria-hidden />;
}

export function accountHealthAriaLabel(status: AccountHealthStatus): string {
  if (status === 'good') return 'Account health good';
  if (status === 'bad') return 'Account health bad';
  return 'Account health at risk';
}
