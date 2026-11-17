import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ConversationSession,
  ConversationSafetyPolicy,
  processVoiceTurn,
} from "../src/index.js";
const policy = () =>
  new ConversationSafetyPolicy({
    version: "TEST-ONLY",
    fixedResourcePhrases: ["synthetic resource trigger"],
    blockedOutputPhrases: ["synthetic disallowed output"],
  });

test("malformed policy and empty normalized phrases cannot enable checks", () => {
  for (const phrases of [[], ["   "], [null], "not-an-array"]) {
    assert.throws(() => new ConversationSafetyPolicy({
      version: "TEST-ONLY",
      fixedResourcePhrases: phrases as string[],
      blockedOutputPhrases: ["synthetic output"],
    }), /POLICY_NOT_CONFIGURED/);
  }
});
test("a new turn, mute, cancellation and stop invalidate old authorizations", () => {
  const s = new ConversationSession("s", "alice", Date.now() + 10000);
  const g = s.beginTurn("a");
  assert.equal(s.isCurrent("a", g), true);
  s.beginTurn("b");
  assert.equal(s.isCurrent("a", g), false);
  s.setMuted(true);
  assert.throws(() => s.beginTurn("c"));
  s.setMuted(false);
  const fresh = s.beginTurn("d");
  s.stop();
  assert.equal(s.isCurrent("d", fresh), false);
  assert.throws(() => s.assertOwner("mallory"), /WRONG_OWNER/);
});
test("missing, incomplete and wrong-session transcripts fail closed", () => {
  const s = new ConversationSession("s", "alice", Date.now() + 10000);
  const g = s.beginTurn("t");
  for (const override of [
    { transcript: "" },
    { completed: false },
    { interrupted: true },
    { sessionId: "other" },
  ]) {
    assert.equal(
      policy().validateVoiceTurn(
        s,
        {
          sessionId: "s",
          turnId: "t",
          transcript: "hello",
          completed: true,
          interrupted: false,
          ...override,
        },
        g,
      ).route,
      "BLOCKED",
    );
  }
});
test("deterministic resource route never requests generation", async () => {
  const s = new ConversationSession("s", "alice", Date.now() + 10000);
  const g = s.beginTurn("t");
  let requests = 0;
  const result = await processVoiceTurn({
    session: s,
    generation: g,
    turn: {
      sessionId: "s",
      turnId: "t",
      transcript: "synthetic resource trigger",
      completed: true,
      interrupted: false,
    },
    policy: policy(),
    access: { check: async () => {} },
    provider: {
      requestApprovedVoiceReply: async () => {
        requests++;
        throw Error();
      },
      cancelPendingReply() {},
    },
    context: [],
    signal: new AbortController().signal,
  });
  assert.equal(requests, 0);
  assert.equal(result.decision.route, "FIXED_RESOURCES");
  assert.equal(result.candidate, undefined);
});
test("cancellation during generation prevents audio release", async () => {
  const s = new ConversationSession("s", "alice", Date.now() + 10000);
  const g = s.beginTurn("t");
  await assert.rejects(
    processVoiceTurn({
      session: s,
      generation: g,
      turn: {
        sessionId: "s",
        turnId: "t",
        transcript: "hello",
        completed: true,
        interrupted: false,
      },
      policy: policy(),
      access: { check: async () => {} },
      provider: {
        requestApprovedVoiceReply: async () => {
          s.cancel();
          return { audio: "candidate", transcript: "hello", responseId: "r" };
        },
        cancelPendingReply() {},
      },
      context: [],
      signal: new AbortController().signal,
    }),
    /STALE_TURN/,
  );
});
test("revocation during generation prevents audio release", async () => {
  const s = new ConversationSession("s", "alice", Date.now() + 10000);
  const g = s.beginTurn("t");
  let checks = 0;
  await assert.rejects(
    processVoiceTurn({
      session: s,
      generation: g,
      turn: {
        sessionId: "s",
        turnId: "t",
        transcript: "hello",
        completed: true,
        interrupted: false,
      },
      policy: policy(),
      access: {
        check: async () => {
          if (++checks === 2) throw Error("CONSENT_REQUIRED");
        },
      },
      provider: {
        requestApprovedVoiceReply: async () => ({
          audio: "candidate",
          transcript: "hello",
          responseId: "r",
        }),
        cancelPendingReply() {},
      },
      context: [],
      signal: new AbortController().signal,
    }),
    /CONSENT_REQUIRED/,
  );
});
test("unsafe candidate has no playable output", async () => {
  const s = new ConversationSession("s", "alice", Date.now() + 10000);
  const g = s.beginTurn("t");
  const result = await processVoiceTurn({
    session: s,
    generation: g,
    turn: {
      sessionId: "s",
      turnId: "t",
      transcript: "hello",
      completed: true,
      interrupted: false,
    },
    policy: policy(),
    access: { check: async () => {} },
    provider: {
      requestApprovedVoiceReply: async () => ({
        audio: "never-release",
        transcript: "synthetic disallowed output",
        responseId: "r",
      }),
      cancelPendingReply() {},
    },
    context: [],
    signal: new AbortController().signal,
  });
  assert.equal(result.decision.route, "BLOCKED");
  assert.equal(result.candidate, undefined);
});
