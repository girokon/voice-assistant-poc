import { useState, useCallback, useEffect } from 'react';
import {
  useSpeechDetection,
  SpeechRecognitionManager,
} from './useSpeechDetection';
import { SilenceDetector } from './useSilenceDetection';

export class AudioRecorderManager {
  private static instance: AudioRecorderManager;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private onSilenceCallback: (() => void) | null = null;
  private error: string | null = null;
  private onRecordingStateChange: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): AudioRecorderManager {
    if (!AudioRecorderManager.instance) {
      AudioRecorderManager.instance = new AudioRecorderManager();
    }
    return AudioRecorderManager.instance;
  }

  public async startRecording(): Promise<void> {
    try {
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }

      const recorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.start(250);
      this.mediaRecorder = recorder;
      this.isRecording = true;
      this.error = null;
      this.audioChunks = [];
      this.onRecordingStateChange?.();
    } catch (err) {
      this.error =
        'Failed to start recording: ' +
        (err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  public async stopRecording(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      const handleStop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: 'audio/webm;codecs=opus',
        });

        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;

        // First notify about state change
        this.onRecordingStateChange?.();

        // Then resume recognition in the next tick
        setTimeout(() => {
          const speechManager = SpeechRecognitionManager.getInstance();
          speechManager.resumeAfterRecording();
        }, 0);

        resolve(audioBlob);
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
  stopRecording: () => Promise<Blob>;
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
          const audioBlob = await recorder.stopRecording();
          console.log('Recording stopped successfully after silence', {
            blobSize: audioBlob.size,
          });
          onRecordingComplete?.(audioBlob);
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
