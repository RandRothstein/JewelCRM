export type PriceInput = { weightGrams: number; goldRate: number; makingCharge?: number; stoneValue?: number; discount?: number };
export function calculateJewelleryPrice(input: PriceInput) {
  const goldValue = input.weightGrams * input.goldRate;
  const subtotal = goldValue + (input.makingCharge || 0) + (input.stoneValue || 0);
  return { goldValue, subtotal, total: Math.max(0, subtotal - (input.discount || 0)) };
}
export function isSlowMover(acquiredAt: Date | string, thresholdDays = 90) {
  return Date.now() - new Date(acquiredAt).getTime() > thresholdDays * 86400000;
}
