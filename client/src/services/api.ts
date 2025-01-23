const API_BASE_URL = 'https://voice-assistant.localhost/api';

interface ServerResponse {
  transcription: string;
  response: string;
}

export async function sendAudioToServer(
  audioBlob: Blob
): Promise<ServerResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE_URL}/speech`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to send audio: ${response.statusText}`);
  }

  return response.json();
}
