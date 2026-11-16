"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, inr, fmtDate } from "@/lib/client";
import { Badge, Notice, PageHeader } from "@/components/ui";

type Account = {
  id: string;
  points: number;
  tier: string;
  expiresAt: string | null;
  customer: { id: string; name: string; phone: string };
  coupons: { id: string; code: string; value: number; status: string; expiresAt: string | null }[];
};

export default function LoyaltyPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pointValue, setPointValue] = useState(1);
  const [value, setValue] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ accounts: Account[]; pointValue: number }>("/api/loyalty");
      setAccounts(d.accounts);
      setPointValue(d.pointValue);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function issue(a: Account) {
    setError(null);
    setMessage(null);
    try {
      const c = await apiFetch<{ code: string; value: number }>("/api/loyalty", { method: "POST", json: { accountId: a.id, value: Number(value[a.id]), expiresInDays: 30 } });
      setMessage(`Coupon ${c.code} (${inr(c.value)}) issued to ${a.customer.name}.`);
      setValue({ ...value, [a.id]: "" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rewards" title="Loyalty accounts" description={`Points are earned on purchases and redeemable against making charges only (1 point = ${inr(pointValue)}). Issue goodwill coupons here.`} />
      <Notice error={error} message={message} />
      <div className="card table-wrap p-3">
        <table>
          <thead><tr><th>Customer</th><th>Tier</th><th>Points</th><th>Expires</th><th>Recent coupons</th><th>Issue coupon</th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td><a href={`/customers/${a.customer.id}`} className="font-semibold hover:underline">{a.customer.name}</a><div className="text-xs text-stone-500">{a.customer.phone}</div></td>
                <td><Badge>{a.tier}</Badge></td>
                <td className="font-serif text-xl">{a.points}</td>
                <td>{fmtDate(a.expiresAt)}</td>
                <td className="text-xs">{a.coupons.length ? a.coupons.map((c) => <div key={c.id}>{c.code} · {inr(c.value)} · {c.status}</div>) : "—"}</td>
                <td>
                  <div className="flex gap-2">
                    <input type="number" min={1} placeholder="₹ value" className="!w-28" value={value[a.id] || ""} onChange={(e) => setValue({ ...value, [a.id]: e.target.value })} />
                    <button className="gold-button whitespace-nowrap" disabled={!value[a.id]} onClick={() => issue(a)}>Issue</button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={6} className="text-center text-stone-500">No loyalty accounts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
