# design.md

Why the product looks and behaves the way it does. Mocked in Pencil during planning (not a repo artifact — the design tool, not a committed file). Companion to `decisions.md`, which covers the technical calls.

## What's actually in the product

Six screens, and that's deliberate:

- **Chat (mobile)** — the product. Four states mocked: first-run, tracking with a timeline card, reschedule with confirmation, and the messy states (reconnect, rate-limit).
- **Traces (desktop)** — the "would you trust it" surface. Every model call and tool call, inspectable.
- **Landing (desktop)** — exists for exactly one person: the evaluator opening a cold URL. Demo tracking numbers front and center.

Feature set is the smallest one that covers the full risk spectrum: track (read-only), delivery instructions (low-risk write), reschedule (medium, undoable), address change (high-risk, guardrailed), damage claim (creates a record). Each one exercises a different part of the safety model, which is the point — features were picked to prove behaviors, not to fill a list.

## Form factor: chat is mobile, ops surfaces are desktop

"Where's my package" is a phone moment — you're at work, you got an SMS, you have one thumb free. So the chat is designed at 390px with the input pinned at the bottom and every action reachable in the lower half. The traces viewer is the opposite: it's a debugging/audit tool, information-dense, two-panel — nobody audits an agent on a phone. Designing each surface for the posture it's actually used in mattered more to me than a uniform responsive grid.

## Conversation + structured UI, not conversation alone

The core UX position: **chat is for intent, widgets are for precision.** Free text is great at "reschedule it, I'm away this weekend" and terrible at unambiguously picking a date. So the agent answers in prose but hands over structured UI at every decision point:

- **Timeline card** for tracking — a status has shape (events, places, times, an exception). Prose would bury the one thing that matters (it's late, here's the new date). The card leads with the warning-colored exception row instead of hiding it mid-paragraph.
- **Date/slot chips** for rescheduling — the agent only offers slots that are actually valid on that route (Sunday isn't offered at all, rather than offered and then refused). Constraints belong in the choices, not in the error message after.
- **Confirmation card** for anything that changes state — a bordered, accent-colored card with a key/value summary of exactly what will happen, Cancel and Confirm side by side, and one honest line: "Nothing changes until you confirm." The model can't render this card as "done" — it's a proposal, visually and technically.

The rule I kept: the model never gets to be the only witness to an important fact. Anything consequential is shown as UI the user can read, not just words the model said.

## The messy states are designed, not handled

Screen 4 exists because the unhappy path is where trust is won:

- **Reconnected pill** — if you refresh mid-answer, the stream resumes and says so, in a quiet centered pill, not a modal. It's reassurance, not an apology.
- **Rate-limit banner** — free-tier LLM means 429s will happen in the demo. The banner says what's true: "High demand. Retrying in 12s. Your message is saved." Amber, not red — it's a delay, not a failure, and the user's input is never lost.
- **Success card** — after an action executes, the result is a card with a confirmation number, not a chat bubble saying "done!". If it changed the real world, it gets a receipt.

Identity verification is also done conversationally (last 4 digits of the phone) before any shipment details are shown — a smaller version of what real carriers do, kept in-flow instead of bouncing to a form.

## Visual language

Neutral slate + white, one indigo accent, Inter, JetBrains Mono for anything machine-flavored (tracking numbers, tool args, token counts). Reasoning:

- **Indigo is spent on exactly two things**: the user's own messages and primary actions. When something indigo appears, it's either "you said this" or "this is the button". The agent's side is deliberately quiet (light gray bubbles) — the assistant should feel like infrastructure, not a character.
- **Semantic colors carry state**: green = confirmed/delivered, amber = exception/held/needs-you, red = damage/failure. The timeline, the trace statuses, and the demo cards all use the same mapping, so color reads consistently across the app.
- No illustrations, no gradients, no mascot. The demo's personality budget went into the copy ("Fictional carrier, real agent") and the data instead.

## Traces viewer

Two panels: conversations on the left (with a status dot — green completed, amber refusal, red error), a step tree on the right. Each step row: what ran (model call / tool / guardrail), the args in mono, duration and tokens, and an outcome chip. The guardrail row renders as a first-class step — refusals and held-for-confirmation states are *visible events*, not silent absences. That's the observability story in one screen: you can point at the exact step where the agent asked permission.

## Landing page

One job: get a stranger from URL to a working conversation in under a minute. Hero states the promise and the safety model in two sentences, a live-looking chat preview shows the product before any click, and the five demo tracking numbers are cards with the scenario spelled out — including one ("out for delivery, try changing the address") that invites the evaluator to watch the agent refuse. Advertising the refusal is deliberate: the guardrails are a feature, so the landing page sells them.

## What I deliberately didn't design

- **Dark mode** — nice, not load-bearing; five days.
- **Voice input, rich attachments** — claim photos would be real-world useful, but they'd drag in upload infra without proving anything new about the agent.
- **Sidebar with conversation history on mobile** — one conversation is the demo; history is a settings-menu problem for later.
- **A separate "track shipment" form UI** — the whole thesis is that the conversation *is* the interface; building a parallel form would hedge against my own bet.
