import { generateId, type UIMessage } from "ai";
import * as services from "@/lib/domain/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params;
  const { chatId }: { chatId: string } = await req.json();

  const result = await services.cancelProposal(proposalId, chatId);

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
