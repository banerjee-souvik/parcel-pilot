import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { ActionKind, ActionState, ShipmentStatus } from "../domain/types";

export const shipments = pgTable("shipments", {
  trackingNumber: text("tracking_number").primaryKey(),
  recipientName: text("recipient_name").notNull(),
  phoneLast4: text("phone_last4").notNull(),
  addressLine: text("address_line").notNull(),
  city: text("city").notNull(),
  status: text("status").notNull().$type<ShipmentStatus>(),
  packageCount: integer("package_count").notNull().default(1),
  sender: text("sender").notNull(),
  eta: timestamp("eta", { withTimezone: true }),
  originalEta: timestamp("original_eta", { withTimezone: true }),
  deliveryWindow: text("delivery_window"),
  deliveryInstructions: text("delivery_instructions"),
  exception: jsonb("exception").$type<{ code: string; summary: string } | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shipmentEvents = pgTable("shipment_events", {
  id: text("id").primaryKey(),
  trackingNumber: text("tracking_number")
    .notNull()
    .references(() => shipments.trackingNumber),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  location: text("location"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
});

export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  title: text("title"),
  activeStreamId: text("active_stream_id"),
  verifiedTrackingNumbers: jsonb("verified_tracking_numbers").$type<string[]>().notNull().default([]),
  // Set once, on the first shipment a chat ever engages with (lookup, verify, or propose — whichever
  // comes first); every subsequent shipment-touching call is refused if it names a different tracking
  // number. A session is about one shipment, not a general-purpose lookup tool. See decisions.md.
  scopedTrackingNumber: text("scoped_tracking_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id),
  role: text("role").notNull(),
  parts: jsonb("parts").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Two-phase actions. State machine: proposed -> confirmed -> executed | failed; proposed -> cancelled | expired.
export const actions = pgTable(
  "actions",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id),
    trackingNumber: text("tracking_number").notNull(),
    kind: text("kind").notNull().$type<ActionKind>(),
    payload: jsonb("payload").notNull(),
    state: text("state").notNull().default("proposed").$type<ActionState>(),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("actions_chat_proposal_unique").on(t.chatId, t.id)]
);

export const traces = pgTable("traces", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("running"),
  totalTokens: integer("total_tokens"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const traceSpans = pgTable("trace_spans", {
  id: text("id").primaryKey(),
  traceId: text("trace_id")
    .notNull()
    .references(() => traces.id),
  seq: integer("seq").notNull(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  durationMs: integer("duration_ms"),
  tokens: integer("tokens"),
  outcome: text("outcome"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
});
