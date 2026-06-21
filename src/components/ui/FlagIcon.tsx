import React from 'react';
import { cn } from '../../lib/utils';

/** ISO-style flag codes supported by the language switcher. */
export type FlagCode = 'de' | 'en' | 'es' | 'jp' | 'kr';

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
      return (
        <svg viewBox="0 0 24 16" className={sizeClass} width={24} height={16} aria-hidden={!title}>
          <rect width="24" height="16" fill="#FFF" />
          <circle cx="12" cy="8" r="4.5" fill="#BC002D" />
        </svg>
      );
    case 'kr':
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
    default:
      return null;
  }
}

/** Map polyglot language display names to flag codes. */
export function languageToFlagCode(lang: string): FlagCode {
  const normalized = lang.toLowerCase().trim();
  if (normalized.includes('german') || normalized === 'deutsch' || normalized === 'de') return 'de';
  if (normalized.includes('english') || normalized === 'en') return 'en';
  if (normalized.includes('spanish') || normalized === 'español' || normalized === 'es') return 'es';
  if (normalized.includes('japanese') || normalized === 'ja') return 'jp';
  if (normalized.includes('korean') || normalized === 'ko') return 'kr';
  return 'en';
}
