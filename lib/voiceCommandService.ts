/**
 * Voice Command Service — global wake-word detection and intent routing
 *
 * Features:
 * - Unified speech recognition across the system
 * - Wake-word detection ("Hey Jackie", "Jackie", etc.)
 * - Intent routing to app launch, automation trigger, or dictation
 * - Multi-language support (en-US, zh-CN)
 */

import { bus } from './bus';
import { automationEngine } from './automation';

export interface VoiceCommand {
  id: string;
  keyword: string;
  intent: 'launch_app' | 'trigger_automation' | 'dictate';
  payload?: Record<string, any>;
  enabled: boolean;
}

export interface VoiceSession {
  isActive: boolean;
  isListening: boolean;
  transcript: string;
  confidence: number;
  language: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

class VoiceCommandService {
  private recognition: any = null;
  private session: VoiceSession = {
    isActive: false,
    isListening: false,
    transcript: '',
    confidence: 0,
    language: 'en-US',
  };
  private commands: Map<string, VoiceCommand> = new Map();
  private wakeWords: string[] = ['hey jackie', 'jackie', 'ok jackie'];
  private isWoken: boolean = false;
  private commandTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeRecognition();
    this.loadCommands();
  }

  /**
   * Initialize speech recognition
   */
  private initializeRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[voiceCommandService] Speech Recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.language = this.session.language;

    this.recognition.onstart = () => {
      this.session.isListening = true;
      bus.emit('voice-state-changed', { state: 'listening' });
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          this.session.transcript = transcript.toLowerCase();
          this.session.confidence = confidence;
          isFinal = true;
        } else {
          interimTranscript += transcript;
        }
      }

      if (isFinal) {
        this.handleTranscript(this.session.transcript, this.session.confidence);
      }

      bus.emit('voice-transcript', {
        interim: interimTranscript,
        final: isFinal ? this.session.transcript : '',
        confidence: this.session.confidence,
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('[voiceCommandService] Error:', event.error);
      bus.emit('voice-error', { error: event.error });
    };

    this.recognition.onend = () => {
      this.session.isListening = false;
      if (this.session.isActive) {
        // Auto-restart if still active
        this.startListening();
      } else {
        bus.emit('voice-state-changed', { state: 'stopped' });
      }
    };
  }

  /**
   * Start listening for voice commands
   */
  public startListening(): void {
    if (!this.recognition) {
      console.warn('[voiceCommandService] Speech Recognition not available');
      return;
    }

    if (this.session.isActive) return;

    this.session.isActive = true;
    this.session.transcript = '';
    this.isWoken = false;

    try {
      this.recognition.start();
      bus.emit('voice-state-changed', { state: 'active' });
    } catch (e) {
      console.error('[voiceCommandService] Failed to start:', e);
    }
  }

  /**
   * Stop listening
   */
  public stopListening(): void {
    this.session.isActive = false;
    this.isWoken = false;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Already stopped
      }
    }

    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = null;
    }

    bus.emit('voice-state-changed', { state: 'stopped' });
  }

  /**
   * Handle recognized transcript
   */
  private handleTranscript(transcript: string, confidence: number): void {
    // Check for wake word
    if (!this.isWoken) {
      const foundWakeWord = this.wakeWords.some(ww => transcript.includes(ww));
      if (foundWakeWord) {
        this.isWoken = true;
        bus.emit('voice-woken', { transcript, confidence });

        // Listen for command in next 5 seconds
        if (this.commandTimeout) clearTimeout(this.commandTimeout);
        this.commandTimeout = setTimeout(() => {
          this.isWoken = false;
        }, 5000);
        return;
      }
      return;
    }

    // We're awoken, try to match a command
    const command = this.matchCommand(transcript);
    if (command) {
      this.executeCommand(command, transcript);
    } else {
      // Try to interpret as dictation for focused app
      bus.emit('voice-dictate', { text: transcript });
    }

    this.isWoken = false;
  }

  /**
   * Match transcript to a registered command
   */
  private matchCommand(transcript: string): VoiceCommand | null {
    for (const cmd of this.commands.values()) {
      if (!cmd.enabled) continue;

      // Simple keyword matching (can be enhanced with fuzzy matching)
      if (transcript.includes(cmd.keyword)) {
        return cmd;
      }
    }
    return null;
  }

  /**
   * Execute a matched command
   */
  private executeCommand(command: VoiceCommand, transcript: string): void {
    switch (command.intent) {
      case 'launch_app':
        bus.emit('launch-app', { appId: command.payload?.appId });
        break;

      case 'trigger_automation':
        // Find and run automation rule
        const ruleId = command.payload?.ruleId;
        if (ruleId) {
          // Trigger automation (would need to wire to automationEngine)
          bus.emit('automation-trigger', { ruleId });
        }
        break;

      case 'dictate':
        bus.emit('voice-dictate', { text: transcript });
        break;
    }

    bus.emit('voice-command-executed', {
      commandId: command.id,
      keyword: command.keyword,
      transcript,
      intent: command.intent,
    });
  }

  /**
   * Register a voice command
   */
  public registerCommand(cmd: Omit<VoiceCommand, 'id'>): VoiceCommand {
    const id = `voicecmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullCmd: VoiceCommand = { ...cmd, id };
    this.commands.set(id, fullCmd);
    return fullCmd;
  }

  /**
   * Get all commands
   */
  public getCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Remove a command
   */
  public removeCommand(id: string): boolean {
    return this.commands.delete(id);
  }

  /**
   * Get current session state
   */
  public getSession(): VoiceSession {
    return { ...this.session };
  }

  /**
   * Set wake words
   */
  public setWakeWords(words: string[]): void {
    this.wakeWords = words.map(w => w.toLowerCase());
  }

  /**
   * Get wake words
   */
  public getWakeWords(): string[] {
    return [...this.wakeWords];
  }

  /**
   * Change language
   */
  public setLanguage(lang: string): void {
    this.session.language = lang;
    if (this.recognition) {
      this.recognition.language = lang;
    }
  }

  /**
   * Private methods
   */
  private loadCommands(): void {
    // Load saved commands from storage if available
    // For now, start with empty
  }
}

export const voiceCommandService = new VoiceCommandService();
