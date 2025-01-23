import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { sendAudioToServer } from './services/api';

function VoiceIndicator({
  status,
}: {
  status: 'idle' | 'detecting' | 'listening' | 'responding';
}) {
  return (
    <div
      className={`voice-indicator ${status}`}
      aria-label={`Voice assistant is ${status}`}
    />
  );
}

function App() {
  const [status, setStatus] = useState<
    'idle' | 'detecting' | 'listening' | 'responding'
  >('idle');
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [lastRecording, setLastRecording] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const activationSound = new Audio('/src/assets/sounds/beep.wav');

  const playActivationSound = useCallback(() => {
    activationSound.play().catch(console.error);
  }, []);

  const setWakeWordDetectionState = (isDetecting: boolean) => {
    if (isDetecting) {
      setStatus('detecting');
      setRecognizedText('Ожидаю ключевое слово "привет"...');
    } else {
      setStatus('idle');
      setRecognizedText('');
    }
  };

  const {
    stopRecording,
    isRecording,
    error,
    isListeningForWakeWord,
    startWakeWordDetection,
    stopWakeWordDetection,
  } = useAudioRecorder({
    wakeWord: 'привет',
    autoStopOnSilence: true,
    silenceThreshold: -50,
    silenceDuration: 2000,
    onWakeWordDetected: playActivationSound,
    onRecordingComplete: async (audioBlob) => {
      console.log('Recording completed with size:', audioBlob.size);
      setLastRecording(audioBlob);
      setStatus('responding');
      setRecognizedText('Обработка...');

      try {
        await sendAudioToServer(audioBlob);
        startWakeWordDetection();
        setWakeWordDetectionState(true);
      } catch (err) {
        setStatus('idle');
        setRecognizedText(
          `Ошибка: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
  });

  useEffect(() => {
    startWakeWordDetection();
    setWakeWordDetectionState(true);

    return () => {
      stopWakeWordDetection();
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      setStatus('listening');
      setRecognizedText('Слушаю...');
    }
  }, [isRecording]);

  useEffect(() => {
    if (lastRecording) {
      const url = URL.createObjectURL(lastRecording);
      setAudioUrl(url);
      console.log('Created new audio URL:', url, 'for blob:', lastRecording);
      return () => {
        URL.revokeObjectURL(url);
        console.log('Revoked audio URL:', url);
      };
    }
  }, [lastRecording]);

  const handleIndicatorClick = async () => {
    try {
      if (isRecording) {
        setStatus('responding');
        setRecognizedText('Обработка...');
        const audioBlob = await stopRecording();
        setLastRecording(audioBlob);
        await sendAudioToServer(audioBlob);
        startWakeWordDetection();
        setWakeWordDetectionState(true);
      } else {
        if (isListeningForWakeWord) {
          stopWakeWordDetection();
          setWakeWordDetectionState(false);
        } else {
          startWakeWordDetection();
          setWakeWordDetectionState(true);
        }
      }
    } catch (err) {
      setStatus('idle');
      setRecognizedText(
        `Ошибка: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  return (
    <div className="app-container">
      <div className="voice-container">
        <button
          className="voice-button"
          onClick={handleIndicatorClick}
          aria-label="Toggle voice input"
        >
          <VoiceIndicator status={status} />
        </button>
        {(recognizedText || error) && (
          <p className="recognized-text">{error || recognizedText}</p>
        )}
        <div className="audio-player">
          <audio key={audioUrl} src={audioUrl} controls />
          {lastRecording && (
            <div className="debug-info">
              Size: {(lastRecording.size / 1024).toFixed(1)}KB Type:{' '}
              {lastRecording.type}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
