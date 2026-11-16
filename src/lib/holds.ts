import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { getSetting, getSettingNumber } from "@/lib/settings";
import { getLatestRates, computeProductPrice } from "@/lib/rates";
import { createPaymentLink } from "@/lib/adapters/payments";
import { refreshCustomerStage } from "@/lib/stages";

export type CreateHoldResult =
  | { ok: true; hold: Awaited<ReturnType<typeof prisma.hold.create>>; depositPaymentUrl?: string | null }
  | { ok: false; status: number; error: string };

/** Creates a 24h hold with locked gold rate/price, max-active enforcement and optional deposit. */
export async function createHold(input: {
  productId: string;
  customerId: string;
  actorId?: string | null;
  notes?: string;
}): Promise<CreateHoldResult> {
  const [product, customer] = await Promise.all([
    prisma.product.findUnique({ where: { id: input.productId } }),
    prisma.customer.findUnique({ where: { id: input.customerId } }),
  ]);
  if (!product) return { ok: false, status: 404, error: "Product not found" };
  if (!customer) return { ok: false, status: 404, error: "Customer not found" };
  if (!product.available || product.stockQty < 1) {
    return { ok: false, status: 409, error: "Product is not available for hold" };
  }

  const maxActive = await getSettingNumber("holdMaxActive", 2);
  const activeCount = await prisma.hold.count({
    where: { customerId: customer.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
  });
  if (activeCount >= maxActive) {
    return { ok: false, status: 409, error: `Customer already has ${maxActive} active holds (maximum)` };
  }

  const rates = await getLatestRates();
  const { goldRate, price } = computeProductPrice(product, rates);
  const holdHours = await getSettingNumber("holdHours", 24);
  const threshold = await getSettingNumber("holdDepositThreshold", 200000);
  const percent = await getSettingNumber("holdDepositPercent", 10);
  const policy = await getSetting("holdDepositPolicy", "REFUNDABLE");
  const depositAmount = price > threshold ? Math.round((price * percent) / 100) : 0;

  const hold = await prisma.hold.create({
    data: {
      productId: product.id,
      customerId: customer.id,
      lockedGoldRate: goldRate,
      lockedPrice: price,
      depositAmount,
      depositPolicy: policy,
      expiresAt: new Date(Date.now() + holdHours * 3600000),
      notes: input.notes,
    },
  });
  await prisma.product.update({ where: { id: product.id }, data: { available: false } });

  let depositPaymentUrl: string | null | undefined;
  if (depositAmount > 0) {
    const payment = await createPaymentLink({
      customerId: customer.id,
      amount: depositAmount,
      purpose: `HOLD_DEPOSIT:${hold.id}`,
      panRequired: depositAmount >= 200000,
    });
    depositPaymentUrl = payment.paymentUrl;
  }

  await auditLog("CREATE", "Hold", hold.id, input.actorId ?? null, {
    productId: product.id,
    customerId: customer.id,
    lockedPrice: price,
    depositAmount,
  });
  await refreshCustomerStage(customer.id);
  return { ok: true, hold, depositPaymentUrl };
}
