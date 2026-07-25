import { tool } from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";
import * as services from "../domain/services";

// Every tool is a thin wrapper over domain/services.ts. State-changing tools only ever *propose* —
// there is no tool that executes a change. See tech-design.md §9.
export function buildTools({ chatId }: { chatId: string }) {
  return {
    lookupShipment: tool({
      description: "Look up a shipment by tracking number. Returns only status and city — no address or timeline details until identity is verified.",
      inputSchema: z.object({ trackingNumber: z.string() }),
      execute: async ({ trackingNumber }) => services.lookupShipment(trackingNumber),
    }),

    verifyIdentity: tool({
      description: "Verify the customer's identity for a tracking number using the last 4 digits of the phone number on the order. Must succeed before shipment details can be disclosed.",
      inputSchema: z.object({ trackingNumber: z.string(), phoneLast4: z.string().length(4) }),
      execute: async ({ trackingNumber, phoneLast4 }) => services.verifyIdentity(chatId, trackingNumber, phoneLast4),
    }),

    getShipmentDetail: tool({
      description: "Get full shipment detail — status, address, timeline events, exceptions. Requires prior identity verification for this tracking number.",
      inputSchema: z.object({ trackingNumber: z.string() }),
      execute: async ({ trackingNumber }) => {
        const result = await services.getShipmentDetail(chatId, trackingNumber);
        return result.ok ? { ...result, renderHint: "timeline" } : result;
      },
    }),

    getRescheduleOptions: tool({
      description: "Get valid reschedule dates and delivery windows for a shipment. Requires prior identity verification.",
      inputSchema: z.object({ trackingNumber: z.string() }),
      execute: async ({ trackingNumber }) => {
        const result = await services.getRescheduleOptions(chatId, trackingNumber);
        return result.ok ? { ...result, renderHint: "datePicker" } : result;
      },
    }),

    proposeReschedule: tool({
      description: "Propose rescheduling a delivery to a new date and window. Does NOT execute the change — creates a proposal the customer must confirm in the UI.",
      inputSchema: z.object({
        trackingNumber: z.string(),
        date: z.string().describe("YYYY-MM-DD"),
        window: z.enum(["09:00-13:00", "13:00-18:00"]),
      }),
      execute: async ({ trackingNumber, date, window }) => {
        const result = await services.proposeAction(chatId, { kind: "reschedule", trackingNumber, date, window });
        return result.ok ? { ...result, renderHint: "confirmCard" } : result;
      },
    }),

    proposeAddressChange: tool({
      description: "Propose changing the delivery address. Does NOT execute the change — creates a proposal the customer must confirm in the UI.",
      inputSchema: z.object({ trackingNumber: z.string(), addressLine: z.string(), city: z.string() }),
      execute: async ({ trackingNumber, addressLine, city }) => {
        const result = await services.proposeAction(chatId, { kind: "change_address", trackingNumber, addressLine, city });
        return result.ok ? { ...result, renderHint: "confirmCard" } : result;
      },
    }),

    proposeInstructionsUpdate: tool({
      description: "Propose updating delivery instructions for the courier. Does NOT execute the change — creates a proposal the customer must confirm in the UI.",
      inputSchema: z.object({ trackingNumber: z.string(), instructions: z.string().max(200) }),
      execute: async ({ trackingNumber, instructions }) => {
        const result = await services.proposeAction(chatId, { kind: "update_instructions", trackingNumber, instructions });
        return result.ok ? { ...result, renderHint: "confirmCard" } : result;
      },
    }),

    proposeClaim: tool({
      description: "Propose filing a damage or missing-item claim. Only valid once a shipment is delivered or lost. Does NOT execute — creates a proposal the customer must confirm in the UI.",
      inputSchema: z.object({
        trackingNumber: z.string(),
        type: z.enum(["damaged", "missing"]),
        description: z.string(),
      }),
      execute: async ({ trackingNumber, type, description }) => {
        const result = await services.proposeAction(chatId, { kind: "file_claim", trackingNumber, type, description });
        return result.ok ? { ...result, renderHint: "confirmCard" } : result;
      },
    }),

    escalateToHuman: tool({
      description: "Hand off to a human agent when the request is outside what you can do (full cancellations, refunds, anything else you can't act on).",
      inputSchema: z.object({ reason: z.string() }),
      execute: async ({ reason }) => ({
        ok: true as const,
        data: {
          referenceNumber: `ESC-${nanoid(6).toUpperCase()}`,
          message: `I've flagged this for a human agent: ${reason}. They'll follow up shortly.`,
        },
      }),
    }),
  };
}
