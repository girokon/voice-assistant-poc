export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private onTranscriptionCallback: ((text: string) => void) | null = null;
  private onResponseCallback: ((text: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private isConnecting: boolean = false;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received WebSocket message:', message);
          switch (message.type) {
            case 'transcription':
              this.onTranscriptionCallback?.(message.text);
              break;
            case 'response':
              this.onResponseCallback?.(message.text);
              break;
            case 'error':
              this.onErrorCallback?.(message.message);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.onErrorCallback?.('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnecting = false;
        // Try to reconnect after a delay
        setTimeout(() => this.connect(), 3000);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.onErrorCallback?.('Failed to create WebSocket connection');
    }
  }

  public sendAudioChunk(chunk: Blob): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn(
        'WebSocket not connected (state:',
        this.ws?.readyState,
        '), reconnecting...'
      );
      this.connect();
      return;
    }

    try {
      this.ws.send(chunk);
      console.log('Sent audio chunk, size:', chunk.size);
    } catch (error) {
      console.error('Error sending audio chunk:', error);
      this.onErrorCallback?.('Failed to send audio chunk');
    }
  }

  public sendEndOfAudio(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected for end-of-audio signal');
      return;
    }

    try {
      const message = JSON.stringify({ type: 'end' });
      this.ws.send(message);
      console.log('Sent end-of-audio signal');
    } catch (error) {
      console.error('Error sending end-of-audio signal:', error);
      this.onErrorCallback?.('Failed to send end-of-audio signal');
    }
  }

  public setOnTranscription(callback: (text: string) => void): void {
    this.onTranscriptionCallback = callback;
  }

  public setOnResponse(callback: (text: string) => void): void {
    this.onResponseCallback = callback;
  }

  public setOnError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  public disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting WebSocket');
      this.ws.close();
      this.ws = null;
    }
  }
}
