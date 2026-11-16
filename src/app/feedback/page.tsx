"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fmtDateTime } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Feedback = {
  id: string;
  nps: number;
  storeRating: number | null;
  staffRating: number | null;
  collectionRating: number | null;
  comment: string | null;
  bridal: boolean;
  ownerComment: string | null;
  ownerReviewedAt: string | null;
  croAcknowledgedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
};
type Summary = { count: number; avgNps: number | null; npsScore: number | null; avgStore: number | null; avgStaff: number | null; avgCollection: number | null };

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [role, setRole] = useState("");
  const [form, setForm] = useState({ customerId: "", nps: "9", storeRating: "5", staffRating: "5", collectionRating: "5", comment: "", bridal: false });
  const [ownerText, setOwnerText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ feedback: Feedback[]; customers: { id: string; name: string }[]; summary: Summary }>("/api/feedback");
      setItems(d.feedback);
      setCustomers(d.customers);
      setSummary(d.summary);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    apiFetch<{ role: string }>("/api/auth/me").then((d) => setRole(d.role)).catch(() => undefined);
  }, [load]);

  async function post(json: Record<string, unknown>, ok: string) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/feedback", { method: "POST", json });
      setMessage(ok);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const isOwner = role === "OWNER" || role === "MANAGER";
  const canAck = isOwner || role === "SALES_CRO";
  const stat = (label: string, v: number | null, suffix = "") => (
    <div className="card p-5"><div className="eyebrow">{label}</div><div className="mt-2 font-serif text-3xl">{v === null ? "—" : `${v}${suffix}`}</div></div>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Voice of customer" title="Feedback & NPS" description="Mock WhatsApp survey submissions. Low scores and bridal feedback should be reviewed by the owner and acknowledged by the CRO." />
      <Notice error={error} message={message} />

      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          {stat("Responses", summary.count)}
          {stat("NPS score", summary.npsScore)}
          {stat("Avg NPS (0-10)", summary.avgNps)}
          {stat("Staff rating", summary.avgStaff, "/5")}
          {stat("Collection", summary.avgCollection, "/5")}
        </div>
      )}

      <form
        className="card grid gap-4 p-5 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          post({ action: "submit", ...form, nps: Number(form.nps) }, "Feedback recorded.");
        }}
      >
        <div className="eyebrow md:col-span-6">Submit mock survey response</div>
        <div className="md:col-span-2">
          <Field label="Customer">
            <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Anonymous</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="NPS (0-10)"><input type="number" min={0} max={10} value={form.nps} onChange={(e) => setForm({ ...form, nps: e.target.value })} /></Field>
        <Field label="Store (1-5)"><input type="number" min={1} max={5} value={form.storeRating} onChange={(e) => setForm({ ...form, storeRating: e.target.value })} /></Field>
        <Field label="Staff (1-5)"><input type="number" min={1} max={5} value={form.staffRating} onChange={(e) => setForm({ ...form, staffRating: e.target.value })} /></Field>
        <Field label="Collection (1-5)"><input type="number" min={1} max={5} value={form.collectionRating} onChange={(e) => setForm({ ...form, collectionRating: e.target.value })} /></Field>
        <div className="md:col-span-4"><Field label="Comment"><input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field></div>
        <label className="flex items-end gap-2 pb-3 text-sm md:col-span-1"><input type="checkbox" className="!w-auto" checked={form.bridal} onChange={(e) => setForm({ ...form, bridal: e.target.checked })} />Bridal</label>
        <div className="flex items-end md:col-span-1"><button className="gold-button w-full">Submit</button></div>
      </form>

      <div className="space-y-4">
        {items.map((f) => (
          <article key={f.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{f.customer?.name || "Anonymous"} <span className="text-xs font-normal text-stone-500">· {fmtDateTime(f.createdAt)}</span></div>
              <div className="flex gap-2">
                <Badge tone={f.nps >= 9 ? "green" : f.nps >= 7 ? "gold" : "red"}>NPS {f.nps}</Badge>
                {f.bridal && <Badge tone="amber">Bridal</Badge>}
                {f.croAcknowledgedAt ? <Badge tone="green">CRO acknowledged</Badge> : <Badge tone="stone">Awaiting CRO</Badge>}
              </div>
            </div>
            <p className="text-sm text-stone-600">{f.comment || "No comment."}</p>
            <div className="text-xs text-stone-500">Store {f.storeRating ?? "—"} · Staff {f.staffRating ?? "—"} · Collection {f.collectionRating ?? "—"}</div>
            {f.ownerComment && <div className="rounded-xl bg-[#faf4e8] p-3 text-sm"><strong>Owner:</strong> {f.ownerComment}</div>}
            <div className="flex flex-wrap items-center gap-3">
              {canAck && !f.croAcknowledgedAt && <button className="soft-button" onClick={() => post({ action: "acknowledge", feedbackId: f.id }, "Acknowledged.")}>Acknowledge</button>}
              {isOwner && (
                <>
                  <input className="!w-72" placeholder="Owner comment" value={ownerText[f.id] || ""} onChange={(e) => setOwnerText({ ...ownerText, [f.id]: e.target.value })} />
                  <button className="gold-button" disabled={!ownerText[f.id]} onClick={() => post({ action: "ownerComment", feedbackId: f.id, comment: ownerText[f.id] }, "Owner comment saved.")}>Save comment</button>
                </>
              )}
            </div>
          </article>
        ))}
        {items.length === 0 && <div className="card p-6 text-sm text-stone-500">No feedback yet.</div>}
      </div>
    </div>
  );
}
