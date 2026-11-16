import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createPaymentLink } from "@/lib/adapters/payments";
import { requireSession, badRequest } from "@/lib/api";

const PAN_THRESHOLD = 200000;

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const payments = await prisma.payment.findMany({
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  const amount = Number(b.amount);
  if (!(amount > 0)) return badRequest("Amount must be positive");
  const purpose = String(b.purpose || "").trim();
  if (!purpose) return badRequest("Purpose is required");
  if (b.customerId && !(await prisma.customer.findUnique({ where: { id: String(b.customerId) } }))) {
    return badRequest("Customer not found", 404);
  }
  const payment = await createPaymentLink({
    customerId: b.customerId ? String(b.customerId) : undefined,
    amount,
    purpose,
    panRequired: amount >= PAN_THRESHOLD || Boolean(b.panRequired),
  });
  await auditLog("CREATE", "Payment", payment.id, auth.session.userId, { amount, purpose });
  return NextResponse.json(payment, { status: 201 });
}
