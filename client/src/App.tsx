import { useState, useEffect } from 'react';
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
    onRecordingComplete: async (audioBlob) => {
      console.log('Recording completed with size:', audioBlob.size);
      setLastRecording(audioBlob);
      setStatus('responding');
      setRecognizedText('Обработка...');

      try {
        await sendAudioToServer(audioBlob);
        startWakeWordDetection();
        setStatus('detecting');
        setRecognizedText('Ожидаю ключевое слово "привет"...');
      } catch (err) {
        setStatus('idle');
        setRecognizedText(
          `Ошибка: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
  });

  useEffect(() => {
    // Start wake word detection when component mounts
    startWakeWordDetection();
    setStatus('detecting');
    setRecognizedText('Ожидаю ключевое слово "привет"...');

    return () => {
      stopWakeWordDetection();
    };
  }, []); // Empty dependencies since we only want this to run once on mount

  useEffect(() => {
    if (isRecording) {
      setStatus('listening');
      setRecognizedText('Слушаю...');
    }
  }, [isRecording]);

  useEffect(() => {
    if (isListeningForWakeWord && !isRecording) {
      setStatus('detecting');
      setRecognizedText('Ожидаю ключевое слово "привет"...');
    }
  }, [isListeningForWakeWord, isRecording]);

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
      if (!isRecording) {
        if (isListeningForWakeWord) {
          // Stop wake word detection
          stopWakeWordDetection();
          setStatus('idle');
          setRecognizedText('');
        } else {
          // Start wake word detection
          startWakeWordDetection();
          setStatus('detecting');
          setRecognizedText('Ожидаю ключевое слово "привет"...');
        }
      } else {
        setStatus('responding');
        setRecognizedText('Обработка...');
        const audioBlob = await stopRecording();
        setLastRecording(audioBlob);

        await sendAudioToServer(audioBlob);

        // Return to wake word detection
        startWakeWordDetection();
        setStatus('detecting');
        setRecognizedText('Ожидаю ключевое слово "привет"...');
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
