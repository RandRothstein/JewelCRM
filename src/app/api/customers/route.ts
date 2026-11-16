import { NextRequest, NextResponse } from "next/server";
import type { CustomerStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { refreshCustomerStage } from "@/lib/stages";
import { requireSession, badRequest, normalizePhone } from "@/lib/api";

const STAGES: CustomerStage[] = ["LEAD", "PROSPECT", "INTERESTED", "ESTIMATED", "CUSTOMER", "REPEAT", "LAPSED"];

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const stage = req.nextUrl.searchParams.get("stage");
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const customers = await prisma.customer.findMany({
    where: {
      ...(stage && (STAGES as string[]).includes(stage) ? { stage: stage as CustomerStage } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    include: { loyalty: true, _count: { select: { visits: true, estimates: true, holds: true } } },
    orderBy: { lastActivityAt: "desc" },
    take: 500,
  });
  const counts = await prisma.customer.groupBy({ by: ["stage"], _count: true });
  return NextResponse.json({ customers, stageCounts: Object.fromEntries(counts.map((c) => [c.stage, c._count])) });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const phone = normalizePhone(b.phone);
  if (!name || phone.length < 8) return badRequest("Name and a valid phone are required");
  if (await prisma.customer.findUnique({ where: { phone } })) return badRequest("A customer with this phone already exists", 409);
  const optIn = Boolean(b.whatsappOptIn || b.consent);
  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
      email: b.email || null,
      preferredMetal: b.preferredMetal || null,
      notes: b.notes || null,
      source: b.source || "WALK_IN",
      whatsappOptIn: optIn,
      stage: optIn ? "PROSPECT" : "LEAD",
      consents: optIn ? { create: { channel: "WHATSAPP", granted: true, source: "CRM" } } : undefined,
    },
  });
  await auditLog("CREATE", "Customer", customer.id, session.userId);
  await refreshCustomerStage(customer.id);
  return NextResponse.json(customer, { status: 201 });
}
