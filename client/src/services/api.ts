const API_BASE_URL = 'https://voice-assistant.localhost/api';

export async function sendAudioToServer(audioBlob: Blob): Promise<void> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE_URL}/speech`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to send audio: ${response.statusText}`);
  }
}
