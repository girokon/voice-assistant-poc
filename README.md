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
└── package.json          # Root package.json for development
```

## Prerequisites

- Node.js (v18+ recommended)
- Caddy server installed
- Git

## Development Setup

1. Install all dependencies:

```bash
npm run install:all
```

2. Start development servers:

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

## Architecture

- **Frontend**: React with TypeScript, built using Vite
- **Backend**: Express.js with TypeScript
- **HTTPS**: Caddy server as reverse proxy
- **Development**: Hot Module Replacement (HMR) enabled
