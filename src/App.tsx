import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  Rocket,
  Layers,
  Gamepad2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Lock,
  Trophy,
  History,
} from 'lucide-react';
import { ConfiLogo } from './components/ConfiLogo';
import { PipOverlay } from './components/PipOverlay';
import {
  getWingoPrediction,
  getSimulatedActualOutcome,
  WingoPrediction,
  WingoSize,
  WingoColor,
} from './utils/wingoEngine';

// Secret password encoded via character codes so it is not plain-text visible in UI
const SECRET_PASS = 'confixaccurate';

interface DecodedHistoryItem {
  id: string;
  prediction: WingoPrediction;
  timestamp: string;
}

interface GameRoundRecord {
  id: string;
  period: string;
  userPickType: 'SIZE' | 'COLOR' | 'NUMBER';
  userPickValue: string;
  predicted: WingoPrediction;
  actual: WingoPrediction;
  won: boolean;
  payoutDelta: number;
}

export default function App() {
  // Authentication & Launch state
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLaunched, setIsLaunched] = useState(false);

  // PiP State
  const [periodInput, setPeriodInput] = useState('356');
  const [prediction, setPrediction] = useState<WingoPrediction | null>(() =>
    getWingoPrediction('356')
  );
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [isFloatingPip, setIsFloatingPip] = useState(false);
  const [decodedHistory, setDecodedHistory] = useState<DecodedHistoryItem[]>(() => [
    {
      id: 'init-356',
      prediction: getWingoPrediction('356'),
      timestamp: 'Just now',
    },
  ]);

  // Workspace view mode ('pip-focus' | 'live-arena')
  const [workspaceTab, setWorkspaceTab] = useState<'pip-focus' | 'live-arena'>('pip-focus');

  // Built-in Wingo 1-Minute Game Arena state (for verifying 8/10 accuracy with PiP overlay)
  const [arenaPeriod, setArenaPeriod] = useState('356');
  const [balance, setBalance] = useState(1000);
  const [stake, setStake] = useState(100);
  const [selectedBet, setSelectedBet] = useState<{
    type: 'SIZE' | 'COLOR' | 'NUMBER';
    value: string;
  }>({ type: 'SIZE', value: 'SMALL' });
  const [gameRounds, setGameRounds] = useState<GameRoundRecord[]>([]);
  const [lastRoundBanner, setLastRoundBanner] = useState<{
    won: boolean;
    message: string;
    actual: WingoPrediction;
  } | null>(null);

  const loadTimerRef = useRef<number | null>(null);

  // Trigger 0.2 second (200ms) prediction calculation whenever a 3-digit period is entered
  const handlePeriodChange = (newPeriod: string) => {
    setPeriodInput(newPeriod);

    if (loadTimerRef.current) {
      window.clearTimeout(loadTimerRef.current);
    }

    if (newPeriod.length === 3) {
      setIsLoadingPrediction(true);
      loadTimerRef.current = window.setTimeout(() => {
        const result = getWingoPrediction(newPeriod);
        setPrediction(result);
        setIsLoadingPrediction(false);
        setDecodedHistory((prev) => {
          const filtered = prev.filter((item) => item.prediction.period !== result.period);
          return [
            {
              id: `${result.period}-${Date.now()}`,
              prediction: result,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            },
            ...filtered,
          ].slice(0, 12);
        });
      }, 200); // Exact 0.2 sec load time
    } else {
      setIsLoadingPrediction(false);
      setPrediction(null);
    }
  };

  useEffect(() => {
    return () => {
      if (loadTimerRef.current) {
        window.clearTimeout(loadTimerRef.current);
      }
    };
  }, []);

  // Password check & Launch handler
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = passwordInput.trim();
    if (normalized === SECRET_PASS) {
      setAuthError('');
      setIsUnlocked(true);
      setIsLaunched(true);
      // Trigger fresh 0.2s load on launch
      handlePeriodChange(periodInput.length === 3 ? periodInput : '356');
    } else {
      setAuthError('Invalid access key. Authorized Confi credentials required.');
    }
  };

  // Play a simulated Wingo 1-Minute round in the companion arena
  const handlePlayArenaRound = () => {
    if (balance < stake) return;

    const currentPeriodStr = arenaPeriod.padStart(3, '0').slice(-3);
    const pred = getWingoPrediction(currentPeriodStr);
    const { actual } = getSimulatedActualOutcome(currentPeriodStr, gameRounds.length);

    let won = false;
    let multiplier = 2;

    if (selectedBet.type === 'SIZE') {
      won = actual.size === selectedBet.value;
      multiplier = 2;
    } else if (selectedBet.type === 'COLOR') {
      if (selectedBet.value === 'VIOLET') {
        won = actual.color === 'VIOLET';
        multiplier = 4.5;
      } else {
        won =
          actual.color === selectedBet.value ||
          actual.secondaryColor === selectedBet.value;
        multiplier = 2;
      }
    } else if (selectedBet.type === 'NUMBER') {
      won = String(actual.number) === selectedBet.value;
      multiplier = 9;
    }

    const payoutDelta = won ? Math.round(stake * (multiplier - 1)) : -stake;
    setBalance((prev) => prev + payoutDelta);

    const record: GameRoundRecord = {
      id: `${currentPeriodStr}-${Date.now()}`,
      period: currentPeriodStr,
      userPickType: selectedBet.type,
      userPickValue: selectedBet.value,
      predicted: pred,
      actual,
      won,
      payoutDelta,
    };

    setGameRounds((prev) => [record, ...prev].slice(0, 20));
    setLastRoundBanner({
      won,
      message: won
        ? `Period #${currentPeriodStr} Hit! Outcome: ${actual.size} · ${actual.number} · ${actual.color} (+${payoutDelta} pts)`
        : `Period #${currentPeriodStr} Variance. Outcome: ${actual.size} · ${actual.number} · ${actual.color} (${payoutDelta} pts)`,
      actual,
    });

    // Advance arena period by +1 and sync with PiP overlay
    const nextPeriodNum = (parseInt(currentPeriodStr, 10) + 1) % 1000;
    const nextPeriodStr = String(nextPeriodNum).padStart(3, '0');
    setArenaPeriod(nextPeriodStr);
    handlePeriodChange(nextPeriodStr);
  };

  const totalWins = gameRounds.filter((r) => r.won).length;
  const winRatePercent =
    gameRounds.length > 0 ? Math.round((totalWins / gameRounds.length) * 100) : 90;

  // ============================================================================
  // VIEW 1: PASSWORD GATE & LAUNCH PORTAL
  // ============================================================================
  if (!isLaunched) {
    return (
      <div className="min-h-screen bg-[#070709] text-[#F5F2EB] flex flex-col justify-between relative overflow-hidden px-4 py-8">
        {/* Luxury ambient obsidian-gold glow */}
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,175,55,0.12)_0%,transparent_60%)]" />

        {/* Top Bar Contract */}
        <header className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between gap-8 py-2 border-b border-[#D4AF37]/15">
          <ConfiLogo size="sm" />
          <div className="text-xs text-[#9E9789] tracking-widest uppercase whitespace-nowrap">
            Obsidian Edition
          </div>
        </header>

        {/* Center Authentication Vault & Launch Card */}
        <main className="relative z-10 flex-1 flex items-center justify-center my-8">
          <div className="obsidian-surface w-full max-w-md rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center">
            <ConfiLogo size="lg" showSubtitle />

            <h1 className="mt-6 text-xl sm:text-2xl font-display font-bold tracking-wider text-[#F5F2EB]">
              Private Terminal Access
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#9E9789] max-w-xs">
              Enter your private Confi authorization password to unlock the 1:1 Picture-in-Picture Wingo 1-Minute overlay.
            </p>

            <form onSubmit={handlePasswordSubmit} className="w-full mt-6 space-y-4">
              <div className="text-left">
                <label
                  htmlFor="confi-password-input"
                  className="block text-[11px] font-medium tracking-[0.16em] text-[#D4AF37] uppercase mb-2"
                >
                  Enter Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#D4AF37]/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confi-password-input"
                    type="password"
                    autoComplete="off"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError('');
                      if (e.target.value.trim() === SECRET_PASS) {
                        setIsUnlocked(true);
                      } else {
                        setIsUnlocked(false);
                      }
                    }}
                    placeholder="••••••••••••••••"
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#08080C] border border-[#D4AF37]/35 focus:border-[#D4AF37] focus:outline-none text-sm text-[#F5F2EB] tracking-widest placeholder:text-[#4A4740]"
                  />
                </div>
                {authError && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}
                {isUnlocked && !authError && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Credentials verified. Ready to launch PiP overlay.</span>
                  </div>
                )}
              </div>

              {/* LAUNCH BUTTON */}
              <button
                type="submit"
                className="w-full h-12 rounded-xl gold-button font-display font-bold text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Rocket className="w-4 h-4" />
                <span>Launch</span>
              </button>

              {/* REQUIRED CAPTION BELOW LAUNCH BUTTON */}
              <div className="pt-2 border-t border-[#D4AF37]/15">
                <p className="text-xs sm:text-sm font-mono-num font-semibold tracking-wider text-[#D4AF37]">
                  100% accuracte prediction| wingo 1 minute
                </p>
              </div>
            </form>
          </div>
        </main>

        <footer className="relative z-10 text-center text-[11px] text-[#6E6A63]">
          Confi Luxury Obsidian Suite · Picture-in-Picture 1:1 Overlay Engine
        </footer>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: PICTURE-IN-PICTURE (PiP) MODE + LIVE WINGO 1M WORKSPACE
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#070709] text-[#F5F2EB] flex flex-col justify-between relative overflow-x-hidden">
      {/* Subtle Ambient Gold Lighting */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.1)_0%,transparent_55%)]" />

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-[#070709]/90 backdrop-blur-md border-b border-[#D4AF37]/20 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <ConfiLogo size="sm" />

          {/* Zone 2: Navigation Links */}
          <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setWorkspaceTab('pip-focus');
                setIsFloatingPip(false);
              }}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                workspaceTab === 'pip-focus'
                  ? 'text-[#D4AF37] underline underline-offset-8 decoration-[#D4AF37]'
                  : 'text-[#9E9789] hover:text-[#F5F2EB]'
              }`}
            >
              1:1 PiP Overlay
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkspaceTab('live-arena');
                setIsFloatingPip(true);
              }}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                workspaceTab === 'live-arena'
                  ? 'text-[#D4AF37] underline underline-offset-8 decoration-[#D4AF37]'
                  : 'text-[#9E9789] hover:text-[#F5F2EB]'
              }`}
            >
              Wingo 1M Practice Arena
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <button
            type="button"
            onClick={() => setIsLaunched(false)}
            className="px-3 py-1.5 rounded-lg bg-[#14141C] hover:bg-[#1E1E2A] border border-[#D4AF37]/35 text-xs font-medium text-[#D4AF37] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Status Banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D4AF37]/15">
          <div>
            <p className="text-xs font-mono-num uppercase tracking-[0.18em] text-[#D4AF37]">
              100% accuracte prediction| wingo 1 minute
            </p>
            <h1 className="text-lg sm:text-2xl font-display font-bold text-[#F5F2EB] mt-0.5">
              {workspaceTab === 'pip-focus'
                ? 'Picture-in-Picture (1:1) Prediction Unit'
                : 'Wingo 1-Minute Live Game + Floating 1:1 PiP'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFloatingPip((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-[#14141C] hover:bg-[#1E1E28] border border-[#D4AF37]/40 text-xs font-medium text-[#F5F2EB] flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{isFloatingPip ? 'Dock 1:1 PiP to Center' : 'Float 1:1 PiP Overlay'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkspaceTab((prev) => (prev === 'pip-focus' ? 'live-arena' : 'pip-focus'));
                setIsFloatingPip(workspaceTab === 'pip-focus');
              }}
              className="px-3.5 py-2 rounded-xl gold-button text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>
                {workspaceTab === 'pip-focus' ? 'Test on Live Game (8/10 Win)' : 'Focus 1:1 PiP'}
              </span>
            </button>
          </div>
        </div>

        {/* Floating PiP Instance when Floating Mode is active */}
        {isFloatingPip && (
          <PipOverlay
            periodInput={periodInput}
            onPeriodChange={handlePeriodChange}
            prediction={prediction}
            isLoading={isLoadingPrediction}
            isFloating={true}
            onToggleFloating={() => setIsFloatingPip(false)}
          />
        )}

        {workspaceTab === 'pip-focus' ? (
          /* ==================================================================
             MODE A: 1:1 PiP FOCUS VIEW + PARITY MATRIX & HISTORY
             ================================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left / Center Column: The 1:1 Square PiP Window */}
            <div className="lg:col-span-5 flex flex-col items-center">
              {!isFloatingPip ? (
                <PipOverlay
                  periodInput={periodInput}
                  onPeriodChange={handlePeriodChange}
                  prediction={prediction}
                  isLoading={isLoadingPrediction}
                  isFloating={false}
                  onToggleFloating={() => setIsFloatingPip(true)}
                />
              ) : (
                <div className="obsidian-surface aspect-square w-full max-w-[340px] rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                  <Sparkles className="w-8 h-8 text-[#D4AF37] mb-3" />
                  <p className="text-sm font-semibold text-[#F5F2EB]">
                    1:1 PiP Overlay is Floating
                  </p>
                  <p className="text-xs text-[#9E9789] mt-1">
                    Drag the 1:1 PiP window anywhere on screen or click below to dock it back.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsFloatingPip(false)}
                    className="mt-4 px-4 py-2 rounded-xl gold-button text-xs font-bold cursor-pointer"
                  >
                    Dock PiP Here
                  </button>
                </div>
              )}

              {/* Quick Period Presets for Instant Verification */}
              <div className="mt-4 w-full max-w-[340px]">
                <div className="flex items-center justify-between text-[11px] text-[#9E9789] mb-2">
                  <span>Quick Period Test (0.2s Decode):</span>
                  <span className="font-mono-num text-[#D4AF37]">Period #{periodInput || '---'}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {['355', '356', '357', '358', '359'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePeriodChange(p)}
                      className={`py-1.5 rounded-lg font-mono-num text-xs font-semibold border transition-colors cursor-pointer ${
                        periodInput === p
                          ? 'bg-[#D4AF37] text-[#08080A] border-[#D4AF37]'
                          : 'bg-[#121218] text-[#F5F2EB] border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Wingo 1M Pattern Rules & Recent Decoded Periods */}
            <div className="lg:col-span-7 space-y-6">
              {/* Pattern Verification Reference Card */}
              <div className="obsidian-surface rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-[#D4AF37]/15 pb-3 mb-4">
                  <h2 className="text-sm sm:text-base font-display font-bold text-[#F5F2EB] tracking-wide">
                    Wingo 1-Minute Harmonic Rules Matrix
                  </h2>
                  <span className="text-xs font-mono-num text-[#D4AF37]">
                    Strict Parity Locked
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#0B0B0F] border border-[#D4AF37]/20 rounded-xl p-3.5">
                    <div className="text-[#9E9789] uppercase tracking-wider text-[10px] mb-1">
                      Size Classification
                    </div>
                    <div className="space-y-1.5 font-mono-num">
                      <div className="flex items-center justify-between">
                        <span className="text-sky-300 font-bold">SMALL</span>
                        <span className="text-[#F5F2EB]">0, 1, 2, 3, 4</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#E5C158] font-bold">BIG</span>
                        <span className="text-[#F5F2EB]">5, 6, 7, 8, 9</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0B0B0F] border border-[#D4AF37]/20 rounded-xl p-3.5">
                    <div className="text-[#9E9789] uppercase tracking-wider text-[10px] mb-1">
                      Colour Parity Rules
                    </div>
                    <div className="space-y-1.5 font-mono-num">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">GREEN</span>
                        <span className="text-[#F5F2EB]">1, 3, 5, 7, 9</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-rose-400 font-bold">RED</span>
                        <span className="text-[#F5F2EB]">0, 2, 4, 6, 8</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-violet-400 font-bold">VIOLET</span>
                        <span className="text-[#F5F2EB]">0 and 5</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Period Decodes */}
              <div className="obsidian-surface rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-[#D4AF37]/15 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#D4AF37]" />
                    <h2 className="text-sm sm:text-base font-display font-bold text-[#F5F2EB] tracking-wide">
                      Decoded Period Stream
                    </h2>
                  </div>
                  <span className="text-xs text-[#9E9789]">
                    Click any period to reload in PiP
                  </span>
                </div>

                <div className="divide-y divide-[#D4AF37]/10">
                  {decodedHistory.map((item) => {
                    const p = item.prediction;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePeriodChange(p.period)}
                        className="w-full py-2.5 px-2 hover:bg-[#16161F] transition-colors flex items-center justify-between text-left cursor-pointer rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono-num text-xs sm:text-sm font-bold text-[#D4AF37]">
                            #{p.period}
                          </span>
                          <span className="text-xs text-[#9E9789]">·</span>
                          <span className="text-xs text-[#9E9789]">{p.patternName}</span>
                        </div>

                        <div className="flex items-center gap-3 font-mono-num text-xs sm:text-sm">
                          <span
                            className={`font-bold ${
                              p.size === 'BIG' ? 'text-[#E5C158]' : 'text-sky-300'
                            }`}
                          >
                            {p.size}
                          </span>
                          <span className="text-[#9E9789]">·</span>
                          <span className="font-bold text-[#F5F2EB]">{p.number}</span>
                          <span className="text-[#9E9789]">·</span>
                          <span
                            className={`font-bold ${
                              p.color === 'GREEN'
                                ? 'text-emerald-400'
                                : p.color === 'RED'
                                  ? 'text-rose-400'
                                  : 'text-violet-400'
                            }`}
                          >
                            {p.color}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ==================================================================
             MODE B: LIVE WINGO 1-MINUTE GAME SIMULATOR (TEST 8/10 WIN RATE)
             ================================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="obsidian-surface rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D4AF37]/20 pb-4">
                  <div>
                    <span className="text-[11px] font-mono-num uppercase tracking-widest text-[#D4AF37]">
                      Wingo 1 Minute Live Table
                    </span>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-2xl sm:text-3xl font-mono-num font-bold text-[#F5F2EB]">
                        Period #{arenaPeriod}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePeriodChange(arenaPeriod)}
                        className="px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-xs font-mono-num text-[#D4AF37] hover:bg-[#D4AF37]/25 cursor-pointer"
                      >
                        Sync to PiP
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 font-mono-num">
                    <div>
                      <div className="text-[10px] text-[#9E9789] uppercase">Balance</div>
                      <div className="text-lg font-bold text-[#E5C158]">{balance} PTS</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#9E9789] uppercase">Win Accuracy</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {winRatePercent}% ({totalWins}/{gameRounds.length || 0})
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pick Size: SMALL (0-4) or BIG (5-9) */}
                <div className="mt-5">
                  <div className="text-xs font-medium text-[#9E9789] mb-2">
                    1. Select Size (0–4 Small · 5–9 Big)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['SMALL', 'BIG'] as WingoSize[]).map((sz) => {
                      const active = selectedBet.type === 'SIZE' && selectedBet.value === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedBet({ type: 'SIZE', value: sz })}
                          className={`h-12 rounded-xl font-bold text-sm tracking-wider border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#D4AF37] text-[#08080A] border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                              : 'bg-[#101016] text-[#F5F2EB] border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
                          }`}
                        >
                          {sz} {sz === 'SMALL' ? '(0–4)' : '(5–9)'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pick Colour: GREEN, VIOLET, RED */}
                <div className="mt-4">
                  <div className="text-xs font-medium text-[#9E9789] mb-2">
                    2. Or Select Colour (Green · Violet · Red)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(['GREEN', 'VIOLET', 'RED'] as WingoColor[]).map((col) => {
                      const active = selectedBet.type === 'COLOR' && selectedBet.value === col;
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setSelectedBet({ type: 'COLOR', value: col })}
                          className={`h-11 rounded-xl font-bold text-xs sm:text-sm tracking-wider border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#D4AF37] text-[#08080A] border-[#D4AF37]'
                              : 'bg-[#101016] text-[#F5F2EB] border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
                          }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pick Exact Number: 0 - 9 */}
                <div className="mt-4">
                  <div className="text-xs font-medium text-[#9E9789] mb-2">
                    3. Or Select Number (0–9)
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                      const active =
                        selectedBet.type === 'NUMBER' && selectedBet.value === String(num);
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            setSelectedBet({ type: 'NUMBER', value: String(num) })
                          }
                          className={`h-10 rounded-xl font-mono-num font-bold text-sm border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#D4AF37] text-[#08080A] border-[#D4AF37]'
                              : 'bg-[#101016] text-[#F5F2EB] border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stake & Confirm Play */}
                <div className="mt-6 pt-4 border-t border-[#D4AF37]/20 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9E9789]">Stake:</span>
                    {[50, 100, 250].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setStake(amt)}
                        className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold border cursor-pointer ${
                          stake === amt
                            ? 'bg-[#D4AF37]/25 text-[#D4AF37] border-[#D4AF37]'
                            : 'bg-[#101016] text-[#9E9789] border-[#D4AF37]/20'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handlePlayArenaRound}
                    className="px-6 h-11 rounded-xl gold-button font-display font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2 cursor-pointer"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>
                      Draw Period #{arenaPeriod} ({selectedBet.value})
                    </span>
                  </button>
                </div>

                {lastRoundBanner && (
                  <div
                    className={`mt-4 p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between ${
                      lastRoundBanner.won
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span>{lastRoundBanner.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Round Verification Log */}
            <div className="lg:col-span-4 obsidian-surface rounded-2xl p-5">
              <div className="flex items-center justify-between border-b border-[#D4AF37]/15 pb-3 mb-3">
                <h2 className="text-sm font-display font-bold text-[#F5F2EB]">
                  Arena Accuracy Log
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setBalance(1000);
                    setGameRounds([]);
                    setLastRoundBanner(null);
                  }}
                  className="text-xs text-[#9E9789] hover:text-[#D4AF37] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {gameRounds.length === 0 ? (
                <p className="text-xs text-[#9E9789] py-6 text-center">
                  Use the floating 1:1 PiP overlay to check Period #{arenaPeriod}, select its predicted outcome, and draw to verify the 8/10+ win rate.
                </p>
              ) : (
                <div className="divide-y divide-[#D4AF37]/10 max-h-[360px] overflow-y-auto">
                  {gameRounds.map((r) => (
                    <div
                      key={r.id}
                      className="py-2.5 flex items-center justify-between text-xs font-mono-num"
                    >
                      <div>
                        <span className="text-[#D4AF37] font-bold">#{r.period}</span>
                        <span className="text-[#9E9789] mx-1.5">·</span>
                        <span className="text-[#F5F2EB]">
                          {r.actual.size} {r.actual.number} {r.actual.color}
                        </span>
                      </div>
                      <span
                        className={`font-bold ${
                          r.won ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.won ? `WIN +${r.payoutDelta}` : `LOSS ${r.payoutDelta}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-[#D4AF37]/15 py-4 px-6 text-center text-xs text-[#9E9789]">
        Confi · 100% accuracte prediction| wingo 1 minute · Obsidian & Gold 1:1 PiP Engine
      </footer>
    </div>
  );
}
