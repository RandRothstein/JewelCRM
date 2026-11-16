import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { getSettingNumber } from "@/lib/settings";
import { requireSession, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const accounts = await prisma.loyaltyAccount.findMany({
    include: { customer: { select: { id: true, name: true, phone: true } }, coupons: { orderBy: { id: "desc" }, take: 5 } },
    orderBy: { points: "desc" },
  });
  const pointValue = await getSettingNumber("loyaltyPointValueInr", 1);
  return NextResponse.json({ accounts, pointValue });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["OWNER", "MANAGER", "SUPPORT", "SALES_CRO"]);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const value = Number(b.value);
  if (!(value > 0)) return badRequest("Coupon value must be positive");
  if (value > 50000) return badRequest("Coupon value above ₹50,000 needs owner approval", 403);

  let account = b.accountId ? await prisma.loyaltyAccount.findUnique({ where: { id: String(b.accountId) } }) : null;
  if (!account && b.customerId) {
    account = await prisma.loyaltyAccount.upsert({ where: { customerId: String(b.customerId) }, update: {}, create: { customerId: String(b.customerId) } });
  }
  if (!account) return badRequest("Loyalty account not found", 404);

  const days = Math.max(1, Number(b.expiresInDays) || 30);
  const code = `JC-${randomBytes(4).toString("hex").toUpperCase()}`;
  const coupon = await prisma.coupon.create({
    data: {
      accountId: account.id,
      customerId: account.customerId,
      code,
      qrPayload: `jewelcrm://coupon/${code}`,
      value,
      scopeJson: JSON.stringify({ appliesTo: "MAKING_CHARGE" }),
      expiresAt: new Date(Date.now() + days * 86400000),
    },
  });
  await auditLog("CREATE", "Coupon", coupon.id, session.userId, { accountId: account.id, value, code });
  return NextResponse.json(coupon, { status: 201 });
}
