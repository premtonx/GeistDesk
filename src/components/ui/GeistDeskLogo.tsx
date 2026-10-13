import React from 'react';
import { cn } from '../../lib/utils';

interface GeistDeskLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  stacked?: boolean;
  className?: string;
}

export function GeistDeskLogo({
  size = 'md',
  showText = true,
  stacked = false,
  className
}: GeistDeskLogoProps) {
  // Dimensions based on size prop
  const iconSizes = {
    xs: 'w-8 h-8 md:w-9 md:h-9',
    sm: 'w-11 h-11 md:w-12 md:h-12',
    md: 'w-20 h-20 md:w-24 md:h-24',
    lg: 'w-40 h-40 md:w-48 md:h-48',
    xl: 'w-56 h-56 md:w-64 md:h-64'
  };

  const textSizes = {
    xs: 'text-sm md:text-base font-bold tracking-tight',
    sm: 'text-lg md:text-xl font-black tracking-tight',
    md: 'text-2xl md:text-3xl font-black tracking-tight',
    lg: 'text-4xl md:text-5xl font-black tracking-tight',
    xl: 'text-6xl md:text-7xl font-black tracking-tight'
  };

  const gapSizes = {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-5',
    xl: 'gap-7'
  };

  return (
    <div 
      className={cn(
        "inline-flex items-center select-none", 
        stacked ? "flex-col text-center" : "flex-row",
        gapSizes[size],
        className
      )}
    >
      {/* Dynamic GeistDesk Icon (Ticket + Ghost SVG) */}
      <div className={cn("relative shrink-0 flex items-center justify-center", iconSizes[size])}>
        <svg 
          viewBox="0 0 512 512" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Tilted Ticket Background */}
          {/* Rotated by -11deg with 256, 256 origin */}
          <g transform="rotate(-11, 256, 256)">
            {/* Ticket Outer Fill & Border */}
            <path 
              d="M 64 160 
                 A 24 24 0 0 1 88 136 
                 L 424 136 
                 A 24 24 0 0 1 448 160 
                 L 448 216 
                 A 32 32 0 0 0 400 248 
                 A 32 32 0 0 0 448 280 
                 L 448 352 
                 A 24 24 0 0 1 424 376 
                 L 88 376 
                 A 24 24 0 0 1 64 352 
                 L 64 280 
                 A 32 32 0 0 0 112 248 
                 A 32 32 0 0 0 64 216 
                 Z" 
              fill="#FFFFFF" 
              stroke="#202124" 
              strokeWidth="24" 
              strokeLinejoin="round" 
            />

            {/* German flag dashed lines on the left side of the ticket */}
            <line 
              x1="160" y1="164" 
              x2="160" y2="216" 
              stroke="#202124" 
              strokeWidth="16" 
              strokeLinecap="round" 
            />
            <line 
              x1="160" y1="236" 
              x2="160" y2="288" 
              stroke="#E51B24" 
              strokeWidth="16" 
              strokeLinecap="round" 
            />
            <line 
              x1="160" y1="308" 
              x2="160" y2="348" 
              stroke="#FBBF24" 
              strokeWidth="16" 
              strokeLinecap="round" 
            />
          </g>

          {/* Cute Floating Ghost */}
          <g transform="translate(48, 12)">
            {/* Shadow under the ghost body */}
            <path 
              d="M 128 368 
                 C 144 384, 160 380, 176 384 
                 C 192 388, 208 384, 224 388 
                 C 240 392, 256 384, 272 388 
                 C 288 392, 304 384, 320 380 
                 C 328 350, 310 280, 310 240 
                 C 250 240, 180 240, 128 250
                 Z" 
              fill="#E2E8F0" 
              opacity="0.8" 
            />

            {/* Ghost Main Body with Outer Outline */}
            <path 
              d="M 128 240 
                 C 112 120, 288 120, 272 240 
                 C 272 284, 312 300, 312 340 
                 C 294 362, 280 344, 260 358 
                 C 240 372, 230 348, 210 364 
                 C 190 380, 180 356, 160 370 
                 C 142 352, 134 324, 128 240 
                 Z" 
              fill="#FFFFFF" 
              stroke="#202124" 
              strokeWidth="24" 
              strokeLinecap="round"
              strokeLinejoin="round" 
            />

            {/* Ghost Eyes */}
            <ellipse cx="178" cy="216" rx="14" ry="24" fill="#202124" />
            <ellipse cx="230" cy="216" rx="14" ry="24" fill="#202124" />
          </g>
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <span 
          className={cn(
            "font-sans select-none tracking-tight",
            textSizes[size]
          )}
        >
          <span className="text-[#202124] dark:text-white font-[600]">Geist</span>
          <span className="text-[#E51B24] font-[800]">Desk</span>
        </span>
      )}
    </div>
  );
}
