"use client";
const KEY = "jewelcrm-offline-queue";
export type QueuedRequest = { url: string; method: string; body?: unknown; queuedAt: string };
export function enqueueOffline(request: Omit<QueuedRequest, "queuedAt">) {
  const queue: QueuedRequest[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  queue.push({ ...request, queuedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(queue));
}
export async function flushOfflineQueue() {
  const queue: QueuedRequest[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  const failed: QueuedRequest[] = [];
  for (const item of queue) {
    try { const response = await fetch(item.url, { method: item.method, headers: { "Content-Type": "application/json" }, body: item.body ? JSON.stringify(item.body) : undefined }); if (!response.ok) failed.push(item); }
    catch { failed.push(item); }
  }
  localStorage.setItem(KEY, JSON.stringify(failed));
  return { synced: queue.length - failed.length, remaining: failed.length };
}
