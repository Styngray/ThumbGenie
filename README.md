# ThumbGenie

An AI-assisted thumbnail editor for creating, analyzing, and refining visual assets through a browser-based editing workflow.

ThumbGenie combines natural-language image assistance with a hands-on canvas editor. It is designed to make thumbnail iteration faster without taking control away from the person doing the creative work.

## What it includes

- AI-assisted thumbnail generation and image analysis
- Natural-language editing prompts through Gemini
- Layer-based editing and canvas compositing
- Region editing, cropping, text overlays, and background replacement
- Templates, stock assets, project folders, undo/redo history, and export
- Runtime error handling and project persistence

## Technology

- React 18
- TypeScript
- Vite
- Google Gemini via `@google/genai`
- `react-image-crop`
- `react-router-dom`

## Run locally

### Prerequisites

- Node.js 18+
- A Google Gemini API key for AI features

### Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local Vite URL shown in the terminal.

Keep the real API key in your local `.env` file. The repository ignores environment files and includes only the safe variable template in `.env.example`.

## Verification

The Vite production build completes successfully:

```bash
npm run build
```

## Project status

ThumbGenie is a working portfolio prototype. The core editor and AI-assisted workflow are implemented; additional performance work remains for bundle size and CSS loading behavior.

## Design focus

The project explores the boundary between AI assistance and direct creative control. AI handles generation and analysis while the editor keeps layers, regions, text, history, and export visible to the user.
