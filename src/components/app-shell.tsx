"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gem, LayoutDashboard, Users, Store, Boxes, Megaphone, CalendarDays, BarChart3, Settings, Menu, X, Target, HandCoins, MessageSquareHeart, Clock3,
} from "lucide-react";
import { useEffect, useState } from "react";

const allNav = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/showroom", "Showroom", Store],
  ["/customers", "Customers", Users],
  ["/catalog", "Catalog", Gem],
  ["/campaigns", "Campaigns", Megaphone],
  ["/stock-check", "Stock", Boxes],
  ["/shifts", "Shifts", Clock3],
  ["/targets", "Targets", Target],
  ["/holds", "Holds", HandCoins],
  ["/bookings", "Bookings", CalendarDays],
  ["/loyalty", "Loyalty", Gem],
  ["/feedback", "Feedback", MessageSquareHeart],
  ["/reports", "Reports", BarChart3],
  ["/settings", "Settings", Settings],
] as const;

export function AppShell({ children, role }: { children: React.ReactNode; role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAllowed(d?.nav || null))
      .catch(() => setAllowed(null));
  }, [pathname]);

  if (pathname === "/login" || pathname.startsWith("/store/")) return <>{children}</>;

  const nav = allNav.filter(([href]) => !allowed || allowed.some((p) => href === p || href.startsWith(p)));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <button className="fixed right-4 top-4 z-50 rounded-full bg-[#2d2a26] p-3 text-white md:hidden" onClick={() => setOpen(!open)}>
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>
      <aside className={`fixed inset-y-0 left-0 z-40 w-[250px] bg-[#292724] text-white transition-transform md:sticky md:top-0 md:h-screen ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <div className="rounded-full bg-[#b8872f] p-2"><Gem size={20} /></div>
          <div>
            <div className="font-serif text-xl">JewelCRM</div>
            <div className="text-[10px] uppercase tracking-[.2em] text-[#d6b77e]">Retail Intelligence</div>
          </div>
        </div>
        <nav className="max-h-[calc(100vh-140px)] space-y-1 overflow-y-auto p-4">
          {nav.map(([href, label, Icon]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${pathname.startsWith(href) ? "bg-[#b8872f] text-white" : "text-stone-300 hover:bg-white/8 hover:text-white"}`}>
              <Icon size={18} />{label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <form action="/api/auth/logout" method="post">
            <button className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-left text-sm text-stone-300">Sign out {role ? `· ${role}` : ""}</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="border-b border-[#eadfcd] bg-[#fffdfa]/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div>
              <div className="eyebrow">Flagship showroom</div>
              <div className="text-sm text-stone-500">Live CRM + ERM workspace</div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-5 md:p-8">{children}</div>
      </main>
    </div>
  );
}
