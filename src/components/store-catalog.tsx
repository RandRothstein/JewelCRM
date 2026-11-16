"use client";
import { useState } from "react";

type P = { id: string; name: string; category: string; purity: string; weightGrams: number; price: number };
type HoldResult = { lockedPrice: number; expiresAt: string; depositAmount: number; depositPaymentUrl: string | null };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function StoreCatalog({ token, products, needsContact }: { token: string; products: P[]; needsContact: boolean }) {
  const [held, setHeld] = useState<Record<string, HoldResult>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", whatsappConsent: false });

  async function hold(productId: string) {
    setError(null);
    setBusy(productId);
    try {
      const res = await fetch(`/api/store/${token}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, ...contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place hold");
      setHeld((h) => ({ ...h, [productId]: data }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {needsContact && (
        <div className="grid gap-3 rounded-2xl bg-white/10 p-4 md:grid-cols-3">
          <input className="!bg-white text-[#292724]" placeholder="Your name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          <input className="!bg-white text-[#292724]" placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-stone-200"><input type="checkbox" className="!w-auto" checked={contact.whatsappConsent} onChange={(e) => setContact({ ...contact, whatsappConsent: e.target.checked })} />WhatsApp updates OK</label>
        </div>
      )}
      {error && <div className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => {
          const h = held[p.id];
          return (
            <article key={p.id} className="rounded-3xl bg-[#fffdfa] p-5 text-[#292724]">
              <div className="eyebrow">{p.category}</div>
              <h3 className="mt-1 font-serif text-2xl">{p.name}</h3>
              <p className="text-sm text-stone-500">{p.purity} · {p.weightGrams}g</p>
              <div className="mt-3 text-2xl font-semibold">{inr(p.price)}</div>
              {h ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                  Held at {inr(h.lockedPrice)} until {new Date(h.expiresAt).toLocaleString("en-IN")}.
                  {h.depositAmount > 0 && <div className="mt-1">Deposit of {inr(h.depositAmount)} required{h.depositPaymentUrl && <> · <a className="font-semibold underline" href={h.depositPaymentUrl}>Pay now (mock)</a></>}.</div>}
                </div>
              ) : (
                <button className="gold-button mt-4 w-full" disabled={busy === p.id} onClick={() => hold(p.id)}>{busy === p.id ? "Reserving…" : "Hold for 24 hours"}</button>
              )}
            </article>
          );
        })}
        {products.length === 0 && <div className="text-stone-300">No pieces are available right now.</div>}
      </div>
    </div>
  );
}
