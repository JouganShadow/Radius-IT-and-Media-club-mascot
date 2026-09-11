import React, { useState, useEffect } from 'react';
import { RefreshCw, Mic, MicOff, Maximize2, Minimize2, Radio, School } from 'lucide-react';
import { ConnectionStatus, MicStatus } from '../types';
import { MIMO_INFO } from '../mimo-data';

interface KioskHeaderProps {
  connectionStatus: ConnectionStatus;
  micStatus: MicStatus;
  onRequestMic: () => void;
  onReset: () => void;
  isBusy: boolean;
}

export const KioskHeader: React.FC<KioskHeaderProps> = ({
  connectionStatus,
  micStatus,
  onRequestMic,
  onReset,
  isBusy,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const connectionDetails = {
    connected: { label: 'Gemini Live Active', color: 'bg-emerald-500', text: 'text-emerald-700' },
    connecting: { label: 'Connecting...', color: 'bg-amber-500', text: 'text-amber-700' },
    reconnecting: { label: 'Reconnecting...', color: 'bg-amber-500', text: 'text-amber-700' },
    fallback: { label: 'Voice AI Ready', color: 'bg-blue-500', text: 'text-blue-700' },
    error: { label: 'Reconnecting...', color: 'bg-rose-500', text: 'text-rose-700' },
  }[connectionStatus];

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 py-3.5 shadow-xs select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: School & Character Mark */}
        <div className="flex items-center gap-3">
          {/* Custom YSIS & Mimo Emblem Badge */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-[#C83CFB] flex items-center justify-center text-white shadow-md ring-2 ring-purple-100">
            <span className="font-extrabold text-sm tracking-wider">YSIS</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-none">
                {MIMO_INFO.name}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-semibold">
                Invenio • IT & Media Club
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium line-clamp-1">
              {MIMO_INFO.school} • Invenio Science Exhibition
            </p>
          </div>
        </div>

        {/* Center/Right Indicators & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-slate-600" />
            <span className={`w-2 h-2 rounded-full ${connectionDetails.color}`} />
            <span className={connectionDetails.text}>{connectionDetails.label}</span>
          </div>

          {/* Microphone Permission Indicator & Activator */}
          <button
            type="button"
            onClick={onRequestMic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              micStatus === 'granted' || micStatus === 'recording'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : micStatus === 'denied'
                ? 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse'
                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
            }`}
            title={
              micStatus === 'granted'
                ? 'Microphone is ready'
                : 'Click to grant or verify microphone access'
            }
          >
            {micStatus === 'granted' || micStatus === 'recording' ? (
              <>
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Mic Ready</span>
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Enable Mic</span>
              </>
            )}
          </button>

          {/* New Visitor / Reset Conversation Button */}
          <button
            type="button"
            id="kiosk-reset-btn"
            onClick={onReset}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Start fresh conversation for the next visitor"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Visitor</span>
          </button>

          {/* Kiosk Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Kiosk Fullscreen' : 'Enter Kiosk Fullscreen'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
