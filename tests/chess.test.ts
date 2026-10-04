import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { replay, snapshot, uci } from "../src/lib/chess";
import {
  decideDemo,
  buildJevRequest,
  validateJevResponse,
} from "../src/lib/jev";

test("replay preserves threefold repetition and reports a draw", () => {
  const game = replay(["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
  assert.equal(snapshot(game).result, "Draw by threefold repetition");
});

test("checkmate ends a match with the correct winner", () => {
  const game = replay(["f3", "e5", "g4", "Qh4#"]);
  assert.equal(snapshot(game).result, "Black wins by checkmate");
  assert.equal(snapshot(game).legalMoves, 0);
});

test("capture metrics track actual material", () => {
  const game = replay(["e4", "d5", "exd5"]);
  assert.deepEqual(snapshot(game).material, { w: 39, b: 38 });
});

test("special moves retain promotion, en passant and castling legality", () => {
  const promotion = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  assert.ok(
    promotion.moves({ verbose: true }).some((move) => uci(move) === "a7a8q"),
  );
  const enPassant = replay(["e4", "a6", "e5", "d5"]);
  const capture = enPassant.move("exd6");
  assert.equal(capture.captured, "p");
  assert.equal(enPassant.get("d5"), undefined);
  const castling = replay(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]);
  assert.equal(castling.get("g1")?.type, "k");
  assert.equal(castling.get("f1")?.type, "r");
});

test("Jev gets active player context and every legal move", () => {
  const game = replay(["e4"]);
  const payload = buildJevRequest(game, {
    name: "Ghost",
    goal: "Set sound tactical traps",
  });
  assert.equal(payload.state.player.color, "black");
  assert.equal(payload.state.player.goal, "Set sound tactical traps");
  assert.equal(payload.questions.next_move.type, "choice");
  assert.ok(typeof payload.questions.next_move.instructions === "string");
  assert.equal(
    Object.keys(payload.questions.next_move.criteria).length,
    game.moves().length,
  );
  assert.equal("opponent" in payload.state, false);
  assert.equal("white" in payload.state, false);
  assert.equal("messages" in payload, false);
});

test("provider response is constrained to a complete legal distribution", () => {
  const game = new Chess();
  const options = game.moves({ verbose: true }).map(uci);
  const probabilities = Object.fromEntries(
    options.map((key, i) => [key, i === 0 ? 1 : 0]),
  );
  const response = {
    model: "jev-1.13.0",
    answers: {
      next_move: {
        type: "choice",
        choice: options[0],
        probabilities,
        confidence: 0.83,
      },
    },
    usage: { input_tokens: 123 },
  };
  assert.equal(validateJevResponse(response, game).selected, options[0]);
  assert.equal(validateJevResponse(response, game).confidence, 0.83);
  assert.equal(validateJevResponse(response, game).model, "jev-1.13.0");
  assert.equal(validateJevResponse(response, game).inputTokens, 123);
  assert.equal(
    validateJevResponse(
      {
        ...response,
        answers: {
          next_move: { ...response.answers.next_move, confidence: undefined },
        },
      },
      game,
    ).confidence,
    null,
  );
  assert.equal(
    validateJevResponse(
      {
        ...response,
        answers: {
          next_move: { ...response.answers.next_move, confidence: 0 },
        },
      },
      game,
    ).confidence,
    0,
  );
  assert.throws(
    () =>
      validateJevResponse(
        {
          ...response,
          answers: {
            next_move: { ...response.answers.next_move, confidence: 1.2 },
          },
        },
        game,
      ),
    /incomplete decision/,
  );
  assert.throws(
    () =>
      validateJevResponse(
        {
          ...response,
          answers: {
            next_move: { ...response.answers.next_move, choice: "a1a8" },
          },
        },
        game,
      ),
    /invalid move/,
  );
  assert.throws(
    () =>
      validateJevResponse(
        {
          ...response,
          answers: {
            next_move: {
              ...response.answers.next_move,
              probabilities: { [options[0]]: 1 },
            },
          },
        },
        game,
      ),
    /invalid move/,
  );
  assert.throws(
    () =>
      validateJevResponse(
        {
          ...response,
          answers: {
            next_move: { ...response.answers.next_move, choice: options[1] },
          },
        },
        game,
      ),
    /did not match/,
  );
});

test("TypeSafe probabilities must sum to one and are never renormalized", () => {
  const game = new Chess();
  const options = game.moves({ verbose: true }).map(uci);
  const probabilities = Object.fromEntries(
    options.map((key, index) => [key, index === 0 ? 0.81 : 0.01]),
  );
  const response = {
    model: "jev-1.13.0",
    answers: {
      next_move: { type: "choice", choice: options[0], probabilities },
    },
    usage: { input_tokens: 123 },
  };
  assert.equal(
    validateJevResponse(response, game).candidates[0].probability,
    0.81,
  );
  probabilities[options[1]] = 0.009;
  assert.throws(
    () => validateJevResponse(response, game),
    /invalid move distribution/,
  );
});

test("demo produces legal moves and preserves the source position", () => {
  const game = new Chess();
  for (let i = 0; i < 35 && !game.isGameOver(); i++) {
    const fen = game.fen();
    const history = game.history();
    const decision = decideDemo(game);
    assert.equal(game.fen(), fen);
    assert.deepEqual(game.history(), history);
    assert.equal(decision.confidence, null);
    assert.equal(decision.source, "demo");
    const move = game
      .moves({ verbose: true })
      .find((move) => uci(move) === decision.selected);
    assert.ok(move);
    game.move(move);
  }
});
