import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeaveBodySchema } from "@/lib/schemas";
import { checkLeaveRate, getClientIp } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id }. Removes the presence row and any pending
// signals to/from this user. Called via navigator.sendBeacon on tab close, so
// the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  // Rate limit by IP.
  const ip = getClientIp(request);
  if (!checkLeaveRate(ip)) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  let id: string | undefined;
  try {
    const text = await request.text();
    const raw = text ? JSON.parse(text) : {};
    const parsed = LeaveBodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Invalid id." }, { status: 400 });
    }
    id = parsed.data.id;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    // Independent cleanup deletes — no atomicity needed.
    await prisma.signal.deleteMany({
      where: { OR: [{ toId: id }, { fromId: id }] },
    });
    await prisma.presence.deleteMany({ where: { id } });
  } catch (err) {
    console.error("[leave] db error:", err);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
