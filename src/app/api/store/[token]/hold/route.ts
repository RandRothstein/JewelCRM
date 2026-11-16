import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHold } from "@/lib/holds";
import { resolveStoreToken } from "@/lib/store";
import { badRequest, normalizePhone } from "@/lib/api";

/** Public endpoint: a valid store token authorises placing a hold. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const store = await resolveStoreToken(token);
  if (!store) return badRequest("Invalid store link", 404);
  if (store.kind === "expired") return badRequest("This store link has expired", 410);

  const b = await req.json().catch(() => ({}));
  const productId = String(b.productId || "");
  if (!productId) return badRequest("Product is required");

  let customerId = store.customerId;
  if (!customerId) {
    const name = String(b.name || "").trim();
    const phone = normalizePhone(b.phone);
    if (!name || phone.length < 8) return badRequest("Name and phone are required to place a hold");
    const consent = Boolean(b.whatsappConsent);
    const existing = await prisma.customer.findUnique({ where: { phone } });
    const customer =
      existing ??
      (await prisma.customer.create({
        data: { name, phone, source: "ONLINE_STORE", whatsappOptIn: consent, stage: consent ? "PROSPECT" : "LEAD" },
      }));
    if (consent && !customer.whatsappOptIn) {
      await prisma.customer.update({ where: { id: customer.id }, data: { whatsappOptIn: true } });
      await prisma.consent.create({ data: { customerId: customer.id, channel: "WHATSAPP", granted: true, source: "STORE_LINK" } });
    }
    customerId = customer.id;
  }

  const result = await createHold({ productId, customerId, actorId: null, notes: "Placed via public store link" });
  if (!result.ok) return badRequest(result.error, result.status);
  return NextResponse.json(
    {
      productId,
      lockedPrice: result.hold.lockedPrice,
      expiresAt: result.hold.expiresAt,
      depositAmount: result.hold.depositAmount,
      depositPaymentUrl: result.depositPaymentUrl ?? null,
    },
    { status: 201 }
  );
}
