import { db } from "@/lib/db";
import { shipments } from "@/lib/db/schema";

// Demo-only convenience endpoint: the seeded tracking numbers + their live status, for the
// chat header's "demo shipments" menu (README documents this as the fast path for testing).
// No PII — trackingNumber and status only, same fields the landing page already exposes.
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ trackingNumber: shipments.trackingNumber, status: shipments.status })
    .from(shipments)
    .orderBy(shipments.trackingNumber);
  return Response.json({ shipments: rows });
}
