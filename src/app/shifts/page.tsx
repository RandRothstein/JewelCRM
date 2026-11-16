"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fmtDateTime, toLocalInput } from "@/lib/client";
import { Badge, Field, Notice, PageHeader } from "@/components/ui";

type Shift = { id: string; task: string | null; notes: string | null; plannedStart: string; plannedEnd: string; user: { id: string; name: string; role: string }; rack: { code: string; name: string } | null };
type User = { id: string; name: string; role: string };
type Rack = { id: string; code: string; name: string };

function defaultTimes() {
  const s = new Date();
  s.setDate(s.getDate() + 1);
  s.setHours(10, 0, 0, 0);
  const e = new Date(s);
  e.setHours(19);
  return { plannedStart: toLocalInput(s), plannedEnd: toLocalInput(e) };
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [form, setForm] = useState({ userId: "", rackId: "", task: "", notes: "", ...defaultTimes() });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ shifts: Shift[]; users: User[]; racks: Rack[] }>("/api/shifts");
      setShifts(d.shifts);
      setUsers(d.users);
      setRacks(d.racks);
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
      await apiFetch("/api/shifts", { method: "POST", json: { ...form, plannedStart: new Date(form.plannedStart).toISOString(), plannedEnd: new Date(form.plannedEnd).toISOString() } });
      setMessage("Shift created.");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/shifts?id=${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Floor calendar" title="Staff shifts" description="Plan who covers which rack and when. Overlapping shifts for the same person are rejected." />
      <Notice error={error} message={message} />
      <form onSubmit={create} className="card grid gap-4 p-5 md:grid-cols-6">
        <div className="md:col-span-2">
          <Field label="Staff member">
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Select…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Rack">
            <select value={form.rackId} onChange={(e) => setForm({ ...form, rackId: e.target.value })}>
              <option value="">No rack</option>
              {racks.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2"><Field label="Task"><input value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="Bridal counter" /></Field></div>
        <div className="md:col-span-2"><Field label="Start"><input required type="datetime-local" value={form.plannedStart} onChange={(e) => setForm({ ...form, plannedStart: e.target.value })} /></Field></div>
        <div className="md:col-span-2"><Field label="End"><input required type="datetime-local" value={form.plannedEnd} onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })} /></Field></div>
        <div className="flex items-end md:col-span-2"><button className="gold-button w-full">Create shift</button></div>
      </form>

      <div className="card table-wrap p-3">
        <table>
          <thead><tr><th>Staff</th><th>Rack</th><th>Task</th><th>Start</th><th>End</th><th></th></tr></thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td><div className="font-semibold">{s.user.name}</div><Badge tone="stone">{s.user.role}</Badge></td>
                <td>{s.rack ? `${s.rack.code} · ${s.rack.name}` : "—"}</td>
                <td>{s.task || "—"}</td>
                <td>{fmtDateTime(s.plannedStart)}</td>
                <td>{fmtDateTime(s.plannedEnd)}</td>
                <td><button className="text-sm font-semibold text-red-700" onClick={() => remove(s.id)}>Remove</button></td>
              </tr>
            ))}
            {shifts.length === 0 && <tr><td colSpan={6} className="text-center text-stone-500">No upcoming shifts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
