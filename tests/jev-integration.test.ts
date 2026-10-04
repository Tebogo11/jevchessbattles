import test from "node:test";
import assert from "node:assert/strict";
import { startBattle, advanceBattle } from "../src/app/actions";
import { readSession } from "../src/lib/session";
import { buildJevRequest } from "../src/lib/jev";

process.env.SESSION_SECRET = "test-only-secret-32-characters-long-not-for-deployment";
type JevRequest = ReturnType<typeof buildJevRequest>;
const config = { white: { name: "Neon", goal: "WHITE_PRIVATE_OBJECTIVE: prioritize material" }, black: { name: "Ghost", goal: "BLACK_PRIVATE_OBJECTIVE: create tactical traps" }, mode: "jev" as const, interval: 800 };

test.beforeEach(() => {
  process.env.TYPESAFE_API_KEY = "  mock-typesafe-key-never-sent-to-the-network  ";
  delete process.env.JEV_MODEL;
});

test("live server actions call TypeSafe directly with isolated bot contexts", async t => {
  const requests: JevRequest[] = [];
  const mock = t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("authorization"), "Bearer mock-typesafe-key-never-sent-to-the-network");
    assert.ok(init.signal);
    const request = JSON.parse(init.body as string) as JevRequest;
    assert.equal(request.model, "jev-latest");
    requests.push(request);
    const candidates = Object.keys(request.questions.next_move.criteria);
    const chosen = requests.length === 1 ? "e2e4" : "e7e5";
    assert.ok(candidates.includes(chosen));
    return Response.json({ model: "jev-1.13.0", answers: { next_move: { type: "choice", choice: chosen, confidence: 0.83, probabilities: Object.fromEntries(candidates.map(key => [key, key === chosen ? 0.81 : 0.19 / (candidates.length - 1)])) } }, usage: { input_tokens: 500, output_tokens: 34 } });
  });
  const started = await startBattle(config);
  assert.ok(started.ok);
  const white = await advanceBattle(started.data.token);
  assert.ok(white.ok);
  assert.equal(white.data.turn.san, "e4");
  assert.equal(white.data.turn.source, "jev");
  assert.equal(white.data.turn.confidence, 0.83);
  assert.equal(white.data.turn.inputTokens, 500);
  assert.equal(white.data.turn.model, "jev-1.13.0");
  const black = await advanceBattle(white.data.token);
  assert.ok(black.ok);
  assert.equal(black.data.turn.san, "e5");
  assert.deepEqual(readSession(black.data.token).moves, ["e4", "e5"]);
  assert.equal(requests[0].state.player.color, "white");
  assert.equal(requests[1].state.player.color, "black");
  assert.ok(!JSON.stringify(requests[0]).includes("BLACK_PRIVATE_OBJECTIVE"));
  assert.ok(!JSON.stringify(requests[1]).includes("WHITE_PRIVATE_OBJECTIVE"));
  assert.equal(mock.mock.callCount(), 2);
});

test("a configured direct model ID is sent to TypeSafe", async t => {
  process.env.JEV_MODEL = "  jev-1.13.0  ";
  const mock = t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(JSON.parse(init.body as string).model, "jev-1.13.0");
    return new Response(null, { status: 429 });
  });
  const started = await startBattle(config);
  assert.ok(started.ok);
  await advanceBattle(started.data.token);
  assert.equal(mock.mock.callCount(), 1);
});

test("removing the TypeSafe key blocks an existing live match before any request", async t => {
  const started = await startBattle(config);
  assert.ok(started.ok);
  delete process.env.TYPESAFE_API_KEY;
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("No request expected"); });
  const failed = await advanceBattle(started.data.token);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.error, /TYPESAFE_API_KEY/);
  assert.deepEqual(readSession(started.data.token).moves, []);
  assert.equal(mock.mock.callCount(), 0);
});

for (const [status, expected] of [[400, /request format/], [401, /TYPESAFE_API_KEY/], [402, /credits/], [403, /TYPESAFE_API_KEY/], [404, /JEV_MODEL/], [422, /request format/], [429, /rate limit/], [503, /temporarily unavailable/], [529, /temporarily unavailable/]] as const) {
  test("TypeSafe HTTP " + status + " fails safely without advancing the match or retrying", async t => {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "SENSITIVE_PROVIDER_DETAIL" } }, { status }));
    const started = await startBattle(config);
    assert.ok(started.ok);
    const failed = await advanceBattle(started.data.token);
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.match(failed.error, expected);
      assert.ok(!failed.error.includes("SENSITIVE_PROVIDER_DETAIL"));
    }
    assert.equal(mock.mock.callCount(), 1);
    assert.deepEqual(readSession(started.data.token).moves, []);
  });
}

for (const [body, expected] of [
  ["not-json", /unreadable/],
  [JSON.stringify({ answers: {}, usage: {} }), /incomplete decision/],
  [JSON.stringify({ model: "jev-1.13.0", answers: { next_move: { type: "choice", choice: "a1a8", probabilities: { a1a8: 1 }, confidence: 1 } }, usage: { input_tokens: 100 } }), /invalid move distribution/],
] as const) {
  test("invalid TypeSafe response is rejected: " + expected.source, async t => {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(body, { status: 200 }));
    const started = await startBattle(config);
    assert.ok(started.ok);
    const failed = await advanceBattle(started.data.token);
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.match(failed.error, expected);
    assert.deepEqual(readSession(started.data.token).moves, []);
    assert.equal(mock.mock.callCount(), 1);
  });
}

test("network failures do not leak private details or retry", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("SENSITIVE_NETWORK_DETAIL"); });
  const started = await startBattle(config);
  assert.ok(started.ok);
  const failed = await advanceBattle(started.data.token);
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.match(failed.error, /Could not reach Jev through TypeSafe AI/);
    assert.ok(!failed.error.includes("SENSITIVE_NETWORK_DETAIL"));
  }
  assert.equal(mock.mock.callCount(), 1);
  assert.deepEqual(readSession(started.data.token).moves, []);
});

for (const phase of ["request", "body"]) {
  test("the 25-second timeout covers the " + phase + " without retrying", async t => {
    const controller = new AbortController();
    t.mock.method(AbortSignal, "timeout", (ms: number) => {
      assert.equal(ms, 25000);
      return controller.signal;
    });
    const mock = t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
      assert.equal(init.signal, controller.signal);
      if (phase === "request") {
        controller.abort();
        throw new Error("aborted request");
      }
      const response = new Response();
      t.mock.method(response, "json", async () => {
        controller.abort();
        throw new Error("aborted body");
      });
      return response;
    });
    const started = await startBattle(config);
    assert.ok(started.ok);
    const failed = await advanceBattle(started.data.token);
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.match(failed.error, /within 25 seconds/);
    assert.equal(mock.mock.callCount(), 1);
    assert.deepEqual(readSession(started.data.token).moves, []);
  });
}
