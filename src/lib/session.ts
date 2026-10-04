import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MAX_PLIES } from "./chess";

const bot = z.object({ name: z.string().trim().min(1).max(24), goal: z.string().trim().min(5).max(600) });
export const configSchema = z.object({ white: bot, black: bot, mode: z.enum(["jev", "demo"]), interval: z.number().int().min(500).max(10000) });
const sessionSchema = z.object({
  id: z.string().uuid(),
  config: configSchema,
  moves: z.array(z.string().min(2).max(12)).max(MAX_PLIES),
  expires: z.number(),
});
export type Session = z.infer<typeof sessionSchema>;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("Set SESSION_SECRET to at least 32 characters in .env and restart the app.");
  return value;
}

export function signSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSession(token: string): Session {
  if (typeof token !== "string" || token.length > 20000) throw new Error("Invalid match. Start a new battle.");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid match. Start a new battle.");
  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid match. Start a new battle.");
  const parsed = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  if (!parsed.success) throw new Error("Invalid match. Start a new battle.");
  if (parsed.data.expires < Date.now()) throw new Error("This match has expired. Start a new battle.");
  return parsed.data;
}
