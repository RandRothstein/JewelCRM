import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { isSlowMover } from "@/lib/pricing";
import { getSettingNumber } from "@/lib/settings";
import { getLatestRates, computeProductPrice } from "@/lib/rates";
import { requireSession, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [products, racks, rates, days] = await Promise.all([
    prisma.product.findMany({ include: { rack: true }, orderBy: { name: "asc" } }),
    prisma.rack.findMany({ orderBy: { code: "asc" } }),
    getLatestRates(),
    getSettingNumber("slowMoverDays", 90),
  ]);
  return NextResponse.json({
    rates,
    slowMoverDays: days,
    racks,
    products: products.map((p) => {
      const priced = computeProductPrice(p, rates);
      return { ...p, goldRate: priced.goldRate, price: priced.price, slowMover: isSlowMover(p.acquiredAt, days) && p.stockQty > 0 };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["OWNER", "MANAGER", "SUPPORT", "SALES_CRO", "MARKETING_CRO"]);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const sku = String(b.sku || "").trim();
  const name = String(b.name || "").trim();
  const weightGrams = Number(b.weightGrams);
  if (!sku || !name || !(weightGrams > 0)) return badRequest("SKU, name and a positive weight are required");
  if (await prisma.product.findUnique({ where: { sku } })) return badRequest("SKU already exists", 409);
  const product = await prisma.product.create({
    data: {
      sku,
      name,
      category: String(b.category || "Jewellery"),
      purity: String(b.purity || "22K"),
      metal: String(b.metal || "Gold"),
      weightGrams,
      makingCharge: Number(b.makingCharge) || 0,
      stoneValue: Number(b.stoneValue) || 0,
      stockQty: b.stockQty === undefined || b.stockQty === "" ? 1 : Math.max(0, Math.floor(Number(b.stockQty))),
      priceOverride: b.priceOverride ? Number(b.priceOverride) : null,
      rackId: b.rackId || null,
    },
  });
  await auditLog("CREATE", "Product", product.id, session.userId, { sku });
  return NextResponse.json(product, { status: 201 });
}
