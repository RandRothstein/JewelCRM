"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr, fmtDateTime } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Campaign = {
  id: string;
  name: string;
  templateType: string;
  goal: string | null;
  status: string;
  messagesSent: number;
  messagesRead: number;
  costAmount: number;
  segmentJson: string;
  messages: { id: string; recipient: string; status: string; body: string; sentAt: string | null; customer: { name: string } | null }[];
};
type SendResult = { sent: number; cost: number; skippedRecentlyMessaged: number; excludedNoConsent: number; practiceMode: boolean };

const TEMPLATES: Record<string, string> = {
  FESTIVE: "Hi {name}, celebrate the festive season with our new gold collection. Visit us this week!",
  BRIDAL: "Hi {name}, our bridal gold & diamond sets are now on display. Book a private viewing.",
  NEW_ARRIVAL: "Hi {name}, new arrivals just landed in the showroom. Come see them first.",
  WINBACK: "Hi {name}, we miss you! Enjoy a complimentary cleaning and a fresh look at our latest designs.",
  BIRTHDAY: "Happy birthday {name}! Visit us this month for a special gift.",
  CUSTOM: "",
};
const STAGES = ["LEAD", "PROSPECT", "INTERESTED", "ESTIMATED", "CUSTOMER", "REPEAT", "LAPSED"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [practice, setPractice] = useState(true);
  const [form, setForm] = useState({ name: "", templateType: "FESTIVE", goal: "", message: TEMPLATES.FESTIVE, stages: [] as string[] });
  const [results, setResults] = useState<Record<string, SendResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ campaigns: Campaign[]; practiceMode: boolean }>("/api/campaigns");
      setCampaigns(d.campaigns);
      setPractice(d.practiceMode);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/campaigns", { method: "POST", json: { action: "create", ...form } });
      setForm({ ...form, name: "", goal: "" });
      setMessage("Campaign created as draft.");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function send(id: string) {
    setError(null);
    setMessage(null);
    try {
      const r = await apiFetch<SendResult>("/api/campaigns", { method: "POST", json: { action: "send", campaignId: id } });
      setResults({ ...results, [id]: r });
      setMessage(`Sent ${r.sent} message(s).`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const toggleStage = (s: string) => setForm({ ...form, stages: form.stages.includes(s) ? form.stages.filter((x) => x !== s) : [...form.stages, s] });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Growth" title="Campaign studio" description="Template-based WhatsApp campaigns sent only to customers who opted in. Recently messaged customers are skipped automatically." />
      {practice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">PRACTICE_MODE is on — messages are routed to a staff phone, never to real customers.</div>}
      <Notice error={error} message={message} />

      <form onSubmit={create} className="card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-2"><Field label="Campaign name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
        <div className="md:col-span-2">
          <Field label="Template type">
            <select value={form.templateType} onChange={(e) => setForm({ ...form, templateType: e.target.value, message: TEMPLATES[e.target.value] ?? form.message })}>
              {Object.keys(TEMPLATES).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2"><Field label="Goal"><input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Drive 10 visits" /></Field></div>
        <div className="md:col-span-6"><Field label="Message ({name} is personalised)"><textarea rows={3} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field></div>
        <div className="md:col-span-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Segment by stage (none = all opted-in)</div>
          <div className="flex flex-wrap gap-2">{STAGES.map((s) => <button type="button" key={s} className={form.stages.includes(s) ? "gold-button" : "soft-button"} onClick={() => toggleStage(s)}>{s}</button>)}</div>
        </div>
        <div className="md:col-span-6"><button className="gold-button">Create campaign</button></div>
      </form>

      <div className="space-y-4">
        {campaigns.map((c) => {
          const r = results[c.id];
          let stages: string[] = [];
          try { stages = JSON.parse(c.segmentJson).stages || []; } catch { /* ignore */ }
          return (
            <article key={c.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl">{c.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-2"><Badge>{c.templateType}</Badge><Badge tone={c.status === "SENT" ? "green" : "stone"}>{c.status}</Badge><Badge tone="stone">{stages.length ? stages.join(", ") : "All opted-in"}</Badge></div>
                </div>
                {c.status !== "SENT" && <button className="gold-button" onClick={() => send(c.id)}>Send mock WhatsApp</button>}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="eyebrow">Sent</div><div className="font-serif text-2xl">{c.messagesSent}</div></div>
                <div><div className="eyebrow">Read</div><div className="font-serif text-2xl">{c.messagesRead}</div></div>
                <div><div className="eyebrow">Cost</div><div className="font-serif text-2xl">{inr(c.costAmount)}</div></div>
              </div>
              {r && (
                <div className="rounded-xl bg-[#faf4e8] p-3 text-sm">
                  Result: {r.sent} sent · {inr(r.cost)} cost · {r.skippedRecentlyMessaged} skipped (recently messaged) · {r.excludedNoConsent} excluded (no consent)
                </div>
              )}
              {c.messages.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Recipient</th><th>Customer</th><th>Status</th><th>Sent</th></tr></thead>
                    <tbody>{c.messages.map((m) => <tr key={m.id}><td>{m.recipient}</td><td>{m.customer?.name || "—"}</td><td>{m.status}</td><td>{fmtDateTime(m.sentAt)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
        {campaigns.length === 0 && <div className="card p-6 text-sm text-stone-500">No campaigns yet.</div>}
      </div>
    </div>
  );
}
