import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettingNumber } from "@/lib/settings";
import { getLatestRates, computeProductPrice } from "@/lib/rates";
import { requireSession } from "@/lib/api";

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : null;
};

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const slowDays = await getSettingNumber("slowMoverDays", 120);
  const slowCutoff = new Date(Date.now() - slowDays * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);

  const [sales, campaigns, products, feedback, rates, stageCounts, estimates] = await Promise.all([
    prisma.saleImport.findMany({ include: { cro: { select: { name: true } } }, orderBy: { soldAt: "desc" } }),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { stockQty: { gt: 0 } }, orderBy: { acquiredAt: "asc" } }),
    prisma.feedback.findMany(),
    getLatestRates(),
    prisma.customer.groupBy({ by: ["stage"], _count: true }),
    prisma.estimate.groupBy({ by: ["status"], _count: true, _sum: { total: true } }),
  ]);

  const signed = (s: { amount: number; isReturn: boolean }) => (s.isReturn ? -s.amount : s.amount);
  const byCategory: Record<string, number> = {};
  const byCro: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  for (const s of sales) {
    byCategory[s.category || "General"] = (byCategory[s.category || "General"] || 0) + signed(s);
    byCro[s.cro?.name || "Unattributed"] = (byCro[s.cro?.name || "Unattributed"] || 0) + signed(s);
    const m = s.soldAt.toISOString().slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + signed(s);
  }

  const slow = products
    .filter((p) => p.acquiredAt < slowCutoff)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      stockQty: p.stockQty,
      ageDays: Math.floor((Date.now() - p.acquiredAt.getTime()) / 86400000),
      value: computeProductPrice(p, rates).price * p.stockQty,
    }));

  const promoters = feedback.filter((f) => f.nps >= 9).length;
  const detractors = feedback.filter((f) => f.nps <= 6).length;

  return NextResponse.json({
    sales: {
      total: sales.reduce((s, x) => s + signed(x), 0),
      last30Days: sales.filter((s) => s.soldAt >= since30).reduce((s, x) => s + signed(x), 0),
      count: sales.filter((s) => !s.isReturn).length,
      returns: sales.filter((s) => s.isReturn).reduce((s, x) => s + x.amount, 0),
      byCategory,
      byCro,
      byMonth,
    },
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      templateType: c.templateType,
      status: c.status,
      messagesSent: c.messagesSent,
      messagesRead: c.messagesRead,
      holdsCreated: c.holdsCreated,
      visitsBooked: c.visitsBooked,
      salesWithin14d: c.salesWithin14d,
      costAmount: c.costAmount,
    })),
    stock: {
      slowMoverDays: slowDays,
      totalUnits: products.reduce((s, p) => s + p.stockQty, 0),
      slowMovers: slow,
      slowValue: slow.reduce((s, p) => s + p.value, 0),
    },
    feedback: {
      count: feedback.length,
      avgNps: avg(feedback.map((f) => f.nps)),
      npsScore: feedback.length ? Math.round(((promoters - detractors) / feedback.length) * 100) : null,
      avgStore: avg(feedback.map((f) => f.storeRating)),
      avgStaff: avg(feedback.map((f) => f.staffRating)),
      avgCollection: avg(feedback.map((f) => f.collectionRating)),
    },
    customersByStage: Object.fromEntries(stageCounts.map((s) => [s.stage, s._count])),
    estimates: estimates.map((e) => ({ status: e.status, count: e._count, total: e._sum.total || 0 })),
  });
}
