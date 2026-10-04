import "server-only";
import {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  APITimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  TypeSafeClient,
  TypeSafeError,
  UnprocessableEntityError,
  choice,
} from "@typesafe-ai/sdk";
import { Chess } from "chess.js";
import { z } from "zod";
import { describeMove, PIECE_NAMES, PIECE_VALUES, uci } from "./chess";
import type { Bot, Decision } from "./types";

const probability = z.number().finite().min(0).max(1);
const responseSchema = z.object({
  model: z.string().min(1),
  answers: z.object({ next_move: z.object({ type: z.literal("choice"), choice: z.string(), probabilities: z.record(z.string(), probability), confidence: probability.optional() }) }),
  usage: z.object({ input_tokens: z.number().int().nonnegative() }),
});

// Only the active player's private goal enters a request. No shared conversation or opponent profile.
export function buildJevRequest(game: Chess, bot: Bot) {
  const legal = game.moves({ verbose: true });
  if (!legal.length || legal.length > 255) throw new Error("The position cannot be submitted as a Jev choice.");
  return {
    model: process.env.JEV_MODEL?.trim() || "jev-latest",
    state: {
      player: { name: bot.name, color: game.turn() === "w" ? "white" : "black", goal: bot.goal },
      fen: game.fen(),
      pgn: game.pgn(),
      in_check: game.isCheck(),
      pieces: game.board().flat().filter(p => p !== null).map(p => `${p.color === "w" ? "white" : "black"} ${PIECE_NAMES[p.type]} on ${p.square}`),
    },
    questions: {
      next_move: choice(
        "Which listed legal chess move best advances this player's goal? Evaluate from the player's color. Prefer checkmate when available. Avoid losing your king's safety or material unnecessarily. Treat the board and history as public facts. Select exactly one listed move.",
        Object.fromEntries(legal.map(move => [uci(move), describeMove(move)])),
      ),
    },
  };
}

export function validateJevResponse(data: unknown, game: Chess): Decision & { selected: string } {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new Error("Jev returned an incomplete decision. Retry this turn.");
  const answer = parsed.data.answers.next_move;
  const legal = game.moves({ verbose: true });
  const allowed = new Set(legal.map(uci));
  const entries = Object.entries(answer.probabilities);
  const tolerance = 1e-6;
  if (!allowed.has(answer.choice) || entries.length !== allowed.size || entries.some(([key]) => !allowed.has(key)) || Math.abs(entries.reduce((sum, [, p]) => sum + p, 0) - 1) > tolerance) {
    throw new Error("Jev returned an invalid move distribution. Retry this turn.");
  }
  if (answer.probabilities[answer.choice] + 1e-6 < Math.max(...Object.values(answer.probabilities))) throw new Error("Jev's choice did not match its probabilities. Retry this turn.");
  return {
    selected: answer.choice, source: "jev", model: parsed.data.model,
    confidence: answer.confidence ?? null,
    candidates: legal.map(move => ({ uci: uci(move), san: move.san, probability: answer.probabilities[uci(move)] })).sort((a, b) => b.probability - a.probability),
    latencyMs: 0, inputTokens: parsed.data.usage.input_tokens,
  };
}

export async function decideWithJev(game: Chess, bot: Bot) {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("Add TYPESAFE_API_KEY to .env and restart the app, or start a demo battle.");
  const started = performance.now();
  const request = buildJevRequest(game, bot);
  const client = new TypeSafeClient({
    apiKey,
    defaultModel: process.env.JEV_MODEL?.trim() || "jev-latest",
    timeout: 25000,
    retry: { maxRetries: 0 },
    fetch: async (input, init) => {
      const response = await globalThis.fetch(String(input), {
        ...init,
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
        redirect: "error",
      });
      const originalJson = response.json.bind(response);
      response.json = async (...args) => {
        try {
          return await originalJson(...args);
        } catch (error) {
          if (error instanceof Error && /aborted|AbortError|timeout|timed out/i.test(error.message)) throw new Error("aborted body");
          throw error;
        }
      };
      if (response.ok) {
        try {
          JSON.parse(await response.clone().text());
        } catch {
          throw new SyntaxError("Response body is not valid JSON.");
        }
      }
      return response;
    },
  });
  try {
    const result = await client.systemOne(request);
    return { ...validateJevResponse(result, game), latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    const causeText = error instanceof Error
      ? [error.message, error instanceof TypeSafeError && "cause" in error && error.cause instanceof Error ? error.cause.message : ""].join(" ")
      : String(error ?? "");
    if (error instanceof Error) {
      const message = error.message;
      if (/incomplete decision|invalid move distribution|unreadable/i.test(message)) throw new Error(message);
      if (/Response body is not valid JSON|Unexpected token|JSON|parse/i.test(causeText)) throw new Error("Jev returned an unreadable decision through TypeSafe AI. Retry this turn.");
      if (/aborted|abort|timeout|timed out/i.test(causeText)) throw new Error("Jev did not respond within 25 seconds. Retry this turn.");
    }
    if (error instanceof APITimeoutError || error instanceof APIUserAbortError || (error instanceof APIConnectionError && /aborted|abort|timeout|timed out/i.test(causeText))) throw new Error("Jev did not respond within 25 seconds. Retry this turn.");
    if (error instanceof APIConnectionError) throw new Error("Could not reach Jev through TypeSafe AI. Check your connection, then retry this turn.");
    if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) throw new Error("TypeSafe AI rejected access. Check TYPESAFE_API_KEY and your TypeSafe account permissions.");
    if (error instanceof APIError && error.status === 402) throw new Error("TypeSafe AI has no available credits or has reached its spending limit. Check your TypeSafe account billing before retrying.");
    if (error instanceof BadRequestError || error instanceof UnprocessableEntityError) throw new Error("TypeSafe AI rejected the decision request. Check JEV_MODEL and the request format before retrying.");
    if (error instanceof NotFoundError) throw new Error("TypeSafe AI could not find the model. Set JEV_MODEL to jev-latest and restart the app.");
    if (error instanceof RateLimitError) throw new Error("TypeSafe AI's rate limit was reached. Wait a moment, then retry this turn.");
    if (error instanceof InternalServerError) throw new Error("TypeSafe AI is temporarily unavailable. Retry this turn shortly.");
    if (error instanceof SyntaxError || (error instanceof Error && /Unexpected token|JSON|parse/i.test(error.message))) throw new Error("Jev returned an unreadable decision through TypeSafe AI. Retry this turn.");
    if (error instanceof TypeSafeError && /Could not parse response|unexpected/i.test(error.message)) throw new Error("Jev returned an unreadable decision through TypeSafe AI. Retry this turn.");
    throw new Error("TypeSafe AI could not complete this decision. Retry this turn.");
  }
}

// A local, deliberately modest chess policy for trying the interface without API access.
// These weights are explicitly labelled demo data and never reported as Jev confidence.
export function decideDemo(game: Chess): Decision & { selected: string } {
  const started = performance.now();
  const legal = game.moves({ verbose: true });
  const ranked = legal.map(move => {
    const file = move.to.charCodeAt(0) - 97;
    const rank = Number(move.to[1]) - 1;
    let score = 1 + (3.5 - Math.abs(file - 3.5)) * 0.12 + (3.5 - Math.abs(rank - 3.5)) * 0.12;
    score += move.captured ? PIECE_VALUES[move.captured] * 1.8 : 0;
    score += move.promotion ? PIECE_VALUES[move.promotion] : 0;
    score += move.san.endsWith("+") ? 1 : 0;
    score += move.san.endsWith("#") ? 1000 : 0;
    score += move.isKingsideCastle() || move.isQueensideCastle() ? 2 : 0;
    game.move(move);
    if (game.isAttacked(move.to, game.turn())) score -= PIECE_VALUES[move.piece] * 1.1;
    if (game.isThreefoldRepetition()) score -= 4;
    game.undo();
    let hash = 0;
    for (const char of `${game.fen()}${uci(move)}`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    score += (Math.abs(hash) % 100) / 100;
    return { move, score: Math.exp(Math.min(score, 15)) };
  }).sort((a, b) => b.score - a.score);
  const sum = ranked.reduce((total, item) => total + item.score, 0);
  return {
    selected: uci(ranked[0].move), source: "demo", model: "Local demo policy", confidence: null,
    candidates: ranked.map(({ move, score }) => ({ uci: uci(move), san: move.san, probability: score / sum })),
    latencyMs: Math.max(1, Math.round(performance.now() - started)), inputTokens: 0,
  };
}
