import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { createHold } from "@/lib/holds";
import { getSettingNumber } from "@/lib/settings";
import { getLatestRates, computeProductPrice } from "@/lib/rates";
import { refreshCustomerStage } from "@/lib/stages";
import { requireSession, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [holds, customers, products, rates, maxActive] = await Promise.all([
    prisma.hold.findMany({ include: { customer: true, product: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.customer.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.product.findMany({ where: { available: true, stockQty: { gt: 0 } }, orderBy: { name: "asc" } }),
    getLatestRates(),
    getSettingNumber("holdMaxActive", 2),
  ]);
  return NextResponse.json({
    holds,
    customers,
    maxActive,
    products: products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, purity: p.purity, price: computeProductPrice(p, rates).price })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "create");

  if (action === "create") {
    if (!b.productId || !b.customerId) return badRequest("Product and customer are required");
    const result = await createHold({
      productId: String(b.productId),
      customerId: String(b.customerId),
      actorId: session.userId,
      notes: b.notes ? String(b.notes) : undefined,
    });
    if (!result.ok) return badRequest(result.error, result.status);
    return NextResponse.json({ hold: result.hold, depositPaymentUrl: result.depositPaymentUrl }, { status: 201 });
  }

  const hold = await prisma.hold.findUnique({ where: { id: String(b.holdId || "") }, include: { product: true } });
  if (!hold) return badRequest("Hold not found", 404);
  if (hold.status !== "ACTIVE") return badRequest(`Hold is already ${hold.status}`, 409);

  if (action === "cancel") {
    const updated = await prisma.hold.update({
      where: { id: hold.id },
      data: { status: "CANCELLED", cancelReason: b.reason ? String(b.reason) : "Cancelled by staff" },
    });
    await prisma.product.update({ where: { id: hold.productId }, data: { available: true } });
    const depositNote =
      hold.depositAmount > 0 ? (hold.depositPolicy === "KEEP" ? "Deposit is retained per policy." : "Deposit is refundable per policy.") : null;
    await auditLog("CANCEL", "Hold", hold.id, session.userId, { reason: b.reason, depositNote });
    await refreshCustomerStage(hold.customerId);
    return NextResponse.json({ hold: updated, depositNote });
  }

  if (action === "extend") {
    const holdHours = await getSettingNumber("holdHours", 24);
    const maxTotalMs = holdHours * 3 * 3600000;
    const newExpiry = new Date(new Date(hold.expiresAt).getTime() + holdHours * 3600000);
    if (newExpiry.getTime() - new Date(hold.createdAt).getTime() > maxTotalMs) {
      return badRequest(`Holds can be extended up to ${holdHours * 3}h in total`, 409);
    }
    const updated = await prisma.hold.update({ where: { id: hold.id }, data: { expiresAt: newExpiry, remindedAt: null } });
    await auditLog("EXTEND", "Hold", hold.id, session.userId, { expiresAt: newExpiry });
    return NextResponse.json({ hold: updated });
  }

  return badRequest("Unknown action");
}
