import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadApprovedPolicy } from "../dist/policy.js";

const file = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));

test("only the reviewed capstone version can enable the live policy", () => {
  assert.throws(() => loadApprovedPolicy(file("policy.example.json")), /POLICY_NOT_APPROVED/);
  const policy = loadApprovedPolicy(file("policy.approved.json"));
  assert.equal(policy.evaluateText("I WANT TO END MY LIFE").route, "FIXED_RESOURCES");
  assert.equal(policy.evaluateText("I want to talk about my day").route, "PERMITTED");
  assert.equal(policy.evaluateReply("Stop taking your medication").route, "BLOCKED");
  assert.equal(policy.evaluateReply("I have contacted emergency services").route, "BLOCKED");
  assert.equal(policy.evaluateReply("I can listen while you describe your day.").route, "PERMITTED");
});
