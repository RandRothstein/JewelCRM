"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fmtDateTime, toLocalInput } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Booking = {
  id: string;
  guestName: string;
  phone: string;
  scheduledAt: string;
  purpose: string | null;
  status: string;
  productIds: string;
  customer: { id: string; name: string } | null;
  assignedTo: { name: string } | null;
};
type Opt = { id: string; name: string; sku?: string };

const defaultTime = () => {
  const d = new Date(Date.now() + 86400000);
  d.setHours(11, 0, 0, 0);
  return toLocalInput(d);
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [form, setForm] = useState({ guestName: "", phone: "", scheduledAt: defaultTime(), purpose: "", assignedToId: "", productId: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ bookings: Booking[]; users: Opt[]; products: Opt[] }>("/api/bookings");
      setBookings(d.bookings);
      setUsers(d.users);
      setProducts(d.products);
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
      await apiFetch("/api/bookings", { method: "POST", json: { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() } });
      setMessage("Booking created.");
      setForm({ guestName: "", phone: "", scheduledAt: defaultTime(), purpose: "", assignedToId: "", productId: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function setStatus(bookingId: string, status: string) {
    try {
      await apiFetch("/api/bookings", { method: "POST", json: { action: "status", bookingId, status } });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const productName = (json: string) => {
    try {
      return (JSON.parse(json) as string[]).map((id) => products.find((p) => p.id === id)?.name).filter(Boolean).join(", ");
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Appointments" title="Bookings" description="Private viewings and consultations, linked to customers by phone when they already exist." />
      <Notice error={error} message={message} />
      <form onSubmit={create} className="card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-2"><Field label="Guest name"><input required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} /></Field></div>
        <div className="md:col-span-2"><Field label="Phone"><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div>
        <div className="md:col-span-2"><Field label="When"><input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field></div>
        <div className="md:col-span-2"><Field label="Purpose"><input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Bridal consultation" /></Field></div>
        <div className="md:col-span-2">
          <Field label="Assign to">
            <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Product of interest">
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">None</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-6"><button className="gold-button">Create booking</button></div>
      </form>

      <div className="card table-wrap p-3">
        <table>
          <thead><tr><th>When</th><th>Guest</th><th>Purpose</th><th>Assigned</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{fmtDateTime(b.scheduledAt)}</td>
                <td><div className="font-semibold">{b.customer ? <a href={`/customers/${b.customer.id}`} className="hover:underline">{b.guestName}</a> : b.guestName}</div><div className="text-xs text-stone-500">{b.phone}</div></td>
                <td>{b.purpose || "—"}<div className="text-xs text-stone-500">{productName(b.productIds)}</div></td>
                <td>{b.assignedTo?.name || "—"}</td>
                <td><Badge tone={b.status === "CONFIRMED" ? "gold" : b.status === "COMPLETED" ? "green" : "stone"}>{b.status}</Badge></td>
                <td className="whitespace-nowrap">
                  {b.status === "CONFIRMED" && (
                    <>
                      <button className="mr-3 text-sm font-semibold text-emerald-700" onClick={() => setStatus(b.id, "COMPLETED")}>Complete</button>
                      <button className="text-sm font-semibold text-red-700" onClick={() => setStatus(b.id, "CANCELLED")}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={6} className="text-center text-stone-500">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
