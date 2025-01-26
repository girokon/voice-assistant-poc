import OpenAI from 'openai';
import { FunctionsBag } from './FunctionsBag.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  timestamp: number;
  name?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }[];
  tool_call_id?: string;
}

type MessageRole = ConversationMessage['role'];

export class OpenAIService {
  private openai: OpenAI;
  private model: string;
  private conversationHistory: ConversationMessage[] = [];
  private readonly CONVERSATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  private functionsBag: FunctionsBag;

  constructor(apiKey: string, functionsBag: FunctionsBag) {
    this.openai = new OpenAI({ apiKey });
    this.functionsBag = functionsBag;

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

  private getRecentMessages(): ChatCompletionMessageParam[] {
    this.cleanupOldMessages();
    return this.conversationHistory.map(
      ({ role, content, name, tool_calls, tool_call_id }) => ({
        role,
        content,
        name,
        tool_calls,
        tool_call_id,
      })
    ) as ChatCompletionMessageParam[];
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
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user' satisfies MessageRole,
        content: transcription,
        timestamp: Date.now(),
      });

      const tools = this.functionsBag.getTools();
      console.log('Available tools:', tools);
      console.log('Current conversation history:', this.conversationHistory);

      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: this.getRecentMessages(),
        tools,
        tool_choice: 'auto',
        stream: true,
      });

      let assistantMessage = '';
      let currentToolCalls: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }> = [];

      for await (const chunk of stream) {
        console.log('Received chunk:', JSON.stringify(chunk.choices[0]?.delta));
        const delta = chunk.choices[0]?.delta;

        if (delta?.tool_calls) {
          for (const [index, deltaToolCall] of delta.tool_calls.entries()) {
            if (index >= currentToolCalls.length) {
              currentToolCalls.push({
                id: deltaToolCall.id || '',
                type: 'function',
                function: { name: '', arguments: '' },
              });
            }

            const toolCall = currentToolCalls[index];
            if (deltaToolCall.id) toolCall.id = deltaToolCall.id;

            if (deltaToolCall.function?.name) {
              toolCall.function.name += deltaToolCall.function.name;
            }
            if (deltaToolCall.function?.arguments) {
              toolCall.function.arguments += deltaToolCall.function.arguments;
            }
          }
        } else if (delta?.content) {
          assistantMessage += delta.content;
          yield delta.content;
        }
      }

      const toolCalls = currentToolCalls.map(
        ({ id, type, function: { name, arguments: args } }) => ({
          id,
          type,
          function: { name, arguments: args },
        })
      );
      console.log('Final tool calls:', toolCalls);

      if (toolCalls.length > 0) {
        // Add assistant's tool calls to history FIRST
        const assistantToolMessage: ConversationMessage = {
          role: 'assistant' satisfies MessageRole,
          content: null,
          tool_calls: toolCalls,
          timestamp: Date.now(),
        };
        console.log(
          'Adding assistant message with tool calls:',
          assistantToolMessage
        );
        this.conversationHistory.push(assistantToolMessage);

        // Execute all tool calls and collect results
        for (const toolCall of toolCalls) {
          try {
            if (
              !toolCall.function.name ||
              !toolCall.function.arguments ||
              toolCall.function.arguments.trim() === ''
            ) {
              console.warn('Incomplete tool call:', toolCall);
              continue;
            }

            console.log('Executing tool call:', toolCall);
            const result = await this.functionsBag.executeFunction(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            console.log('Tool call result:', result);

            // Add function result to history with matching tool_call_id
            const toolMessage: ConversationMessage = {
              role: 'tool' satisfies MessageRole,
              name: toolCall.function.name,
              content: JSON.stringify(result),
              timestamp: Date.now(),
              tool_call_id: toolCall.id,
            };
            console.log('Adding tool message:', toolMessage);
            this.conversationHistory.push(toolMessage);
          } catch (error) {
            console.error('Error executing function:', error);
            // Add error result to history with matching tool_call_id
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            const toolMessage: ConversationMessage = {
              role: 'tool' satisfies MessageRole,
              name: toolCall.function.name,
              content: JSON.stringify({ error: errorMessage }),
              timestamp: Date.now(),
              tool_call_id: toolCall.id,
            };
            this.conversationHistory.push(toolMessage);
            yield `Извините, произошла ошибка при выполнении функции: ${errorMessage}`;
          }
        }

        console.log(
          'Current conversation history before follow-up:',
          this.conversationHistory
        );
        // Get a follow-up response from the assistant
        const followUpStream = await this.openai.chat.completions.create({
          model: this.model,
          messages: this.getRecentMessages(),
          tools,
          tool_choice: 'auto',
          stream: true,
        });

        let followUpMessage = '';
        for await (const chunk of followUpStream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            followUpMessage += content;
            yield content;
          }
        }

        if (followUpMessage) {
          const finalMessage: ConversationMessage = {
            role: 'assistant' satisfies MessageRole,
            content: followUpMessage,
            timestamp: Date.now(),
          };
          console.log('Adding final assistant message:', finalMessage);
          this.conversationHistory.push(finalMessage);
        }
      } else if (assistantMessage) {
        // Add assistant's response to history (only if no tool calls were made)
        const finalMessage = {
          role: 'assistant' as const,
          content: assistantMessage,
          timestamp: Date.now(),
        };
        console.log('Adding final assistant message:', finalMessage);
        this.conversationHistory.push(finalMessage);
      }
    } catch (error) {
      console.error('Error in streamChatResponse:', error);
      console.error('Current conversation history:', this.conversationHistory);
      yield `Извините, произошла ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async getChatResponse(transcription: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user' satisfies MessageRole,
      content: transcription,
      timestamp: Date.now(),
    });

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: this.getRecentMessages(),
      tools: this.functionsBag.getTools(),
      tool_choice: 'auto',
    });

    const message = response.choices[0]?.message;
    if (!message) {
      return 'No response generated';
    }

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add assistant's tool calls to history
      this.conversationHistory.push({
        role: 'assistant' satisfies MessageRole,
        content: null,
        tool_calls: message.tool_calls,
        timestamp: Date.now(),
      });

      // Execute all tool calls
      for (const toolCall of message.tool_calls) {
        try {
          const result = await this.functionsBag.executeFunction(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );

          // Add function result to history
          this.conversationHistory.push({
            role: 'tool' satisfies MessageRole,
            name: toolCall.function.name,
            content: JSON.stringify(result),
            timestamp: Date.now(),
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          console.error('Error executing function:', error);
        }
      }

      // Get final response
      const finalResponse = await this.openai.chat.completions.create({
        model: this.model,
        messages: this.getRecentMessages(),
        tools: this.functionsBag.getTools(),
        tool_choice: 'auto',
      });

      const finalMessage =
        finalResponse.choices[0]?.message?.content || 'No response generated';

      // Add final response to history
      this.conversationHistory.push({
        role: 'assistant' satisfies MessageRole,
        content: finalMessage,
        timestamp: Date.now(),
      });

      return finalMessage;
    }

    // No tool calls, just add the response to history
    const assistantMessage = message.content || 'No response generated';
    this.conversationHistory.push({
      role: 'assistant' satisfies MessageRole,
      content: assistantMessage,
      timestamp: Date.now(),
    });

    return assistantMessage;
  }
}
