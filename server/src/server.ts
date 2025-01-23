import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAIService } from './services/OpenAIService.js';

// Load environment variables
dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required in .env file');
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const openAIService = new OpenAIService(process.env.OPENAI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// API routes
const apiRouter = express.Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Endpoint for receiving audio
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

      // Transcribe audio using OpenAI Whisper
      const transcription = await openAIService.transcribeAudio(file.buffer);

      // Get chat response based on transcription
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

  // In production, serve index.html for any unknown routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
