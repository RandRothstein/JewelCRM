import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { upsertSetting } from "@/lib/settings";
import { requireSession, badRequest, MANAGEMENT } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [settings, rates, costs] = await Promise.all([
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
    prisma.goldRate.findMany({ orderBy: [{ purity: "asc" }, { effectiveAt: "desc" }], take: 60 }),
    prisma.monthlyCostLine.findMany({ where: { month }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ settings, rates, costs, month, role: auth.session.role });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const body = await req.json().catch(() => ({}));

  if (body.type === "goldRate") {
    const ratePerGram = Number(body.ratePerGram);
    if (!(ratePerGram > 0)) return badRequest("Rate per gram must be positive");
    const rate = await prisma.goldRate.create({ data: { purity: String(body.purity || "22K"), ratePerGram } });
    await auditLog("CREATE", "GoldRate", rate.id, session.userId, { purity: rate.purity, ratePerGram });
    return NextResponse.json(rate, { status: 201 });
  }

  if (body.type === "cost") {
    const amount = Number(body.amount);
    const label = String(body.label || "").trim();
    if (!label || !(amount >= 0)) return badRequest("Label and a non-negative amount are required");
    const line = await prisma.monthlyCostLine.create({
      data: {
        month: String(body.month || new Date().toISOString().slice(0, 7)),
        category: String(body.category || "OTHER"),
        label,
        amount,
        units: Math.max(1, Math.floor(Number(body.units) || 1)),
        notes: body.notes ? String(body.notes) : null,
      },
    });
    await auditLog("CREATE", "MonthlyCostLine", line.id, session.userId, { label, amount });
    return NextResponse.json(line, { status: 201 });
  }

  if (body.key) {
    const row = await upsertSetting(String(body.key), String(body.value), body.description);
    await auditLog("UPDATE", "Setting", row.id, session.userId, { key: body.key, value: body.value });
    return NextResponse.json(row);
  }
  return badRequest("Invalid payload");
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT);
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("costId");
  if (!id) return badRequest("costId required");
  await prisma.monthlyCostLine.delete({ where: { id } }).catch(() => null);
  await auditLog("DELETE", "MonthlyCostLine", id, auth.session.userId);
  return NextResponse.json({ deleted: true });
}
