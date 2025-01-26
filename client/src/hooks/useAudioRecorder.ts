import { useState, useCallback, useEffect } from 'react';
import {
  useSpeechDetection,
  SpeechRecognitionManager,
} from './useSpeechDetection';
import { SilenceDetector } from './useSilenceDetection';
import { WebSocketService } from '../services/WebSocketService';

export class AudioRecorderManager {
  private static instance: AudioRecorderManager;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private onSilenceCallback: (() => void) | null = null;
  private error: string | null = null;
  private onRecordingStateChange: (() => void) | null = null;
  private wsService: WebSocketService;

  private constructor() {
    this.wsService = WebSocketService.getInstance();
  }

  public static getInstance(): AudioRecorderManager {
    if (!AudioRecorderManager.instance) {
      AudioRecorderManager.instance = new AudioRecorderManager();
    }
    return AudioRecorderManager.instance;
  }

  public async startRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        console.log('Recording already in progress');
        return;
      }

      // Ensure WebSocket connection is established first
      this.wsService.connect();

      if (!this.stream) {
        console.log('Requesting microphone access...');
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        console.log('Microphone access granted');
      }

      const recorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk available:', event.data.size, 'bytes');
          // Send each chunk through WebSocket
          this.wsService.sendAudioChunk(event.data);
        }
      };

      console.log('Starting MediaRecorder...');
      recorder.start(250); // Send chunks every 250ms
      this.mediaRecorder = recorder;
      this.isRecording = true;
      this.error = null;
      this.onRecordingStateChange?.();
      console.log('Recording started successfully');
    } catch (err) {
      console.error('Failed to start recording:', err);
      this.error =
        'Failed to start recording: ' +
        (err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  public async stopRecording(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        console.log('No recording in progress');
        reject(new Error('No recording in progress'));
        return;
      }

      console.log('Stopping recording...');
      const handleStop = () => {
        this.mediaRecorder = null;
        this.isRecording = false;

        // Send end of audio signal
        console.log('Sending end-of-audio signal');
        this.wsService.sendEndOfAudio();

        // First notify about state change
        this.onRecordingStateChange?.();

        // Then resume recognition in the next tick
        setTimeout(() => {
          const speechManager = SpeechRecognitionManager.getInstance();
          speechManager.resumeAfterRecording();
        }, 0);

        console.log('Recording stopped successfully');
        resolve();
      };

      try {
        this.mediaRecorder.onstop = handleStop;
        // Request data before stopping
        this.mediaRecorder.requestData();
        // Small timeout to ensure data is collected
        setTimeout(() => {
          if (this.mediaRecorder) {
            this.mediaRecorder.stop();
          }
        }, 100);
      } catch (e) {
        console.error('Error stopping recording:', e);
        this.isRecording = false;
        reject(e);
      }
    });
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getError(): string | null {
    return this.error;
  }

  public cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.wsService.disconnect();
  }

  public setOnSilenceDetected(callback: () => void): void {
    this.onSilenceCallback = callback;
  }

  public handleSilenceDetected(): void {
    if (this.isRecording && this.onSilenceCallback) {
      this.onSilenceCallback();
    }
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public setOnRecordingStateChange(callback: () => void): void {
    this.onRecordingStateChange = callback;
  }

  public setOnTranscription(callback: (text: string) => void): void {
    this.wsService.setOnTranscription(callback);
  }

  public setOnResponse(callback: (text: string) => void): void {
    this.wsService.setOnResponse(callback);
  }

  public setOnError(callback: (error: string) => void): void {
    this.wsService.setOnError(callback);
  }
}

interface UseAudioRecorderProps {
  wakeWord?: string;
  autoStopOnSilence?: boolean;
  silenceThreshold?: number;
  silenceDuration?: number;
  onRecordingComplete?: (blob: Blob) => void;
  onWakeWordDetected?: () => void;
}

interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  isRecording: boolean;
  error: string | null;
  isListeningForWakeWord: boolean;
  startWakeWordDetection: () => void;
  stopWakeWordDetection: () => void;
}

export function useAudioRecorder({
  wakeWord = 'привет',
  autoStopOnSilence = true,
  silenceThreshold = -50,
  silenceDuration = 2000,
  onRecordingComplete,
  onWakeWordDetected,
}: UseAudioRecorderProps = {}): UseAudioRecorderReturn {
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const [isRecordingState, setIsRecordingState] = useState(false);
  const recorder = AudioRecorderManager.getInstance();
  const silenceDetector = SilenceDetector.getInstance();

  // Follow the recording state
  useEffect(() => {
    recorder.setOnRecordingStateChange(() => {
      setIsRecordingState(recorder.getIsRecording());
    });
  }, []);

  // Handle wake word detection
  useSpeechDetection({
    wakeWord,
    onWakeWordDetected: useCallback(() => {
      console.log('Wake word callback triggered:', {
        isListeningForWakeWord,
        isRecording: recorder.getIsRecording(),
      });

      if (isListeningForWakeWord && !recorder.getIsRecording()) {
        console.log('Starting recording after wake word...');
        onWakeWordDetected?.();
        recorder.startRecording();
      } else {
        console.log('Not starting recording:', {
          reason: !isListeningForWakeWord
            ? 'not listening for wake word'
            : 'already recording',
        });
      }
    }, [isListeningForWakeWord, onWakeWordDetected]),
    enabled: isListeningForWakeWord,
  });

  // Configure silence detection
  useEffect(() => {
    if (!autoStopOnSilence || !isRecordingState) {
      console.log('Stopping silence detection:', {
        autoStopOnSilence,
        isRecording: isRecordingState,
      });
      silenceDetector.stop();
      return;
    }

    const stream = recorder.getStream();
    if (!stream) {
      console.log('No stream available for silence detection');
      return;
    }

    console.log('Configuring silence detection:', {
      threshold: silenceThreshold,
      duration: silenceDuration,
      hasStream: !!stream,
    });

    silenceDetector.setConfig(silenceThreshold, silenceDuration);
    silenceDetector.setOnSilenceDetected(async () => {
      if (recorder.getIsRecording()) {
        console.log('Silence detected, stopping recording');
        try {
          await recorder.stopRecording();
          console.log('Recording stopped successfully after silence');
          onRecordingComplete?.(new Blob([]));
        } catch (error) {
          console.error('Failed to stop recording after silence:', error);
        }
      }
    });

    silenceDetector.start(stream);

    return () => {
      silenceDetector.stop();
    };
  }, [
    autoStopOnSilence,
    silenceThreshold,
    silenceDuration,
    isRecordingState,
    onRecordingComplete,
  ]);

  const startWakeWordDetection = useCallback(() => {
    console.log('Starting wake word detection');
    setIsListeningForWakeWord(true);
  }, []);

  const stopWakeWordDetection = useCallback(() => {
    console.log('Stopping wake word detection');
    setIsListeningForWakeWord(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      recorder.cleanup();
      silenceDetector.stop();
    };
  }, []);

  return {
    startRecording: () => recorder.startRecording(),
    stopRecording: () => recorder.stopRecording(),
    isRecording: recorder.getIsRecording(),
    error: recorder.getError(),
    isListeningForWakeWord,
    startWakeWordDetection,
    stopWakeWordDetection,
  };
}
