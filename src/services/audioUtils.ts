/**
 * Audio utilities for Mimo:
 * - 16kHz PCM recording & base64 encoding (for Gemini Live API input)
 * - 24kHz PCM playback & volume analysis (for Gemini Live API & TTS output)
 * - Web Speech Recognition for instant on-screen transcription
 */

// Convert Float32Array from AudioContext to 16-bit PCM ArrayBuffer
export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output.buffer;
}

// Convert ArrayBuffer to Base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to 16-bit PCM Float32Array for Web Audio playback
export function base64ToFloat32Array(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 16-bit signed integer little-endian
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

/**
 * Audio Queue Player for 24kHz PCM streaming playback
 */
export class LiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private onVolumeChange?: (volume: number) => void;
  private onStateChange?: (playing: boolean) => void;
  private activeSources: AudioBufferSourceNode[] = [];
  private endTimeout: any = null;

  constructor(callbacks?: {
    onVolume?: (vol: number) => void;
    onState?: (playing: boolean) => void;
  }) {
    this.onVolumeChange = callbacks?.onVolume;
    this.onStateChange = callbacks?.onState;
  }

  private initContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public playChunk(base64Pcm: string) {
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const float32Data = base64ToFloat32Array(base64Pcm);
      if (float32Data.length === 0) return;

      // Calculate chunk volume for mouth movement
      let sum = 0;
      for (let i = 0; i < float32Data.length; i++) {
        sum += Math.abs(float32Data[i]);
      }
      const avgVol = Math.min(1, (sum / float32Data.length) * 4);
      if (this.onVolumeChange) {
        this.onVolumeChange(avgVol);
      }

      // Create audio buffer at 24kHz
      const buffer = this.audioCtx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.push(source);

      if (!this.isPlaying) {
        this.isPlaying = true;
        this.onStateChange?.(true);
      }

      if (this.endTimeout) {
        clearTimeout(this.endTimeout);
      }

      const durationUntilEnd = (this.nextStartTime - currentTime) * 1000 + 150;
      this.endTimeout = setTimeout(() => {
        this.isPlaying = false;
        this.onStateChange?.(false);
        this.onVolumeChange?.(0);
        this.activeSources = [];
      }, durationUntilEnd);
    } catch (e) {
      console.error('Error playing audio chunk:', e);
    }
  }

  public stop() {
    try {
      if (this.endTimeout) clearTimeout(this.endTimeout);
      for (const src of this.activeSources) {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      }
      this.activeSources = [];
      this.isPlaying = false;
      this.nextStartTime = 0;
      this.onStateChange?.(false);
      this.onVolumeChange?.(0);
    } catch {
      // ignore
    }
  }

  public getContext(): AudioContext | null {
    return this.audioCtx;
  }
}

/**
 * Microphone Recorder capturing 16kHz PCM chunks
 */
export class MicRecorder {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onAudioChunk?: (base64Pcm: string) => void;
  private onVolumeChange?: (volume: number) => void;
  private isRecording: boolean = false;

  constructor(callbacks: {
    onChunk: (base64Pcm: string) => void;
    onVolume?: (vol: number) => void;
  }) {
    this.onAudioChunk = callbacks.onChunk;
    this.onVolumeChange = callbacks.onVolume;
  }

  public async start(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      this.mediaStream = stream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });

      this.source = this.audioCtx.createMediaStreamSource(stream);
      // ScriptProcessor buffer size 4096 gives smooth ~250ms chunks at 16kHz
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const channelData = e.inputBuffer.getChannelData(0);

        // Volume measurement
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        const volume = Math.min(1, rms * 5);
        this.onVolumeChange?.(volume);

        // Convert to 16-bit PCM and send
        const pcmBuffer = floatTo16BitPCM(channelData);
        const base64 = arrayBufferToBase64(pcmBuffer);
        this.onAudioChunk?.(base64);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start microphone recording:', err);
      return false;
    }
  }

  public stop() {
    this.isRecording = false;
    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
        this.processor = null;
      }
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
        this.audioCtx = null;
      }
      this.onVolumeChange?.(0);
    } catch {
      // ignore
    }
  }

  public isActive(): boolean {
    return this.isRecording;
  }
}
