import { useEffect, useRef } from 'react';

// Add type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface Window {
  webkitSpeechRecognition: {
    new (): SpeechRecognition;
  };
}

export class SpeechRecognitionManager {
  private static instance: SpeechRecognitionManager;
  private recognition: SpeechRecognition | null = null;
  private isRunning = false;
  private onWakeWordCallback: ((word: string) => void) | null = null;
  private wakeWord: string = '';
  private enabled = false;
  private pendingCallback: (() => void) | null = null;

  private constructor() {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Speech recognition is not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as unknown as Window)
      .webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    const recognition = this.recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase().trim();
      console.log('Recognition result:', transcript);

      if (
        this.enabled &&
        this.wakeWord &&
        transcript.includes(this.wakeWord.toLowerCase())
      ) {
        console.log('Wake word detected!');
        this.stop();
        this.setEnabled(false);
        this.pendingCallback = () => this.onWakeWordCallback?.(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('Recognition error occurred:', event.error);
      this.isRunning = false;
      if (this.enabled) {
        console.log('Attempting to restart after error...');
        setTimeout(() => this.start(), 1000);
      }
    };

    recognition.onend = () => {
      console.log('Recognition ended, enabled:', this.enabled);
      this.isRunning = false;

      if (this.pendingCallback) {
        const callback = this.pendingCallback;
        this.pendingCallback = null;
        callback();
      } else if (this.enabled) {
        console.log('Attempting to restart recognition...');
        setTimeout(() => this.start(), 100);
      } else {
        console.log('Not restarting - recognition disabled');
      }
    };

    console.log('Speech recognition initialized successfully');
  }

  public static getInstance(): SpeechRecognitionManager {
    if (!SpeechRecognitionManager.instance) {
      SpeechRecognitionManager.instance = new SpeechRecognitionManager();
    }
    return SpeechRecognitionManager.instance;
  }

  public start(): void {
    if (!this.recognition || this.isRunning || !this.enabled) return;

    try {
      this.recognition.start();
      this.isRunning = true;
      console.log('Recognition started successfully');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      this.isRunning = false;
    }
  }

  public stop(): void {
    if (!this.recognition || !this.isRunning) return;

    try {
      this.recognition.stop();
      this.isRunning = false;
      console.log('Recognition stopped successfully');
    } catch (e) {
      console.error('Failed to stop recognition:', e);
    }
  }

  public setEnabled(enabled: boolean): void {
    const wasEnabled = this.enabled;
    this.enabled = enabled;

    if (!wasEnabled && enabled) {
      this.start();
    } else if (wasEnabled && !enabled) {
      this.stop();
    }
  }

  public setWakeWord(word: string): void {
    this.wakeWord = word;
  }

  public setOnWakeWord(callback: (word: string) => void): void {
    this.onWakeWordCallback = callback;
  }

  public resumeAfterRecording(): void {
    this.setEnabled(true);
    this.start();
  }
}

interface UseSpeechDetectionProps {
  wakeWord: string;
  onWakeWordDetected: () => void;
  enabled: boolean;
}

export function useSpeechDetection({
  wakeWord,
  onWakeWordDetected,
  enabled,
}: UseSpeechDetectionProps) {
  const manager = useRef<SpeechRecognitionManager>(
    SpeechRecognitionManager.getInstance()
  );

  useEffect(() => {
    const speechManager = manager.current;

    speechManager.setWakeWord(wakeWord);
    speechManager.setOnWakeWord(() => onWakeWordDetected());
    speechManager.setEnabled(enabled);

    return () => {
      if (enabled) {
        speechManager.setEnabled(false);
      }
    };
  }, [enabled, wakeWord, onWakeWordDetected]);
}
