# Parcel Pilot

A conversational delivery agent for a fictional carrier (SwiftShip). Track shipments, reschedule
deliveries, update instructions, change addresses, and file damage claims — via chat, backed by a
real Postgres domain model and enforced guardrails.

Full design context: [`decisions.md`](./decisions.md) (why every technical choice was made),
[`design.md`](./design.md) (product/UX reasoning), [`tech-design.md`](./tech-design.md)
(implementation spec).

**Status:** chat loop, guardrails, tracing, the structured UI (timeline/date-picker/confirm/success
cards), the confirm/cancel endpoints, resumable streams, the landing page, `/traces`, the eval
suite, unit tests, and a Playwright smoke test are all working end-to-end locally, with CI wired
up. Not yet deployed — this README gets a live URL once it is.

## Local development

```bash
docker compose up -d        # Postgres + Redis
cp .env.example .env.local  # then fill in GROQ_API_KEY
yarn install
yarn db:setup                # push schema + seed 5 demo shipments
yarn dev
```

Open `/` for the landing page (with copyable demo tracking numbers) or `/chat` directly.
Verification code for every seeded shipment is `7742`; the shipments themselves are in
`src/lib/db/seed.ts`.

## Testing

```bash
yarn test      # unit tests — guardrails matrix, proposal state machine, provider config
yarn eval      # 8 scripted conversations against the real agent loop + a real LLM
yarn e2e       # Playwright smoke test — landing through a filed claim, against a real build
```

`yarn eval` and `yarn e2e` call a real model (Groq), so they need a working `GROQ_API_KEY` and will
consume a small amount of quota. Both retry once on transient infra failures; a genuine assertion
failure means something's actually broken. `/traces` shows every model call and tool call from any
run, including ones the tests generate.

## Stack

Next.js 16 (App Router) · Vercel AI SDK v7 · Drizzle ORM + Postgres · Redis (for stream resumption) ·
Groq (free tier) · Tailwind
