import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { confirmPayment } from "@/lib/adapters/payments";
import { refreshCustomerStage } from "@/lib/stages";

/** Public mock payment gateway callback (the payment link points here). */
async function confirm(ref: string | null) {
  if (!ref) return { status: 400, body: { error: "ref is required" } };
  const existing = await prisma.payment.findUnique({ where: { providerRef: ref } });
  if (!existing) return { status: 404, body: { error: "Payment not found" } };
  if (existing.status === "PAID") return { status: 200, body: { ok: true, alreadyPaid: true, payment: existing } };
  const payment = await confirmPayment(ref);
  await auditLog("CONFIRM", "Payment", payment.id, null, { amount: payment.amount, purpose: payment.purpose });
  if (payment.customerId) await refreshCustomerStage(payment.customerId);
  return { status: 200, body: { ok: true, payment } };
}

export async function GET(req: NextRequest) {
  const wantsJson = req.headers.get("accept")?.includes("application/json");
  const result = await confirm(req.nextUrl.searchParams.get("ref"));
  if (wantsJson) return NextResponse.json(result.body, { status: result.status });
  const ok = result.status === 200;
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Georgia,serif;background:#292724;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center;padding:24px"><h1>${ok ? "Payment received" : "Payment failed"}</h1><p>${ok ? "Thank you. This is a mock payment confirmation." : String((result.body as { error?: string }).error || "Unknown error")}</p></div></body>`;
  return new NextResponse(html, { status: result.status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await confirm(String(body.ref || req.nextUrl.searchParams.get("ref") || "") || null);
  return NextResponse.json(result.body, { status: result.status });
}
