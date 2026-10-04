import { Chess, type Move, type PieceSymbol } from "chess.js";
import type { Snapshot } from "./types";

export const PIECE_NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const MAX_PLIES = 400;
export const uci = (move: Move) => `${move.from}${move.to}${move.promotion ?? ""}`;

export function replay(moves: string[]) {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game;
}

export function snapshot(game: Chess): Snapshot {
  const material = { w: 0, b: 0 };
  for (const piece of game.board().flat()) if (piece) material[piece.color] += PIECE_VALUES[piece.type];
  const ply = game.history().length;
  let result: string | null = null;
  if (game.isCheckmate()) result = `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  else if (game.isStalemate()) result = "Draw by stalemate";
  else if (game.isThreefoldRepetition()) result = "Draw by threefold repetition";
  else if (game.isInsufficientMaterial()) result = "Draw by insufficient material";
  else if (game.isDrawByFiftyMoves()) result = "Draw by fifty-move rule";
  else if (game.isDraw()) result = "Draw";
  else if (ply >= MAX_PLIES) result = "Move limit reached · match stopped";
  return { fen: game.fen(), turn: game.turn(), ply, legalMoves: game.moves().length, check: game.isCheck(), result, material };
}

export function describeMove(move: Move) {
  return `${move.san}: ${PIECE_NAMES[move.piece]} from ${move.from} to ${move.to}${move.captured ? `, captures a ${PIECE_NAMES[move.captured]}` : ""}${move.promotion ? `, promotes to ${PIECE_NAMES[move.promotion]}` : ""}${move.san.endsWith("#") ? ", checkmate" : move.san.endsWith("+") ? ", gives check" : ""}${move.isKingsideCastle() || move.isQueensideCastle() ? ", castles" : ""}`;
}
