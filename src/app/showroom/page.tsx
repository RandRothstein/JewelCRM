"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr, fmtDateTime } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Product = { id: string; sku: string; name: string; purity: string; weightGrams: number; price: number };
type Visit = {
  id: string;
  startedAt: string;
  reason: string | null;
  customer: { id: string; name: string; phone: string; stage: string; whatsappOptIn: boolean };
  greeter: { name: string } | null;
  assignedCro: { id: string; name: string } | null;
  items: { id: string; product: { id: string; name: string; sku: string } }[];
  estimates: { id: string; total: number; discount: number; saleLinks: { token: string }[] }[];
};
type Cro = { id: string; name: string };

const OUTCOMES = ["BOUGHT", "ESTIMATE", "BROWSE", "LEFT"];

export default function ShowroomPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cros, setCros] = useState<Cro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", reason: "", whatsappConsent: false, assignedCroId: "" });
  const [pick, setPick] = useState<Record<string, string>>({});
  const [discount, setDiscount] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ visits: Visit[]; products: Product[]; cros: Cro[] }>("/api/visits?status=open");
      setVisits(d.visits);
      setProducts(d.products);
      setCros(d.cros);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<string | void>) {
    setError(null);
    setMessage(null);
    try {
      const msg = await fn();
      if (msg) setMessage(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await apiFetch<{ visit: Visit; returning: boolean }>("/api/visits", { method: "POST", json: { action: "start", ...form } });
      setForm({ name: "", phone: "", reason: "", whatsappConsent: false, assignedCroId: "" });
      return `${r.returning ? "Returning customer" : "New customer"} ${r.visit.customer.name} checked in${r.visit.assignedCro ? ` · assigned to ${r.visit.assignedCro.name}` : ""}.`;
    });
  };

  const post = (json: Record<string, unknown>) => apiFetch<Record<string, unknown>>("/api/visits", { method: "POST", json });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Live showroom" title="Showroom floor" description="Welcome visitors, capture intent, price pieces at today's gold rate and close every visit with an outcome." />
      <Notice error={error} message={message} />

      <form onSubmit={start} className="card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-6"><div className="eyebrow">Greeter desk · new visit</div></div>
        <div className="md:col-span-2"><Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
        <div className="md:col-span-2"><Field label="Phone"><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" /></Field></div>
        <div className="md:col-span-2">
          <Field label="Assign CRO">
            <select value={form.assignedCroId} onChange={(e) => setForm({ ...form, assignedCroId: e.target.value })}>
              <option value="">Auto-assign (least busy)</option>
              {cros.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-4"><Field label="Reason for visit"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Wedding shopping, gifting, repair…" /></Field></div>
        <label className="flex items-end gap-2 pb-3 text-sm md:col-span-1">
          <input type="checkbox" className="!w-auto" checked={form.whatsappConsent} onChange={(e) => setForm({ ...form, whatsappConsent: e.target.checked })} />
          WhatsApp consent
        </label>
        <div className="flex items-end md:col-span-1"><button className="gold-button w-full">Start visit</button></div>
      </form>

      <section className="space-y-4">
        <div className="eyebrow">Open visits · {visits.length}</div>
        {visits.length === 0 && <div className="card p-6 text-sm text-stone-500">No open visits right now.</div>}
        {visits.map((v) => (
          <article key={v.id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <a href={`/customers/${v.customer.id}`} className="font-serif text-2xl hover:underline">{v.customer.name}</a>
                <div className="text-xs text-stone-500">{v.customer.phone} · since {fmtDateTime(v.startedAt)}</div>
                <div className="mt-1 text-sm text-stone-600">{v.reason || "No reason recorded"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{v.customer.stage}</Badge>
                {v.customer.whatsappOptIn && <Badge tone="green">WhatsApp opt-in</Badge>}
                <Badge tone="stone">CRO: {v.assignedCro?.name || "Unassigned"}</Badge>
              </div>
            </div>

            <div>
              <div className="eyebrow mb-2">Pieces viewed</div>
              {v.items.length === 0 ? <div className="text-sm text-stone-500">None yet.</div> : (
                <div className="flex flex-wrap gap-2">{v.items.map((i) => <Badge key={i.id} tone="stone">{i.product.name} · {i.product.sku}</Badge>)}</div>
              )}
              <div className="mt-3 flex gap-2">
                <select value={pick[v.id] || ""} onChange={(e) => setPick({ ...pick, [v.id]: e.target.value })}>
                  <option value="">Select a product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.purity} · {p.weightGrams}g · {inr(p.price)}</option>)}
                </select>
                <button className="soft-button whitespace-nowrap" disabled={!pick[v.id]} onClick={() => run(async () => { await post({ action: "addProduct", visitId: v.id, productId: pick[v.id] }); setPick({ ...pick, [v.id]: "" }); return "Product added to visit."; })}>Add product</button>
              </div>
            </div>

            <div className="grid gap-3 border-t border-[#eee4d4] pt-4 md:grid-cols-2">
              <div>
                <div className="eyebrow mb-2">Estimate (live gold rate)</div>
                {v.estimates.map((e) => (
                  <div key={e.id} className="mb-2 rounded-xl bg-[#faf4e8] p-3 text-sm">
                    Total <strong>{inr(e.total)}</strong>{e.discount > 0 && ` (after ${inr(e.discount)} discount)`}
                    {e.saleLinks[0] && <> · <a className="font-semibold text-[#8b621f]" href={`/store/${e.saleLinks[0].token}`} target="_blank">Customer link</a></>}
                  </div>
                ))}
                <div className="flex gap-2">
                  <input type="number" min={0} placeholder="Discount ₹" value={discount[v.id] || ""} onChange={(e) => setDiscount({ ...discount, [v.id]: e.target.value })} />
                  <button className="gold-button whitespace-nowrap" disabled={v.items.length === 0} onClick={() => run(async () => { const r = await post({ action: "estimate", visitId: v.id, discount: Number(discount[v.id] || 0) }); return `Estimate created: ${inr(Number(r.total))}`; })}>Create estimate</button>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-2">End visit</div>
                <div className="flex gap-2">
                  <select value={outcome[v.id] || ""} onChange={(e) => setOutcome({ ...outcome, [v.id]: e.target.value })}>
                    <option value="">Outcome…</option>
                    {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button className="soft-button whitespace-nowrap" disabled={!outcome[v.id]} onClick={() => run(async () => { await post({ action: "end", visitId: v.id, outcome: outcome[v.id] }); return "Visit closed."; })}>End visit</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
