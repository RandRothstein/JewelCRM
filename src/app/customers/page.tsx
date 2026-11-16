"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr } from "@/lib/client";
import { Badge, Field, Notice, PageHeader, stageTone } from "@/components/ui";

type Customer = {
  id: string;
  name: string;
  phone: string;
  stage: string;
  preferredMetal: string | null;
  totalSpend: number;
  whatsappOptIn: boolean;
  loyalty: { points: number } | null;
  _count: { visits: number; estimates: number; holds: number };
};
const STAGES = ["LEAD", "PROSPECT", "INTERESTED", "ESTIMATED", "CUSTOMER", "REPEAT", "LAPSED"];

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferredMetal: "", whatsappOptIn: false });

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ customers: Customer[]; stageCounts: Record<string, number> }>(`/api/customers?stage=${stage}&q=${encodeURIComponent(q)}`);
      setRows(d.customers);
      setCounts(d.stageCounts);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [stage, q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/customers", { method: "POST", json: form });
      setMessage("Customer added.");
      setShowForm(false);
      setForm({ name: "", phone: "", email: "", preferredMetal: "", whatsappOptIn: false });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Relationship book" title="Customers" description="Lifecycle stage, preferences and lifetime value in one respectful view.">
        <button className="gold-button" onClick={() => setShowForm(!showForm)}>+ Add customer</button>
      </PageHeader>
      <Notice error={error} message={message} />

      {showForm && (
        <form onSubmit={add} className="card grid gap-4 p-5 md:grid-cols-5">
          <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Preferred metal"><input value={form.preferredMetal} onChange={(e) => setForm({ ...form, preferredMetal: e.target.value })} /></Field>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" className="!w-auto" checked={form.whatsappOptIn} onChange={(e) => setForm({ ...form, whatsappOptIn: e.target.checked })} />WhatsApp opt-in</label>
            <button className="gold-button">Save</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className={stage === "" ? "gold-button" : "soft-button"} onClick={() => setStage("")}>All</button>
        {STAGES.map((s) => (
          <button key={s} className={stage === s ? "gold-button" : "soft-button"} onClick={() => setStage(s)}>{s} · {counts[s] || 0}</button>
        ))}
        <div className="ml-auto w-full md:w-72"><input placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      <div className="card table-wrap p-3">
        <table>
          <thead><tr><th>Customer</th><th>Stage</th><th>Preference</th><th>Visits</th><th>Estimates</th><th>Spend</th><th>Loyalty</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><div className="font-semibold">{c.name}</div><div className="text-xs text-stone-500">{c.phone}{c.whatsappOptIn ? " · WA" : ""}</div></td>
                <td><Badge tone={stageTone(c.stage)}>{c.stage}</Badge></td>
                <td>{c.preferredMetal || "—"}</td>
                <td>{c._count.visits}</td>
                <td>{c._count.estimates}</td>
                <td>{inr(c.totalSpend)}</td>
                <td>{c.loyalty?.points || 0} pts</td>
                <td><a className="font-semibold text-[#8b621f]" href={`/customers/${c.id}`}>View →</a></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-stone-500">No customers match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
