# decisions.md

Running log of decisions while building this. Newest at the bottom. For each one: what I picked, what else was on the table, why, and what I consciously left out.

---

## 1. Why the conversational agent problem

**Decision:** Problem #2, and specifically an agent in the logistics domain.

**Alternatives considered:** The other two problem statements, briefly. And within #2, a bunch of domains (finance, support, travel).

**Reasoning:** I've built something in this shape before — a chat extension for Locus (logistics SaaS), where users could ask about orders and trigger actions from a conversation. So I know from experience where these things actually break: the model calling tools with garbage args, users refreshing mid-response, actions firing twice. That means I can skip the "figure out what's hard" phase and spend the 5 days solving the hard parts instead of discovering them. Picking a domain I've shipped in felt more honest than picking one that demos flashier.

**Deliberately cut:** Nothing yet, this decision is what created the cut list below.

---

## 2. Who it's for: the person waiting for a package

**Decision:** The agent serves a package recipient of a fictional carrier: track a shipment, reschedule delivery, update delivery instructions, change address, report damage / file a claim.

**Alternatives considered:** An ops-side agent ("which shipments will miss SLA today?") — closer to what I built at Locus, and richer domain-wise. Also a freight booking flow with quote comparison.

**Reasoning:** Honestly, the deciding factor was the evaluator. Someone opens the demo cold, types a tracking number, and gets it in 30 seconds. The ops agent would need a README section just to explain the persona. My domain background still shows up, just in the data instead — the seed has weather exceptions, customs holds, failed delivery attempts, multi-package shipments, because that's what real tracking data looks like, not three parcels that are all "in transit".

**Deliberately cut:** The ops persona, multi-carrier support, and real carrier API integration (the free sandboxes aren't worth the auth friction they'd push onto whoever's evaluating).

---

## 3. Stack: Next.js + Vercel AI SDK

**Decision:** Next.js 16 (App Router, TypeScript) with Vercel AI SDK v7 for the agent loop and streaming, Tailwind + shadcn/ui, deployed on Vercel.

**Alternatives considered:** Separate React SPA + Node API (two deployables, hand-rolled SSE). Or Next.js but writing the agent loop myself without the AI SDK.

**Reasoning:** At Locus we hand-rolled a lot of the streaming plumbing and it ate weeks. I'm not doing that again in a 5-day window. The AI SDK covers transport and tool-calling; everything I actually want to be judged on — guardrails, idempotency, tracing, the eval harness — sits in my code on top of it.

Worth noting honestly: the AI SDK moved from v5 to v7 over the course of planning this project, twice, in about 48 hours. I ended up re-verifying the exact API surface (resumable streams, callback names, tool definitions) against live docs right before install, rather than trusting anything I'd written down earlier in the week. Not a fun rabbit hole, but the alternative was locking a hard-dependency spec to APIs that no longer existed by the time anyone tried to build against it.

**Deliberately cut:** The hand-written agent loop. I can whiteboard one, but rebuilding it here changes nothing about the product, only the timeline.

---

## 4. LLM: free-tier Gemini Flash

**Decision:** Gemini Flash on the free tier, behind a small provider switch so a `GROQ_API_KEY` works as a drop-in.

**Alternatives considered:** Paid Claude/GPT. Local models via Ollama.

**Reasoning:** I wanted the demo to cost nothing to run and nothing to reproduce — an evaluator can grab a free key in two minutes. Gemini Flash's tool-calling is good enough, and the free-tier rate limits turned out to be useful: they forced me to build the 429 handling (backoff, honest "retrying" banner) that I'd probably have skipped with a paid key. Local models were out because the deliverable is a deployed URL, and I'm not hosting a GPU for this.

Small honest footnote: I originally planned around `gemini-2.5-flash` and `llama-3.3-70b-versatile`, both of which turned out to be dead or dying by the time I actually wired up a live key — the first came back a flat 404 ("no longer available to new users"), the second is on a deprecation clock three weeks out. Model catalogs move as fast as the SDKs do. Ended up on `gemini-3.6-flash` and `openai/gpt-oss-120b`, verified against each provider's docs at build time rather than trusted from what I'd written down days earlier.

**Deliberately cut:** Model tuning and multi-model routing. Reliability here comes from code-level guardrails and evals, not from a smarter model.

---

## 5. Datastore: Neon Postgres + Drizzle, Redis only for streams

**Decision:** Postgres (Neon free tier) via Drizzle for domain data, chat history, action log, and traces. Upstash Redis just for the resumable-stream buffers.

**Alternatives considered:** Redis-only (I need it for stream resumption anyway, so why not one store for everything?). SQLite or in-memory. Postgres with raw SQL.

**Reasoning:** In-memory/SQLite dies immediately on Vercel — read-only filesystem, no instance affinity, so a rescheduled delivery would quietly un-reschedule itself on the next request. Redis-only was genuinely tempting for the simpler setup, but the two areas I'm going deep on (evals and tracing) are basically queries: "which tools ran in this conversation", "assert the DB state after this scenario". That's SQL work, and I didn't want to hand-roll JSON query plumbing all week. Drizzle stays because the schema file doubles as data-model docs and `drizzle-kit push` + seed keeps setup to one command.

**Deliberately cut:** The single-datastore story. Two free services at one env var each was a fair price for trivial queries everywhere else.

---

## 6. Safety: the model proposes, code disposes

**Decision:** State-changing actions are two-phase. The model can only call `propose*` tools; a proposal renders as a confirmation card, and the actual execution is a plain HTTP call with an idempotency key when the user clicks Confirm. Business rules (no reschedule when out-for-delivery, no address change after terminal scan, verify identity before showing anything) are pure functions in `guardrails.ts` that the model never gets to skip.

**Alternatives considered:** Prompt-level guardrails ("always ask before acting"). Single-phase tools with a `confirmed: true` argument the model passes.

**Reasoning:** This one comes straight from the Locus experience: a prompt is a suggestion, and one hallucinated tool arg walks right through it. The invariant I care about is "no irreversible action without explicit human confirmation, exactly once" — and "exactly once" has to survive double-clicks, retries after timeouts, and dropped connections. The idempotency key (chatId + proposalId, unique-constrained in the action log) is what makes that true rather than hoped-for. There's an eval that double-fires Confirm to prove it.

**Deliberately cut:** Per-action risk levels and a policy engine. One rule — every mutation confirms — is easier to reason about and easier to test.

---

## 7. Tests: deterministic evals, no LLM-as-judge

**Decision:** Evals run scripted multi-turn conversations through the real agent loop against a freshly seeded DB and assert facts: which tools got called with which args, the final DB state, whether a refusal happened.

**Alternatives considered:** LLM-as-judge scoring. Snapshot tests on response text.

**Reasoning:** I want CI to fail loudly when something real regresses — like the agent no longer verifying identity before reading out shipment details. Judge evals are noisy and cost tokens every run; text snapshots break whenever the model rephrases something harmlessly. Tool calls and DB state *are* the agent's behavior, so that's the contract I'm pinning.

**Deliberately cut:** Tone/quality scoring. If the actions are right and refusals get relayed, tone is polish.

---

## 8. First live run: three real bugs, found by actually running it

**Decision:** Before writing a single automated test, I hand-drove the chat API with curl against a live model key — happy path, a guardrail refusal, a multi-turn conversation, an actual propose flow — and fixed what broke instead of trusting the code because it typechecked.

**What broke:** (1) `toolExecutionMs` from the AI SDK's tool-lifecycle event is a float; my `trace_spans.duration_ms` column is `integer` — every tool-call trace insert failed silently in the background (`after()` swallows the error into a log line, not a crash), so tracing looked fine in the terminal and was quietly broken. (2) I never passed `generateMessageId` to `toUIMessageStream`, so assistant messages got persisted with an empty-string id instead of a real one — worked fine for a single turn, would've been a real problem the moment two assistant messages landed in the same chat. (3) `getRescheduleOptions` searches forward day-by-day for 7 valid reschedule dates — for a shipment guardrails will refuse *no matter what date you pick* (delivered, out for delivery, customs hold), that search never finds 7 valid dates and never terminates. I caught it because I specifically tried to reschedule a delivered shipment to make sure the refusal path worked, and the request just hung.

**Alternatives considered:** Trusting `tsc --noEmit` and `eslint` as suffient before moving on — both passed clean on all three bugs above. None of these are type errors; they're runtime behavior that only shows up when a real model actually calls a real tool against real data.

**Reasoning:** This is the whole argument for deterministic evals from decision #7, proven a day early: (2) is exactly "the agent stopped doing X" and (3) is exactly the kind of hang a scripted "propose against a locked shipment" scenario would catch on every CI run, forever, instead of relying on me remembering to test it by hand again next time I touch that function. Also learned a testing-methodology lesson the hard way: I reused the literal id `"msg_1"` across several manual test chats, and since `messages.id` is a genuinely global primary key (correctly — that's how real client-generated ids work), the second chat's upsert silently overwrote the first chat's row and orphaned it under the wrong `chat_id`. Not a code bug, but it produced a very confusing Gemini 400 ("function call must follow a user turn") before I figured out my own test data was the problem, not the message-reconstruction logic.

**Deliberately cut:** Nothing — all three got fixed immediately, not logged as follow-ups. A bug that corrupts trace data or hangs a request isn't a "later" problem.

---

## 9. Repo layout: src/ wrapper, not a frontend/backend split

**Decision:** Application code (`app/`, `components/`, `lib/`) moved under `src/`; project tooling config (`package.json`, `tsconfig.json`, `drizzle.config.ts`, `docker-compose.yml`, etc.) and `public/` stay at the true root.

**Alternatives considered:** A real top-level `frontend/`/`backend/` split — two separate deployables, an actual API server, CORS, hand-rolled streaming instead of the AI SDK's Next.js integration.

**Reasoning:** The root directory was getting cluttered — a dozen-plus config files sitting next to the actual app code made the repo feel bigger and messier than it is. But a literal frontend/backend split isn't a folder question here: there's no network boundary between "frontend" and "backend" in this architecture. The API routes run in-process inside the same Next.js server and call `lib/domain` directly — that's the entire point of decision #3 (skip the hand-rolled SSE plumbing from the Locus days). Reversing that this far into the build to satisfy a folder-naming instinct would've been a real, multi-day architecture change for a purely cosmetic complaint. `src/` gets the same practical win — app code in one place, tooling config in another — without touching anything that's already built and verified.

**Deliberately cut:** The frontend/backend rename. Asked directly rather than assumed, since it would've silently contradicted an already-documented decision.

---

## 10. Day 2: real UI, and what broke building it

**Decision:** Built the actual chat surface — timeline card, date-picker, confirm card, success/cancel card, empty state, landing page — against the exact Pencil mocks (pulled node trees directly, not from memory of the design doc), plus the confirm/cancel HTTP endpoints so the confirm button in the new ConfirmCard does something real instead of being decorative.

**What changed from the original tool contracts:** `proposeAction` used to return just `{proposalId, summary}` — a single sentence. The mock's confirm card shows structured before/after rows (Shipment / Current ETA / New delivery), which a flat sentence can't drive. Rather than fake that layout from a string, I extended the service to return `{title, rows, note}` alongside the summary — the model still gets a plain sentence to talk about, the UI gets what it actually needs to render. Also added a `data-receipt` message part that the confirm/cancel endpoints persist after acting, with a `convertDataPart` hook so the model sees on the *next* turn that an action actually executed, not just that a proposal existed — otherwise a confirmed reschedule would be invisible to the model one turn later.

**What broke:** Passing a Lucide icon *component* (`icon={Icon}`) as a prop from the landing page's Server Component down into `DemoCard`, a Client Component, blew up with "Only plain objects can be passed to Client Components from Server Components." React Server Components can't serialize function/component references across that boundary — only plain data or already-rendered JSX. Fix: render `<Icon className="..." />` in the server component and pass the resulting element down as `icon: ReactNode`, not the component reference. Caught immediately because I checked HTTP status codes after every change, not just that the page returned *some* HTML — a 500 with a working error overlay still contains recognizable text, so a naive "does the response contain my copy" grep would have missed this.

**A real limitation this session:** Gemini's free tier caps at 20 requests/day per model, and Day 1's testing alone ate most of it. I hit the wall again testing Day 2 and couldn't re-verify the full LLM-driven conversation end-to-end today. I fell back to testing the new backend logic directly — confirm, cancel, idempotency, the structured proposal output — without going through the model, which covers everything actually new today (the model-calling path itself was already proven in decision #8). Worth being honest about: this isn't the same as a full live pass, and the UI has not been visually screenshotted at all, since I have no browser/screenshot tool available in this session — only HTTP status codes, rendered HTML content checks, and code-level review against the exact mock specs.

**Deliberately cut:** Nothing scoped for today. The `data-receipt`/`convertDataPart` mechanism was originally sketched as a "later" nice-to-have in the tech design; built it now because a ConfirmCard whose confirm button doesn't inform the model is a half-finished feature, not a phased one.

---

## 12. Day 3: stream resilience, and a redirect I didn't originally plan

**Decision:** Built resumable streams (Redis-backed), the rate-limit banner with auto-retry, an offline banner, and the "reconnected" pill. Also restructured `/chat` into `/chat` (redirects to a new id) + `/chat/[id]` (the real, durable page) — not originally in the plan.

**Why the routing changed:** Resumption only means something if the same chat id survives a page refresh. The route as it existed after Day 1/2 minted a fresh chat id on every load of `/chat` — refreshing would silently start a brand-new conversation every time, so there would never be an in-flight stream to reattach to. Found this before writing any resumption code, not after, by asking "what would I actually be testing" rather than building the Redis plumbing first and discovering the URL couldn't exercise it.

**What broke, twice, in the same feature:**

1. `tech-design.md` originally imported from bare `"resumable-stream"`. Reading the *compiled JS* (not just the `.d.ts`) showed it does an unconditional top-level `require("redis")` — it would have crashed at module load, immediately, in an app that installed `ioredis` instead (which is what we did, on purpose, back in decision #3's stack table). The `/ioredis` subpath is the one built for that client. Would not have caught this from the types alone.
2. Wired the fix using `resumable-stream/ioredis-adapters`, which doesn't exist as a public import — the package's `exports` map only allows `.`, `./ioredis`, `./redis`, `./generic`. `tsc` caught this immediately (`Cannot find module`), which is exactly the kind of mistake a type-level check *should* catch and did.

**A real bug found only by killing the actual Redis container, not by reasoning about the code:** the naive per-request `createResumableStreamContext({waitUntil})` pattern (auto-creating its own `ioredis` clients each call) degrades *correctly* from the user's point of view when Redis is down — the chat still streams, still responds — but every request spins up a fresh client that fails to connect and is never torn down. Each one keeps retrying on its own timer in the background, so a sustained outage doesn't fail quietly, it fails *increasingly loudly*, one more zombie client at a time. Fixed by building one shared `redisPublisher`/`redisSubscriber` pair as module-level singletons instead of per-request clients, with a `retryStrategy` that keeps retrying forever at a capped interval rather than ever giving up outright — giving up permanently would have meant a transient Redis blip leaves resumability dead until the server restarts, trading one silent failure mode for another. Verified all three states directly: quiet single-line degradation while Redis was down, a live Redis key reappearing the moment it came back up (self-healing, not just "didn't crash"), and the original resumption case itself — hit the GET route mid-flight on a real in-progress reply and got back the identical `messageId` and content stream, not a simulated result.

**Reasoning:** None of this — the routing gap, the two import mistakes, the zombie-client pattern — showed up in `tsc` or `eslint` (except the second import, which type-checking legitimately did catch). They only surfaced by doing the thing for real: stopping the Redis container mid-session, hitting the resume endpoint while a reply was actually streaming, waiting out the retry window to see if it recovered on its own. This is the same lesson as decision #10's RSC bug, aimed at infrastructure instead of a component boundary.

**Deliberately cut:** A precise server-supplied retry countdown for the rate-limit banner (parsed from the provider's `retryDelay`). Google's and Groq's error bodies aren't shaped the same way, and hand-parsing a Gemini-specific field would silently stop working the moment the provider fallback kicks in. A fixed 15s client-side countdown costs nothing to get right on every provider.

---

## 13. Day 4: evals found a real timezone bug, not just their own flakiness

**Decision:** Built `/traces` (list + detail, keyed by traceId not chatId — a chat has one trace per turn, not one overall), the eval harness driving the real agent loop directly, all 8 scripted scenarios from tech-design.md §14, 61 unit tests (guardrails matrix, provider fallback, proposal state machine + a 10-way concurrent confirm race), and a CI workflow. Also wired tracing into the confirm/cancel routes, which tech-design.md always specified but Day 2 never actually built.

**The finding that mattered most:** `getRescheduleOptions` computed valid dates with local-timezone arithmetic (`cursor.getDay()`) but serialized them with `.toISOString().slice(0,10)` — and `applyAction`'s reschedule branch separately built the stored ETA with a *third*, differently-inconsistent method (`` `${date}T00:00:00Z` ``). `toISOString()` is always UTC; local calendar-day arithmetic is not. Any server timezone ahead of UTC can have the two disagree about which day a date string represents, especially close to local midnight. This was a genuinely latent product bug, not an eval artifact — it just happened to surface *through* an eval, because I ran the suite locally in IST just after midnight and a date my code had validated as Monday got serialized as, and then correctly rejected as, Sunday. Confirmed by direct computation, not guessing: `new Date()` at that moment really did roundtrip through UTC into the wrong calendar day. Fixed by adding `guardrails.parseDateOnly`/`formatDateOnly` (construct/read calendar dates via local getters only, never through a UTC instant) and routing every reschedule-date touchpoint in `services.ts` through them, plus my own eval helpers, which had copied the same anti-pattern.

**Two more things evals surfaced that weren't bugs:** (1) A scenario timed out at 553s against a 60s limit, then passed cleanly in isolation seconds later — a transient network hang against Groq, not reproducible. Added a real one-retry-then-fail wrapper in the harness (tech-design.md §14 already called for this; it just hadn't been built). (2) Two scenarios (`claim-not-eligible`, `address-change-out-for-delivery`) intermittently "failed" because the model sometimes reasons out an ineligibility from context it already has, without ever calling the tool that would produce the specific refusal code being asserted. Both outcomes are safe — the guardrail is enforced either way, since nothing executes without the tool call. Loosened those two assertions to require the specific refusal code only when the tool was actually attempted, and check the real invariant (nothing ever mutates) unconditionally.

**Reasoning:** This is decision #7's bet paying off exactly as argued — a deterministic assertion on real DB state caught a real timezone bug that no amount of "does the response look right" eyeballing would have surfaced, because the bug only manifests at specific times of day in specific timezones. It's also a reminder that eval flakiness has (at least) three different causes that call for three different responses: a real bug (fix the product), a transient infra hiccup (retry), and legitimate model non-determinism (assert on the invariant that actually matters, not one specific path to it).

**Deliberately cut:** An e2e/Playwright CI job. Tech-design.md's phase list bundles it with this phase, but the Playwright suite itself doesn't exist yet (that's Day 5) — a CI job asserting against tests that aren't written would be worse than no job at all. `lint+typecheck`, `unit`, and `evals` (secret-gated, skips loudly on forks) are real and green; `e2e` gets added when there's something for it to run.
