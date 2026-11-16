import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IndianRupee, Users, AlertTriangle, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session || session.pending2fa) redirect("/login");

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const month = startToday.toISOString().slice(0, 7);
  const lastMonthDate = new Date(startToday.getFullYear(), startToday.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [todaySales, monthSales, lastMonthSales, customers, openVisits, unhappy, otpPending, mismatches, tomorrowShifts, rate] =
    await Promise.all([
      prisma.saleImport.aggregate({ _sum: { amount: true }, where: { soldAt: { gte: startToday }, isReturn: false } }),
      prisma.saleImport.aggregate({ _sum: { amount: true }, where: { soldAt: { gte: new Date(`${month}-01`) }, isReturn: false } }),
      prisma.saleImport.aggregate({
        _sum: { amount: true },
        where: { soldAt: { gte: new Date(`${lastMonth}-01`), lt: new Date(`${month}-01`) }, isReturn: false },
      }),
      prisma.customer.count(),
      prisma.visit.findMany({ where: { endedAt: null }, include: { customer: true, assignedCro: true }, take: 8 }),
      prisma.feedback.findMany({ where: { OR: [{ nps: { lte: 6 } }, { bridal: true }], ownerReviewedAt: null }, include: { customer: true }, take: 5 }),
      prisma.otpAccessRequest.count({ where: { verifiedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.stockMismatch.count({ where: { resolved: false } }),
      prisma.staffShift.findMany({
        where: { plannedStart: { gte: tomorrow, lte: tomorrowEnd } },
        include: { user: true, rack: true },
        orderBy: { plannedStart: "asc" },
      }),
      prisma.goldRate.findFirst({ where: { purity: "22K" }, orderBy: { effectiveAt: "desc" } }),
    ]);

  const stats = [
    { label: "Today's sales", value: todaySales._sum.amount || 0, icon: IndianRupee },
    { label: "This month", value: monthSales._sum.amount || 0, icon: IndianRupee },
    { label: "Last month", value: lastMonthSales._sum.amount || 0, icon: IndianRupee },
    { label: "Customers", value: customers, icon: Users },
  ];

  return (
    <div className="space-y-7">
      <section>
        <div className="eyebrow">Owner dashboard</div>
        <h1 className="mt-2 font-serif text-4xl">Good day, {session.name.split(" ")[0]}.</h1>
        <p className="mt-2 text-stone-500">22K rate ₹{(rate?.ratePerGram || 0).toLocaleString("en-IN")}/g · live showroom pulse</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div className="card p-5" key={label}>
            <Icon className="text-[#a97926]" size={20} />
            <div className="mt-4 font-serif text-3xl">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
            <div className="mt-1 text-sm text-stone-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <div className="eyebrow">Waiting for you</div>
          <h2 className="mt-1 font-serif text-2xl">Approvals & alerts</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-[#fff6ea] px-4 py-3"><span>Unhappy / bridal feedback</span><strong>{unhappy.length}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-[#fff6ea] px-4 py-3"><span>OTP access requests</span><strong>{otpPending}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-[#fff6ea] px-4 py-3"><span>Stock mismatches</span><strong>{mismatches}</strong></div>
            <Link href="/settings/costs" className="flex items-center justify-between rounded-xl bg-[#f4f0e8] px-4 py-3"><span>Monthly bill</span><span className="text-[#8b621f]">Open →</span></Link>
          </div>
          {unhappy.length > 0 && (
            <div className="mt-5 space-y-2">
              {unhappy.map((f) => (
                <div key={f.id} className="rounded-xl border border-[#eadfcd] p-3 text-sm">
                  <div className="font-semibold">{f.customer?.name || "Guest"} · NPS {f.nps}{f.bridal ? " · Bridal" : ""}</div>
                  <div className="text-stone-500">{f.comment || "No comment"}</div>
                </div>
              ))}
              <Link href="/feedback" className="text-sm font-semibold text-[#8b621f]">Review feedback →</Link>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Tomorrow</div>
              <h2 className="mt-1 font-serif text-2xl">Shift plan</h2>
            </div>
            <CalendarDays className="text-[#a97926]" />
          </div>
          <div className="mt-4 space-y-2">
            {tomorrowShifts.length === 0 && <div className="text-sm text-stone-500">No shifts scheduled yet.</div>}
            {tomorrowShifts.map((s) => (
              <div key={s.id} className="rounded-xl border border-[#eadfcd] px-4 py-3 text-sm">
                <div className="font-semibold">{s.user.name}</div>
                <div className="text-stone-500">{s.task || "Floor"}{s.rack ? ` · ${s.rack.name}` : ""} · {s.plannedStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{s.plannedEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
            <Link href="/shifts" className="text-sm font-semibold text-[#8b621f]">Manage shifts →</Link>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Right now</div>
            <h2 className="mt-1 font-serif text-2xl">Open visits</h2>
          </div>
          <Link href="/showroom" className="soft-button">Showroom</Link>
        </div>
        <div className="mt-4 divide-y divide-[#eee4d4]">
          {openVisits.length === 0 && <div className="py-4 text-sm text-stone-500">No active visits.</div>}
          {openVisits.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="font-semibold">{v.customer.name}</div>
                <div className="text-stone-500">{v.reason || v.purpose || "Visit"} · {v.assignedCro?.name || "Unassigned"}</div>
              </div>
              <AlertTriangle className="text-stone-300" size={16} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
