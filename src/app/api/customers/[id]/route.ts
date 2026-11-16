import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { canSeeFullCustomer } from "@/lib/roles";
import { isElevated } from "@/lib/auth";
import { requireSession, badRequest } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const fullInclude = {
  visits: { include: { items: { include: { product: true } }, assignedCro: { select: { name: true } } }, orderBy: { startedAt: "desc" } },
  estimates: { include: { lines: true }, orderBy: { createdAt: "desc" } },
  holds: { include: { product: true }, orderBy: { createdAt: "desc" } },
  messages: { orderBy: { createdAt: "desc" }, take: 100 },
  feedback: { orderBy: { createdAt: "desc" } },
  loyalty: true,
  consents: true,
  payments: true,
  bookings: true,
} as const;

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id }, include: fullInclude });
  if (!customer) return badRequest("Customer not found", 404);

  if (req.nextUrl.searchParams.get("export") === "1") {
    if (!canSeeFullCustomer(session.role) && !isElevated(session)) {
      return badRequest("Exports require Owner/Manager/Support role or OTP elevation", 403);
    }
    await auditLog("EXPORT", "Customer", id, session.userId, { note: "Customer data export (JSON)" });
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), exportedBy: session.email, customer }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="customer-${id}.json"`,
      },
    });
  }
  return NextResponse.json(customer);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.notes === "string") data.notes = b.notes;
  if (typeof b.email === "string") data.email = b.email || null;
  if (typeof b.preferredMetal === "string") data.preferredMetal = b.preferredMetal || null;
  if (typeof b.whatsappOptIn === "boolean") data.whatsappOptIn = b.whatsappOptIn;
  if (!Object.keys(data).length) return badRequest("Nothing to update");
  const updated = await prisma.customer.update({ where: { id }, data });
  if (typeof b.whatsappOptIn === "boolean") {
    await prisma.consent.create({ data: { customerId: id, channel: "WHATSAPP", granted: b.whatsappOptIn, source: "CRM" } });
  }
  await auditLog("UPDATE", "Customer", id, session.userId, { fields: Object.keys(data) });
  return NextResponse.json(updated);
}
