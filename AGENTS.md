# AGENTS.md

See [GEMINI.md](GEMINI.md) for full project architecture, development workflow, and guidelines.

## Agent Guidelines Summary
- **Project**: Stock Analysis Dashboard (React 18 + TypeScript + Vite + Express + Google GenAI SDK).
- **Dev Command**: `npm run dev`
- **Lint / Typecheck**: `npm run lint`
- **Build**: `npm run build`
- **Key Rules**:
  - Always verify changes with `npm run lint`.
  - Maintain clean separation between backend endpoints in `server.ts` and frontend React UI in `src/`.
  - Do not commit secrets (`.env`, `.env.local`).
