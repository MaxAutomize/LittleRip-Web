# LittleRip Web

Personal LittleRip website at **[littlerip.com](https://littlerip.com)**.

This is the web side of the LittleRip ecosystem, alongside:

- **LittleRip iOS** — mobile AI assistant + SmartRent unlock widget.
- **LittleRip Mac** — robot camera/sensor control center.

## Self-hosting and recovery handoff

The separate **LittleRip Metal** workspace, its setup, production-readiness blockers, performance results, and the owner's on-demand recovery preference are documented in **[docs/self-hosting/README.md](docs/self-hosting/README.md)**.

Those commands apply to `~/littlerip-metal`, not this Next.js repository root. The documentation does not mean a public-domain migration has occurred or that the self-hosted application source is included here.

## Routes

- `/` — minimal landing page with no public feature tabs.
- `/chat` — retained direct AI chat UI using Ollama Cloud's `/v1/chat/completions` backend.
- `/call` — retained direct browser voice call using Web Speech API speech-to-text and speech synthesis.
- `/payment` — retained direct Stripe one-time custom-amount checkout.

## Stack

- Next.js 16 App Router
- React 19
- Edge runtime on `/api/chat`
- Stripe checkout for payments
- Deployed on Vercel

## Configuration

All secrets live in local/Vercel environment variables and are never committed:

- `OLLAMA_BASE_URL` — backend for chat and call; production should be `https://ollama.com` (local development may use `http://localhost:11434`)
- `OLLAMA_API_KEY` — server-only Ollama Cloud API key from https://ollama.com/settings/keys
- `OLLAMA_MODEL` — optional regular chat model override; defaults to `glm-5.1`
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
