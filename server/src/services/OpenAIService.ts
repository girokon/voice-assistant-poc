import OpenAI from 'openai';

export class OpenAIService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });

    if (!process.env.OPENAI_MODEL) {
      throw new Error('OPENAI_MODEL is required in .env file');
    }
    this.model = process.env.OPENAI_MODEL;
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
    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Ты умный помощник, реализованный ввиде умной колонки',
        },
        {
          role: 'user',
          content: transcription,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // Keep the old method for compatibility
  async getChatResponse(transcription: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Ты умный помощник, реализованный ввиде умной колонки',
        },
        {
          role: 'user',
          content: transcription,
        },
      ],
    });

    return response.choices[0]?.message?.content || 'No response generated';
  }
}
