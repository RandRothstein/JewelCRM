import { prisma } from "@/lib/prisma";

export async function getSetting(key: string, fallback = "") {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function getSettingNumber(key: string, fallback: number) {
  const value = await getSetting(key, String(fallback));
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function isPracticeMode() {
  return (await getSetting("practiceMode", "true")) === "true";
}

export async function upsertSetting(key: string, value: string, description?: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value, ...(description ? { description } : {}) },
    create: { key, value, description },
  });
}
