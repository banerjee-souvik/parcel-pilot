import { generateId, type UIMessage } from "ai";
import * as services from "@/lib/domain/services";
import { recordActionTrace } from "@/lib/tracing";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params;
  const { chatId }: { chatId: string } = await req.json();

  const startedAt = Date.now();
  const result = await services.cancelProposal(proposalId, chatId);
  const durationMs = Date.now() - startedAt;

  await recordActionTrace({
    chatId,
    name: "cancelProposal",
    input: { proposalId },
    output: result,
    durationMs,
    outcome: result.ok ? "cancelled" : "refused",
    status: "completed",
  });

  if (!result.ok) {
    return Response.json({ result }, { status: 409 });
  }

  const message: UIMessage = {
    id: generateId(),
    role: "assistant",
    parts: [{ type: "data-receipt", data: { status: "cancelled" as const } }],
  };
  await services.persistMessage(chatId, { id: message.id, role: message.role, parts: message.parts });

  return Response.json({ result, message });
}
