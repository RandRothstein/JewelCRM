import { CustomerStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettingNumber } from "@/lib/settings";

export async function refreshCustomerStage(customerId: string) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: { visits: { include: { items: true } }, estimates: true, holds: true },
  });
  const lapsedDays = await getSettingNumber("lapsedDays", 180);
  const inactiveMs = Date.now() - new Date(customer.lastActivityAt).getTime();
  let stage: CustomerStage = customer.stage;

  if (!customer.whatsappOptIn && customer.source === "EVENT_LIST") stage = CustomerStage.LEAD;
  else if (customer.purchaseCount >= 2) stage = CustomerStage.REPEAT;
  else if (customer.purchaseCount === 1) stage = CustomerStage.CUSTOMER;
  else if (customer.estimates.length > 0) stage = CustomerStage.ESTIMATED;
  else if (customer.visits.some((v) => v.items.length > 0) || customer.holds.length > 0) stage = CustomerStage.INTERESTED;
  else if (customer.whatsappOptIn) stage = CustomerStage.PROSPECT;

  if (inactiveMs > lapsedDays * 86400000 && customer.purchaseCount > 0) stage = CustomerStage.LAPSED;

  return prisma.customer.update({
    where: { id: customerId },
    data: { stage, lastActivityAt: new Date() },
  });
}
