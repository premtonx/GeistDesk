import React from 'react';
import { cn } from '../../lib/utils';

/** ISO-style flag codes supported by the language switcher. */
export type FlagCode = 'de' | 'en' | 'es' | 'jp' | 'kr' | 'fr' | 'it' | 'pt' | 'nl' | (string & {});

interface FlagIconProps {
  code: FlagCode;
  className?: string;
  title?: string;
}

/**
 * Cross-platform SVG flag icons. Replaces emoji flags that fail to render on
 * Windows/Android system fonts.
 */
export function FlagIcon({ code, className, title }: FlagIconProps) {
  const sizeClass = cn('inline-block shrink-0 rounded-sm overflow-hidden', className);

  switch (code) {
    case 'de':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title} role={title ? 'img' : undefined} aria-label={title}>
          <rect width="24" height="5.33" y="0" fill="#000" />
          <rect width="24" height="5.33" y="5.33" fill="#DD0000" />
          <rect width="24" height="5.34" y="10.66" fill="#FFCE00" />
        </svg>
      );
    case 'en':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title} role={title ? 'img' : undefined} aria-label={title}>
          <rect width="24" height="16" fill="#B22234" />
          <g fill="#FFF">
            {[0, 2.46, 4.92, 7.38, 9.84, 12.3].map(y => (
              <rect key={y} width="24" height="1.23" y={y} />
            ))}
          </g>
          <rect width="9.6" height="8.62" fill="#3C3B6E" />
          <g fill="#FFF">
            {Array.from({ length: 15 }).map((_, i) => (
              <circle key={i} cx={(i % 5) * 1.9 + 1} cy={Math.floor(i / 5) * 1.7 + 1} r="0.35" />
            ))}
          </g>
        </svg>
      );
    case 'es':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="24" height="16" fill="#AA151B" />
          <rect width="24" height="8" y="4" fill="#F1BF00" />
        </svg>
      );
    case 'jp':
    case 'ja':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="24" height="16" fill="#FFF" />
          <circle cx="12" cy="8" r="4.5" fill="#BC002D" />
        </svg>
      );
    case 'kr':
    case 'ko':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="24" height="16" fill="#FFF" />
          <circle cx="12" cy="8" r="3.5" fill="#C60C30" />
          <circle cx="12" cy="8" r="2.8" fill="#003478" clipPath="url(#kr-clip)" />
          <defs>
            <clipPath id="kr-clip">
              <rect x="12" y="0" width="12" height="16" />
            </clipPath>
          </defs>
        </svg>
      );
    case 'fr':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="8" height="16" fill="#0055A4" />
          <rect width="8" height="16" x="8" fill="#FFF" />
          <rect width="8" height="16" x="16" fill="#EF4135" />
        </svg>
      );
    case 'it':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="8" height="16" fill="#009246" />
          <rect width="8" height="16" x="8" fill="#FFF" />
          <rect width="8" height="16" x="16" fill="#CE2B37" />
        </svg>
      );
    case 'pt':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="24" height="16" fill="#006600" />
          <rect width="10" height="16" fill="#FF0000" />
        </svg>
      );
    case 'nl':
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="24" height="5.33" fill="#AE1C28" />
          <rect width="24" height="5.33" y="5.33" fill="#FFF" />
          <rect width="24" height="5.34" y="10.66" fill="#21468B" />
        </svg>
      );
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center justify-center shrink-0 rounded-sm border border-slate-300 bg-slate-100 text-[8px] font-bold uppercase text-slate-600 min-w-[24px] min-h-[16px]',
            className,
          )}
          title={title}
        >
          {String(code).slice(0, 2).toUpperCase()}
        </span>
      );
  }
}

/** Map polyglot language display names to flag codes. */
export function languageToFlagCode(lang: string): FlagCode {
  const normalized = lang.toLowerCase().trim();
  if (normalized.includes('german') || normalized === 'deutsch' || normalized === 'de') return 'de';
  if (normalized.includes('english') || normalized === 'en') return 'en';
  if (normalized.includes('spanish') || normalized === 'español' || normalized === 'es') return 'es';
  if (normalized.includes('french') || normalized === 'français' || normalized === 'fr') return 'fr';
  if (normalized.includes('italian') || normalized === 'it') return 'it';
  if (normalized.includes('japanese') || normalized === 'ja' || normalized === 'jp') return 'jp';
  if (normalized.includes('korean') || normalized === 'ko' || normalized === 'kr') return 'kr';
  if (normalized.includes('portuguese') || normalized === 'pt') return 'pt';
  if (normalized.includes('dutch') || normalized === 'nl') return 'nl';
  if (normalized.length === 2) return normalized;
  return 'en';
}
