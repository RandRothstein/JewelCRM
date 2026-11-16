import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const otp = body.otp ? String(body.otp) : "";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const needs2fa = user.requires2fa || user.role === "OWNER" || user.role === "MANAGER";

  if (needs2fa && !otp) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.loginOtp.create({
      data: {
        userId: user.id,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    console.log(`[2FA OTP for ${user.email}] ${code}`);
    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pending2fa: true,
    });
    return NextResponse.json({ requiresOtp: true, message: "OTP sent (check server console in mock mode)" });
  }

  if (needs2fa && otp) {
    const latest = await prisma.loginOtp.findFirst({
      where: { userId: user.id, verifiedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!latest || !(await bcrypt.compare(otp, latest.codeHash))) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }
    await prisma.loginOtp.update({ where: { id: latest.id }, data: { verifiedAt: new Date() } });
  }

  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  await auditLog("LOGIN", "User", user.id, user.id);
  return NextResponse.json({ ok: true, role: user.role, name: user.name });
}
