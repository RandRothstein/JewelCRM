"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  purity: string;
  weightGrams: number;
  stockQty: number;
  available: boolean;
  price: number;
  goldRate: number;
  slowMover: boolean;
  priceOverride: number | null;
  rack: { code: string } | null;
};
type Rack = { id: string; code: string; name: string };

const empty = { sku: "", name: "", category: "Necklace", purity: "22K", weightGrams: "", makingCharge: "", stoneValue: "", stockQty: "1", rackId: "" };

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [days, setDays] = useState(90);
  const [form, setForm] = useState(empty);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState("");
  const [onlySlow, setOnlySlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ products: Product[]; racks: Rack[]; rates: Record<string, number>; slowMoverDays: number }>("/api/products");
      setProducts(d.products);
      setRacks(d.racks);
      setRates(d.rates);
      setDays(d.slowMoverDays);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/products", { method: "POST", json: form });
      setForm(empty);
      setShow(false);
      setMessage("Product added.");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function importFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await apiFetch<{ imported: number }>("/api/catalog/import", { method: "POST", body: fd });
      setMessage(`Imported ${r.imported} products.`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const shown = products.filter((p) => (!onlySlow || p.slowMover) && (!filter || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(filter.toLowerCase())));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Merchandise intelligence" title="Jewellery catalog" description={`Live gold pricing, rack placement and ageing. Pieces older than ${days} days are flagged slow movers.`}>
        <div className="flex flex-wrap gap-2">
          <label className="soft-button cursor-pointer">Import XLSX<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
          <button className="gold-button" onClick={() => setShow(!show)}>+ Add product</button>
        </div>
      </PageHeader>
      <Notice error={error} message={message} />
      <div className="text-sm text-stone-500">Today&apos;s rates: {Object.entries(rates).map(([k, v]) => `${k} ${inr(v)}/g`).join(" · ") || "No gold rates set — enter them in Settings."}</div>

      {show && (
        <form onSubmit={add} className="card grid gap-4 p-5 md:grid-cols-4">
          <Field label="SKU"><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Purity">
            <select value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })}>
              {["24K", "22K", "18K", "14K"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Weight (g)"><input required type="number" step="0.01" min="0" value={form.weightGrams} onChange={(e) => setForm({ ...form, weightGrams: e.target.value })} /></Field>
          <Field label="Making charge ₹"><input type="number" min="0" value={form.makingCharge} onChange={(e) => setForm({ ...form, makingCharge: e.target.value })} /></Field>
          <Field label="Stone value ₹"><input type="number" min="0" value={form.stoneValue} onChange={(e) => setForm({ ...form, stoneValue: e.target.value })} /></Field>
          <Field label="Stock qty"><input type="number" min="0" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} /></Field>
          <Field label="Rack">
            <select value={form.rackId} onChange={(e) => setForm({ ...form, rackId: e.target.value })}>
              <option value="">Unassigned</option>
              {racks.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </select>
          </Field>
          <div className="flex items-end md:col-span-3"><button className="gold-button">Save product</button></div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:w-72"><input placeholder="Search name, SKU, category" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="!w-auto" checked={onlySlow} onChange={(e) => setOnlySlow(e.target.checked)} />Slow movers only</label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <article className="card p-5" key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <span className="eyebrow">{p.sku}</span>
              <div className="flex gap-1">
                {p.slowMover && <Badge tone="amber">Slow mover</Badge>}
                {!p.available && <Badge tone="stone">Held / unavailable</Badge>}
              </div>
            </div>
            <h2 className="mt-3 font-serif text-2xl">{p.name}</h2>
            <p className="mt-1 text-sm text-stone-500">{p.category} · {p.purity} · {p.weightGrams}g</p>
            <div className="mt-5 text-2xl font-semibold">{inr(p.price)}</div>
            <div className="text-xs text-stone-500">{p.priceOverride ? "Fixed price" : `@ ${inr(p.goldRate)}/g + making + stones`}</div>
            <div className="mt-4 flex justify-between border-t border-[#eee4d4] pt-3 text-xs text-stone-500">
              <span>{p.rack?.code || "Unassigned"}</span>
              <span>{p.stockQty} in stock</span>
            </div>
          </article>
        ))}
        {shown.length === 0 && <div className="card p-6 text-sm text-stone-500">No products found.</div>}
      </div>
    </div>
  );
}
