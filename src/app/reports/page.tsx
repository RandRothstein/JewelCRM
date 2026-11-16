"use client";
import { useEffect, useState } from "react";
import { apiFetch, inr } from "@/lib/client";
import { Badge, Notice, PageHeader } from "@/components/ui";

type Money = Record<string, number>;
type Report = {
  sales: { total: number; last30Days: number; count: number; returns: number; byCategory: Money; byCro: Money; byMonth: Money };
  campaigns: { id: string; name: string; templateType: string; status: string; messagesSent: number; messagesRead: number; holdsCreated: number; visitsBooked: number; salesWithin14d: number; costAmount: number }[];
  stock: { slowMoverDays: number; totalUnits: number; slowValue: number; slowMovers: { id: string; sku: string; name: string; stockQty: number; ageDays: number; value: number }[] };
  feedback: { count: number; avgNps: number | null; npsScore: number | null; avgStore: number | null; avgStaff: number | null; avgCollection: number | null };
  customersByStage: Record<string, number>;
  estimates: { status: string; count: number; total: number }[];
};

function Breakdown({ title, data }: { title: string; data: Money }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => Math.abs(v)));
  return (
    <div className="card p-5">
      <div className="eyebrow">{title}</div>
      <div className="mt-3 space-y-2">
        {entries.length === 0 && <div className="text-sm text-stone-500">No data.</div>}
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-sm"><span>{k}</span><span className="font-semibold">{inr(v)}</span></div>
            <div className="mt-1 h-2 rounded-full bg-[#efe5d2]"><div className="h-2 rounded-full bg-[#a97926]" style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<Report>("/api/reports").then(setR).catch((e) => setError(e.message));
  }, []);

  const kpi = (label: string, value: string) => (
    <div className="card p-5"><div className="eyebrow">{label}</div><div className="mt-2 font-serif text-3xl">{value}</div></div>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Reports & insights" description="Sales, campaign performance, slow-moving stock and customer sentiment." />
      <Notice error={error} />
      {!r && !error && <div className="text-stone-500">Loading…</div>}
      {r && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {kpi("Net sales", inr(r.sales.total))}
            {kpi("Last 30 days", inr(r.sales.last30Days))}
            {kpi("Bills", String(r.sales.count))}
            {kpi("Returns", inr(r.sales.returns))}
          </section>
          <section className="grid gap-4 lg:grid-cols-3">
            <Breakdown title="Sales by category" data={r.sales.byCategory} />
            <Breakdown title="Sales by CRO" data={r.sales.byCro} />
            <Breakdown title="Sales by month" data={r.sales.byMonth} />
          </section>

          <section className="card table-wrap p-3">
            <div className="eyebrow p-3">Campaign performance</div>
            <table>
              <thead><tr><th>Campaign</th><th>Type</th><th>Status</th><th>Sent</th><th>Read</th><th>Holds</th><th>Visits</th><th>Sales 14d</th><th>Cost</th></tr></thead>
              <tbody>
                {r.campaigns.map((c) => (
                  <tr key={c.id}><td className="font-semibold">{c.name}</td><td>{c.templateType}</td><td><Badge tone={c.status === "SENT" ? "green" : "stone"}>{c.status}</Badge></td><td>{c.messagesSent}</td><td>{c.messagesRead}</td><td>{c.holdsCreated}</td><td>{c.visitsBooked}</td><td>{inr(c.salesWithin14d)}</td><td>{inr(c.costAmount)}</td></tr>
                ))}
                {r.campaigns.length === 0 && <tr><td colSpan={9} className="text-center text-stone-500">No campaigns.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="card table-wrap p-3">
            <div className="eyebrow p-3">Slow movers (older than {r.stock.slowMoverDays} days) · {inr(r.stock.slowValue)} tied up · {r.stock.totalUnits} units in stock</div>
            <table>
              <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Age</th><th>Value</th></tr></thead>
              <tbody>
                {r.stock.slowMovers.map((p) => <tr key={p.id}><td>{p.sku}</td><td className="font-semibold">{p.name}</td><td>{p.stockQty}</td><td>{p.ageDays} days</td><td>{inr(p.value)}</td></tr>)}
                {r.stock.slowMovers.length === 0 && <tr><td colSpan={5} className="text-center text-stone-500">No slow movers.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            {kpi("Feedback responses", String(r.feedback.count))}
            {kpi("NPS score", r.feedback.npsScore === null ? "—" : String(r.feedback.npsScore))}
            {kpi("Avg store", r.feedback.avgStore === null ? "—" : `${r.feedback.avgStore}/5`)}
            {kpi("Avg staff", r.feedback.avgStaff === null ? "—" : `${r.feedback.avgStaff}/5`)}
            {kpi("Avg collection", r.feedback.avgCollection === null ? "—" : `${r.feedback.avgCollection}/5`)}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <div className="eyebrow">Customers by stage</div>
              <div className="mt-3 flex flex-wrap gap-2">{Object.entries(r.customersByStage).map(([k, v]) => <Badge key={k}>{k}: {v}</Badge>)}</div>
            </div>
            <div className="card p-5">
              <div className="eyebrow">Estimates</div>
              <div className="mt-3 flex flex-wrap gap-2">{r.estimates.map((e) => <Badge key={e.status} tone="stone">{e.status}: {e.count} · {inr(e.total)}</Badge>)}</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
