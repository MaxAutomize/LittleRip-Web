# LittleRip Web

Personal LittleRip website at **[littlerip.com](https://littlerip.com)**.

This is the web side of the LittleRip ecosystem, alongside:

- **LittleRip iOS** — mobile AI assistant + SmartRent unlock widget.
- **LittleRip Mac** — robot camera/sensor control center.

## Routes

- `/` — landing page with the arc-rainbow LittleRip title.
- `/chat` — streaming Char chat UI using Ollama Cloud's `/v1/chat/completions` backend. Char is a serious fictional roleplay persona with South Park canon cross-referencing.
- `/call` — browser voice call using Web Speech API speech-to-text and speech synthesis.
- `/inner-monologue` — account-based, five-minute GLM-5.2 reflection loop with browser speech, editable inquiry prompt, and categorized persistent memory.
- `/payment` — Stripe one-time custom-amount checkout.

## Stack

- Next.js 16 App Router
- React 19
- Edge runtime on `/api/chat`
- Neon serverless Postgres for Inner Monologue accounts, sessions, journals, and memory
- Stripe checkout for payments
- Deployed on Vercel

## Inner Monologue behavior

- A cycle lasts five minutes and makes one high-effort GLM-5.2 reflection pass per minute.
- After pass five, the browser speaks one saved sentence and starts the next cycle automatically.
- The loop continues while the page is open; Ollama Cloud and storage do not depend on the developer laptop.
- Public reflection notes are saved instead of private hidden chain-of-thought.
- At 70% of a deliberately limited 32K active journal budget, notes are compacted into durable topic folders and the model may revise a capped addendum to its prompt.
- Account sessions use secure HTTP-only cookies that last 90 days.

## Configuration

All secrets live in local/Vercel environment variables and are never committed:

- `OLLAMA_BASE_URL` — backend for chat, call, and Inner Monologue; production should be `https://ollama.com` (local development may use `http://localhost:11434`)
- `OLLAMA_API_KEY` — server-only Ollama Cloud API key from https://ollama.com/settings/keys
- `OLLAMA_MODEL` — optional regular chat model override; defaults to `glm-5.1`
- `INNER_MONOLOGUE_MODEL` — optional Inner Monologue override; defaults to direct-cloud `glm-5.2`
- `DATABASE_URL` — Neon Postgres connection string supplied by the Vercel integration
- `STRIPE_SECRET_KEY` — Stripe checkout secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable client key

## Development

```sh
npm install
npm run dev
```

## Deployment

Vercel auto-deploys pushes to `main` for **littlerip.com**.

GitHub repo:

`https://github.com/MaxAutomize/LittleRip-Web.git`
