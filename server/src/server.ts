import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

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

      // For now, just confirm receiving the file
      console.log('Received audio file:', {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      });

      res.json({ message: 'Audio received successfully' });
    } catch (error) {
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
