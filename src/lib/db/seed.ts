import { pathToFileURL } from "node:url";
import { db } from "./index";
import { actions, chats, messages, shipmentEvents, shipments, traceSpans, traces } from "./schema";

// Idempotent: safe to run repeatedly. Every timestamp is computed relative to `now` at seed time
// so the demo never looks stale. See tech-design.md §5 for the exact spec this implements.

const PHONE_LAST4 = "7742";

function daysAgo(now: Date, n: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(now: Date, n: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d;
}

function hoursAgo(now: Date, n: number): Date {
  const d = new Date(now);
  d.setHours(d.getHours() - n);
  return d;
}

// Exported so the eval harness can reseed between scenarios without going through the CLI's
// process.exit — importing this module must never have that side effect.
export async function seedDatabase() {
  const now = new Date();

  // Delete in FK-safe order.
  await db.delete(traceSpans);
  await db.delete(traces);
  await db.delete(actions);
  await db.delete(messages);
  await db.delete(chats);
  await db.delete(shipmentEvents);
  await db.delete(shipments);

  // --- SS-4417-DEMO: weather exception, held at hub ---
  await db.insert(shipments).values({
    trackingNumber: "SS-4417-DEMO",
    recipientName: "Aditi Rao",
    phoneLast4: PHONE_LAST4,
    addressLine: "14 Salt Lake Sector V",
    city: "Kolkata",
    status: "exception",
    packageCount: 2,
    sender: "Meesho Retail",
    eta: daysFromNow(now, 2),
    originalEta: daysAgo(now, 0),
    deliveryWindow: null,
    deliveryInstructions: null,
    exception: { code: "WEATHER_DELAY", summary: "Heavy rain — held at Nagpur hub" },
  });
  await db.insert(shipmentEvents).values([
    { id: "evt_4417_1", trackingNumber: "SS-4417-DEMO", kind: "pickup", summary: "Picked up", location: "Kolkata sort facility", occurredAt: daysAgo(now, 4) },
    { id: "evt_4417_2", trackingNumber: "SS-4417-DEMO", kind: "depart_hub", summary: "Departed hub", location: "Kolkata", occurredAt: daysAgo(now, 3) },
    { id: "evt_4417_3", trackingNumber: "SS-4417-DEMO", kind: "exception", summary: "Weather exception — held at Nagpur hub", location: "Nagpur", occurredAt: daysAgo(now, 2) },
  ]);

  // --- SS-9021-DEMO: out for delivery today ---
  await db.insert(shipments).values({
    trackingNumber: "SS-9021-DEMO",
    recipientName: "Rohan Mehta",
    phoneLast4: PHONE_LAST4,
    addressLine: "22 Koramangala 4th Block",
    city: "Bengaluru",
    status: "out_for_delivery",
    packageCount: 1,
    sender: "Nykaa Fashion",
    eta: now,
    originalEta: now,
    deliveryWindow: "09:00-13:00",
    deliveryInstructions: null,
    exception: null,
  });
  await db.insert(shipmentEvents).values([
    { id: "evt_9021_1", trackingNumber: "SS-9021-DEMO", kind: "pickup", summary: "Picked up", location: "Bengaluru sort facility", occurredAt: daysAgo(now, 3) },
    { id: "evt_9021_2", trackingNumber: "SS-9021-DEMO", kind: "depart_hub", summary: "Departed hub", location: "Bengaluru", occurredAt: daysAgo(now, 2) },
    { id: "evt_9021_3", trackingNumber: "SS-9021-DEMO", kind: "arrive_hub", summary: "Arrived at local facility", location: "Koramangala hub", occurredAt: daysAgo(now, 1) },
    { id: "evt_9021_4", trackingNumber: "SS-9021-DEMO", kind: "out_for_delivery", summary: "Out for delivery", location: "Bengaluru", occurredAt: hoursAgo(now, 3) },
  ]);

  // --- SS-7130-DEMO: delivered, target for damage claims ---
  await db.insert(shipments).values({
    trackingNumber: "SS-7130-DEMO",
    recipientName: "Priya Nair",
    phoneLast4: PHONE_LAST4,
    addressLine: "8 Marine Drive",
    city: "Kochi",
    status: "delivered",
    packageCount: 1,
    sender: "Croma Electronics",
    eta: daysAgo(now, 1),
    originalEta: daysAgo(now, 1),
    deliveryWindow: null,
    deliveryInstructions: null,
    exception: null,
  });
  await db.insert(shipmentEvents).values([
    { id: "evt_7130_1", trackingNumber: "SS-7130-DEMO", kind: "pickup", summary: "Picked up", location: "Kochi sort facility", occurredAt: daysAgo(now, 3) },
    { id: "evt_7130_2", trackingNumber: "SS-7130-DEMO", kind: "out_for_delivery", summary: "Out for delivery", location: "Kochi", occurredAt: daysAgo(now, 1) },
    { id: "evt_7130_3", trackingNumber: "SS-7130-DEMO", kind: "delivered", summary: "Delivered — signed by front desk", location: "Kochi", occurredAt: daysAgo(now, 1) },
  ]);

  // --- SS-2288-DEMO: customs hold, no ETA ---
  await db.insert(shipments).values({
    trackingNumber: "SS-2288-DEMO",
    recipientName: "Karan Shah",
    phoneLast4: PHONE_LAST4,
    addressLine: "101 Andheri West",
    city: "Mumbai",
    status: "customs_hold",
    packageCount: 1,
    sender: "Shenzhen Electronics",
    eta: null,
    originalEta: null,
    deliveryWindow: null,
    deliveryInstructions: null,
    exception: { code: "CUSTOMS_HOLD", summary: "Held in customs — no ETA yet" },
  });
  await db.insert(shipmentEvents).values([
    { id: "evt_2288_1", trackingNumber: "SS-2288-DEMO", kind: "pickup", summary: "Picked up", location: "Shenzhen", occurredAt: daysAgo(now, 9) },
    { id: "evt_2288_2", trackingNumber: "SS-2288-DEMO", kind: "customs_hold", summary: "Held in customs", location: "Mumbai", occurredAt: daysAgo(now, 5) },
  ]);

  // --- SS-5560-DEMO: failed attempt, auto-rescheduled ---
  await db.insert(shipments).values({
    trackingNumber: "SS-5560-DEMO",
    recipientName: "Neha Kulkarni",
    phoneLast4: PHONE_LAST4,
    addressLine: "45 Baner Road",
    city: "Pune",
    status: "attempt_failed",
    packageCount: 1,
    sender: "Ajio Fashion",
    eta: daysFromNow(now, 1),
    originalEta: daysAgo(now, 1),
    deliveryWindow: "13:00-18:00",
    deliveryInstructions: null,
    exception: { code: "DELIVERY_ATTEMPT_FAILED", summary: "Recipient unavailable — auto-rescheduled" },
  });
  await db.insert(shipmentEvents).values([
    { id: "evt_5560_1", trackingNumber: "SS-5560-DEMO", kind: "pickup", summary: "Picked up", location: "Pune sort facility", occurredAt: daysAgo(now, 3) },
    { id: "evt_5560_2", trackingNumber: "SS-5560-DEMO", kind: "attempt_failed", summary: "Delivery attempt failed — recipient unavailable", location: "Pune", occurredAt: daysAgo(now, 1) },
  ]);

  // --- Demo chat + trace, so /traces is never empty on first visit ---
  await db.insert(chats).values({
    id: "c_demo",
    title: "Track + reschedule SS-4417",
    activeStreamId: null,
    verifiedTrackingNumbers: ["SS-4417-DEMO"],
    createdAt: hoursAgo(now, 2),
  });
  await db.insert(messages).values([
    {
      id: "msg_demo_1",
      chatId: "c_demo",
      role: "user",
      parts: [{ type: "text", text: "Where is SS-4417-DEMO?" }],
      createdAt: hoursAgo(now, 2),
    },
    {
      id: "msg_demo_2",
      chatId: "c_demo",
      role: "assistant",
      parts: [{ type: "text", text: "Your order is held at the Nagpur hub due to heavy rain — new ETA is in 2 days. Want me to reschedule it?" }],
      createdAt: hoursAgo(now, 2),
    },
  ]);
  await db.insert(traces).values({
    id: "t_demo",
    chatId: "c_demo",
    model: "gemini-3.6-flash",
    status: "completed",
    totalTokens: 4118,
    durationMs: 8400,
    createdAt: hoursAgo(now, 2),
  });
  await db.insert(traceSpans).values([
    { id: "span_demo_1", traceId: "t_demo", seq: 0, kind: "model_call", name: "gemini-3.6-flash", input: null, output: { text: "Found it. Quick verification first…" }, durationMs: 812, tokens: 1204, outcome: "ok", startedAt: hoursAgo(now, 2) },
    { id: "span_demo_2", traceId: "t_demo", seq: 1, kind: "tool_call", name: "verifyIdentity", input: { trackingNumber: "SS-4417-DEMO", phoneLast4: "7742" }, output: { ok: true }, durationMs: 34, tokens: null, outcome: "ok", startedAt: hoursAgo(now, 2) },
    { id: "span_demo_3", traceId: "t_demo", seq: 2, kind: "tool_call", name: "getShipmentDetail", input: { trackingNumber: "SS-4417-DEMO" }, output: { status: "exception" }, durationMs: 41, tokens: null, outcome: "ok", startedAt: hoursAgo(now, 2) },
    { id: "span_demo_4", traceId: "t_demo", seq: 3, kind: "model_call", name: "gemini-3.6-flash", input: null, output: { text: "shipment status + timeline card" }, durationMs: 1096, tokens: 1488, outcome: "ok", startedAt: hoursAgo(now, 2) },
  ]);

  console.log("Seeded 5 demo shipments + 1 demo chat/trace.");
}

// ESM-safe equivalent of `require.main === module`: only auto-run (and exit the process) when this
// file is executed directly by tsx/node, never when imported (e.g. by the eval harness). Compares
// via pathToFileURL rather than a hand-rolled "file://" + argv[1] string, which doesn't reliably
// match on every OS/path shape (confirmed: the naive version silently never matched here).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
