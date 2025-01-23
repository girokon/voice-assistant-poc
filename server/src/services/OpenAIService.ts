import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class OpenAIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    // Create a temporary file
    const tmpFile = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);
    await fs.promises.writeFile(tmpFile, audioBuffer);

    try {
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: 'whisper-1',
      });

      return response.text;
    } finally {
      // Clean up the temporary file
      await fs.promises.unlink(tmpFile).catch(console.error);
    }
  }

  async getChatResponse(transcription: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
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
