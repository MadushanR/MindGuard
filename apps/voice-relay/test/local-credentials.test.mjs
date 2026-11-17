import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("local credential process returns valid temporary credentials only to the SDK pipe", () => {
  const directory = mkdtempSync(join(tmpdir(), "mindguard-credentials-test-"));
  const file = join(directory, "credentials.json");
  try {
    const fixture = { Version: 1, AccessKeyId: "SYNTHETIC_ID", SecretAccessKey: "synthetic-secret", SessionToken: "synthetic-session", Expiration: new Date(Date.now() + 60000).toISOString() };
    writeFileSync(file, JSON.stringify(fixture));
    const run = () => spawnSync(process.execPath, [fileURLToPath(new URL("../read-local-credentials.cjs", import.meta.url))], {
      env: { ...process.env, VOICE_LOCAL_AWS_CREDENTIALS_FILE: file }, encoding: "utf8",
    });
    const valid = run();
    assert.equal(valid.status, 0);
    assert.deepEqual(JSON.parse(valid.stdout), fixture);
    assert.equal(valid.stderr, "");
    writeFileSync(file, JSON.stringify({ ...fixture, Expiration: "2000-01-01T00:00:00Z" }));
    const expired = run();
    assert.equal(expired.status, 1);
    assert.equal(expired.stdout, "");
    assert.equal(expired.stderr.trim(), "LOCAL_AWS_CREDENTIALS_UNAVAILABLE");
    writeFileSync(file, "{invalid");
    const malformed = run();
    assert.equal(malformed.status, 1);
    assert.equal(malformed.stdout, "");
  } finally { unlinkSync(file); rmdirSync(directory); }
});
