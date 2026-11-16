import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireSession, badRequest, MANAGEMENT } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireSession(MANAGEMENT);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["name", "category", "purity", "metal"] as const) if (typeof b[k] === "string" && b[k]) data[k] = b[k];
  for (const k of ["weightGrams", "makingCharge", "stoneValue"] as const) if (b[k] !== undefined && b[k] !== "") data[k] = Number(b[k]);
  if (b.stockQty !== undefined && b.stockQty !== "") data.stockQty = Math.max(0, Math.floor(Number(b.stockQty)));
  if (b.priceOverride !== undefined) data.priceOverride = b.priceOverride ? Number(b.priceOverride) : null;
  if (typeof b.available === "boolean") data.available = b.available;
  if (b.rackId !== undefined) data.rackId = b.rackId || null;
  if (!Object.keys(data).length) return badRequest("Nothing to update");
  const product = await prisma.product.update({ where: { id }, data });
  await auditLog("UPDATE", "Product", id, auth.session.userId, data);
  return NextResponse.json(product);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireSession(["OWNER", "MANAGER"]);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const refs = await prisma.visitItem.count({ where: { productId: id } });
  const holds = await prisma.hold.count({ where: { productId: id } });
  const lines = await prisma.estimateItem.count({ where: { productId: id } });
  const mismatches = await prisma.stockMismatch.count({ where: { productId: id } });
  if (refs || holds || lines || mismatches) {
    const product = await prisma.product.update({ where: { id }, data: { available: false, stockQty: 0 } });
    await auditLog("ARCHIVE", "Product", id, auth.session.userId);
    return NextResponse.json({ archived: true, product });
  }
  await prisma.product.delete({ where: { id } });
  await auditLog("DELETE", "Product", id, auth.session.userId);
  return NextResponse.json({ deleted: true });
}
