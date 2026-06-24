import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import { PollQuerySchema } from "@/lib/schemas";
import { checkPollRate, getClientIp } from "@/lib/limiter";
import type { PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll?id= — the single endpoint that drives the live map.
// It (1) heartbeats the caller, (2) reaps stale presence + orphan signals,
// (3) returns the filtered online peers, and (4) drains this user's mailbox.
export async function GET(request: NextRequest) {
  // Rate limit by IP.
  const ip = getClientIp(request);
  if (!checkPollRate(ip)) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  // Validate the `id` query-parameter.
  const parsed = PollQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id } = parsed.data;
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  try {
    // 1) Heartbeat — refresh lastSeen for the caller only.
    await prisma.presence.updateMany({
      where: { id },
      data: { lastSeen: new Date(now) },
    });

    // 2) Reap stale presence rows and orphaned signals.
    await prisma.presence.deleteMany({ where: { lastSeen: { lt: staleCutoff } } });
    await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });

    // 3) Online peers, excluding self.
    const peers = await prisma.presence.findMany({
      where: {
        id: { not: id },
        lastSeen: { gte: staleCutoff },
      },
      select: { id: true, lat: true, lng: true, busy: true, mood: true },
    });

    // 4) Drain this user's mailbox: read, then delete exactly what we read.
    const inbox = await prisma.signal.findMany({
      where: { toId: id },
      orderBy: { createdAt: "asc" },
    });
    if (inbox.length > 0) {
      await prisma.signal.deleteMany({
        where: { id: { in: inbox.map((s) => s.id) } },
      });
    }

    const response: PollResponse = {
      peers: peers.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        busy: p.busy,
        mood: p.mood,
      })),
      signals: inbox.map((s) => ({
        id: s.id,
        fromId: s.fromId,
        toId: s.toId,
        type: s.type as PollResponse["signals"][number]["type"],
        payload: s.payload,
        createdAt: s.createdAt.toISOString(),
      })),
    };

    return Response.json(response);
  } catch (err) {
    console.error("[poll] db error:", err);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
