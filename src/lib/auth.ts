import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { ROLE_NAV } from "@/lib/roles";

const key = new TextEncoder().encode(process.env.JWT_SECRET || "local-development-secret-change-in-production");
export type Session = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  elevatedUntil?: number;
  pending2fa?: boolean;
};

export async function createSession(payload: Session) {
  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
  (await cookies()).set("jewelcrm_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 43200,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get("jewelcrm_session")?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, key)).payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete("jewelcrm_session");
}

export function canAccess(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

export function isElevated(session: Session) {
  return Boolean(session.elevatedUntil && session.elevatedUntil > Date.now());
}

export function roleCanVisit(role: Role, path: string) {
  const allowed = ROLE_NAV[role] || [];
  if (path.startsWith("/api")) return true;
  if (path === "/" || path === "/login" || path.startsWith("/store")) return true;
  return allowed.some((p) => path === p || path.startsWith(p + "/"));
}
