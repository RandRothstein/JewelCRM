import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { scanRack } from "@/lib/adapters/rfid";
import { requireSession, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [checks, racks] = await Promise.all([
    prisma.stockCheck.findMany({
      include: { mismatches: { include: { product: true } }, performedBy: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.rack.findMany({ orderBy: { code: "asc" } }),
  ]);
  return NextResponse.json({ checks, racks });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "start");

  if (action === "start") {
    const rackId = String(b.rackId || "");
    if (!rackId) return badRequest("Select a rack to scan");
    const rack = await prisma.rack.findUnique({ where: { id: rackId } });
    if (!rack) return badRequest("Rack not found", 404);
    const scan = await scanRack(rackId);
    const bad = scan.filter((s) => s.expectedQty !== s.actualQty);
    const check = await prisma.stockCheck.create({
      data: {
        performedById: session.userId,
        rackId,
        completedAt: bad.length ? undefined : new Date(),
        notes: `RFID scan of ${rack.code}: ${scan.length} SKUs, ${bad.length} mismatches`,
        mismatches: {
          create: bad.map((s) => ({ productId: s.productId, expectedQty: s.expectedQty, actualQty: s.actualQty })),
        },
      },
      include: { mismatches: { include: { product: true } } },
    });
    await auditLog("CREATE", "StockCheck", check.id, session.userId, { rackId, scanned: scan.length, mismatches: bad.length });
    return NextResponse.json(check, { status: 201 });
  }

  if (action === "approve") {
    if (session.role !== "OWNER" && session.role !== "MANAGER") {
      return badRequest("Only a manager or owner can approve stock adjustments", 403);
    }
    const mismatch = await prisma.stockMismatch.findUnique({ where: { id: String(b.mismatchId || "") } });
    if (!mismatch) return badRequest("Mismatch not found", 404);
    if (mismatch.resolved) return badRequest("Mismatch already resolved", 409);

    await prisma.$transaction(async (tx) => {
      if (mismatch.productId) {
        await tx.product.update({ where: { id: mismatch.productId }, data: { stockQty: mismatch.actualQty } });
      }
      await tx.stockMismatch.update({
        where: { id: mismatch.id },
        data: { resolved: true, approvedById: session.userId, approvedAt: new Date(), notes: b.notes ? String(b.notes) : mismatch.notes },
      });
      const open = await tx.stockMismatch.count({ where: { stockCheckId: mismatch.stockCheckId, resolved: false } });
      if (open === 0) await tx.stockCheck.update({ where: { id: mismatch.stockCheckId }, data: { completedAt: new Date() } });
    });
    await auditLog("APPROVE", "StockMismatch", mismatch.id, session.userId, {
      productId: mismatch.productId,
      from: mismatch.expectedQty,
      to: mismatch.actualQty,
    });
    return NextResponse.json({ resolved: true });
  }

  return badRequest("Unknown action");
}
