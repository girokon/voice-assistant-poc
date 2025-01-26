import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import { OpenAIService } from './services/OpenAIService.js';
import { FunctionsBag } from './services/FunctionsBag.js';
import { WeatherFunction } from './services/functions/WeatherFunction.js';

// Load environment variables
dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required in .env file');
}

if (!process.env.OPENAI_MODEL) {
  throw new Error('OPENAI_MODEL is required in .env file');
}

// Initialize FunctionsBag and register functions
const functionsBag = new FunctionsBag();
functionsBag.registerFunction(new WeatherFunction());

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const upload = multer({ storage: multer.memoryStorage() });
const openAIService = new OpenAIService(
  process.env.OPENAI_API_KEY,
  functionsBag
);

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket handling
wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection established');
  let audioChunks: Buffer[] = [];

  ws.on('message', async (message: Buffer) => {
    try {
      // Check if it's a control message
      const messageStr = message.toString();
      if (messageStr.startsWith('{')) {
        console.log('Received control message:', messageStr);
        const control = JSON.parse(messageStr);
        if (control.type === 'end') {
          console.log('Processing end of audio signal');
          // Process accumulated audio
          const audioBuffer = Buffer.concat(audioChunks);
          console.log('Processing audio buffer of size:', audioBuffer.length);

          // Transcribe audio
          console.log('Starting transcription...');
          const transcription =
            await openAIService.transcribeAudio(audioBuffer);
          console.log('Transcription completed:', transcription);

          // Send transcription
          ws.send(
            JSON.stringify({ type: 'transcription', text: transcription })
          );

          // Stream chat response
          console.log('Starting chat response stream...');
          for await (const chunk of openAIService.streamChatResponse(
            transcription
          )) {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'response', text: chunk }));
            } else {
              console.log('WebSocket closed during response streaming');
              break;
            }
          }
          console.log('Chat response stream completed');

          // Clear buffer
          audioChunks = [];
        }
      } else {
        // Accumulate audio chunks
        audioChunks.push(message);
        console.log('Received audio chunk, total chunks:', audioChunks.length);
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message:
              error instanceof Error ? error.message : 'Error processing audio',
          })
        );
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected, clearing audio chunks');
    audioChunks = [];
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Keep the REST endpoint for backward compatibility
const apiRouter = express.Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Legacy endpoint for receiving audio
apiRouter.post(
  '/speech',
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ error: 'No audio file provided' });
        return;
      }

      const transcription = await openAIService.transcribeAudio(file.buffer);
      const response = await openAIService.getChatResponse(transcription);

      res.json({
        transcription,
        response,
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      next(error);
    }
  }
);

// Mount API routes under /api
app.use('/api', apiRouter);

// Serve static files from the client's dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
