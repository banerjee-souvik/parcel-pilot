# Parcel Pilot

A conversational delivery agent for a fictional carrier (SwiftShip). Track shipments, reschedule
deliveries, update instructions, change addresses, and file damage claims — via chat, backed by a
real Postgres domain model and enforced guardrails.

Full design context: [`decisions.md`](./decisions.md) (why every technical choice was made),
[`design.md`](./design.md) (product/UX reasoning), [`tech-design.md`](./tech-design.md)
(implementation spec).

**Status:** chat loop, guardrails, tracing, the structured UI (timeline/date-picker/confirm/success
cards), the confirm/cancel endpoints, and the landing page are working end-to-end locally. Stream
resumption and the evals suite are still in progress. This README will get a proper deploy section
once the app is deployed.

## Local development

```bash
docker compose up -d        # Postgres + Redis
cp .env.example .env.local  # then fill in GOOGLE_GENERATIVE_AI_API_KEY (or GROQ_API_KEY)
yarn install
yarn db:setup                # push schema + seed 5 demo shipments
yarn dev
```

Open `/` for the landing page (with copyable demo tracking numbers) or `/chat` directly.
Verification code for every seeded shipment is `7742`; the shipments themselves are in
`src/lib/db/seed.ts`.

## Stack

Next.js 16 (App Router) · Vercel AI SDK v7 · Drizzle ORM + Postgres · Redis (for stream resumption) ·
Gemini/Groq (free tier) · Tailwind
