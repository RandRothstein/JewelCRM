import { prisma } from "@/lib/prisma";
import { getSetting, isPracticeMode } from "@/lib/settings";

export type WhatsAppSendInput = {
  to: string;
  body: string;
  channel?: "WHATSAPP_SESSION" | "WHATSAPP_TEMPLATE" | "SMS";
  customerId?: string;
  campaignId?: string;
};

const COST = {
  WHATSAPP_SESSION: 0.12,
  WHATSAPP_TEMPLATE: 0.86,
  SMS: 0.15,
} as const;

export async function sendWhatsApp(input: WhatsAppSendInput) {
  const practice = await isPracticeMode();
  let recipient = input.to;
  if (practice) {
    const staff = await prisma.user.findFirst({ where: { phone: { not: null }, active: true } });
    recipient = staff?.phone || process.env.PRACTICE_PHONE || "+919900000001";
  }

  const channel = input.channel || "WHATSAPP_SESSION";
  const cost = COST[channel];
  const ref = `mock-wa-${Date.now()}`;
  console.log(`[WhatsApp mock] → ${recipient}: ${input.body}`);

  const log = await prisma.messageLog.create({
    data: {
      campaignId: input.campaignId,
      customerId: input.customerId,
      channel,
      recipient,
      body: input.body,
      status: "SENT",
      costAmount: cost,
      providerRef: ref,
      sentAt: new Date(),
    },
  });

  const month = new Date().toISOString().slice(0, 7);
  await prisma.monthlyCostLine.create({
    data: {
      month,
      category: channel,
      label: `${channel} message`,
      amount: cost,
      units: 1,
      notes: practice ? "practice mode" : undefined,
    },
  });

  if (input.campaignId) {
    await prisma.campaign.update({
      where: { id: input.campaignId },
      data: { messagesSent: { increment: 1 }, costAmount: { increment: cost } },
    });
  }

  return { ok: true, providerRef: ref, recipient, cost, logId: log.id, practice };
}

export async function getWhatsAppQualityRating() {
  return Number((await getSetting("waQualityRating", "80")) || 80);
}
