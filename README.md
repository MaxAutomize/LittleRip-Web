# LittleRip Web

Personal website at **[littlerip.com](https://littlerip.com)**.

A Next.js app with a few self-contained tools:

- `/` — landing page (arc-rainbow "LittleRip" title)
- `/chat` — streaming chat UI (Ollama-compatible /v1/chat/completions)
- `/call` — voice call (Web Speech API STT + speechSynthesis TTS)
- `/assistant` — passive-listening assistant (native SpeechRecognition + GLM 5.2)
- `/payment` — Stripe one-time custom-amount checkout

## Stack

- Next.js 14 (App Router, edge runtime on `/api/chat`)
- React 18
- Stripe for payments

## Configuration

All secrets live in environment variables (never committed):

- `OLLAMA_BASE_URL` — backend for chat/call/assistant (default `http://localhost:11434`)
- `STRIPE_SECRET_KEY` — Stripe checkout
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe client key

Deployed on Vercel — every push to `main` auto-deploys to littlerip.com.