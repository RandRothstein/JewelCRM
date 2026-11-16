import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/adapters/whatsapp";
import { getSettingNumber } from "@/lib/settings";

export function estimateFollowUps(createdAt: Date | string) {
  const base = new Date(createdAt);
  return [2, 5].map((day) => ({
    day,
    dueAt: new Date(base.getTime() + day * 86400000),
    label: `Day-${day} estimate follow-up`,
  }));
}

export async function processDueEstimateFollowups() {
  const now = Date.now();
  const maxDiscount = await getSettingNumber("maxPersonalDiscountPct", 5);
  const open = await prisma.estimate.findMany({
    where: { status: "OPEN", followupStop: false },
    include: { customer: true, lines: true },
  });
  const results = [];
  for (const est of open) {
    if (!est.customer?.whatsappOptIn) continue;
    const ageDays = (now - new Date(est.createdAt).getTime()) / 86400000;
    const piece = est.lines[0]?.label || "your selected piece";
    if (ageDays >= 2 && ageDays < 3) {
      results.push(
        await sendWhatsApp({
          to: est.customer.phone,
          customerId: est.customerId,
          channel: "WHATSAPP_SESSION",
          body: `Hi ${est.customer.name}, still thinking about ${piece}? You can Hold 24h or Book a visit.`,
        })
      );
    }
    if (ageDays >= 5 && ageDays < 6) {
      await prisma.personalOffer.create({
        data: {
          customerId: est.customerId,
          title: `Limited offer on ${piece}`,
          discountType: "PERCENT",
          discountValue: maxDiscount,
          validUntil: new Date(Date.now() + 3 * 86400000),
        },
      });
      results.push(
        await sendWhatsApp({
          to: est.customer.phone,
          customerId: est.customerId,
          channel: "WHATSAPP_TEMPLATE",
          body: `${est.customer.name}, a ${maxDiscount}% offer on ${piece} is open for 3 days. Reply HOLD or BOOK.`,
        })
      );
    }
  }
  return results;
}

export async function expireHoldsAndRemind() {
  const reminderHours = await getSettingNumber("holdReminderHours", 20);
  const holds = await prisma.hold.findMany({ where: { status: "ACTIVE" }, include: { customer: true, product: true } });
  const now = Date.now();
  for (const hold of holds) {
    const ageH = (now - new Date(hold.createdAt).getTime()) / 3600000;
    if (new Date(hold.expiresAt).getTime() <= now) {
      await prisma.hold.update({ where: { id: hold.id }, data: { status: "EXPIRED" } });
      await prisma.product.update({ where: { id: hold.productId }, data: { available: true } });
      if (hold.customer.whatsappOptIn) {
        await sendWhatsApp({
          to: hold.customer.phone,
          customerId: hold.customerId,
          body: `Your hold on ${hold.product.name} has ended.`,
        });
      }
    } else if (ageH >= reminderHours && !hold.remindedAt && hold.customer.whatsappOptIn) {
      await sendWhatsApp({
        to: hold.customer.phone,
        customerId: hold.customerId,
        body: `Reminder: your hold on ${hold.product.name} expires soon.`,
      });
      await prisma.hold.update({ where: { id: hold.id }, data: { remindedAt: new Date() } });
    }
  }
}
