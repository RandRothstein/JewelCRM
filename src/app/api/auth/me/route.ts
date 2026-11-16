import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLE_NAV } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session || session.pending2fa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    nav: ROLE_NAV[session.role],
  });
}
