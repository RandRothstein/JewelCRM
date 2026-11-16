import { PrismaClient, Role, CustomerStage } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  ["Jewel Owner", "owner@jewelcrm.local", "Owner@123", Role.OWNER, true, "+919900000001"],
  ["Store Manager", "manager@jewelcrm.local", "Manager@123", Role.MANAGER, true, "+919900000002"],
  ["Front Greeter", "greeter@jewelcrm.local", "Greeter@123", Role.GREETER, false, "+919900000003"],
  ["Sales CRO", "sales@jewelcrm.local", "Sales@123", Role.SALES_CRO, false, "+919900000004"],
  ["Sales CRO Two", "sales2@jewelcrm.local", "Sales@123", Role.SALES_CRO, false, "+919900000005"],
  ["Marketing CRO", "marketing@jewelcrm.local", "Marketing@123", Role.MARKETING_CRO, false, "+919900000006"],
] as const;

async function main() {
  for (const [name, email, password, role, requires2fa, phone] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, requires2fa, phone, passwordHash: await bcrypt.hash(password, 10), active: true },
      create: { name, email, role, requires2fa, phone, passwordHash: await bcrypt.hash(password, 10) },
    });
  }

  const rack = await prisma.rack.upsert({
    where: { code: "R-A1" },
    update: {},
    create: { code: "R-A1", name: "Bridal Gold", location: "Main showroom" },
  });
  const rack2 = await prisma.rack.upsert({
    where: { code: "R-B2" },
    update: {},
    create: { code: "R-B2", name: "Everyday Elegance", location: "East wall" },
  });

  const products = [
    { sku: "JWL-1001", name: "Aarohi Bridal Necklace", category: "Necklace", purity: "22K", weightGrams: 42.8, makingCharge: 38500, stoneValue: 18000, rackId: rack.id },
    { sku: "JWL-1002", name: "Meher Diamond Ring", category: "Ring", purity: "18K", weightGrams: 7.2, makingCharge: 12000, stoneValue: 78000, rackId: rack2.id },
    { sku: "JWL-1003", name: "Tara Gold Bangles", category: "Bangles", purity: "22K", weightGrams: 31.4, makingCharge: 26000, stoneValue: 0, rackId: rack.id },
    { sku: "JWL-1004", name: "Noor Pearl Earrings", category: "Earrings", purity: "18K", weightGrams: 5.6, makingCharge: 8500, stoneValue: 16500, rackId: rack2.id },
    { sku: "JWL-1005", name: "Saanvi Temple Set", category: "Set", purity: "22K", weightGrams: 68.0, makingCharge: 52000, stoneValue: 24000, rackId: rack.id, acquiredAt: new Date(Date.now() - 140 * 86400000) },
  ];
  for (const product of products) {
    await prisma.product.upsert({ where: { sku: product.sku }, update: product, create: product });
  }

  await prisma.goldRate.deleteMany();
  await prisma.goldRate.createMany({
    data: [
      { purity: "22K", ratePerGram: 7200 },
      { purity: "18K", ratePerGram: 5890 },
      { purity: "14K", ratePerGram: 4580 },
    ],
  });

  const customers = [
    { name: "Ananya Sharma", phone: "+919810001001", email: "ananya@example.com", preferredMetal: "22K Gold", notes: "Wedding in February", stage: CustomerStage.ESTIMATED, whatsappOptIn: true, source: "WALK_IN" },
    { name: "Riya Mehta", phone: "+919810001002", email: "riya@example.com", preferredMetal: "Diamond", notes: "Prefers minimal designs", stage: CustomerStage.INTERESTED, whatsappOptIn: true, source: "WHATSAPP" },
    { name: "Vikram Khanna", phone: "+919810001003", email: "vikram@example.com", preferredMetal: "Platinum", notes: "Anniversary shopper", stage: CustomerStage.CUSTOMER, whatsappOptIn: true, source: "WALK_IN", totalSpend: 185000, purchaseCount: 1 },
    { name: "Event Lead Priya", phone: "+919810001004", preferredMetal: "22K Gold", notes: "Gift hamper list", stage: CustomerStage.LEAD, whatsappOptIn: false, source: "EVENT_LIST" },
  ];
  for (const data of customers) {
    const customer = await prisma.customer.upsert({
      where: { phone: data.phone },
      update: data,
      create: data,
    });
    await prisma.loyaltyAccount.upsert({
      where: { customerId: customer.id },
      update: {},
      create: { customerId: customer.id, points: data.purchaseCount ? 1250 : 0 },
    });
    if (data.whatsappOptIn) {
      await prisma.consent.create({
        data: { customerId: customer.id, channel: "WHATSAPP", granted: true, source: data.source },
      });
    }
  }

  const sales = await prisma.user.findUniqueOrThrow({ where: { email: "sales@jewelcrm.local" } });
  const greeter = await prisma.user.findUniqueOrThrow({ where: { email: "greeter@jewelcrm.local" } });
  const month = new Date().toISOString().slice(0, 7);

  await prisma.target.upsert({
    where: { userId_month_metric: { userId: sales.id, month, metric: "Revenue" } },
    update: { goal: 2500000, achieved: 1420000 },
    create: { userId: sales.id, month, metric: "Revenue", goal: 2500000, achieved: 1420000 },
  });
  const target = await prisma.target.findUniqueOrThrow({
    where: { userId_month_metric: { userId: sales.id, month, metric: "Revenue" } },
  });
  await prisma.incentiveTier.deleteMany({ where: { targetId: target.id } });
  await prisma.incentiveTier.createMany({
    data: [
      { targetId: target.id, threshold: 800000, reward: 15000, description: "₹8L bonus" },
      { targetId: target.id, threshold: 1200000, reward: 35000, description: "₹12L bonus" },
      { targetId: target.id, threshold: 2500000, reward: 75000, description: "Full target" },
    ],
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(19, 0, 0, 0);
  await prisma.staffShift.deleteMany();
  await prisma.staffShift.create({
    data: {
      userId: sales.id,
      rackId: rack.id,
      task: "Bridal counter",
      plannedStart: tomorrow,
      plannedEnd: tomorrowEnd,
      notes: "Focus on Aarohi set",
    },
  });
  await prisma.staffShift.create({
    data: {
      userId: greeter.id,
      task: "Front desk",
      plannedStart: tomorrow,
      plannedEnd: tomorrowEnd,
    },
  });

  const settings: Array<[string, string, string]> = [
    ["storeName", "JewelCRM Flagship", "Display name"],
    ["slowMoverDays", "120", "Days before stock is flagged as slow-moving"],
    ["holdHours", "24", "Hold duration hours"],
    ["holdReminderHours", "20", "Hours after which hold reminder is sent"],
    ["holdMaxActive", "2", "Max active holds per customer"],
    ["holdDepositThreshold", "200000", "Deposit required above this price"],
    ["holdDepositPercent", "10", "Deposit percent for high-value holds"],
    ["holdDepositPolicy", "REFUNDABLE", "REFUNDABLE or KEEP"],
    ["maxPersonalDiscountPct", "5", "Max personal offer discount %"],
    ["maxCampaignDiscountPct", "8", "Max campaign discount %"],
    ["maxStaffDiscountPct", "3", "Max staff-given discount %"],
    ["loyaltyPointsPerGram", "10", "Points per gram of gold"],
    ["loyaltyPointsPerDiamondValue", "0.01", "Points per rupee of diamond value"],
    ["loyaltyPointsPerMaking", "0.005", "Points per rupee of making"],
    ["loyaltyPointValueInr", "1", "INR value of one point (making only)"],
    ["loyaltyMaxRedeemPct", "50", "Max % of making redeemable"],
    ["loyaltyExpiryDays", "365", "Points expiry days"],
    ["campaignSkipDays", "7", "Skip customers messaged within N days"],
    ["lapsedDays", "180", "Days without activity before LAPSED"],
    ["practiceMode", "true", "Messages only to staff phones"],
    ["goldRateSource", "MANUAL", "MANUAL or BILLING"],
  ];
  for (const [key, value, description] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }

  await prisma.monthlyCostLine.deleteMany({ where: { month } });
  await prisma.monthlyCostLine.createMany({
    data: [
      { month, category: "MAINTENANCE", label: "Platform maintenance", amount: 15000, units: 1 },
      { month, category: "WHATSAPP_TEMPLATE", label: "WhatsApp offer templates", amount: 86, units: 100, notes: "₹0.86 each mock" },
    ],
  });

  await prisma.storeCart.upsert({
    where: { token: "demo" },
    update: { expiresAt: new Date(Date.now() + 365 * 86400000) },
    create: { token: "demo", expiresAt: new Date(Date.now() + 365 * 86400000) },
  });

  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
