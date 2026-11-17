import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { once } from "node:events";

async function startRelay(t, environment = {}) {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, PORT: String(port), OPENAI_API_KEY: "", ...environment },
    stdio: "ignore",
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}/api/voice`;
  let ready = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(base + "/health", { signal: AbortSignal.timeout(500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(ready, true, "relay started");
  return base;
}

test("unconfigured relay exposes health but blocks protected work", async (t) => {
  const base = await startRelay(t);
  assert.equal((await fetch(base + "/ready")).status, 503);
  const session = await fetch(base + "/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(session.status, 503);
  assert.deepEqual(await session.json(), { code: "SERVICE_NOT_CONFIGURED" });
});

test("approval flag cannot make the synthetic policy ready for live processing", async (t) => {
  const base = await startRelay(t, {
    OPENAI_API_KEY: "synthetic-never-sent",
    OPENAI_REALTIME_MODEL: "synthetic-model",
    OPENAI_TRANSCRIPTION_MODEL: "synthetic-transcription",
    COGNITO_ISSUER: "https://cognito-idp.ca-central-1.amazonaws.com/synthetic",
    COGNITO_CLIENT_ID: "synthetic-client",
    VOICE_TABLE: "synthetic-table",
    ALLOWED_ORIGINS: "http://localhost:8081",
    VOICE_POLICY_FILE: fileURLToPath(new URL("../policy.example.json", import.meta.url)),
    VOICE_POLICY_APPROVED: "true",
  });
  const readiness = await fetch(base + "/ready");
  assert.equal(readiness.status, 503);
  assert.ok((await readiness.json()).missing.includes("VOICE_POLICY_OR_ACCESS_CONFIGURATION"));
  assert.equal((await fetch(base + "/consent")).status, 503);
});
