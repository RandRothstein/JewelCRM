import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, isElevated } from "@/lib/auth";
import { canSeeFullCustomer } from "@/lib/roles";
import { Badge, stageTone } from "@/components/ui";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

type TimelineEvent = { at: Date; kind: string; title: string; detail?: string };

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.pending2fa) redirect("/login");
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      visits: { include: { items: { include: { product: true } }, assignedCro: { select: { name: true } } } },
      estimates: { include: { lines: true } },
      holds: { include: { product: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
      feedback: true,
      loyalty: true,
    },
  });
  if (!c) notFound();

  const full = canSeeFullCustomer(session.role) || session.role === "SALES_CRO" || isElevated(session);
  const canExport = canSeeFullCustomer(session.role) || isElevated(session);

  const events: TimelineEvent[] = [
    ...c.visits.map((v) => ({
      at: v.startedAt,
      kind: "VISIT",
      title: `Visit · ${v.outcome}`,
      detail: `${v.reason || "No reason"}${v.assignedCro ? ` · CRO ${v.assignedCro.name}` : ""}${v.items.length ? ` · viewed ${v.items.map((i) => i.product.name).join(", ")}` : ""}`,
    })),
    ...c.estimates.map((e) => ({
      at: e.createdAt,
      kind: "ESTIMATE",
      title: `Estimate ${inr(e.total)} (${e.status})`,
      detail: e.lines.map((l) => l.label).join(", "),
    })),
    ...c.holds.map((h) => ({
      at: h.createdAt,
      kind: "HOLD",
      title: `Hold · ${h.product.name} (${h.status})`,
      detail: `Locked ${inr(h.lockedPrice)} @ ${inr(h.lockedGoldRate)}/g${h.depositAmount ? ` · deposit ${inr(h.depositAmount)}` : ""}`,
    })),
    ...c.messages.map((m) => ({ at: m.createdAt, kind: "MESSAGE", title: `${m.channel} · ${m.status}`, detail: m.body })),
    ...c.feedback.map((f) => ({ at: f.createdAt, kind: "FEEDBACK", title: `Feedback NPS ${f.nps}`, detail: f.comment || undefined })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="space-y-6">
      <a href="/customers" className="text-sm font-semibold text-[#8b621f]">← Customers</a>
      <section className="card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="eyebrow">Customer profile</div>
          <Badge tone={stageTone(c.stage)}>{c.stage}</Badge>
        </div>
        <h1 className="mt-2 font-serif text-4xl">{c.name}</h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-500">
          <span>{c.phone}</span><span>•</span>
          <span>{full ? c.email || "No email" : "Email hidden (OTP elevation required)"}</span><span>•</span>
          <span>{c.preferredMetal || "Preference not recorded"}</span><span>•</span>
          <span>{c.whatsappOptIn ? "WhatsApp opted-in" : "No WhatsApp consent"}</span>
        </div>
        <p className="mt-5 rounded-xl bg-[#faf4e8] p-4 text-sm">{full ? c.notes || "No private notes." : "Private notes are restricted."}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canExport ? (
            <a className="soft-button" href={`/api/customers/${c.id}?export=1`}>Export customer data (JSON)</a>
          ) : (
            <span className="text-xs text-stone-500">Data export is limited to Owner/Manager/Support or OTP-elevated sessions.</span>
          )}
          <span className="text-xs text-stone-500">Export note: every export is recorded in the audit log and should only be shared with the customer or for compliance.</span>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        <div className="card p-5"><div className="eyebrow">Loyalty</div><div className="mt-3 font-serif text-3xl">{c.loyalty?.points || 0}</div><div className="text-sm text-stone-500">{c.loyalty?.tier || "Not enrolled"} tier points</div></div>
        <div className="card p-5"><div className="eyebrow">Visits</div><div className="mt-3 font-serif text-3xl">{c.visits.length}</div><div className="text-sm text-stone-500">Showroom interactions</div></div>
        <div className="card p-5"><div className="eyebrow">Open interests</div><div className="mt-3 font-serif text-3xl">{c.estimates.filter((e) => e.status === "OPEN").length + c.holds.filter((h) => h.status === "ACTIVE").length}</div><div className="text-sm text-stone-500">Estimates and active holds</div></div>
        <div className="card p-5"><div className="eyebrow">Lifetime spend</div><div className="mt-3 font-serif text-3xl">{full ? inr(c.totalSpend) : "—"}</div><div className="text-sm text-stone-500">{c.purchaseCount} purchases</div></div>
      </section>

      <section className="card p-6">
        <div className="eyebrow">Timeline</div>
        <ol className="mt-4 space-y-4">
          {events.length === 0 && <li className="text-sm text-stone-500">No activity recorded yet.</li>}
          {events.map((e, i) => (
            <li key={i} className="flex gap-4 border-l-2 border-[#e6d4b0] pl-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={e.kind === "FEEDBACK" ? "amber" : e.kind === "MESSAGE" ? "stone" : "gold"}>{e.kind}</Badge>
                  <span className="font-semibold">{e.title}</span>
                  <span className="text-xs text-stone-500">{fmt(e.at)}</span>
                </div>
                {e.detail && <div className="mt-1 text-sm text-stone-600">{e.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
