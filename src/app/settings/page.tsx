"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr, fmtDateTime } from "@/lib/client";
import { Field, Notice, PageHeader } from "@/components/ui";

type Setting = { id: string; key: string; value: string; description: string | null };
type Rate = { id: string; purity: string; ratePerGram: number; effectiveAt: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rate, setRate] = useState({ purity: "22K", ratePerGram: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ settings: Setting[]; rates: Rate[] }>("/api/settings");
      setSettings(d.settings);
      setRates(d.rates);
      setDraft(Object.fromEntries(d.settings.map((s) => [s.key, s.value])));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(s: Setting) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/settings", { method: "POST", json: { key: s.key, value: draft[s.key] } });
      setMessage(`Saved ${s.key}.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/settings", { method: "POST", json: { type: "goldRate", ...rate } });
      setMessage(`${rate.purity} rate recorded.`);
      setRate({ ...rate, ratePerGram: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const latest: Record<string, Rate> = {};
  for (const r of rates) if (!latest[r.purity]) latest[r.purity] = r;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configuration" title="Settings" description="Gold rates drive every price in the CRM. Business rules below apply immediately.">
        <a href="/settings/costs" className="soft-button">Monthly costs →</a>
      </PageHeader>
      <Notice error={error} message={message} />

      <section className="card space-y-4 p-5">
        <div className="eyebrow">Gold rate entry (₹ per gram)</div>
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.values(latest).map((r) => <div key={r.id} className="rounded-xl bg-[#faf4e8] px-4 py-2"><strong>{r.purity}</strong> {inr(r.ratePerGram)}/g <span className="text-xs text-stone-500">· {fmtDateTime(r.effectiveAt)}</span></div>)}
        </div>
        <form onSubmit={addRate} className="grid gap-3 md:grid-cols-4">
          <Field label="Purity">
            <select value={rate.purity} onChange={(e) => setRate({ ...rate, purity: e.target.value })}>
              {["24K", "22K", "18K", "14K"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Rate ₹/g"><input required type="number" min={1} step="0.01" value={rate.ratePerGram} onChange={(e) => setRate({ ...rate, ratePerGram: e.target.value })} /></Field>
          <div className="flex items-end"><button className="gold-button">Record rate</button></div>
        </form>
      </section>

      <section className="card table-wrap p-3">
        <div className="eyebrow p-3">Business rules</div>
        <table>
          <thead><tr><th>Key</th><th>Description</th><th>Value</th><th></th></tr></thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.key}</td>
                <td className="text-sm text-stone-500">{s.description || "—"}</td>
                <td className="w-56">
                  {s.value === "true" || s.value === "false" ? (
                    <select value={draft[s.key] ?? s.value} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input value={draft[s.key] ?? s.value} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
                  )}
                </td>
                <td><button className="soft-button" disabled={(draft[s.key] ?? s.value) === s.value} onClick={() => save(s)}>Save</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
