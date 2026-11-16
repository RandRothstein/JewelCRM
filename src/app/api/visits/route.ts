import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { refreshCustomerStage } from "@/lib/stages";
import { getSettingNumber } from "@/lib/settings";
import { getLatestRates, computeProductPrice } from "@/lib/rates";
import { requireSession, badRequest, normalizePhone } from "@/lib/api";

const OUTCOMES = ["BOUGHT", "ESTIMATE", "BROWSE", "LEFT"] as const;

const visitInclude = {
  customer: true,
  greeter: { select: { id: true, name: true } },
  assignedCro: { select: { id: true, name: true } },
  items: { include: { product: true } },
  estimates: { include: { lines: true, saleLinks: true } },
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const status = req.nextUrl.searchParams.get("status") || "open";

  const [visits, cros, products, rates] = await Promise.all([
    prisma.visit.findMany({
      where: status === "open" ? { endedAt: null } : {},
      include: visitInclude,
      orderBy: { startedAt: "desc" },
      take: status === "open" ? 100 : 50,
    }),
    prisma.user.findMany({
      where: { role: "SALES_CRO", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({ where: { available: true, stockQty: { gt: 0 } }, orderBy: { name: "asc" } }),
    getLatestRates(),
  ]);
  return NextResponse.json({
    visits: visits.map((v) => ({
      ...v,
      estimates: v.estimates.map((e) => ({ ...e, saleLinks: e.saleLinks.map((l) => ({ token: l.token })) })),
    })),
    cros,
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      purity: p.purity,
      weightGrams: p.weightGrams,
      price: computeProductPrice(p, rates).price,
    })),
  });
}

async function pickCro() {
  const cros = await prisma.user.findMany({ where: { role: "SALES_CRO", active: true } });
  if (!cros.length) return null;
  const now = new Date();
  const onShift = await prisma.staffShift.findMany({
    where: { userId: { in: cros.map((c) => c.id) }, plannedStart: { lte: now }, plannedEnd: { gte: now } },
  });
  const shiftIds = new Set(onShift.map((s) => s.userId));
  const pool = cros.filter((c) => shiftIds.has(c.id));
  const candidates = pool.length ? pool : cros;
  const open = await prisma.visit.groupBy({
    by: ["assignedCroId"],
    where: { endedAt: null, assignedCroId: { in: candidates.map((c) => c.id) } },
    _count: true,
  });
  const load = new Map(open.map((o) => [o.assignedCroId, o._count]));
  return [...candidates].sort((a, b) => (load.get(a.id) || 0) - (load.get(b.id) || 0))[0];
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "start");

  if (action === "start") {
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    if (!name || phone.length < 8) return badRequest("Name and a valid phone number are required");
    const optIn = Boolean(body.whatsappConsent);

    const existing = await prisma.customer.findUnique({ where: { phone } });
    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: { name: existing.name || name, lastActivityAt: new Date(), ...(optIn && !existing.whatsappOptIn ? { whatsappOptIn: true } : {}) },
        })
      : await prisma.customer.create({
          data: { name, phone, whatsappOptIn: optIn, source: "WALK_IN", stage: optIn ? "PROSPECT" : "LEAD" },
        });
    if (optIn && !existing?.whatsappOptIn) {
      await prisma.consent.create({ data: { customerId: customer.id, channel: "WHATSAPP", granted: true, source: "GREETER_DESK" } });
    }

    const openVisit = await prisma.visit.findFirst({ where: { customerId: customer.id, endedAt: null } });
    if (openVisit) return badRequest("This customer already has an open visit", 409);

    let assignedCroId: string | null = body.assignedCroId ? String(body.assignedCroId) : null;
    if (!assignedCroId) assignedCroId = (await pickCro())?.id ?? null;

    const visit = await prisma.visit.create({
      data: {
        customerId: customer.id,
        greeterId: session.userId,
        staffId: session.userId,
        assignedCroId,
        reason: body.reason ? String(body.reason) : null,
        purpose: body.reason ? String(body.reason) : null,
      },
      include: visitInclude,
    });
    await auditLog("CREATE", "Visit", visit.id, session.userId, { customerId: customer.id, assignedCroId, returning: Boolean(existing) });
    await refreshCustomerStage(customer.id);
    return NextResponse.json({ visit, returning: Boolean(existing) }, { status: 201 });
  }

  const visitId = String(body.visitId || "");
  const visit = await prisma.visit.findUnique({ where: { id: visitId }, include: { items: true } });
  if (!visit) return badRequest("Visit not found", 404);

  if (action === "addProduct") {
    if (visit.endedAt) return badRequest("Visit already ended", 409);
    const productId = String(body.productId || "");
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return badRequest("Product not found", 404);
    if (visit.items.some((i) => i.productId === productId)) return badRequest("Product already added to this visit", 409);
    const item = await prisma.visitItem.create({
      data: { visitId, productId, interest: body.interest ? String(body.interest) : null },
    });
    await auditLog("CREATE", "VisitItem", item.id, session.userId, { visitId, productId });
    await refreshCustomerStage(visit.customerId);
    return NextResponse.json(item, { status: 201 });
  }

  if (action === "estimate") {
    if (visit.endedAt) return badRequest("Visit already ended", 409);
    const productIds: string[] = Array.isArray(body.productIds) && body.productIds.length ? body.productIds.map(String) : visit.items.map((i) => i.productId);
    if (!productIds.length) return badRequest("Add at least one product to the visit first");
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    if (!products.length) return badRequest("No valid products selected");

    const rates = await getLatestRates();
    const lines = products.map((p) => {
      const priced = computeProductPrice(p, rates);
      return {
        productId: p.id,
        label: `${p.name} (${p.sku})`,
        weightGrams: p.weightGrams,
        makingCharge: p.makingCharge,
        stoneValue: p.stoneValue,
        goldRate: priced.goldRate,
        quotedPrice: priced.price,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.quotedPrice, 0);
    const discount = Math.max(0, Number(body.discount) || 0);
    const maxPct = await getSettingNumber("maxStaffDiscountPct", 3);
    const privileged = session.role === "OWNER" || session.role === "MANAGER";
    if (!privileged && discount > (subtotal * maxPct) / 100) {
      return badRequest(`Discount exceeds the ${maxPct}% staff limit; ask a manager`, 403);
    }
    if (discount > subtotal) return badRequest("Discount cannot exceed subtotal");
    const total = subtotal - discount;
    const primaryRate = rates["22K"] ?? lines[0]?.goldRate ?? null;

    const estimate = await prisma.estimate.create({
      data: {
        customerId: visit.customerId,
        visitId,
        itemsJson: JSON.stringify(lines),
        subtotal,
        discount,
        total,
        goldRateUsed: primaryRate,
        validUntil: new Date(Date.now() + 7 * 86400000),
        lines: { create: lines },
        saleLinks: { create: { token: randomUUID().replace(/-/g, ""), expiresAt: new Date(Date.now() + 7 * 86400000) } },
      },
      include: { lines: true, saleLinks: true },
    });
    await auditLog("CREATE", "Estimate", estimate.id, session.userId, { visitId, total, discount });
    await refreshCustomerStage(visit.customerId);
    return NextResponse.json(estimate, { status: 201 });
  }

  if (action === "end") {
    const outcome = String(body.outcome || "");
    if (!(OUTCOMES as readonly string[]).includes(outcome)) return badRequest(`Outcome must be one of ${OUTCOMES.join(", ")}`);
    if (visit.endedAt) return badRequest("Visit already ended", 409);
    const updated = await prisma.visit.update({
      where: { id: visitId },
      data: {
        outcome: outcome as (typeof OUTCOMES)[number],
        endedAt: new Date(),
        notes: body.notes ? String(body.notes) : visit.notes,
      },
    });
    await auditLog("END", "Visit", visitId, session.userId, { outcome });
    await refreshCustomerStage(visit.customerId);
    return NextResponse.json(updated);
  }

  return badRequest("Unknown action");
}
