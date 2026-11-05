import React from 'react';

interface ConfiLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const ConfiLogo: React.FC<ConfiLogoProps> = ({ size = 'md', showSubtitle = false }) => {
  const dimensions = {
    sm: { box: 'w-7 h-7', text: 'text-base', badge: 'text-[10px]' },
    md: { box: 'w-10 h-10', text: 'text-xl', badge: 'text-xs' },
    lg: { box: 'w-14 h-14', text: 'text-3xl', badge: 'text-sm' },
  }[size];

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`${dimensions.box} relative rounded-xl flex items-center justify-center bg-gradient-to-br from-[#231E12] via-[#111015] to-[#08080B] border border-[#D4AF37]/50 shadow-[0_0_20px_rgba(212,175,55,0.2)] shrink-0`}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          className="w-3/5 h-3/5"
          aria-hidden="true"
        >
          <path
            d="M18 3L31 10.5V25.5L18 33L5 25.5V10.5L18 3Z"
            stroke="url(#confiGoldGrad)"
            strokeWidth="2.2"
          />
          <path
            d="M22.5 13.5C21.2 12.2 19.5 11.5 17.6 11.5C13.8 11.5 11 14.4 11 18C11 21.6 13.8 24.5 17.6 24.5C19.5 24.5 21.2 23.8 22.5 22.5"
            stroke="url(#confiGoldGrad)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="22.5" cy="18" r="2" fill="#D4AF37" />
          <defs>
            <linearGradient id="confiGoldGrad" x1="5" y1="3" x2="31" y2="33" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF3D1" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#9A7214" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="flex flex-col">
        <span
          className={`${dimensions.text} font-display font-bold tracking-[0.18em] gold-gradient-text leading-none uppercase`}
        >
          confi
        </span>
        {showSubtitle && (
          <span className="text-[11px] text-[#9E9789] tracking-widest mt-1">
            WINGO 1M ORACLE
          </span>
        )}
      </div>
    </div>
  );
};
