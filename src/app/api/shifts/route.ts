import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireSession, badRequest, parseDate, MANAGEMENT } from "@/lib/api";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [shifts, users, racks] = await Promise.all([
    prisma.staffShift.findMany({
      where: { plannedEnd: { gte: new Date() } },
      include: { user: { select: { id: true, name: true, role: true } }, rack: true },
      orderBy: { plannedStart: "asc" },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.rack.findMany({ orderBy: { code: "asc" } }),
  ]);
  return NextResponse.json({ shifts, users, racks });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const userId = String(b.userId || "");
  const start = parseDate(b.plannedStart);
  const end = parseDate(b.plannedEnd);
  if (!userId || !start || !end) return badRequest("User, start and end times are required");
  if (end <= start) return badRequest("End time must be after start time");
  if (!(await prisma.user.findUnique({ where: { id: userId } }))) return badRequest("User not found", 404);

  const clash = await prisma.staffShift.findFirst({
    where: { userId, plannedStart: { lt: end }, plannedEnd: { gt: start } },
    include: { user: { select: { name: true } } },
  });
  if (clash) {
    return badRequest(
      `${clash.user.name} already has an overlapping shift (${clash.plannedStart.toLocaleString("en-IN")} – ${clash.plannedEnd.toLocaleString("en-IN")})`,
      409
    );
  }

  const shift = await prisma.staffShift.create({
    data: {
      userId,
      rackId: b.rackId || null,
      task: b.task ? String(b.task) : null,
      notes: b.notes ? String(b.notes) : null,
      plannedStart: start,
      plannedEnd: end,
    },
    include: { user: { select: { id: true, name: true, role: true } }, rack: true },
  });
  await auditLog("CREATE", "StaffShift", shift.id, session.userId, { userId, start, end });
  return NextResponse.json(shift, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT);
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return badRequest("id required");
  await prisma.staffShift.delete({ where: { id } }).catch(() => null);
  await auditLog("DELETE", "StaffShift", id, auth.session.userId);
  return NextResponse.json({ deleted: true });
}
