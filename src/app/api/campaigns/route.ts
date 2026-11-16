import { NextRequest, NextResponse } from "next/server";
import type { CustomerStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { sendWhatsApp } from "@/lib/adapters/whatsapp";
import { getSettingNumber, isPracticeMode } from "@/lib/settings";
import { requireSession, badRequest } from "@/lib/api";

const ROLES = ["OWNER", "MANAGER", "MARKETING_CRO", "SUPPORT"] as const;
const TEMPLATE_TYPES = ["FESTIVE", "BRIDAL", "NEW_ARRIVAL", "WINBACK", "BIRTHDAY", "CUSTOM"] as const;
const STAGES = ["LEAD", "PROSPECT", "INTERESTED", "ESTIMATED", "CUSTOMER", "REPEAT", "LAPSED"];

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [campaigns, practiceMode] = await Promise.all([
    prisma.campaign.findMany({
      include: { offers: true, messages: { orderBy: { createdAt: "desc" }, take: 8, include: { customer: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    isPracticeMode(),
  ]);
  return NextResponse.json({ campaigns, practiceMode, templateTypes: TEMPLATE_TYPES });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession([...ROLES]);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "create");

  if (action === "create") {
    const name = String(b.name || "").trim();
    const templateType = String(b.templateType || "CUSTOM");
    const message = String(b.message || "").trim();
    if (!name) return badRequest("Campaign name is required");
    if (!(TEMPLATE_TYPES as readonly string[]).includes(templateType)) return badRequest("Invalid template type");
    if (!message) return badRequest("Message body is required");
    const stages: string[] = Array.isArray(b.stages) ? b.stages.filter((s: string) => STAGES.includes(s)) : [];
    const campaign = await prisma.campaign.create({
      data: {
        name,
        templateType,
        goal: b.goal ? String(b.goal) : null,
        channel: "WHATSAPP_TEMPLATE",
        segmentJson: JSON.stringify({ stages, message }),
      },
    });
    await auditLog("CREATE", "Campaign", campaign.id, session.userId, { templateType, stages });
    return NextResponse.json(campaign, { status: 201 });
  }

  if (action === "send") {
    const campaign = await prisma.campaign.findUnique({ where: { id: String(b.campaignId || "") } });
    if (!campaign) return badRequest("Campaign not found", 404);
    if (campaign.status === "SENT") return badRequest("Campaign already sent", 409);

    let segment: { stages?: string[]; message?: string } = {};
    try {
      segment = JSON.parse(campaign.segmentJson);
    } catch {
      /* default */
    }
    const stages = (segment.stages || []).filter((s) => STAGES.includes(s)) as CustomerStage[];
    const template = segment.message || campaign.goal || `Hello {name}, a special update from our showroom.`;
    const skipDays = await getSettingNumber("campaignSkipDays", 7);
    const since = new Date(Date.now() - skipDays * 86400000);

    const segmentWhere = stages.length ? { stage: { in: stages } } : {};
    const [optedIn, notOptedIn, recent] = await Promise.all([
      prisma.customer.findMany({ where: { whatsappOptIn: true, ...segmentWhere } }),
      prisma.customer.count({ where: { whatsappOptIn: false, ...segmentWhere } }),
      prisma.messageLog.findMany({
        where: { campaignId: { not: null }, createdAt: { gte: since }, customerId: { not: null } },
        select: { customerId: true },
      }),
    ]);
    const recentIds = new Set(recent.map((r) => r.customerId));
    const targets = optedIn.filter((c) => !recentIds.has(c.id));

    let sent = 0;
    let cost = 0;
    for (const c of targets) {
      const r = await sendWhatsApp({
        to: c.phone,
        customerId: c.id,
        campaignId: campaign.id,
        channel: "WHATSAPP_TEMPLATE",
        body: template.replace(/\{name\}/g, c.name),
      });
      sent += 1;
      cost += r.cost;
    }
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENT", startsAt: new Date() } });
    await auditLog("SEND", "Campaign", campaign.id, session.userId, { sent, skippedRecent: optedIn.length - targets.length, notOptedIn });
    return NextResponse.json({
      sent,
      cost: Number(cost.toFixed(2)),
      skippedRecentlyMessaged: optedIn.length - targets.length,
      excludedNoConsent: notOptedIn,
      practiceMode: await isPracticeMode(),
    });
  }

  return badRequest("Unknown action");
}
