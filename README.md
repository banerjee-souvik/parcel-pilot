# Parcel Pilot

A conversational delivery agent for a fictional carrier (SwiftShip). Track shipments, reschedule
deliveries, update instructions, change addresses, and file damage claims — via chat, backed by a
real Postgres domain model and enforced guardrails.

Full design context: [`decisions.md`](./decisions.md) (why every technical choice was made),
[`design.md`](./design.md) (product/UX reasoning), [`tech-design.md`](./tech-design.md)
(implementation spec).

**Status:** early build — chat loop, guardrails, and tracing are working end-to-end locally.
Structured UI cards, stream resumption, the confirm/cancel HTTP endpoints, and the evals suite are
still in progress. This README will get a proper setup/deploy section once the app is deployable.

## Local development (current state)

```bash
docker compose up -d        # Postgres + Redis
cp .env.example .env.local  # then fill in GOOGLE_GENERATIVE_AI_API_KEY (or GROQ_API_KEY)
yarn install
yarn db:setup                # push schema + seed 5 demo shipments
yarn dev
```

Then open `/chat`. Demo tracking numbers (verification code `7742` for all of them) are in
`lib/db/seed.ts`.

## Stack

Next.js 16 (App Router) · Vercel AI SDK v7 · Drizzle ORM + Postgres · Redis (for stream resumption) ·
Gemini/Groq (free tier) · Tailwind
