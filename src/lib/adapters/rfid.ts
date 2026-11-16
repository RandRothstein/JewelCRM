import { prisma } from "@/lib/prisma";

/** Mock RFID scan: randomly under-reports one piece on the rack. */
export async function scanRack(rackId: string) {
  const products = await prisma.product.findMany({ where: { rackId } });
  return products.map((p, i) => ({
    productId: p.id,
    sku: p.sku,
    expectedQty: p.stockQty,
    actualQty: i === 0 && p.stockQty > 0 ? Math.max(0, p.stockQty - 1) : p.stockQty,
  }));
}
