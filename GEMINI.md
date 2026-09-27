# Stock Analysis Dashboard - Antigravity Guidelines

This repository is configured as an Antigravity project for developing and maintaining the **Stock Analysis Dashboard**.

## 1. Project Overview
A professional quant analysis dashboard providing real-time and historical market data, technical indicators, composite quantitative scoring, and Gemini-powered AI investment briefings.

### Tech Stack
- **Frontend**: React 18, Vite 6, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Framer Motion (`motion`), Recharts, Lucide Icons, jsPDF, html2canvas.
- **Backend / API**: Express 4, `tsx` (TypeScript executor), `yahoo-finance2` for market & ticker data.
- **AI Integration**: Google GenAI SDK (`@google/genai`) accessing Gemini models for automated financial briefings and sentiment analysis.

---

## 2. Directory Structure
```
├── .agents/                 # Antigravity project customizations (rules, skills, hooks)
│   └── rules/               # Modular agent guidelines
├── src/                     # React frontend source code
│   ├── components/          # Reusable UI widgets and chart components
│   ├── utils/               # Technical indicator calculators and helper functions
│   ├── App.tsx              # Main dashboard view
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global Tailwind CSS styles
│   └── types.ts             # Shared frontend types
├── server.ts                # Express backend & API endpoints + Vite middleware integration
├── sp500_tickers.json       # S&P 500 constituents dataset
├── nasdaq100_tickers.json   # NASDAQ 100 constituents dataset
├── GEMINI.md                # Antigravity project rules & architecture guide
├── AGENTS.md                # Multi-agent standard conventions
└── package.json             # Scripts & dependencies
```

---

## 3. Development Workflow & Commands
All commands should be executed from the workspace root:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the unified server (`server.ts`) via `tsx` (Express API + Vite HMR). Default port: `3000`. |
| `npm run build` | Builds Vite frontend bundle into `dist/` and compiles backend to `dist/server.cjs` via `esbuild`. |
| `npm run start` | Launches the production bundled server (`dist/server.cjs`). |
| `npm run lint` | Runs TypeScript compiler verification (`tsc --noEmit`). |

---

## 4. Environment Variables
Local development credentials should be stored in `.env.local` (or `.env`):
- `GEMINI_API_KEY`: Required for Gemini model inference (summaries, risk assessment, briefings).
- `APP_URL`: (Optional) Host URL for the application.

---

## 5. Coding & Architecture Standards
1. **TypeScript Strictness**:
   - Always run `npm run lint` (`tsc --noEmit`) to verify types after making structural changes.
   - Avoid `any` types where possible; maintain shared types in [src/types.ts](file:///src/types.ts).
2. **Component Architecture**:
   - Keep components focused and modular inside `src/components/`.
   - Use Tailwind CSS utility classes and modern glassmorphic/dark-mode styling matching the dashboard aesthetic.
3. **Backend & Financial Calculations**:
   - Handle Yahoo Finance rate limits and errors gracefully in [server.ts](file:///server.ts).
   - Ensure technical indicator calculations in [src/utils/](file:///src/utils/) handle edge cases (e.g., zero volume, missing historical days).
