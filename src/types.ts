export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type MicStatus = 'prompt' | 'granted' | 'denied' | 'recording';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'fallback' | 'error';

export type MimoIntent = 'school_query' | 'off_topic' | 'inappropriate' | 'unknown_specific' | 'greeting';

export interface TranscriptItem {
  id: string;
  sender: 'user' | 'mimo';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  intent?: MimoIntent;
  suggestedPivots?: string[];
}

export interface QuickTopic {
  label: string;
  prompt: string;
  category: 'clubs' | 'school' | 'values' | 'guardrail_test';
  iconName?: string;
}

export interface EyeGeometry {
  width: number;
  height: number;
  x: number;
  y: number;
  angle: number;
}

export interface ExpressionDefinition {
  head: {
    x: number;
    y: number;
    z: number;
  };
  eyes: {
    left: EyeGeometry;
    right: EyeGeometry;
    spacing: number;
  };
  perspective?: number;
  motion?: {
    eyes: 'none' | 'shake';
    body: 'none' | 'shake' | 'slowDrift';
  };
  colors?: {
    body?: string;
    eyes?: string;
  };
}

export interface AnimationStep {
  expression: string;
  holdMs: number;
  transitionMs: number;
  transition?: string;
}

export interface AnimationBlink {
  enabled: boolean;
  initialDelayMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  durationMs: number;
}

export interface AnimationDefinition {
  playbackMode: 'loop' | 'once';
  steps: AnimationStep[];
  blink?: AnimationBlink;
  metadata?: {
    label: string;
    description: string;
    group: string;
  };
}

export interface AvatarDefinition {
  schema: string;
  schemaVersion: number;
  name: string;
  body: {
    primary: {
      type: string;
      width: number;
      height: number;
      depth: number;
      roundness: number;
    };
    nodes?: any[];
  };
  colors: {
    body: string;
    eyes: string;
  };
  expressions: Record<string, ExpressionDefinition>;
  expressionOrder: string[];
  animations: Record<string, AnimationDefinition>;
  animationOrder: string[];
}

