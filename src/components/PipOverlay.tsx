import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Move, Minimize2, PictureInPicture2, ChevronRight, Sparkles, Lock } from 'lucide-react';
import { WingoPrediction } from '../utils/wingoEngine';

interface PipOverlayProps {
  periodInput: string;
  onPeriodChange: (newPeriod: string) => void;
  prediction: WingoPrediction | null;
  isLoading: boolean;
  isFloating: boolean;
  onToggleFloating: () => void;
}

export const PipOverlay: React.FC<PipOverlayProps> = ({
  periodInput,
  onPeriodChange,
  prediction,
  isLoading,
  isFloating,
  onToggleFloating,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 20, y: 84 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [nativePipActive, setNativePipActive] = useState(false);

  // Handle pointer dragging when in floating PiP mode
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFloating) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !isFloating) return;
    const maxX = Math.max(12, window.innerWidth - 310);
    const maxY = Math.max(12, window.innerHeight - 310);
    const nextX = Math.min(Math.max(12, e.clientX - dragOffset.current.x), maxX);
    const nextY = Math.min(Math.max(12, e.clientY - dragOffset.current.y), maxY);
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if not captured
    }
  };

  // Draw the 1:1 PiP state onto a hidden 500x500 canvas so native video Picture-in-Picture works on mobile/desktop
  const renderCanvasPip = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 500;
    const h = 500;
    ctx.clearRect(0, 0, w, h);

    // Obsidian background
    const bgGrad = ctx.createRadialGradient(w / 2, h * 0.38, 20, w / 2, h / 2, 340);
    bgGrad.addColorStop(0, '#1D1912');
    bgGrad.addColorStop(1, '#08080B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Gold border
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    // Top Header: WINGO 1 MIN
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 24px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText('CONFI · WINGO 1 MIN', w / 2, 52);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 74);
    ctx.lineTo(w - 40, 74);
    ctx.stroke();

    if (isLoading) {
      ctx.fillStyle = '#D4AF37';
      ctx.font = '600 26px Outfit, sans-serif';
      ctx.fillText('ANALYZING PERIOD...', w / 2, h / 2);
    } else if (prediction && periodInput.length === 3) {
      // Color palette for outcome
      const colorHex =
        prediction.color === 'GREEN'
          ? '#10B981'
          : prediction.color === 'RED'
            ? '#EF4444'
            : '#8B5CF6';

      // Center circle medallion
      ctx.beginPath();
      ctx.arc(w / 2, 225, 86, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 15, 20, 0.95)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = colorHex;
      ctx.stroke();

      // Number inside medallion
      ctx.fillStyle = '#F5F2EB';
      ctx.font = 'bold 92px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(prediction.number), w / 2, 230);
      ctx.textBaseline = 'alphabetic';

      // Size & Color pills
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'bold 30px Outfit, sans-serif';
      ctx.fillText(`${prediction.size}  ·  ${prediction.color}`, w / 2, 362);
    } else {
      ctx.fillStyle = '#9E9789';
      ctx.font = '500 22px Outfit, sans-serif';
      ctx.fillText('ENTER 3-DIGIT PERIOD BELOW', w / 2, h / 2);
    }

    // Bottom Period Footer
    ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.fillRect(40, 405, w - 80, 62);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 405, w - 80, 62);

    ctx.fillStyle = '#F5F2EB';
    ctx.font = 'bold 26px JetBrains Mono, monospace';
    ctx.fillText(`PERIOD: ${periodInput || '---'}`, w / 2, 445);
  }, [isLoading, prediction, periodInput]);

  useEffect(() => {
    renderCanvasPip();
  }, [renderCanvasPip]);

  const handleTriggerNativePip = async () => {
    try {
      renderCanvasPip();
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setNativePipActive(false);
        return;
      }

      const stream = canvas.captureStream(15);
      video.srcObject = stream;
      await video.play();
      if ('requestPictureInPicture' in video) {
        await video.requestPictureInPicture();
        setNativePipActive(true);
      }
    } catch {
      // Fallback: toggle floating overlay mode in viewport
      onToggleFloating();
    }
  };

  const handleStepPeriod = (delta: number) => {
    const currentNum = periodInput.length === 3 ? parseInt(periodInput, 10) : 356;
    const nextNum = ((currentNum + delta) % 1000 + 1000) % 1000;
    const nextStr = String(nextNum).padStart(3, '0');
    onPeriodChange(nextStr);
  };

  // Determine styling for the active color outcome
  const getColorStyles = (pred: WingoPrediction | null) => {
    if (!pred) {
      return {
        ring: 'border-[#D4AF37]/40 shadow-[0_0_25px_rgba(212,175,55,0.12)]',
        badgeText: 'text-[#D4AF37]',
        swatchBg: 'bg-[#D4AF37]',
        glow: 'from-[#D4AF37]/15 via-transparent to-transparent',
      };
    }
    if (pred.color === 'GREEN') {
      return {
        ring: 'border-emerald-500/80 shadow-[0_0_32px_rgba(16,185,129,0.32)]',
        badgeText: 'text-emerald-400',
        swatchBg: 'bg-emerald-500',
        glow: 'from-emerald-500/20 via-transparent to-transparent',
      };
    }
    if (pred.color === 'RED') {
      return {
        ring: 'border-rose-500/80 shadow-[0_0_32px_rgba(244,63,94,0.32)]',
        badgeText: 'text-rose-400',
        swatchBg: 'bg-rose-500',
        glow: 'from-rose-500/20 via-transparent to-transparent',
      };
    }
    // VIOLET (0 or 5)
    return {
      ring: 'border-violet-500/80 shadow-[0_0_32px_rgba(139,92,246,0.35)]',
      badgeText: 'text-violet-300',
      swatchBg: 'bg-violet-500',
      glow: 'from-violet-500/25 via-transparent to-transparent',
    };
  };

  const colorStyle = getColorStyles(prediction);

  return (
    <>
      {/* Hidden canvas + video for OS-level native PiP stream */}
      <canvas ref={canvasRef} width={500} height={500} className="hidden" />
      <video ref={videoRef} muted playsInline className="hidden" />

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={
          isFloating
            ? {
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 50,
              }
            : undefined
        }
        className={`obsidian-pip-frame aspect-square w-full max-w-[330px] sm:max-w-[350px] rounded-3xl flex flex-col justify-between p-4 sm:p-5 select-none transition-shadow duration-200 relative overflow-hidden ${
          isFloating ? 'cursor-grab active:cursor-grabbing ring-2 ring-[#D4AF37]/60' : 'mx-auto'
        }`}
      >
        {/* Subtle Radial Ambient Lighting matching outcome */}
        <div
          className={`pointer-events-none absolute inset-0 bg-radial ${colorStyle.glow} opacity-80 transition-all duration-200`}
        />

        {/* TOP ZONE: Written "wingo 1 min" + PiP Window Controls */}
        <div className="relative z-10 flex items-center justify-between border-b border-[#D4AF37]/25 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-display font-bold tracking-[0.2em] gold-gradient-text uppercase">
              confi
            </span>
            <span className="text-[#D4AF37]/40 text-xs">·</span>
            <span className="text-xs sm:text-sm font-semibold tracking-[0.14em] text-[#F5F2EB] uppercase whitespace-nowrap">
              wingo 1 min
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleFloating}
              title={isFloating ? 'Dock PiP Window' : 'Float Overlay PiP'}
              className="w-7 h-7 rounded-lg bg-[#17171F] hover:bg-[#22222E] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] transition-colors"
            >
              {isFloating ? <Minimize2 className="w-3.5 h-3.5" /> : <Move className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleTriggerNativePip}
              title="System Picture-in-Picture Overlay"
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                nativePipActive
                  ? 'bg-[#D4AF37] text-[#08080A] border-[#D4AF37]'
                  : 'bg-[#17171F] hover:bg-[#22222E] border-[#D4AF37]/30 text-[#D4AF37]'
              }`}
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CENTER ZONE: Displays the 3 outcomes (Big/Small, Number 0-9, Colour Red/Green/Violet) after 0.2s load */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2.5 py-4">
              <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <span className="text-xs font-mono-num tracking-[0.2em] text-[#D4AF37] uppercase">
                Decoding 0.2s...
              </span>
            </div>
          ) : prediction && periodInput.length === 3 ? (
            <div className="w-full flex flex-col items-center justify-center gap-2.5">
              {/* Central Number + Color Medallion */}
              <div className="flex items-center justify-center gap-4">
                <div
                  className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#0B0B0F] border-2 ${colorStyle.ring} flex flex-col items-center justify-center relative transition-all duration-150`}
                >
                  <span className="text-[10px] tracking-[0.18em] text-[#9E9789] uppercase leading-none mb-0.5">
                    NUMBER
                  </span>
                  <span className="text-4xl sm:text-5xl font-mono-num font-bold text-[#F5F2EB] leading-none">
                    {prediction.number}
                  </span>
                </div>
              </div>

              {/* Three Outcomes Strip: BIG/SMALL · NUMBER · COLOUR */}
              <div className="w-full grid grid-cols-3 gap-1.5 pt-1">
                {/* 1. BIG or SMALL */}
                <div className="bg-[#121218]/90 border border-[#D4AF37]/30 rounded-xl py-2 px-2 flex flex-col items-center justify-center">
                  <span className="text-[9px] tracking-[0.14em] text-[#9E9789] uppercase">
                    SIZE
                  </span>
                  <span
                    className={`text-sm sm:text-base font-bold tracking-wider mt-0.5 ${
                      prediction.size === 'BIG' ? 'text-[#E5C158]' : 'text-sky-300'
                    }`}
                  >
                    {prediction.size}
                  </span>
                </div>

                {/* 2. NUMBER (0 - 9) */}
                <div className="bg-[#121218]/90 border border-[#D4AF37]/30 rounded-xl py-2 px-2 flex flex-col items-center justify-center">
                  <span className="text-[9px] tracking-[0.14em] text-[#9E9789] uppercase">
                    DIGIT
                  </span>
                  <span className="text-sm sm:text-base font-mono-num font-bold text-[#F5F2EB] mt-0.5">
                    #{prediction.number}
                  </span>
                </div>

                {/* 3. COLOUR (RED / GREEN / VIOLET) */}
                <div className="bg-[#121218]/90 border border-[#D4AF37]/30 rounded-xl py-2 px-2 flex flex-col items-center justify-center">
                  <span className="text-[9px] tracking-[0.14em] text-[#9E9789] uppercase">
                    COLOUR
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${colorStyle.swatchBg} shrink-0`} />
                    {prediction.secondaryColor && (
                      <span
                        className={`w-2 h-2 rounded-full -ml-1 ${
                          prediction.secondaryColor === 'RED' ? 'bg-rose-500' : 'bg-emerald-500'
                        } shrink-0`}
                      />
                    )}
                    <span className={`text-xs sm:text-sm font-bold tracking-wide ${colorStyle.badgeText}`}>
                      {prediction.color}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-3 py-4">
              <div className="w-12 h-12 rounded-full bg-[#14141C] border border-[#D4AF37]/35 flex items-center justify-center mb-2 text-[#D4AF37]">
                <Lock className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#F5F2EB]">
                Enter 3-Digit Period Number
              </p>
              <p className="text-[11px] text-[#9E9789] mt-0.5">
                Instant 0.2s Big/Small, Number & Colour decode
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM ZONE: Write the 3-digit Period Number */}
        <div className="relative z-10 pt-2 border-t border-[#D4AF37]/20">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="pip-period-input"
              className="text-[10px] font-medium tracking-[0.15em] text-[#D4AF37] uppercase"
            >
              Period Number (3 Digits)
            </label>
            <span className="text-[10px] font-mono-num text-[#9E9789]">
              {periodInput.length}/3 digits
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              id="pip-period-input"
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={periodInput}
              onChange={(e) => {
                const clean = e.target.value.replace(/\D/g, '').slice(0, 3);
                onPeriodChange(clean);
              }}
              placeholder="e.g. 356"
              className="w-full h-10 px-3 rounded-xl bg-[#07070A] border border-[#D4AF37]/45 focus:border-[#D4AF37] focus:outline-none text-center font-mono-num text-base font-bold tracking-[0.25em] text-[#F5F2EB] placeholder:text-[#6E6A63] placeholder:tracking-normal placeholder:font-sans placeholder:text-xs"
            />
            <button
              type="button"
              onClick={() => handleStepPeriod(1)}
              title="Next Period (+1)"
              className="h-10 px-3 rounded-xl gold-button font-mono-num text-xs font-bold tracking-wider flex items-center justify-center gap-0.5 shrink-0"
            >
              <span>+1</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
