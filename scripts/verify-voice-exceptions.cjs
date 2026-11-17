const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

(async () => {
  const base = process.env.MINDGUARD_URL || "http://localhost:8080";
  const account = JSON.parse(fs.readFileSync("artifacts/voice-test-account.local.json", "utf8"));
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${path.resolve("artifacts/voice-e2e-silence.wav")}`, "--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({ permissions: ["microphone"], reducedMotion: "reduce", viewport: { width: 430, height: 932 } });
  const checks = [];
  const page = await context.newPage();
  let frames = 0, readyEvents = 0, sessionRequests = 0;
  const runtimeErrors = [];
  page.on("pageerror", () => runtimeErrors.push("BROWSER_RUNTIME_ERROR"));
  page.on("request", (request) => { if (request.url().endsWith("/api/voice/sessions") && request.method() === "POST") sessionRequests++; });
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => { try { if (JSON.parse(payload.toString()).type === "audio") frames++; } catch {} });
    socket.on("framereceived", ({ payload }) => { try { if (JSON.parse(payload.toString()).type === "session.ready") readyEvents++; } catch {} });
  });
  await page.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.__voiceTestSockets = [];
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) {
        super(url, protocols);
        if (String(url).includes("/api/voice/socket")) window.__voiceTestSockets.push(this);
      }
    };
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const start = async () => {
    await button("Start voice conversation").click();
    if (await button("Allow voice processing").isVisible()) {
      await button("Allow voice processing").click();
      await button("Allow voice processing").waitFor({ state: "hidden" });
      await button("Start voice conversation").click();
    }
    await page.getByText("Microphone on", { exact: true }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
  };
  const assertSilent = async () => {
    await page.getByText("Microphone off", { exact: true }).waitFor();
    await page.waitForTimeout(250);
    const stopped = frames;
    await page.waitForTimeout(750);
    assert.equal(frames, stopped);
  };
  try {
    await page.goto(base + "/voice", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Voice account email", { exact: true }).fill(account.email);
    await page.getByLabel("Voice account password", { exact: true }).fill(account.password);
    await button("Sign in to voice").click();
    await button("Sign out of voice").waitFor({ timeout: 25000 });
    await start();
    await button("Stop").click();
    await assertSilent();
    checks.push("stop_immediately_ends_capture_and_transmission");

    await start();
    await page.getByRole("button", { name: "Resources", exact: true }).click();
    await page.waitForURL("**/resources");
    await page.waitForTimeout(250);
    const navigatedFrames = frames;
    await page.waitForTimeout(750);
    assert.equal(frames, navigatedFrames);
    checks.push("navigation_ends_voice_capture");

    await page.goto(base + "/voice", { waitUntil: "domcontentloaded" });
    // Page reload intentionally drops the in-memory sign-in.
    await button("Sign in to voice").waitFor();
    checks.push("page_reload_drops_voice_identity");
    await page.getByLabel("Voice account email", { exact: true }).fill(account.email);
    await page.getByLabel("Voice account password", { exact: true }).fill(account.password);
    await button("Sign in to voice").click();
    await button("Sign out of voice").waitFor({ timeout: 25000 });
    await start();
    const priorReady = readyEvents;
    await page.evaluate(() => window.__voiceTestSockets.at(-1).close(1000, "synthetic connection loss"));
    const recoveredDeadline = Date.now() + 35000;
    while (readyEvents <= priorReady && Date.now() < recoveredDeadline) await page.waitForTimeout(200);
    assert.equal(readyEvents, priorReady + 1);
    await page.getByText("Microphone on", { exact: true }).waitFor();
    await page.getByText("Voice reconnected. Zen may need you to repeat earlier details.", { exact: true }).waitFor();
    checks.push("connection_loss_recovers_automatically");

    const initialRequests = sessionRequests;
    await context.setOffline(true);
    await page.evaluate(() => window.__voiceTestSockets.at(-1).close(1000, "synthetic offline connection loss"));
    await page.getByText("Voice could not reconnect after two attempts. Try again or switch to text.", { exact: true }).waitFor({ timeout: 35000 });
    await assertSilent();
    assert.equal(sessionRequests - initialRequests, 2);
    checks.push("unavailable_connection_stops_after_two_attempts");
    await context.setOffline(false);
    await button("Sign out of voice").click();
    assert.deepEqual(runtimeErrors, []);
    const report = { passed: true, checks, runtimeErrors: runtimeErrors.length, source: "synthetic silent microphone; real services" };
    fs.writeFileSync("artifacts/voice-exceptions-verification.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(String(error?.message ?? "EXCEPTION_TEST_FAILED").split("\n")[0]);
    console.error(JSON.stringify({ checks, readyEvents, sessionRequests, runtimeErrors }));
    process.exitCode = 1;
  } finally { await context.close(); await browser.close(); }
})().catch(() => { console.error("EXCEPTION_TEST_SETUP_FAILED"); process.exitCode = 1; });
