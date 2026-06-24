import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset } from "@/lib/geo";
import { JoinBodySchema } from "@/lib/schemas";
import { checkJoinRate, getClientIp } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, lat, lng } (raw coords).
// Validates and rate-limits the request, applies a 1–3 km privacy offset,
// and upserts the presence row. Raw coordinates are never stored.
export async function POST(request: NextRequest) {
  // Rate limit by IP.
  const ip = getClientIp(request);
  if (!checkJoinRate(ip)) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validate with Zod — covers id format, lat/lng ranges, and finite checks.
  const parsed = JoinBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id, lat, lng, mood, interests } = parsed.data;
  const offset = applyPrivacyOffset(lat, lng);

  try {
    await prisma.presence.upsert({
      where: { id },
      create: {
        id,
        lat: offset.lat,
        lng: offset.lng,
        mood: mood ?? null,
        interests: interests ?? null,
        busy: false,
        lastSeen: new Date(),
      },
      update: {
        lat: offset.lat,
        lng: offset.lng,
        mood: mood ?? null,
        interests: interests ?? null,
        lastSeen: new Date(),
      },
    });
  } catch (err) {
    console.error("[join] db error:", err);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
