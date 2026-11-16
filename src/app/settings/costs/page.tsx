"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr } from "@/lib/client";
import { Field, Notice, PageHeader } from "@/components/ui";

type Cost = { id: string; month: string; category: string; label: string; amount: number; units: number; notes: string | null };

export default function CostsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [costs, setCosts] = useState<Cost[]>([]);
  const [form, setForm] = useState({ category: "MAINTENANCE", label: "", amount: "", units: "1", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ costs: Cost[] }>(`/api/settings?month=${month}`);
      setCosts(d.costs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/settings", { method: "POST", json: { type: "cost", month, ...form } });
      setMessage("Cost line added.");
      setForm({ ...form, label: "", amount: "", notes: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function remove(id: string) {
    try {
      await apiFetch(`/api/settings?costId=${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const byCategory: Record<string, number> = {};
  for (const c of costs) byCategory[c.category] = (byCategory[c.category] || 0) + c.amount * c.units;
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance settings" title="Monthly costs" description="Operating lines (including automatic WhatsApp message costs) that shape contribution and campaign ROI.">
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <a href="/settings" className="soft-button whitespace-nowrap">← Settings</a>
        </div>
      </PageHeader>
      <Notice error={error} message={message} />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-5"><div className="eyebrow">Total {month}</div><div className="mt-2 font-serif text-3xl">{inr(total)}</div></div>
        {Object.entries(byCategory).slice(0, 3).map(([k, v]) => <div key={k} className="card p-5"><div className="eyebrow">{k}</div><div className="mt-2 font-serif text-2xl">{inr(v)}</div></div>)}
      </div>

      <form onSubmit={add} className="card grid gap-4 p-5 md:grid-cols-6">
        <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })} /></Field>
        <div className="md:col-span-2"><Field label="Label"><input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field></div>
        <Field label="Unit amount ₹"><input required type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Units"><input type="number" min={1} value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} /></Field>
        <div className="flex items-end"><button className="gold-button w-full">Add cost</button></div>
      </form>

      <div className="card table-wrap p-3">
        <table>
          <thead><tr><th>Category</th><th>Label</th><th>Unit ₹</th><th>Units</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.id}>
                <td>{c.category}</td>
                <td className="font-semibold">{c.label}{c.notes && <div className="text-xs font-normal text-stone-500">{c.notes}</div>}</td>
                <td>{inr(c.amount)}</td>
                <td>{c.units}</td>
                <td>{inr(c.amount * c.units)}</td>
                <td><button className="text-sm font-semibold text-red-700" onClick={() => remove(c.id)}>Delete</button></td>
              </tr>
            ))}
            {costs.length === 0 && <tr><td colSpan={6} className="text-center text-stone-500">No cost lines for {month}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
