import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/adapters/whatsapp";
import { auditLog } from "@/lib/audit";
import { requireSession, badRequest } from "@/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  if (!b.to || !b.body) return badRequest("`to` and `body` are required");
  const result = await sendWhatsApp({
    to: String(b.to),
    body: String(b.body),
    customerId: b.customerId,
    campaignId: b.campaignId,
    channel: b.channel,
  });
  await auditLog("SEND", "MessageLog", result.logId, auth.session.userId);
  return NextResponse.json(result);
}
