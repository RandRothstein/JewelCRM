import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { processDueEstimateFollowups, expireHoldsAndRemind } from "@/lib/followups";
import { requireSession, MANAGEMENT } from "@/lib/api";

export async function POST() {
  const auth = await requireSession(MANAGEMENT);
  if ("error" in auth) return auth.error;
  const followups = await processDueEstimateFollowups();
  await expireHoldsAndRemind();
  await auditLog("RUN_JOB", "Followups", null, auth.session.userId, { followupsSent: followups.length });
  return NextResponse.json({ ok: true, followupsSent: followups.length, holdsProcessed: true });
}
