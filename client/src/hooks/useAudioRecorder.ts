import { useState, useCallback } from 'react';

interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  isRecording: boolean;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks((chunks) => [...chunks, event.data]);
        }
      };

      // Request data every 250ms to get a smoother audio stream
      recorder.start(250);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setError(null);
      setAudioChunks([]);
    } catch (err) {
      setError(
        'Failed to start recording: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }, []);

  const stopRecording = useCallback(async () => {
    return new Promise<Blob>((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      // Add final handler for any remaining audio data
      const handleStop = () => {
        const audioBlob = new Blob(audioChunks, {
          type: 'audio/webm;codecs=opus',
        });
        resolve(audioBlob);

        // Stop all tracks and cleanup
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        setMediaRecorder(null);
        setAudioChunks([]);
      };

      mediaRecorder.onstop = handleStop;

      // Request any final chunks of data
      mediaRecorder.requestData();
      mediaRecorder.stop();
      setIsRecording(false);
    });
  }, [mediaRecorder, audioChunks]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    error,
  };
}
