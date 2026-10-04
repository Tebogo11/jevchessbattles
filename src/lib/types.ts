export type Side = "w" | "b";
export type Mode = "jev" | "demo";
export type Bot = { name: string; goal: string };
export type BattleConfig = { white: Bot; black: Bot; mode: Mode; interval: number };
export type Candidate = { uci: string; san: string; probability: number };
export type Decision = {
  source: Mode;
  model: string;
  confidence: number | null;
  candidates: Candidate[];
  latencyMs: number;
  inputTokens: number;
};
export type Turn = Decision & {
  ply: number;
  color: Side;
  san: string;
  from: string;
  to: string;
  fen: string;
  captured?: string;
  piece: string;
  check: boolean;
};
export type Snapshot = {
  fen: string;
  turn: Side;
  ply: number;
  legalMoves: number;
  check: boolean;
  result: string | null;
  material: { w: number; b: number };
};
export type Battle = {
  id: string;
  token: string;
  config: BattleConfig;
  initialFen: string;
  snapshot: Snapshot;
  turns: Turn[];
};
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
