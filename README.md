# LittleRip Web

Personal LittleRip website at **[littlerip.com](https://littlerip.com)**.

This is the web side of the LittleRip ecosystem, alongside:

- **LittleRip iOS** — mobile AI assistant + SmartRent unlock widget.
- **LittleRip Mac** — robot camera/sensor control center.

## Routes

- `/` — landing page with the arc-rainbow LittleRip title.
- `/chat` — streaming chat UI using an Ollama-compatible `/v1/chat/completions` backend.
- `/call` — browser voice call using Web Speech API speech-to-text and speech synthesis.
- `/assistant` — passive-listening assistant page.
- `/payment` — Stripe one-time custom-amount checkout.

## Stack

- Next.js 14 App Router
- React 18
- Edge runtime on `/api/chat`
- Stripe checkout for payments
- Deployed on Vercel

## Configuration

All secrets live in local/Vercel environment variables and are never committed:

- `OLLAMA_BASE_URL` — backend for chat/call/assistant, default `http://localhost:11434`
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
