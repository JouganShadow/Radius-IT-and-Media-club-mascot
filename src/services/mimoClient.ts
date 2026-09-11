import { AvatarState, ConnectionStatus, TranscriptItem } from '../types';
import { LiveAudioPlayer, MicRecorder } from './audioUtils';

export interface MimoClientOptions {
  onAvatarStateChange: (state: AvatarState) => void;
  onTranscriptUpdate: (transcripts: TranscriptItem[]) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
  onVolumeChange: (inputVolume: number, outputVolume: number) => void;
  onError: (friendlyMsg: string) => void;
}

export class MimoClient {
  private ws: WebSocket | null = null;
  private audioPlayer: LiveAudioPlayer;
  private micRecorder: MicRecorder | null = null;
  private options: MimoClientOptions;
  private connectionStatus: ConnectionStatus = 'connecting';
  private avatarState: AvatarState = 'idle';
  private transcripts: TranscriptItem[] = [];
  private currentModelTranscript = '';
  private currentUserTranscript = '';
  private isTalking: boolean = false;
  private speechRecognizer: any = null;
  private inputVolume: number = 0;
  private outputVolume: number = 0;

  constructor(options: MimoClientOptions) {
    this.options = options;

    this.audioPlayer = new LiveAudioPlayer({
      onVolume: (vol) => {
        this.outputVolume = vol;
        this.options.onVolumeChange(this.inputVolume, this.outputVolume);
      },
      onState: (playing) => {
        if (playing) {
          this.setAvatarState('speaking');
        } else {
          // Finished speaking
          if (!this.isTalking && this.avatarState === 'speaking') {
            this.setAvatarState('idle');
          }
        }
      },
    });

    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.speechRecognizer = new SpeechRecognitionClass();
        this.speechRecognizer.continuous = true;
        this.speechRecognizer.interimResults = true;
        this.speechRecognizer.lang = 'en-US';

        this.speechRecognizer.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }
          const activeText = final || interim;
          if (activeText.trim()) {
            this.currentUserTranscript = activeText.trim();
            this.updateUserTranscript(activeText.trim(), !final);
          }
        };

        this.speechRecognizer.onerror = (e: any) => {
          console.warn('Web Speech recognition warning:', e?.error);
        };
      }
    } catch (e) {
      console.warn('Web Speech API not supported:', e);
    }
  }

  public connect() {
    this.options.onConnectionChange('connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[MimoClient] WebSocket connected to Gemini Live bridge');
        this.connectionStatus = 'connected';
        this.options.onConnectionChange('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            this.connectionStatus = 'connected';
            this.options.onConnectionChange('connected');
          } else if (msg.type === 'audio' && msg.audio) {
            this.audioPlayer.playChunk(msg.audio);
          } else if (msg.type === 'transcript_user' && msg.text) {
            this.updateUserTranscript(msg.text, false);
          } else if (msg.type === 'transcript_model' && msg.text) {
            this.appendModelTranscript(msg.text);
          } else if (msg.type === 'interrupted') {
            this.audioPlayer.stop();
            this.setAvatarState('idle');
          } else if (msg.type === 'turn_complete') {
            if (this.currentModelTranscript) {
              this.finalizeModelTranscript();
            }
          } else if (msg.type === 'error') {
            this.options.onError(msg.message || "Mimo's taking a quick breath — try again!");
            if (msg.fallback) {
              this.connectionStatus = 'fallback';
              this.options.onConnectionChange('fallback');
            }
          }
        } catch (e) {
          console.error('[MimoClient] Error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[MimoClient] WebSocket closed, using fallback mode');
        if (this.connectionStatus !== 'error') {
          this.connectionStatus = 'fallback';
          this.options.onConnectionChange('fallback');
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[MimoClient] WebSocket error, switching to fallback mode:', err);
        this.connectionStatus = 'fallback';
        this.options.onConnectionChange('fallback');
      };
    } catch (e) {
      console.warn('[MimoClient] WebSocket init failed, fallback mode active:', e);
      this.connectionStatus = 'fallback';
      this.options.onConnectionChange('fallback');
    }
  }

  public async startTalking(): Promise<boolean> {
    this.audioPlayer.stop();
    this.isTalking = true;
    this.currentUserTranscript = '';
    this.setAvatarState('listening');

    // Start Web Speech if available
    try {
      this.speechRecognizer?.start();
    } catch {
      // recognition already active or not allowed
    }

    // Initialize mic recorder for 16kHz PCM chunks
    this.micRecorder = new MicRecorder({
      onChunk: (base64Pcm) => {
        if (this.isTalking && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
        }
      },
      onVolume: (vol) => {
        this.inputVolume = vol;
        this.options.onVolumeChange(this.inputVolume, this.outputVolume);
      },
    });

    const success = await this.micRecorder.start();
    if (!success) {
      this.setAvatarState('idle');
      this.isTalking = false;
      this.options.onError('Please allow microphone access to talk with Mimo!');
      return false;
    }

    return true;
  }

  public async stopTalking() {
    this.isTalking = false;

    this.micRecorder?.stop();
    this.micRecorder = null;
    this.inputVolume = 0;
    this.options.onVolumeChange(0, 0);

    try {
      this.speechRecognizer?.stop();
    } catch {
      // ignore
    }

    this.audioPlayer.stop();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.setAvatarState('idle');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupted' }));
    }
  }

  public async sendTextMessage(text: string) {
    if (!text.trim()) return;
    this.audioPlayer.stop();
    this.updateUserTranscript(text.trim(), false);
    this.setAvatarState('thinking');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text: text.trim() }));
      this.ws.send(JSON.stringify({ type: 'end_turn' }));
    } else {
      await this.sendFallbackPrompt(text.trim());
    }
  }

  private async sendFallbackPrompt(userText: string) {
    try {
      const history = this.transcripts.slice(-6).map((t) => ({
        role: t.sender === 'user' ? 'user' : 'model',
        text: t.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history }),
      });

      if (!res.ok) {
        throw new Error('Chat API returned error');
      }

      const data = await res.json();
      const reply = data.replyText;

      this.appendModelTranscript(reply, data.intent, data.suggestedPivots);
      this.finalizeModelTranscript();

      if (data.audioBase64) {
        this.audioPlayer.playChunk(data.audioBase64);
      } else {
        // Browser SpeechSynthesis fallback
        this.speakWithBrowserSynth(reply);
      }
    } catch (e: any) {
      console.error('[MimoClient] Fallback error:', e);
      this.setAvatarState('error');
      this.options.onError("Mimo's taking a quick breath — try again!");
      setTimeout(() => {
        if (this.avatarState === 'error') {
          this.setAvatarState('idle');
        }
      }, 3500);
    }
  }

  private speakWithBrowserSynth(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.15; // friendly junior mascot tone

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Bad'));
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onstart = () => this.setAvatarState('speaking');
      utterance.onend = () => this.setAvatarState('idle');
      utterance.onerror = () => this.setAvatarState('idle');

      window.speechSynthesis.speak(utterance);
    } else {
      this.setAvatarState('idle');
    }
  }

  private updateUserTranscript(text: string, isStreaming: boolean) {
    const existingIndex = this.transcripts.findIndex((t) => t.isStreaming && t.sender === 'user');
    if (existingIndex >= 0) {
      this.transcripts[existingIndex].text = text;
      this.transcripts[existingIndex].isStreaming = isStreaming;
    } else {
      this.transcripts.push({
        id: 'u-' + Date.now(),
        sender: 'user',
        text,
        timestamp: Date.now(),
        isStreaming,
      });
    }
    this.options.onTranscriptUpdate([...this.transcripts]);
  }

  private appendModelTranscript(chunk: string, intent?: any, suggestedPivots?: string[]) {
    this.currentModelTranscript += chunk;
    const existingIndex = this.transcripts.findIndex((t) => t.isStreaming && t.sender === 'mimo');

    if (existingIndex >= 0) {
      this.transcripts[existingIndex].text = this.currentModelTranscript;
      if (intent) this.transcripts[existingIndex].intent = intent;
      if (suggestedPivots) this.transcripts[existingIndex].suggestedPivots = suggestedPivots;
    } else {
      this.transcripts.push({
        id: 'm-' + Date.now(),
        sender: 'mimo',
        text: this.currentModelTranscript,
        timestamp: Date.now(),
        isStreaming: true,
        intent,
        suggestedPivots,
      });
    }
    this.options.onTranscriptUpdate([...this.transcripts]);
  }

  private finalizeModelTranscript() {
    const existingIndex = this.transcripts.findIndex((t) => t.isStreaming && t.sender === 'mimo');
    if (existingIndex >= 0) {
      this.transcripts[existingIndex].isStreaming = false;
      const text = this.transcripts[existingIndex].text.toLowerCase();
      if (!this.transcripts[existingIndex].intent) {
        if (
          text.includes('honest') ||
          text.includes("don't have that specific") ||
          text.includes('memory bank') ||
          text.includes('confidential') ||
          text.includes('official inquiries')
        ) {
          this.transcripts[existingIndex].intent = 'unknown_specific';
          this.transcripts[existingIndex].suggestedPivots = [
            'Tell me about the IT & Media Club',
            'What makes YSIS special?',
            'What clubs can I join?',
          ];
        } else if (
          text.includes('cheerful') ||
          text.includes('cheeky') ||
          text.includes('school timetable') ||
          text.includes('friendly for everyone')
        ) {
          this.transcripts[existingIndex].intent = 'inappropriate';
          this.transcripts[existingIndex].suggestedPivots = [
            'Tell me about robotics at YSIS',
            'What clubs can I join?',
            'What makes YSIS special?',
          ];
        } else if (
          text.includes('main mission') ||
          text.includes('circuits are dedicated') ||
          text.includes('super interesting') ||
          text.includes('quest today')
        ) {
          this.transcripts[existingIndex].intent = 'off_topic';
          this.transcripts[existingIndex].suggestedPivots = [
            'What clubs does YSIS have?',
            'Tell me about the IT & Media Club',
            'Tell me about robotics at YSIS',
          ];
        }
      }
    }
    this.currentModelTranscript = '';
    this.options.onTranscriptUpdate([...this.transcripts]);
  }

  public resetConversation() {
    this.audioPlayer.stop();
    this.micRecorder?.stop();
    this.micRecorder = null;
    this.isTalking = false;
    this.currentModelTranscript = '';
    this.currentUserTranscript = '';
    this.transcripts = [];
    this.options.onTranscriptUpdate([]);
    this.setAvatarState('idle');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reset' }));
    }
  }

  private setAvatarState(state: AvatarState) {
    this.avatarState = state;
    this.options.onAvatarStateChange(state);
  }

  public getAvatarState(): AvatarState {
    return this.avatarState;
  }

  public destroy() {
    this.audioPlayer.stop();
    this.micRecorder?.stop();
    try {
      this.speechRecognizer?.stop();
    } catch {
      // ignore
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
