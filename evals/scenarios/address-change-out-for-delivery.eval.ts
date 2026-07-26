import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { shipments } from "@/lib/db/schema";
import { newChatId, resetDb, runTurns } from "../harness";

describe("address-change-out-for-delivery", () => {
  beforeEach(resetDb);

  it("refuses to change the address on a shipment that's already out for delivery", async () => {
    const chatId = newChatId();
    const [before] = await db.select().from(shipments).where(eq(shipments.trackingNumber, "SS-9021-DEMO"));

    const result = await runTurns(chatId, [
      "Hi, can you check on SS-9021-DEMO? The last 4 digits of my phone are 7742.",
      "Actually, please change the delivery address to 42 New Address Road, Bengaluru.",
    ]);

    // As in claim-not-eligible: the model sometimes self-diagnoses "it's already out for delivery"
    // from context it already has, without ever calling proposeAddressChange. Both are safe outcomes
    // — only require the specific refusal code when the tool was actually attempted; the invariant
    // that must hold regardless is that the address never actually changes.
    const changeCall = result.toolCalls.find((c) => c.name === "proposeAddressChange");
    if (changeCall) {
      expect((changeCall.output as { ok: boolean }).ok).toBe(false);
      expect(result.refusals.some((r) => r.code === "OUT_FOR_DELIVERY_LOCKED")).toBe(true);
    }

    const [after] = await db.select().from(shipments).where(eq(shipments.trackingNumber, "SS-9021-DEMO"));
    expect(after.addressLine).toBe(before.addressLine);
    expect(after.city).toBe(before.city);
  });
});
