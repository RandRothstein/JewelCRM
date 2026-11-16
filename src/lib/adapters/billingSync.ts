import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function importSalesWorkbook(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
  const created = [];
  for (const row of rows) {
    const externalRef = String(row.billNo || row.BillNo || row.ref || "");
    if (!externalRef) continue;
    const amount = Number(row.amount || row.Amount || 0);
    const phone = String(row.phone || row.Phone || "");
    const customer = phone ? await prisma.customer.findUnique({ where: { phone } }) : null;
    const croEmail = String(row.croEmail || "");
    const cro = croEmail ? await prisma.user.findUnique({ where: { email: croEmail } }) : null;
    const sale = await prisma.saleImport.upsert({
      where: { externalRef },
      update: { amount, customerId: customer?.id, croUserId: cro?.id, isReturn: String(row.isReturn || "") === "1" },
      create: {
        externalRef,
        amount,
        customerId: customer?.id,
        croUserId: cro?.id,
        category: String(row.category || "General"),
        isReturn: String(row.isReturn || "") === "1",
      },
    });
    if (customer && !sale.isReturn) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { totalSpend: { increment: amount }, purchaseCount: { increment: 1 }, lastActivityAt: new Date() },
      });
    }
    if (cro && !sale.isReturn) {
      const month = new Date().toISOString().slice(0, 7);
      await prisma.target.updateMany({
        where: { userId: cro.id, month, metric: "Revenue" },
        data: { achieved: { increment: amount } },
      });
    }
    created.push(sale);
  }
  return created;
}
