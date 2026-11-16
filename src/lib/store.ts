import { prisma } from "@/lib/prisma";

export type StoreContext =
  | { kind: "link"; customerId: string; customerName: string; estimateId: string; linkId: string }
  | { kind: "cart"; customerId: string | null; customerName: string | null }
  | { kind: "expired" }
  | null;

/** Resolves a public store token (estimate SaleLink or StoreCart) into a context. */
export async function resolveStoreToken(token: string): Promise<StoreContext> {
  const link = await prisma.saleLink.findUnique({ where: { token }, include: { estimate: { include: { customer: true } } } });
  if (link) {
    if (link.expiresAt.getTime() < Date.now()) return { kind: "expired" };
    return {
      kind: "link",
      customerId: link.estimate.customerId,
      customerName: link.estimate.customer.name,
      estimateId: link.estimateId,
      linkId: link.id,
    };
  }
  const cart = await prisma.storeCart.findUnique({ where: { token } });
  if (cart) {
    if (cart.expiresAt.getTime() < Date.now()) return { kind: "expired" };
    const customer = cart.customerId ? await prisma.customer.findUnique({ where: { id: cart.customerId } }) : null;
    return { kind: "cart", customerId: customer?.id ?? null, customerName: customer?.name ?? null };
  }
  return null;
}
