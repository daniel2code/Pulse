import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SignalBodySchema } from "@/lib/schemas";
import { checkSignalRate, getClientIp } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/signal — body { fromId, toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time.
export async function POST(request: NextRequest) {
  // Rate limit by IP.
  const ip = getClientIp(request);
  if (!checkSignalRate(ip)) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  // Parse and validate with Zod.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SignalBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { fromId, toId, type: signalType, payload: payloadStr } = parsed.data;

  // Prevent self-signaling.
  if (fromId === toId) {
    return Response.json({ error: "Cannot signal yourself." }, { status: 400 });
  }

  try {
    // ── Security: verify the sender exists in the presence table ─────────────
    // Prevents anonymous callers from injecting signals into active sessions.
    const sender = await prisma.presence.findUnique({
      where: { id: fromId },
      select: { id: true },
    });
    if (!sender) {
      return Response.json(
        { error: "Sender not found. Join the session first." },
        { status: 403 },
      );
    }

    // Enforce "one active connection at a time": if the target is already busy,
    // auto-decline the request instead of delivering it.
    if (signalType === "request") {
      const target = await prisma.presence.findUnique({
        where: { id: toId },
        select: { busy: true },
      });
      if (!target) {
        // Target went offline — tell the initiator it was declined.
        await sendDecline(toId, fromId);
        return Response.json({ ok: true, autoDeclined: true });
      }
      if (target.busy) {
        await sendDecline(toId, fromId);
        return Response.json({ ok: true, autoDeclined: true });
      }
    }

    // ── For WebRTC signals (offer/answer/ice): verify both peers are active ──
    // Prevents third parties from injecting offers/answers into an ongoing call.
    if (signalType === "offer" || signalType === "answer" || signalType === "ice") {
      const [from, to] = await Promise.all([
        prisma.presence.findUnique({ where: { id: fromId }, select: { busy: true } }),
        prisma.presence.findUnique({ where: { id: toId }, select: { busy: true } }),
      ]);
      if (!from || !to) {
        return Response.json(
          { error: "One or both peers are no longer online." },
          { status: 404 },
        );
      }
    }

    // Busy transitions:
    // - accept: connection is now active → mark BOTH peers busy.
    // - decline/end: free both peers.
    if (signalType === "accept") {
      await prisma.presence.updateMany({
        where: { id: { in: [fromId, toId] } },
        data: { busy: true },
      });
    } else if (signalType === "decline" || signalType === "end") {
      await prisma.presence.updateMany({
        where: { id: { in: [fromId, toId] } },
        data: { busy: false },
      });
    }

    await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[signal] db error:", err);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: { fromId: targetId, toId: initiatorId, type: "decline", payload: null },
  });
}
