import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireSession, badRequest } from "@/lib/api";

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : null;
};

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const [feedback, customers] = await Promise.all([
    prisma.feedback.findMany({ include: { customer: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
  ]);
  const promoters = feedback.filter((f) => f.nps >= 9).length;
  const detractors = feedback.filter((f) => f.nps <= 6).length;
  return NextResponse.json({
    feedback,
    customers,
    summary: {
      count: feedback.length,
      avgNps: avg(feedback.map((f) => f.nps)),
      npsScore: feedback.length ? Math.round(((promoters - detractors) / feedback.length) * 100) : null,
      avgStore: avg(feedback.map((f) => f.storeRating)),
      avgStaff: avg(feedback.map((f) => f.staffRating)),
      avgCollection: avg(feedback.map((f) => f.collectionRating)),
    },
  });
}

function rating(v: unknown) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : NaN;
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "submit");

  if (action === "submit") {
    const nps = Number(b.nps);
    if (!Number.isInteger(nps) || nps < 0 || nps > 10) return badRequest("NPS must be a whole number from 0 to 10");
    const store = rating(b.storeRating);
    const staff = rating(b.staffRating);
    const collection = rating(b.collectionRating);
    if ([store, staff, collection].some((r) => Number.isNaN(r))) return badRequest("Ratings must be 1-5");
    const fb = await prisma.feedback.create({
      data: {
        customerId: b.customerId || null,
        nps,
        storeRating: store,
        staffRating: staff,
        collectionRating: collection,
        comment: b.comment ? String(b.comment) : null,
        bridal: Boolean(b.bridal),
        source: b.source ? String(b.source) : "MOCK_WHATSAPP",
      },
    });
    await auditLog("CREATE", "Feedback", fb.id, session.userId, { nps });
    return NextResponse.json(fb, { status: 201 });
  }

  if (action === "ownerComment") {
    if (session.role !== "OWNER" && session.role !== "MANAGER") return badRequest("Only the owner/manager can comment", 403);
    const comment = String(b.comment || "").trim();
    if (!comment) return badRequest("Comment is required");
    const fb = await prisma.feedback.update({
      where: { id: String(b.feedbackId) },
      data: { ownerComment: comment, ownerReviewedAt: new Date(), ownerId: session.userId },
    }).catch(() => null);
    if (!fb) return badRequest("Feedback not found", 404);
    await auditLog("OWNER_COMMENT", "Feedback", fb.id, session.userId);
    return NextResponse.json(fb);
  }

  if (action === "acknowledge") {
    if (session.role !== "SALES_CRO" && session.role !== "OWNER" && session.role !== "MANAGER") {
      return badRequest("Only a CRO or manager can acknowledge feedback", 403);
    }
    const fb = await prisma.feedback.update({
      where: { id: String(b.feedbackId) },
      data: { croAcknowledgedAt: new Date() },
    }).catch(() => null);
    if (!fb) return badRequest("Feedback not found", 404);
    await auditLog("ACKNOWLEDGE", "Feedback", fb.id, session.userId);
    return NextResponse.json(fb);
  }

  return badRequest("Unknown action");
}
