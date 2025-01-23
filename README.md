# Voice Assistant POC

Proof of concept for a voice assistant application with a web interface.

## Project Structure

```
project/
├── client/                 # Frontend (Vite + React)
│   ├── src/               # React source files
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── server/                # Backend (Express + TypeScript)
│   ├── src/              # Server source files
│   └── package.json      # Backend dependencies
├── Caddyfile             # Caddy server configuration
├── .env                  # Environment variables
├── .prettierrc           # Prettier configuration
└── package.json          # Root package.json for development
```

## Prerequisites

- Node.js (v18+ recommended)
- Caddy server installed
- Git
- OpenAI API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

You can get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys).

## Development Setup

1. Install all dependencies:

```bash
npm run install:all
```

2. Create `.env` file with your OpenAI API key

3. Start development servers:

```bash
npm run dev
```

This will start:

- Frontend (Vite) at https://voice-assistant.localhost
- Backend (Express) at https://voice-assistant.localhost/api
- Caddy server as HTTPS proxy

## Available Scripts

- `npm run dev` - Start all development servers
- `npm run dev:client` - Start only frontend
- `npm run dev:server` - Start only backend
- `npm run dev:caddy` - Start only Caddy server
- `npm run install:all` - Install dependencies for all packages
- `npm run format` - Format all files using Prettier
- `npm run format:check` - Check if files are formatted correctly

## Code Style

The project uses Prettier for code formatting with default settings. You can format your code using:

```bash
npm run format
```

Or check if files are formatted correctly using:

```bash
npm run format:check
```

## Architecture

- **Frontend**: React with TypeScript, built using Vite
- **Backend**: Express.js with TypeScript
- **HTTPS**: Caddy server as reverse proxy
- **Development**: Hot Module Replacement (HMR) enabled
- **AI**: OpenAI's Whisper for speech-to-text and GPT-4 for responses
