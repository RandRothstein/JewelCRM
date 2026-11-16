"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fmtDateTime } from "@/lib/client";
import { Badge, Notice, PageHeader } from "@/components/ui";

type Mismatch = { id: string; expectedQty: number; actualQty: number; resolved: boolean; product: { name: string; sku: string } | null };
type Check = { id: string; startedAt: string; completedAt: string | null; notes: string | null; performedBy: { name: string }; mismatches: Mismatch[] };
type Rack = { id: string; code: string; name: string };

export default function StockCheckPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rackId, setRackId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [me, setMe] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ checks: Check[]; racks: Rack[] }>("/api/stock");
      setChecks(d.checks);
      setRacks(d.racks);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    apiFetch<{ role: string }>("/api/auth/me").then((d) => setMe(d.role)).catch(() => undefined);
  }, [load]);

  const canApprove = me === "OWNER" || me === "MANAGER";

  async function start() {
    setError(null);
    setMessage(null);
    try {
      const c = await apiFetch<Check>("/api/stock", { method: "POST", json: { action: "start", rackId } });
      setMessage(c.mismatches.length ? `Scan complete: ${c.mismatches.length} mismatch(es) need review.` : "Scan complete: no mismatches.");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function approve(mismatchId: string) {
    setError(null);
    try {
      await apiFetch("/api/stock", { method: "POST", json: { action: "approve", mismatchId } });
      setMessage("Mismatch approved and stock quantity adjusted.");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const open = checks.flatMap((c) => c.mismatches.filter((m) => !m.resolved).map((m) => ({ ...m, checkId: c.id })));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Inventory control" title="Stock check" description="Scan a rack with RFID, review mismatches, and let a manager approve adjustments to stock quantity." />
      <Notice error={error} message={message} />

      <div className="card flex flex-col gap-3 p-5 md:flex-row md:items-end">
        <div className="flex-1">
          <div className="eyebrow mb-2">Start a check</div>
          <select value={rackId} onChange={(e) => setRackId(e.target.value)}>
            <option value="">Select rack…</option>
            {racks.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
          </select>
        </div>
        <button className="gold-button" disabled={!rackId} onClick={start}>Scan rack (RFID)</button>
      </div>

      <section className="card table-wrap p-3">
        <div className="eyebrow p-3">Unresolved mismatches · {open.length}</div>
        <table>
          <thead><tr><th>Product</th><th>Expected</th><th>Scanned</th><th>Diff</th><th></th></tr></thead>
          <tbody>
            {open.map((m) => (
              <tr key={m.id}>
                <td><div className="font-semibold">{m.product?.name || "Unknown tag"}</div><div className="text-xs text-stone-500">{m.product?.sku}</div></td>
                <td>{m.expectedQty}</td>
                <td>{m.actualQty}</td>
                <td><Badge tone="red">{m.actualQty - m.expectedQty}</Badge></td>
                <td>{canApprove ? <button className="gold-button" onClick={() => approve(m.id)}>Approve & adjust</button> : <span className="text-xs text-stone-500">Awaiting manager</span>}</td>
              </tr>
            ))}
            {open.length === 0 && <tr><td colSpan={5} className="text-center text-stone-500">Nothing to review.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div className="eyebrow">Recent checks</div>
        {checks.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <div><div className="font-semibold">{c.notes || "Stock check"}</div><div className="text-xs text-stone-500">{fmtDateTime(c.startedAt)} · {c.performedBy.name}</div></div>
            <Badge tone={c.completedAt ? "green" : "amber"}>{c.completedAt ? "Completed" : "Pending approval"}</Badge>
          </div>
        ))}
      </section>
    </div>
  );
}
