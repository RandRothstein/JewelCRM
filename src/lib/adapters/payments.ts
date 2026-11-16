import { prisma } from "@/lib/prisma";

export async function createPaymentLink(input: {
  customerId?: string;
  amount: number;
  purpose: string;
  panRequired?: boolean;
}) {
  const providerRef = `pay_mock_${Date.now()}`;
  const paymentUrl = `/api/payments/confirm?ref=${providerRef}`;
  const payment = await prisma.payment.create({
    data: {
      customerId: input.customerId,
      amount: input.amount,
      purpose: input.purpose,
      status: "PENDING",
      providerRef,
      paymentUrl,
      panCollected: !input.panRequired,
    },
  });
  return payment;
}

export async function confirmPayment(providerRef: string) {
  return prisma.payment.update({
    where: { providerRef },
    data: { status: "PAID", confirmedAt: new Date() },
  });
}
