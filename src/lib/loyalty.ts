import { prisma } from "@/lib/prisma";
import { getSettingNumber } from "@/lib/settings";

export async function earnLoyaltyPoints(input: {
  customerId: string;
  weightGrams: number;
  stoneValue: number;
  makingCharge: number;
  reference?: string;
}) {
  const perGram = await getSettingNumber("loyaltyPointsPerGram", 10);
  const perDiamond = await getSettingNumber("loyaltyPointsPerDiamondValue", 0.01);
  const perMaking = await getSettingNumber("loyaltyPointsPerMaking", 0.005);
  const expiryDays = await getSettingNumber("loyaltyExpiryDays", 365);
  const points = Math.floor(
    input.weightGrams * perGram + input.stoneValue * perDiamond + input.makingCharge * perMaking
  );
  if (points <= 0) return null;

  const account = await prisma.loyaltyAccount.upsert({
    where: { customerId: input.customerId },
    update: {
      points: { increment: points },
      expiresAt: new Date(Date.now() + expiryDays * 86400000),
    },
    create: {
      customerId: input.customerId,
      points,
      expiresAt: new Date(Date.now() + expiryDays * 86400000),
    },
  });
  await prisma.loyaltyLedger.create({
    data: { accountId: account.id, points, reason: "PURCHASE", reference: input.reference },
  });
  return { account, points };
}

export async function redeemLoyaltyAgainstMaking(customerId: string, makingCharge: number, pointsToUse: number) {
  const maxPct = await getSettingNumber("loyaltyMaxRedeemPct", 50);
  const pointValue = await getSettingNumber("loyaltyPointValueInr", 1);
  const account = await prisma.loyaltyAccount.findUnique({ where: { customerId } });
  if (!account) throw new Error("No loyalty account");
  const maxInr = makingCharge * (maxPct / 100);
  const requestedInr = pointsToUse * pointValue;
  const redeemInr = Math.min(maxInr, requestedInr, account.points * pointValue);
  const redeemPoints = Math.floor(redeemInr / pointValue);
  await prisma.loyaltyAccount.update({
    where: { id: account.id },
    data: { points: { decrement: redeemPoints } },
  });
  await prisma.loyaltyLedger.create({
    data: { accountId: account.id, points: -redeemPoints, reason: "REDEEM_MAKING" },
  });
  return { redeemPoints, redeemInr };
}
