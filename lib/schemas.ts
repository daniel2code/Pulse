/**
 * Zod validation schemas shared across all API route handlers.
 * Single source of truth for input shapes so each endpoint only
 * needs to call `schema.safeParse(body)` and return the error.
 */
import { z } from "zod";
import { SIGNAL_TTL_MS } from "./presence";

// ── Session ID ──────────────────────────────────────────────────────────────
// Client-generated UUIDs; accept any UUID v4 string (standard or without dashes).
const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SessionIdSchema = z
  .string()
  .regex(SESSION_ID_REGEX, "invalid session id — must be a UUID v4");

// ── Coordinates ─────────────────────────────────────────────────────────────
export const LatLngSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lng: z.number().finite().gte(-180).lte(180),
});

// ── Join ─────────────────────────────────────────────────────────────────────
export const JoinBodySchema = z
  .object({ id: SessionIdSchema })
  .merge(LatLngSchema);

// ── Leave ────────────────────────────────────────────────────────────────────
export const LeaveBodySchema = z.object({ id: SessionIdSchema });

// ── Signal types ─────────────────────────────────────────────────────────────
const SIGNAL_TYPES = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
] as const;

export type ValidSignalType = (typeof SIGNAL_TYPES)[number];

// SDP payloads are JSON-serialised objects; ICE candidates are small JSON blobs.
// We keep the payload as an opaque string but enforce a safe maximum length.
const MAX_PAYLOAD_BYTES = 64 * 1024;

export const SignalBodySchema = z.object({
  fromId: SessionIdSchema,
  toId: SessionIdSchema,
  type: z.enum(SIGNAL_TYPES),
  payload: z
    .string()
    .max(MAX_PAYLOAD_BYTES, "payload too large")
    .nullish()
    .transform((v) => v ?? null),
});

// ── Poll ─────────────────────────────────────────────────────────────────────
// Only the `id` query-param needs validating here.
export const PollQuerySchema = z.object({ id: SessionIdSchema });
