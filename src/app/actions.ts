"use server";

import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { configSchema, readSession, signSession } from "@/lib/session";
import { replay, snapshot, uci } from "@/lib/chess";
import { decideDemo, decideWithJev } from "@/lib/jev";
import type { Battle, Result, Snapshot, Turn } from "@/lib/types";

export async function startBattle(input: unknown): Promise<Result<Battle>> {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Give both bots a name (up to 24 characters) and a goal (5–600 characters)." };
  if (parsed.data.mode === "jev" && !process.env.TYPESAFE_API_KEY?.trim()) return { ok: false, error: "Add TYPESAFE_API_KEY to .env and restart the app, or choose Demo mode." };
  try {
    const game = new Chess();
    const session = { id: randomUUID(), config: parsed.data, moves: [], expires: Date.now() + 24 * 60 * 60 * 1000 };
    return { ok: true, data: { id: session.id, token: signSession(session), config: parsed.data, initialFen: game.fen(), snapshot: snapshot(game), turns: [] } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not start the battle." }; }
}

export async function advanceBattle(token: string): Promise<Result<{ token: string; turn: Turn; snapshot: Snapshot }>> {
  try {
    const session = readSession(token);
    const game = replay(session.moves);
    if (snapshot(game).result) return { ok: false, error: "This match has finished. Start a new battle." };
    const color = game.turn();
    const bot = color === "w" ? session.config.white : session.config.black;
    const decision = session.config.mode === "demo" ? decideDemo(game) : await decideWithJev(game, bot);
    const move = game.moves({ verbose: true }).find(item => uci(item) === decision.selected);
    if (!move) throw new Error("The selected move is no longer legal. Retry this turn.");
    game.move(move);
    const { selected: _selected, ...metrics } = decision;
    const turn: Turn = { ...metrics, ply: session.moves.length + 1, color, san: move.san, from: move.from, to: move.to, fen: game.fen(), captured: move.captured, piece: move.piece, check: game.isCheck() };
    session.moves.push(move.san);
    return { ok: true, data: { token: signSession(session), turn, snapshot: snapshot(game) } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "The turn failed. Retry to continue from this position." }; }
}
