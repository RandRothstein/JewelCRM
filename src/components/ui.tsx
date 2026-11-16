import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-stone-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "green" | "red" | "stone" | "amber" }) {
  const tones = {
    gold: "bg-[#f2e5cc] text-[#76531d]",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    stone: "bg-stone-100 text-stone-600",
    amber: "bg-amber-100 text-amber-800",
  } as const;
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Notice({ error, message }: { error?: string | null; message?: string | null }) {
  if (!error && !message) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {error || message}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</span>
      {children}
    </label>
  );
}

export function ProgressBar({ value, max, marks }: { value: number; max: number; marks?: number[] }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative h-3 w-full rounded-full bg-[#efe5d2]">
      <div className="h-3 rounded-full bg-[#a97926]" style={{ width: `${pct}%` }} />
      {marks?.map((m, i) => (
        <span key={i} className="absolute top-0 h-3 w-0.5 bg-[#292724]/60" style={{ left: `${Math.min(100, (m / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export const stageTone = (stage: string): "gold" | "green" | "red" | "stone" | "amber" =>
  stage === "CUSTOMER" || stage === "REPEAT" ? "green" : stage === "LAPSED" ? "red" : stage === "LEAD" ? "stone" : stage === "ESTIMATED" ? "amber" : "gold";
