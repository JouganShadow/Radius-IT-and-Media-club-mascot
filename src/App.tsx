/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { KioskHeader } from './components/KioskHeader';
import { RadiusAvatar } from './components/MimoAvatar';
import { PushToTalkButton } from './components/PushToTalkButton';
import { AudioVisualizer } from './components/AudioVisualizer';
import { MimoClient } from './services/mimoClient';
import { AvatarState, ConnectionStatus, MicStatus, QuickTopic, TranscriptItem } from './types';
import { MIMO_INFO, INITIAL_GREETING, QUICK_TOPICS } from './mimo-data';
import { Sparkles, MessageSquare, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [micStatus, setMicStatus] = useState<MicStatus>('prompt');
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [outputVolume, setOutputVolume] = useState<number>(0);
  const [friendlyError, setFriendlyError] = useState<string | null>(null);

  const mimoClientRef = useRef<MimoClient | null>(null);

  // Check microphone permissions on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          setMicStatus(permissionStatus.state as MicStatus);
          permissionStatus.onchange = () => {
            setMicStatus(permissionStatus.state as MicStatus);
          };
        })
        .catch(() => {
          // Permissions API might not support microphone query in all browsers
        });
    }
  }, []);

  // Initialize Mimo/Radius Client
  useEffect(() => {
    const client = new MimoClient({
      onAvatarStateChange: (state) => setAvatarState(state),
      onTranscriptUpdate: (newTranscripts) => setTranscripts(newTranscripts),
      onConnectionChange: (status) => setConnectionStatus(status),
      onVolumeChange: (inVol, outVol) => {
        setInputVolume(inVol);
        setOutputVolume(outVol);
      },
      onError: (msg) => {
        setFriendlyError(msg);
      },
    });

    mimoClientRef.current = client;
    client.connect();

    return () => {
      client.destroy();
      mimoClientRef.current = null;
    };
  }, []);

  // Request Microphone explicitly
  const handleRequestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus('granted');
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setMicStatus('denied');
      setFriendlyError('Microphone permission was not granted. Please enable it in browser settings.');
    }
  };

  // Push to talk start
  const handleStartTalking = async (): Promise<boolean> => {
    setFriendlyError(null);
    if (!mimoClientRef.current) return false;
    const success = await mimoClientRef.current.startTalking();
    if (success) {
      setMicStatus('recording');
    }
    return success;
  };

  // Push to talk stop: stops all API/audio activity and restarts the whole page
  const handleStopTalking = () => {
    if (mimoClientRef.current) {
      mimoClientRef.current.stopTalking();
      mimoClientRef.current.destroy();
      mimoClientRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAvatarState('idle');
    setTranscripts([]);
    setInputVolume(0);
    setOutputVolume(0);
    setFriendlyError(null);
    setMicStatus('granted');

    // Restart the whole page
    window.location.reload();
  };

  // Quick topic selection (Touch on screen)
  const handleSelectTopic = (topic: QuickTopic) => {
    setFriendlyError(null);
    if (mimoClientRef.current) {
      mimoClientRef.current.sendTextMessage(topic.prompt);
    }
  };

  // Reset conversation for next visitor
  const handleReset = () => {
    if (mimoClientRef.current) {
      mimoClientRef.current.resetConversation();
      setFriendlyError(null);
      setInputVolume(0);
      setOutputVolume(0);
    }
  };

  // Keyboard shortcut: Spacebar hold to talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && avatarState === 'idle' && e.target === document.body) {
        e.preventDefault();
        handleStartTalking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && avatarState === 'listening') {
        e.preventDefault();
        handleStopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [avatarState]);

  const isBusy = avatarState === 'listening' || avatarState === 'thinking';
  const activeVolume = avatarState === 'listening' ? inputVolume : outputVolume;
  const activeVolumeColor = avatarState === 'listening' ? '#ef4444' : '#C83CFB';

  const lastRadiusTranscript = [...transcripts].reverse().find((t) => t.sender === 'mimo');
  const latestIntent = lastRadiusTranscript?.intent;
  const currentDialogue = lastRadiusTranscript?.text || INITIAL_GREETING;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 via-purple-50/20 to-indigo-50/30 text-slate-900 font-sans antialiased select-none">
      {/* Kiosk Navigation / Status Header */}
      <KioskHeader
        connectionStatus={connectionStatus}
        micStatus={micStatus}
        onRequestMic={handleRequestMic}
        onReset={handleReset}
        isBusy={isBusy}
      />

      {/* Main Viewport: Centered Avatar Hero -> Push-to-Talk -> Speech Bubble, Auxiliary UI in Bottom-Right */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col items-center justify-center min-h-0 overflow-hidden relative">
        {/* Left Side: Big Display Lettering */}
        <div className="hidden md:flex absolute left-4 lg:left-8 xl:left-12 top-1/2 -translate-y-1/2 flex-col max-w-[220px] lg:max-w-[270px] xl:max-w-[320px] text-left z-20 pointer-events-none select-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/90 text-purple-800 text-xs font-bold mb-3 border border-purple-200/80 shadow-2xs w-fit">
            <Sparkles className="w-3.5 h-3.5 text-[#C83CFB]" />
            <span>Invenio Science Exhibition</span>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-slate-900 leading-[1.14] tracking-tight">
            Built by the <br />
            <span className="text-purple-700">Yoshida Shokanji</span> <br />
            <span className="text-slate-800">International School</span> <br />
            <span className="text-[#C83CFB]">IT & Media Club</span>
          </h1>
        </div>

        {/* Right Side: Medium Size Disclaimer & Information Lettering */}
        <div className="hidden md:flex absolute right-4 lg:right-8 xl:right-12 top-1/2 -translate-y-1/2 flex-col items-end max-w-[220px] lg:max-w-[260px] xl:max-w-[300px] text-right z-20 pointer-events-none select-none">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/90 text-amber-900 text-xs font-bold mb-2.5 border border-amber-200/80 shadow-2xs w-fit">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
            <span>Exhibition Notice</span>
          </div>

          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 leading-snug">
            This AI can make mistakes.
          </h2>

          <p className="mt-2 text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
            Responses are generated live and are solely meant for <span className="font-semibold text-slate-800">entertainment</span> and educational demonstration purposes.
          </p>
        </div>

        {/* Mobile Header Banner (When on small screens where left panel is hidden) */}
        <div className="md:hidden w-full text-center px-2 pt-0.5 shrink-0 select-none">
          <p className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-snug">
            Built by the <span className="text-purple-700">Yoshida Shokanji International School</span> <span className="text-[#C83CFB]">IT & Media Club</span>
          </p>
        </div>

        {/* Focused Center Interactive Unit: Avatar -> Push-to-Talk Button -> Speech Status & Dialogue */}
        <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center z-10 my-auto py-1">
          {/* Big Mascot Name "Radius" */}
          <div className="text-center mb-2 sm:mb-3 shrink-0 select-none">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-none">
              Radius
            </h1>
          </div>

          {/* 1. Avatar (Radius orb) as dominant, large focal hero element */}
          <div className="relative flex items-center justify-center shrink-0">
            <RadiusAvatar
              state={avatarState}
              inputVolume={inputVolume}
              outputVolume={outputVolume}
              latestIntent={latestIntent}
              sizeClassName="w-56 h-56 sm:w-68 sm:h-68 md:w-80 md:h-80 lg:w-[380px] lg:h-[380px] xl:w-[420px] xl:h-[420px] max-h-[42vh] aspect-square"
            />
          </div>

          {/* 2. Push-to-Talk Button directly below avatar, part of same interactive unit */}
          <div className="mt-2 sm:mt-3 flex flex-col items-center shrink-0">
            {/* Live Audio Visualizer Spectrum */}
            <AudioVisualizer
              volume={activeVolume}
              isActive={avatarState === 'listening' || avatarState === 'speaking'}
              color={activeVolumeColor}
              barCount={24}
            />

            <div className="mt-1">
              <PushToTalkButton
                avatarState={avatarState}
                onStartTalking={handleStartTalking}
                onStopTalking={handleStopTalking}
                inputVolume={inputVolume}
                showCaption={false}
              />
            </div>
          </div>

          {/* 3. Speech Bubble / Speaking status & dialogue text paragraph */}
          <motion.div
            key={currentDialogue}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-lg mt-2.5 sm:mt-3 px-4 py-2 sm:py-2.5 bg-white/95 backdrop-blur-md rounded-2xl border border-purple-200/80 shadow-xs text-center shrink-0"
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-[#C83CFB] animate-pulse inline-block" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
                {avatarState === 'speaking'
                  ? `${MIMO_INFO.name} is speaking`
                  : avatarState === 'listening'
                  ? 'Listening to your voice...'
                  : avatarState === 'thinking'
                  ? `${MIMO_INFO.name} is thinking...`
                  : `${MIMO_INFO.name} (YSIS Mascot)`}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug line-clamp-3">
              {avatarState === 'listening' ? (
                <span className="text-rose-600 animate-pulse font-bold">
                  “Listening now... say your question!”
                </span>
              ) : avatarState === 'thinking' ? (
                <span className="text-amber-600 animate-pulse font-medium">
                  “Thinking of the best answer for you...”
                </span>
              ) : (
                `“${currentDialogue}”`
              )}
            </p>
          </motion.div>
        </div>

        {/* 4. Bottom-Right Corner: De-emphasized Quick Inquiries & Secondary Controls */}
        <div className="w-full md:w-auto md:absolute md:bottom-3 md:right-4 z-20 flex flex-col items-center md:items-end gap-1 px-2 py-1 md:p-0 shrink-0 select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Quick Inquiries
          </span>
          <div className="flex flex-wrap md:flex-col items-center md:items-end justify-center md:justify-end gap-1 max-w-xl md:max-w-[210px]">
            {QUICK_TOPICS.map((topic) => (
              <button
                key={topic.label}
                type="button"
                onClick={() => handleSelectTopic(topic)}
                disabled={isBusy}
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/75 hover:bg-white text-slate-500 hover:text-purple-700 hover:border-purple-300 border border-slate-200/70 backdrop-blur-xs font-medium transition-all shadow-2xs disabled:opacity-40 cursor-pointer text-right truncate max-w-[200px]"
              >
                {topic.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 hidden md:block mt-0.5 text-right">
            Tap button to stop/restart
          </p>
        </div>

        {/* Friendly Error Alert Banner if any */}
        <AnimatePresence>
          {friendlyError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 left-4 z-30 flex items-center justify-between gap-2 p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs max-w-sm shadow-sm"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{friendlyError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFriendlyError(null)}
                className="font-bold hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Exhibit Footer Bar with School Credentials */}
      <footer className="bg-white/90 border-t border-slate-200/70 px-4 py-2 text-center text-xs text-slate-500 flex items-center justify-between shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <span className="font-semibold text-slate-700">{MIMO_INFO.school}</span>
          <span>•</span>
          <span>Invenio Science Exhibition</span>
        </div>
        <div className="mx-auto sm:mx-0 text-slate-400 font-medium">
          Radius AI • Built by IT & Media Club for Invenio
        </div>
      </footer>
    </div>
  );
}

