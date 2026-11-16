"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr, fmtDateTime } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Hold = {
  id: string;
  status: string;
  lockedGoldRate: number;
  lockedPrice: number;
  depositAmount: number;
  depositPolicy: string;
  expiresAt: string;
  customer: { name: string; phone: string };
  product: { name: string; sku: string };
};
type Opt = { id: string; name: string; phone?: string; sku?: string; price?: number };

export default function HoldsPage() {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [customers, setCustomers] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [maxActive, setMaxActive] = useState(2);
  const [form, setForm] = useState({ customerId: "", productId: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ holds: Hold[]; customers: Opt[]; products: Opt[]; maxActive: number }>("/api/holds");
      setHolds(d.holds);
      setCustomers(d.customers);
      setProducts(d.products);
      setMaxActive(d.maxActive);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(json: Record<string, unknown>, ok: string) {
    setError(null);
    setMessage(null);
    try {
      const r = await apiFetch<{ depositPaymentUrl?: string; depositNote?: string }>("/api/holds", { method: "POST", json });
      setMessage(`${ok}${r.depositPaymentUrl ? ` Deposit link: ${r.depositPaymentUrl}` : ""}${r.depositNote ? ` ${r.depositNote}` : ""}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reservations" title="Product holds" description={`Reserve a piece for 24 hours at a locked gold rate and price. Maximum ${maxActive} active holds per customer; high-value holds need a deposit.`} />
      <Notice error={error} message={message} />

      <form
        className="card grid gap-4 p-5 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: "create", ...form }, "Hold created.").then(() => setForm({ customerId: "", productId: "", notes: "" }));
        }}
      >
        <Field label="Customer">
          <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Select…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
          </select>
        </Field>
        <Field label="Product">
          <select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.price)}</option>)}
          </select>
        </Field>
        <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex items-end"><button className="gold-button w-full">Create 24h hold</button></div>
      </form>

      <div className="card table-wrap p-3">
        <table>
          <thead><tr><th>Customer</th><th>Product</th><th>Locked price</th><th>Deposit</th><th>Expires</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id}>
                <td><div className="font-semibold">{h.customer.name}</div><div className="text-xs text-stone-500">{h.customer.phone}</div></td>
                <td>{h.product.name}<div className="text-xs text-stone-500">{h.product.sku}</div></td>
                <td>{inr(h.lockedPrice)}<div className="text-xs text-stone-500">@ {inr(h.lockedGoldRate)}/g</div></td>
                <td>{h.depositAmount ? `${inr(h.depositAmount)} (${h.depositPolicy})` : "—"}</td>
                <td>{fmtDateTime(h.expiresAt)}</td>
                <td><Badge tone={h.status === "ACTIVE" ? "green" : h.status === "CONVERTED" ? "gold" : "stone"}>{h.status}</Badge></td>
                <td className="whitespace-nowrap">
                  {h.status === "ACTIVE" && (
                    <>
                      <button className="mr-3 text-sm font-semibold text-[#8b621f]" onClick={() => act({ action: "extend", holdId: h.id }, "Hold extended.")}>Extend</button>
                      <button className="text-sm font-semibold text-red-700" onClick={() => act({ action: "cancel", holdId: h.id, reason: "Cancelled from holds desk" }, "Hold cancelled.")}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {holds.length === 0 && <tr><td colSpan={7} className="text-center text-stone-500">No holds yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
