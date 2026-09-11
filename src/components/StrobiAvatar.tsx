import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarState, MimoIntent, AvatarDefinition, ExpressionDefinition, AnimationDefinition } from '../types';
import strobiDefinitionRaw from '../avatar-definition.json';

const avatarDef = strobiDefinitionRaw as unknown as AvatarDefinition;

interface StrobiAvatarProps {
  state: AvatarState;
  inputVolume: number;
  outputVolume: number;
  latestIntent?: MimoIntent;
  currentExpressionOverride?: string;
  onExpressionChange?: (name: string) => void;
  sizeClassName?: string;
}

export const StrobiAvatar: React.FC<StrobiAvatarProps> = ({
  state,
  inputVolume,
  outputVolume,
  latestIntent,
  currentExpressionOverride,
  onExpressionChange,
  sizeClassName = 'w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[420px] lg:h-[420px] xl:w-[480px] xl:h-[480px]',
}) => {
  // Active animation key based on current AvatarState
  const activeAnimationKey = useMemo(() => {
    if (state === 'listening') return 'listening';
    if (state === 'thinking') return 'thinking';
    if (state === 'speaking') {
      if (latestIntent === 'off_topic' || latestIntent === 'unknown_specific') {
        return 'playful';
      }
      return 'happy';
    }
    if (state === 'error') return 'confused';
    return 'idle';
  }, [state, latestIntent]);

  const activeAnimation: AnimationDefinition = useMemo(() => {
    return avatarDef.animations[activeAnimationKey] || avatarDef.animations.idle;
  }, [activeAnimationKey]);

  // Current step in the animation sequence
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [showExpressionPicker, setShowExpressionPicker] = useState<boolean>(false);
  const [manualExpression, setManualExpression] = useState<string | null>(null);

  // Cycle animation steps based on activeAnimation.steps
  useEffect(() => {
    setStepIndex(0);
    const steps = activeAnimation.steps;
    if (!steps || steps.length === 0) return;

    let timeoutId: NodeJS.Timeout;

    const runStep = (idx: number) => {
      const currentStep = steps[idx % steps.length];
      const holdTime = currentStep.holdMs || 2500;

      timeoutId = setTimeout(() => {
        setStepIndex((prev) => {
          const next = (prev + 1) % steps.length;
          return next;
        });
        runStep((idx + 1) % steps.length);
      }, holdTime);
    };

    runStep(0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [activeAnimationKey, activeAnimation]);

  // Handle Natural Blinking based on activeAnimation.blink config
  useEffect(() => {
    const blinkConfig = activeAnimation.blink;
    if (!blinkConfig || !blinkConfig.enabled) return;

    let blinkTimeout: NodeJS.Timeout;
    let cancel = false;

    const scheduleNextBlink = (delay: number) => {
      blinkTimeout = setTimeout(() => {
        if (cancel) return;
        setIsBlinking(true);

        setTimeout(() => {
          if (cancel) return;
          setIsBlinking(false);

          // Schedule next blink randomly within min/max interval
          const nextInterval =
            blinkConfig.minIntervalMs +
            Math.random() * (blinkConfig.maxIntervalMs - blinkConfig.minIntervalMs);
          scheduleNextBlink(nextInterval);
        }, blinkConfig.durationMs || 240);
      }, delay);
    };

    scheduleNextBlink(blinkConfig.initialDelayMs || 2000);

    return () => {
      cancel = true;
      clearTimeout(blinkTimeout);
    };
  }, [activeAnimationKey, activeAnimation]);

  // Determine current active expression name
  const currentStep = activeAnimation.steps[stepIndex % activeAnimation.steps.length];
  const activeExpressionName =
    currentExpressionOverride ||
    manualExpression ||
    (currentStep ? currentStep.expression : 'neutral');

  const activeExpression: ExpressionDefinition =
    avatarDef.expressions[activeExpressionName] || avatarDef.expressions.neutral;

  useEffect(() => {
    if (onExpressionChange) {
      onExpressionChange(activeExpressionName);
    }
  }, [activeExpressionName, onExpressionChange]);

  // Head Orientation: convert pitch (x), yaw (y), roll (z) into 3D facial displacement
  const head = activeExpression.head || { x: 0, y: 0, z: 0 };

  // Yaw (y) moves face horizontally across sphere (approx 1.25px per degree)
  const faceOffsetX = head.y * 1.25;
  // Pitch (x) moves face vertically across sphere:
  // Strict upward/level policy: clamp pitch to >= 0 so Radius never looks or tilts downward
  const nonDownwardPitch = Math.max(0, head.x || 0);
  const faceOffsetY = -nonDownwardPitch * 1.25;
  // Roll (z) rotates the entire face
  const faceRotation = head.z || 0;

  // Eye geometry
  const leftEye = activeExpression.eyes.left;
  const rightEye = activeExpression.eyes.right;
  const spacing = activeExpression.eyes.spacing || 55;

  // Eye Centers relative to the face center (120, 120)
  // Clamp eye Y offset to <= 0 so eyes are strictly level or looking upward
  const leftEyeCenterX = -spacing / 2 + (leftEye.x || 0);
  const leftEyeCenterY = Math.min(0, leftEye.y || 0);

  const rightEyeCenterX = spacing / 2 + (rightEye.x || 0);
  const rightEyeCenterY = Math.min(0, rightEye.y || 0);

  // Speaking reactivity: mouthless minimalist character speaks through expressive sound-reactive pulse
  const isSpeaking = state === 'speaking';
  const speakScale = isSpeaking ? 1 + Math.min(outputVolume * 0.28, 0.22) : 1;
  const speakEyeScaleY = isSpeaking ? 1 + Math.min(outputVolume * 0.35, 0.3) : 1;

  // Motion effects:
  const motionType = activeExpression.motion || { eyes: 'none', body: 'none' };
  const isEyeShaking = motionType.eyes === 'shake';
  const isBodyShaking = motionType.body === 'shake';
  const isSlowDrift = motionType.body === 'slowDrift';

  // Body and Eye Colors (#C83CFB with black eye as requested)
  const bodyColor = '#C83CFB';
  const eyeColor = '#000000';

  return (
    <div className="flex flex-col items-center justify-center select-none w-full" id="radius-avatar-container">
      {/* Audio Reactive Outer Glow Waves & Sphere Stage */}
      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {state === 'idle' && (
            <motion.div
              key="idle-halo"
              className="absolute inset-[-10px] sm:inset-[-16px] rounded-full bg-purple-500/10 blur-2xl pointer-events-none"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: [0.2, 0.45, 0.2],
                scale: [0.98, 1.05, 0.98],
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                repeat: Infinity,
                duration: 3.6,
                ease: 'easeInOut',
              }}
            />
          )}

          {(state === 'listening' || state === 'speaking') && (
            <>
              <motion.div
                className="absolute inset-[-10px] sm:inset-[-16px] rounded-full border-2 border-purple-400/50 pointer-events-none"
                initial={{ scale: 0.95, opacity: 0.8 }}
                animate={{
                  scale: [0.95, 1.25],
                  opacity: [0.75, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: state === 'listening' ? 1.4 : 1.0,
                  ease: 'easeOut',
                }}
              />
              <motion.div
                className="absolute inset-[-18px] sm:inset-[-28px] rounded-full border border-fuchsia-400/40 pointer-events-none"
                initial={{ scale: 0.95, opacity: 0.6 }}
                animate={{
                  scale: [0.95, 1.45],
                  opacity: [0.55, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: state === 'listening' ? 1.8 : 1.2,
                  delay: 0.25,
                  ease: 'easeOut',
                }}
              />
            </>
          )}

          {state === 'thinking' && (
            <motion.div
              className="absolute inset-[-14px] sm:inset-[-20px] rounded-full border-2 border-dashed border-purple-400/60 pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
            />
          )}
        </AnimatePresence>

        {/* Sphere Contact Shadow: subtly scales & changes opacity with the levitating sphere */}
        <motion.div
          className="absolute -bottom-4 sm:-bottom-6 w-3/4 h-8 sm:h-10 bg-purple-950/25 rounded-full blur-lg pointer-events-none transform scale-y-50"
          animate={{
            scale: state === 'idle' ? [1, 0.88, 1] : 1,
            opacity: state === 'idle' ? [0.25, 0.16, 0.25] : 0.25,
          }}
          transition={{
            repeat: Infinity,
            duration: 3.6,
            ease: 'easeInOut',
          }}
        />

        {/* Mascot Main Sphere Body with subtle floating & pulsing animation in idle state */}
        <motion.div
          className={`relative ${sizeClassName} cursor-pointer drop-shadow-xl`}
          onClick={() => {
            if (manualExpression) {
              setManualExpression(null);
            }
          }}
          animate={{
            y:
              isBodyShaking
                ? [0, -3, 3, -2, 2, 0]
                : isSlowDrift
                ? [0, -5, 0]
                : state === 'speaking'
                ? [0, -5, 0]
                : state === 'listening'
                ? [0, -4, 0]
                : state === 'idle'
                ? [0, -9, 0]
                : [0, -4, 0],
            scale:
              state === 'speaking'
                ? speakScale
                : state === 'idle'
                ? [1, 1.026, 1]
                : 1,
          }}
          transition={{
            y: {
              repeat: Infinity,
              duration:
                isBodyShaking
                  ? 0.3
                  : isSlowDrift
                  ? 4.5
                  : state === 'speaking'
                  ? 0.65
                  : state === 'idle'
                  ? 3.6
                  : 3.0,
              ease: 'easeInOut',
            },
            scale:
              state === 'speaking'
                ? { duration: 0.15, ease: 'easeOut' }
                : state === 'idle'
                ? {
                    repeat: Infinity,
                    duration: 3.6,
                    ease: 'easeInOut',
                  }
                : { duration: 0.2 },
          }}
        >
          <svg
            viewBox="0 0 240 240"
            className="w-full h-full drop-shadow-xl overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* 3D Sphere Spherical Shader (#C83CFB vibrant violet/magenta) */}
              <radialGradient
                id="radiusSphereGrad"
                cx="36%"
                cy="30%"
                r="65%"
                fx="30%"
                fy="22%"
                gradientUnits="objectBoundingBox"
              >
                <stop offset="0%" stopColor="#f3bcff" />
                <stop offset="25%" stopColor={bodyColor} />
                <stop offset="76%" stopColor="#9a18ce" />
                <stop offset="100%" stopColor="#660a8e" />
              </radialGradient>

              {/* Sphere Ambient Occlusion & Subtle Rim Highlight */}
              <linearGradient id="radiusRimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="35%" stopColor="#ffffff" stopOpacity="0.06" />
                <stop offset="80%" stopColor="#3b074f" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#240331" stopOpacity="0.4" />
              </linearGradient>

              {/* Eye Pure Black Specular Highlight */}
              <linearGradient id="eyeGlossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#202020" />
                <stop offset="100%" stopColor="#000000" />
              </linearGradient>

              {/* Soft Inner Shadow */}
              <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity="0.3" floodColor="#3b074f" />
              </filter>
            </defs>

            {/* Primary Sphere Body (Diameter: 240, R: 120, centered at 120, 120) */}
            <circle
              cx="120"
              cy="120"
              r="116"
              fill="url(#radiusSphereGrad)"
              filter="url(#softShadow)"
            />

            {/* Subtle Surface Gloss / Rim Light Overlay */}
            <circle
              cx="120"
              cy="120"
              r="116"
              fill="url(#radiusRimGrad)"
              style={{ mixBlendMode: 'overlay' }}
            />

            {/* Soft Top Highlight Gleam */}
            <ellipse
              cx="86"
              cy="62"
              rx="44"
              ry="24"
              transform="rotate(-25 86 62)"
              fill="#ffffff"
              opacity="0.25"
              className="pointer-events-none"
            />

            {/* Face Container: Positioned on Sphere surface according to Head Yaw (y), Pitch (x), and Roll (z) */}
            <g
              transform={`translate(${120 + faceOffsetX}, ${120 + faceOffsetY}) rotate(${faceRotation})`}
              className={isEyeShaking ? 'animate-pulse' : ''}
              style={{
                transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {/* Left Eye (Solid Black) */}
              <g
                transform={`translate(${leftEyeCenterX}, ${leftEyeCenterY}) rotate(${leftEye.angle || 0})`}
                style={{
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {isBlinking ? (
                  // Blinking: Eye flattens to a subtle horizontal seam
                  <rect
                    x={-leftEye.width / 2}
                    y={-2}
                    width={leftEye.width}
                    height={4}
                    rx={2}
                    fill="#000000"
                  />
                ) : (
                  // Normal Eye Pill Capsule geometry in pure black
                  <rect
                    x={-leftEye.width / 2}
                    y={-(leftEye.height * speakEyeScaleY) / 2}
                    width={leftEye.width}
                    height={leftEye.height * speakEyeScaleY}
                    rx={Math.min(leftEye.width, leftEye.height * speakEyeScaleY) / 2}
                    fill="url(#eyeGlossGrad)"
                    style={{
                      transition: 'width 0.35s ease, height 0.35s ease, rx 0.35s ease',
                    }}
                  />
                )}
              </g>

              {/* Right Eye (Solid Black) */}
              <g
                transform={`translate(${rightEyeCenterX}, ${rightEyeCenterY}) rotate(${rightEye.angle || 0})`}
                style={{
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {isBlinking ? (
                  // Blinking: Eye flattens to a subtle horizontal seam
                  <rect
                    x={-rightEye.width / 2}
                    y={-2}
                    width={rightEye.width}
                    height={4}
                    rx={2}
                    fill="#000000"
                  />
                ) : (
                  // Normal Eye Pill Capsule geometry in pure black
                  <rect
                    x={-rightEye.width / 2}
                    y={-(rightEye.height * speakEyeScaleY) / 2}
                    width={rightEye.width}
                    height={rightEye.height * speakEyeScaleY}
                    rx={Math.min(rightEye.width, rightEye.height * speakEyeScaleY) / 2}
                    fill="url(#eyeGlossGrad)"
                    style={{
                      transition: 'width 0.35s ease, height 0.35s ease, rx 0.35s ease',
                    }}
                  />
                )}
              </g>
            </g>
          </svg>
        </motion.div>
      </div>
    </div>
  );
};

export const RadiusAvatar = StrobiAvatar;

