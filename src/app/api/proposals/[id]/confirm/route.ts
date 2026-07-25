import { generateId, type UIMessage } from "ai";
import * as services from "@/lib/domain/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params;
  const { chatId }: { chatId: string } = await req.json();

  const result = await services.executeProposal(proposalId, chatId);

  if (!result.ok) {
    return Response.json({ result }, { status: 409 });
  }

  // Persist a receipt as a first-class message so the model sees on the next turn that this
  // action actually executed, not just that a proposal was created. See tech-design.md §10.
  const message: UIMessage = {
    id: generateId(),
    role: "assistant",
    parts: [{ type: "data-receipt", data: { status: "executed" as const, receipt: result.data } }],
  };
  await services.persistMessage(chatId, { id: message.id, role: message.role, parts: message.parts });

  return Response.json({ result, message });
}
