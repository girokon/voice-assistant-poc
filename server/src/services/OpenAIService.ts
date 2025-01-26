import OpenAI from 'openai';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class OpenAIService {
  private openai: OpenAI;
  private model: string;
  private conversationHistory: ConversationMessage[] = [];
  private readonly CONVERSATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });

    if (!process.env.OPENAI_MODEL) {
      throw new Error('OPENAI_MODEL is required in .env file');
    }
    this.model = process.env.OPENAI_MODEL;

    // Initialize conversation history with system message
    this.conversationHistory = [
      {
        role: 'system',
        content: 'Ты умный помощник, реализованный ввиде умной колонки',
        timestamp: Date.now(),
      },
    ];
  }

  private cleanupOldMessages() {
    const cutoffTime = Date.now() - this.CONVERSATION_WINDOW_MS;
    // Keep system message and remove old messages
    this.conversationHistory = [
      this.conversationHistory[0],
      ...this.conversationHistory
        .slice(1)
        .filter((msg) => msg.timestamp > cutoffTime),
    ];
  }

  private getRecentMessages() {
    this.cleanupOldMessages();
    return this.conversationHistory.map(({ role, content }) => ({
      role,
      content,
    }));
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      return response.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  async *streamChatResponse(transcription: string) {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: transcription,
      timestamp: Date.now(),
    });

    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages: this.getRecentMessages(),
      stream: true,
    });

    let assistantMessage = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        assistantMessage += content;
        yield content;
      }
    }

    // Add assistant's response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: Date.now(),
    });
  }

  // Keep the old method for compatibility
  async getChatResponse(transcription: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: transcription,
      timestamp: Date.now(),
    });

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: this.getRecentMessages(),
    });

    const assistantMessage =
      response.choices[0]?.message?.content || 'No response generated';

    // Add assistant's response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: Date.now(),
    });

    return assistantMessage;
  }
}
