import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestRates, computeProductPrice } from "@/lib/rates";
import { resolveStoreToken } from "@/lib/store";
import { StoreCatalog } from "@/components/store-catalog";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default async function StorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveStoreToken(token);
  if (!ctx) notFound();
  if (ctx.kind === "expired") {
    return (
      <main className="min-h-screen bg-[#292724] p-8 text-white">
        <div className="mx-auto max-w-xl pt-20 text-center">
          <h1 className="font-serif text-4xl">This link has expired</h1>
          <p className="mt-3 text-stone-300">Please contact the showroom for a fresh link.</p>
        </div>
      </main>
    );
  }

  let estimate: { total: number; lines: { id: string; label: string; quotedPrice: number }[] } | null = null;
  if (ctx.kind === "link") {
    await prisma.saleLink.update({ where: { id: ctx.linkId }, data: { viewedAt: new Date() } });
    estimate = await prisma.estimate.findUnique({ where: { id: ctx.estimateId }, include: { lines: true } });
  }

  const [products, rates] = await Promise.all([
    prisma.product.findMany({ where: { available: true, stockQty: { gt: 0 } }, orderBy: { name: "asc" } }),
    getLatestRates(),
  ]);
  const view = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    purity: p.purity,
    weightGrams: p.weightGrams,
    price: computeProductPrice(p, rates).price,
  }));

  return (
    <main className="min-h-screen bg-[#292724] p-5 text-white md:p-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <div className="eyebrow !text-[#d7ae64]">Private jewellery selection</div>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">{ctx.customerName ? `Prepared for ${ctx.customerName}` : "Our collection"}</h1>
          <p className="mt-2 text-stone-300">Prices reflect today&apos;s gold rate. Reserve a piece for 24 hours — the price is locked when you hold.</p>
        </div>

        {estimate && (
          <section className="rounded-3xl bg-[#fffdfa] p-6 text-[#292724]">
            <h2 className="font-serif text-2xl">Your estimate</h2>
            <ul className="mt-3 divide-y divide-[#eee4d4] text-sm">
              {estimate.lines.map((l) => <li key={l.id} className="flex justify-between py-2"><span>{l.label}</span><span>{inr(l.quotedPrice)}</span></li>)}
            </ul>
            <div className="mt-4 flex items-end justify-between border-t pt-4"><span className="text-stone-500">Total</span><strong className="text-3xl">{inr(estimate.total)}</strong></div>
          </section>
        )}

        <section>
          <h2 className="mb-4 font-serif text-2xl">Available pieces</h2>
          <StoreCatalog token={token} products={view} needsContact={!ctx.customerId} />
        </section>
      </div>
    </main>
  );
}
