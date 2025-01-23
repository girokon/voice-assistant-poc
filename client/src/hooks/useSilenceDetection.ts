import { useEffect } from 'react';

export class SilenceDetector {
  private static instance: SilenceDetector;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private silenceTimer: number | null = null;
  private onSilenceCallback: (() => void) | null = null;
  private silenceThreshold: number = -50;
  private silenceDuration: number = 2000;
  private isEnabled: boolean = false;

  private constructor() {}

  public static getInstance(): SilenceDetector {
    if (!SilenceDetector.instance) {
      SilenceDetector.instance = new SilenceDetector();
    }
    return SilenceDetector.instance;
  }

  public setConfig(threshold: number, duration: number): void {
    console.log('Setting silence config:', { threshold, duration });
    this.silenceThreshold = threshold;
    this.silenceDuration = duration;
  }

  public setOnSilenceDetected(callback: () => void): void {
    console.log('Setting silence callback');
    this.onSilenceCallback = callback;
  }

  public start(stream: MediaStream): void {
    console.log('Attempting to start silence detection');
    if (!stream) {
      console.log('No stream provided, cannot start');
      return;
    }
    if (this.isEnabled) {
      console.log('Silence detection already running');
      return;
    }

    this.isEnabled = true;
    this.setupAudioAnalysis(stream);
  }

  public stop(): void {
    console.log('Attempting to stop silence detection');
    if (!this.isEnabled) {
      console.log('Silence detection was not running');
      return;
    }

    this.isEnabled = false;
    this.cleanup();
    console.log('Silence detection stopped');
  }

  private setupAudioAnalysis(stream: MediaStream): void {
    console.log('Setting up audio analysis');
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      console.log('Audio analysis setup complete', {
        sampleRate: this.audioContext.sampleRate,
        fftSize: this.analyser.fftSize,
        bufferLength,
      });

      this.startAnalysis();
    } catch (error) {
      console.error('Failed to setup audio analysis:', error);
    }
  }

  private startAnalysis(): void {
    console.log('Starting audio analysis');
    if (!this.analyser || !this.dataArray || !this.isEnabled) {
      console.log('Cannot start analysis:', {
        hasAnalyser: !!this.analyser,
        hasDataArray: !!this.dataArray,
        isEnabled: this.isEnabled,
      });
      return;
    }

    let silenceStart: number | null = null;
    let lastLogTime = 0;
    const LOG_INTERVAL = 1000;

    const analyze = () => {
      if (!this.isEnabled || !this.analyser || !this.dataArray) {
        console.log('Analysis stopped due to:', {
          isEnabled: this.isEnabled,
          hasAnalyser: !!this.analyser,
          hasDataArray: !!this.dataArray,
        });
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray);
      const average = this.getAverageVolume(this.dataArray);
      const volume = 20 * Math.log10(average / 255); // Convert to dB

      const now = Date.now();
      if (now - lastLogTime > LOG_INTERVAL) {
        console.log('Current audio stats:', {
          averageVolume: average,
          volumeDb: volume,
          isSilent: volume < this.silenceThreshold,
          silenceDuration: silenceStart ? now - silenceStart : 0,
        });
        lastLogTime = now;
      }

      if (volume < this.silenceThreshold) {
        if (silenceStart === null) {
          console.log('Silence started');
          silenceStart = now;
        } else if (now - silenceStart >= this.silenceDuration) {
          console.log('Silence threshold reached, triggering callback');
          this.onSilenceCallback?.();
          silenceStart = null;
          return;
        }
      } else {
        if (silenceStart !== null) {
          console.log('Silence broken after', now - silenceStart, 'ms');
          silenceStart = null;
        }
      }

      requestAnimationFrame(analyze);
    };

    requestAnimationFrame(analyze);
  }

  private getAverageVolume(array: Uint8Array): number {
    const length = array.length;
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += array[i];
    }
    return sum / length;
  }

  private cleanup(): void {
    console.log('Cleaning up silence detector');
    if (this.silenceTimer) {
      console.log('Clearing silence timer');
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.audioContext) {
      console.log('Closing audio context');
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
    console.log('Cleanup complete');
  }
}

interface UseSilenceDetectionProps {
  stream: MediaStream | null;
  onSilenceDetected: () => void;
  silenceThreshold: number;
  silenceDuration: number;
}

export function useSilenceDetection({
  stream,
  onSilenceDetected,
  silenceThreshold,
  silenceDuration,
}: UseSilenceDetectionProps): void {
  useEffect(() => {
    const detector = SilenceDetector.getInstance();
    detector.setConfig(silenceThreshold, silenceDuration);
    detector.setOnSilenceDetected(onSilenceDetected);

    if (stream) {
      detector.start(stream);
    } else {
      detector.stop();
    }

    return () => {
      detector.stop();
    };
  }, [stream, onSilenceDetected, silenceThreshold, silenceDuration]);
}
