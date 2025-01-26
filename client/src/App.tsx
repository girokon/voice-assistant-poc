import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import {
  useAudioRecorder,
  AudioRecorderManager,
} from './hooks/useAudioRecorder';
import ReactMarkdown from 'react-markdown';

interface DialogMessage {
  id: number;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

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

function DialogMessages({ messages }: { messages: DialogMessage[] }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="dialog-messages">
      {messages.map((message) => (
        <div key={message.id} className={`message ${message.type}`}>
          <div className="message-header">
            <span className="message-author">
              {message.type === 'user' ? 'Вы' : 'Ассистент'}
            </span>
            <span className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          <div className="message-content">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function App() {
  const [status, setStatus] = useState<
    'idle' | 'detecting' | 'listening' | 'responding'
  >('idle');
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [messageIdCounter, setMessageIdCounter] = useState(0);
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const activationSound = new Audio('/src/assets/sounds/beep.wav');

  const addMessage = useCallback(
    (type: 'user' | 'assistant', text: string) => {
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: messageIdCounter,
            type,
            text,
            timestamp: new Date(),
          },
        ];
        // Keep only last 10 messages
        return newMessages.slice(-10);
      });
      setMessageIdCounter((prev) => prev + 1);
    },
    [messageIdCounter]
  );

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
    onRecordingComplete: async () => {
      setStatus('responding');
      setRecognizedText('Обработка...');
      startWakeWordDetection();
      setWakeWordDetectionState(true);
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

  // Set up WebSocket message handlers
  useEffect(() => {
    const recorder = AudioRecorderManager.getInstance();

    recorder.setOnTranscription((text: string) => {
      setRecognizedText(text);
      addMessage('user', text);
      // Reset current response when new transcription arrives
      setCurrentResponse('');
    });

    recorder.setOnResponse((text: string) => {
      setCurrentResponse((prev) => {
        const newResponse = prev + text;
        // Only create/update assistant message when we have accumulated some text
        if (newResponse.length > 0) {
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            // If the last message is from assistant, update it
            if (lastMessage?.type === 'assistant') {
              return [
                ...prevMessages.slice(0, -1),
                {
                  ...lastMessage,
                  text: newResponse,
                },
              ];
            }
            // Otherwise, create a new message
            return [
              ...prevMessages,
              {
                id: messageIdCounter,
                type: 'assistant' as const,
                text: newResponse,
                timestamp: new Date(),
              },
            ].slice(-10); // Keep only last 10 messages
          });
          setMessageIdCounter((prev) => prev + 1);
        }
        return newResponse;
      });
      setStatus('detecting');
      setRecognizedText('Ожидаю ключевое слово "привет"...');
    });

    recorder.setOnError((error: string) => {
      setStatus('idle');
      setRecognizedText(`Ошибка: ${error}`);
    });
  }, [addMessage, messageIdCounter]);

  const handleIndicatorClick = async () => {
    try {
      if (isRecording) {
        setStatus('responding');
        setRecognizedText('Обработка...');
        await stopRecording();
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
      </div>
      <DialogMessages messages={messages} />
    </div>
  );
}

export default App;
