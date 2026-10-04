import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startBattle, advanceBattle } from "../src/app/actions";
import { readSession, signSession } from "../src/lib/session";

process.env.SESSION_SECRET = "test-only-secret-32-characters-long-not-for-deployment";
const config = { white: { name: "Neon", goal: "Win with accurate moves" }, black: { name: "Ghost", goal: "Set traps with sound moves" }, mode: "demo" as const, interval: 800 };

test("setup validates names and objectives", async () => {
  const result = await startBattle({ ...config, white: { name: "", goal: "x" } });
  assert.equal(result.ok, false);
});

test("server action advances only signed state and preserves earlier snapshots", async () => {
  const started = await startBattle(config);
  assert.ok(started.ok);
  const first = await advanceBattle(started.data.token);
  assert.ok(first.ok);
  assert.equal(first.data.turn.ply, 1);
  assert.equal(first.data.turn.color, "w");
  assert.equal(readSession(started.data.token).moves.length, 0);
  const second = await advanceBattle(first.data.token);
  assert.ok(second.ok);
  assert.equal(second.data.turn.color, "b");
  assert.equal(readSession(second.data.token).moves.length, 2);
  const tampered = await advanceBattle(first.data.token + "x");
  assert.equal(tampered.ok, false);
});

test("expired sessions and game-over positions cannot make more moves", async () => {
  const expired = signSession({ id: randomUUID(), config, moves: [], expires: Date.now() - 1 });
  assert.throws(() => readSession(expired), /expired/);
  const terminal = signSession({ id: randomUUID(), config, moves: ["f3", "e5", "g4", "Qh4#"], expires: Date.now() + 10000 });
  const result = await advanceBattle(terminal);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /finished/);
});

test("live setup requires a TypeSafe key even when a Gateway key exists", async t => {
  const original = process.env.TYPESAFE_API_KEY;
  const originalGateway = process.env.AI_GATEWAY_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "unused-legacy-gateway-key";
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("No request expected"); });
  try {
    for (const value of [undefined, "", "   "]) {
      if (value === undefined) delete process.env.TYPESAFE_API_KEY;
      else process.env.TYPESAFE_API_KEY = value;
      const result = await startBattle({ ...config, mode: "jev" });
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /TYPESAFE_API_KEY/);
    }
    assert.equal(mock.mock.callCount(), 0);
  } finally {
    if (original !== undefined) process.env.TYPESAFE_API_KEY = original;
    else delete process.env.TYPESAFE_API_KEY;
    if (originalGateway !== undefined) process.env.AI_GATEWAY_API_KEY = originalGateway;
    else delete process.env.AI_GATEWAY_API_KEY;
  }
});
