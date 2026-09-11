import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Square, Sparkles } from 'lucide-react';
import { AvatarState } from '../types';

interface PushToTalkButtonProps {
  avatarState: AvatarState;
  onStartTalking: () => Promise<boolean>;
  onStopTalking: () => void;
  inputVolume: number;
  disabled?: boolean;
  showCaption?: boolean;
}

export const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({
  avatarState,
  onStartTalking,
  onStopTalking,
  inputVolume,
  disabled = false,
  showCaption = true,
}) => {
  const isListening = avatarState === 'listening';
  const isThinking = avatarState === 'thinking';
  const isSpeaking = avatarState === 'speaking';

  // Stop talking on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        onStopTalking();
      }
    };
  }, []);

  // Tap Handler: Toggle between starting and stopping/restarting
  const handleClick = async () => {
    if (disabled) return;
    if (isListening || isSpeaking || isThinking) {
      onStopTalking();
    } else {
      await onStartTalking();
    }
  };

  // Pulse ring scale based on microphone input volume
  const volumeRingScale = 1 + inputVolume * 0.45;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 w-full" id="push-to-talk-control">
      {/* Main Kiosk Tap Button */}
      <div className="relative flex items-center justify-center p-1">
        {/* Animated Volume Wave Ring */}
        {isListening && (
          <motion.div
            className="absolute rounded-full bg-rose-500/25 pointer-events-none"
            style={{ width: 100, height: 100 }}
            animate={{ scale: volumeRingScale }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          />
        )}

        {/* Outer Glow Pulse Button */}
        <motion.button
          type="button"
          id="talk-kiosk-button"
          disabled={disabled}
          onClick={handleClick}
          className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-xl transition-all select-none touch-manipulation cursor-pointer border-3 ${
            disabled
              ? 'bg-slate-400 border-slate-300 opacity-60 cursor-not-allowed'
              : isListening || isThinking
              ? 'bg-gradient-to-tr from-rose-500 to-red-600 border-red-300 ring-6 ring-rose-200 shadow-rose-500/30'
              : isSpeaking
              ? 'bg-gradient-to-tr from-purple-700 to-indigo-700 border-purple-300 ring-4 ring-purple-100 hover:brightness-105 shadow-purple-500/30'
              : 'bg-gradient-to-tr from-[#C83CFB] to-purple-600 border-purple-200 hover:scale-105 active:scale-95 shadow-purple-500/30'
          }`}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
        >
          {isListening || isThinking ? (
            <>
              <Square className="w-6 h-6 fill-current mb-0.5 animate-pulse" />
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold">Tap to Stop</span>
            </>
          ) : isSpeaking ? (
            <>
              <Square className="w-6 h-6 fill-current mb-0.5" />
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold">Tap to Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-6 h-6 sm:w-7 sm:h-7 mb-0.5 drop-shadow-md" />
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold">Tap to Talk</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Helpful Instructions for Exhibit Visitors */}
      {showCaption && (
        <div className="text-center px-4">
          <p className="text-xs sm:text-sm font-medium text-slate-700">
            {isListening ? (
              <span className="text-rose-600 font-semibold flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                Listening now! Tap to stop and restart anytime...
              </span>
            ) : isThinking ? (
              <span className="text-amber-600 font-semibold">Radius is active — tap to stop and restart...</span>
            ) : isSpeaking ? (
              <span className="text-purple-700 font-semibold">Radius is speaking — tap to stop and restart!</span>
            ) : (
              <span><strong>Tap</strong> once to start speaking, and tap again to stop!</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};
