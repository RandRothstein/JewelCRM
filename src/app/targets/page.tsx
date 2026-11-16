import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge, PageHeader, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default async function TargetsPage() {
  const session = await getSession();
  if (!session || session.pending2fa) redirect("/login");
  const month = new Date().toISOString().slice(0, 7);
  const ownOnly = session.role === "SALES_CRO" || session.role === "GREETER" || session.role === "MARKETING_CRO";
  const targets = await prisma.target.findMany({
    where: { month, ...(ownOnly ? { userId: session.userId } : {}) },
    include: { user: true, tiers: { orderBy: { threshold: "asc" } } },
    orderBy: [{ user: { name: "asc" } }, { metric: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Performance" title="Targets & incentives" description={`Progress for ${month}. Markers on each bar show incentive tier thresholds.`} />
      {targets.length === 0 && <div className="card p-6 text-sm text-stone-500">No targets set for this month.</div>}
      <div className="grid gap-5 lg:grid-cols-2">
        {targets.map((t) => {
          const pct = t.goal > 0 ? (t.achieved / t.goal) * 100 : 0;
          const reached = t.tiers.filter((x) => t.achieved >= x.threshold);
          const next = t.tiers.find((x) => t.achieved < x.threshold);
          const earned = reached.length ? Math.max(...reached.map((x) => x.reward)) : 0;
          const max = Math.max(t.goal, ...t.tiers.map((x) => x.threshold));
          return (
            <article key={t.id} className="card space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{t.metric}</div>
                  <h2 className="mt-1 font-serif text-2xl">{t.user.name}</h2>
                </div>
                <Badge tone={pct >= 100 ? "green" : pct >= 50 ? "gold" : "amber"}>{pct.toFixed(0)}%</Badge>
              </div>
              <ProgressBar value={t.achieved} max={max} marks={t.tiers.map((x) => x.threshold)} />
              <div className="flex justify-between text-sm text-stone-600">
                <span>{inr(t.achieved)} achieved</span>
                <span>Goal {inr(t.goal)}</span>
              </div>
              <div className="rounded-xl bg-[#faf4e8] p-4 text-sm">
                <div className="font-semibold">Incentive earned: {inr(earned)}</div>
                {next ? <div className="text-stone-600">{inr(next.threshold - t.achieved)} more to unlock {inr(next.reward)}{next.description ? ` (${next.description})` : ""}.</div> : t.tiers.length > 0 ? <div className="text-stone-600">All tiers unlocked.</div> : null}
              </div>
              <ul className="space-y-1 text-sm">
                {t.tiers.map((x) => (
                  <li key={x.id} className="flex items-center justify-between">
                    <span>{x.description || `Tier at ${inr(x.threshold)}`} · {inr(x.threshold)}</span>
                    <Badge tone={t.achieved >= x.threshold ? "green" : "stone"}>{t.achieved >= x.threshold ? `Reached · ${inr(x.reward)}` : inr(x.reward)}</Badge>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
