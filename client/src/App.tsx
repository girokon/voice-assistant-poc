import { useState } from 'react';
import './App.css';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { sendAudioToServer } from './services/api';

function VoiceIndicator({
  status,
}: {
  status: 'idle' | 'listening' | 'responding';
}) {
  return (
    <div
      className={`voice-indicator ${status}`}
      aria-label={`Voice assistant is ${status}`}
    />
  );
}

function App() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'responding'>(
    'idle'
  );
  const [recognizedText, setRecognizedText] = useState<string>('');
  const { startRecording, stopRecording, isRecording, error } =
    useAudioRecorder();

  const handleIndicatorClick = async () => {
    try {
      if (!isRecording) {
        await startRecording();
        setStatus('listening');
        setRecognizedText('Listening...');
      } else {
        setStatus('responding');
        setRecognizedText('Processing...');
        const audioBlob = await stopRecording();

        await sendAudioToServer(audioBlob);

        // Return to initial state after sending
        setStatus('idle');
        setRecognizedText('Audio sent to server');
      }
    } catch (err) {
      setStatus('idle');
      setRecognizedText(
        `Error: ${err instanceof Error ? err.message : String(err)}`
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
      </div>
    </div>
  );
}

export default App;
