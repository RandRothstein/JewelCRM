import { prisma } from "@/lib/prisma";
import { calculateJewelleryPrice } from "@/lib/pricing";

export type Rates = Record<string, number>;

/** Latest ₹/gram per purity (e.g. "22K"). */
export async function getLatestRates(): Promise<Rates> {
  const rows = await prisma.goldRate.findMany({ orderBy: { effectiveAt: "desc" } });
  const out: Rates = {};
  for (const r of rows) if (!(r.purity in out)) out[r.purity] = r.ratePerGram;
  return out;
}

/** Rate for a purity; falls back to a pro-rata of the 22K rate when a purity has no entry. */
export function rateForPurity(rates: Rates, purity: string) {
  if (rates[purity]) return rates[purity];
  const karat = parseInt(purity, 10);
  if (karat && rates["22K"]) return Math.round((rates["22K"] * karat) / 22);
  return 0;
}

type PriceableProduct = {
  purity: string;
  weightGrams: number;
  makingCharge: number;
  stoneValue: number;
  priceOverride: number | null;
};

export function computeProductPrice(p: PriceableProduct, rates: Rates, discount = 0) {
  const goldRate = rateForPurity(rates, p.purity);
  const calc = calculateJewelleryPrice({
    weightGrams: p.weightGrams,
    goldRate,
    makingCharge: p.makingCharge,
    stoneValue: p.stoneValue,
    discount,
  });
  const price = p.priceOverride != null && p.priceOverride > 0 ? Math.max(0, p.priceOverride - discount) : calc.total;
  return { goldRate, price: Math.round(price), subtotal: Math.round(p.priceOverride || calc.subtotal) };
}
