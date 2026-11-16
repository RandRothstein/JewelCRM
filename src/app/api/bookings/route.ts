import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireSession, badRequest, normalizePhone, parseDate } from "@/lib/api";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [bookings, users, products] = await Promise.all([
    prisma.booking.findMany({
      include: { customer: { select: { id: true, name: true } }, assignedTo: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    }),
    prisma.user.findMany({ where: { active: true, role: { in: ["SALES_CRO", "MANAGER", "OWNER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: { id: true, name: true, sku: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ bookings, users, products });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));

  if (b.action === "status") {
    const status = String(b.status || "");
    if (!["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) return badRequest("Invalid status");
    const updated = await prisma.booking.update({ where: { id: String(b.bookingId) }, data: { status } }).catch(() => null);
    if (!updated) return badRequest("Booking not found", 404);
    await auditLog("UPDATE", "Booking", updated.id, session.userId, { status });
    return NextResponse.json(updated);
  }

  const guestName = String(b.guestName || "").trim();
  const phone = normalizePhone(b.phone);
  const scheduledAt = parseDate(b.scheduledAt);
  if (!guestName || phone.length < 8) return badRequest("Guest name and phone are required");
  if (!scheduledAt) return badRequest("A valid date and time is required");
  if (scheduledAt.getTime() < Date.now() - 5 * 60000) return badRequest("Booking time must be in the future");

  const customer = b.customerId
    ? await prisma.customer.findUnique({ where: { id: String(b.customerId) } })
    : await prisma.customer.findUnique({ where: { phone } });
  const productIds: string[] = Array.isArray(b.productIds) ? b.productIds.map(String) : b.productId ? [String(b.productId)] : [];

  const booking = await prisma.booking.create({
    data: {
      customerId: customer?.id,
      guestName,
      phone,
      scheduledAt,
      purpose: b.purpose ? String(b.purpose) : null,
      assignedToId: b.assignedToId || null,
      productIds: JSON.stringify(productIds),
    },
  });
  await auditLog("CREATE", "Booking", booking.id, session.userId, { scheduledAt });
  return NextResponse.json(booking, { status: 201 });
}
