import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getSession, type Session } from "@/lib/auth";

export type AuthResult = { session: Session } | { error: NextResponse };

/** Returns a session or a ready-made 401/403 response. Pending-2FA sessions are rejected. */
export async function requireSession(roles?: Role[]): Promise<AuthResult> {
  const session = await getSession();
  if (!session || session.pending2fa) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (roles && !roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export const MANAGEMENT: Role[] = ["OWNER", "MANAGER", "SUPPORT"];

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function normalizePhone(raw: unknown) {
  const s = String(raw ?? "").trim().replace(/[\s-]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (/^\d{10}$/.test(s)) return `+91${s}`;
  return s;
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
