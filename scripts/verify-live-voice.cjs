const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
let setupStage = "load_account";
let activeBrowser;
let activeContext;

// Real Cognito, consent table, relay and OpenAI; only the microphone input is synthetic.
// Never log passwords, bearer tokens, audio frames or conversation text.
(async () => {
  const base = process.env.MINDGUARD_URL || "http://localhost:8081";
  const safety = process.env.VOICE_TEST_SCENARIO === "safety";
  const account = JSON.parse(fs.readFileSync("artifacts/voice-test-account.local.json", "utf8"));
  setupStage = "launch_browser";
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${path.resolve(safety ? "artifacts/voice-e2e-safety.wav" : "artifacts/voice-e2e-input.wav")}`, "--autoplay-policy=no-user-gesture-required"],
  });
  activeBrowser = browser;
  const checks = [];
  const failures = [];
  setupStage = "create_recording_context";
  const context = await browser.newContext({ permissions: ["microphone"], viewport: { width: 430, height: 932 }, reducedMotion: "reduce",
    ...(safety ? {} : { recordVideo: { dir: "artifacts/voice-video", size: { width: 430, height: 932 } } }),
  });
  activeContext = context;
  const page = await context.newPage();
  let audioFrames = 0;
  let completedReplies = 0;
  const events = [];
  const network = [];
  page.on("pageerror", () => failures.push("BROWSER_RUNTIME_ERROR"));
  page.on("requestfailed", (request) => {
    if (request.url().includes("cognito-idp") || request.url().includes("/api/voice/"))
      network.push({ service: request.url().includes("cognito-idp") ? "cognito" : "relay", failure: request.failure()?.errorText });
  });
  page.on("response", async (response) => {
    if (response.status() < 400 || (!response.url().includes("cognito-idp") && !response.url().includes("/api/voice/"))) return;
    const body = await response.json().catch(() => ({}));
    const code = body.code || body.__type?.split("#").at(-1);
    network.push({ service: response.url().includes("cognito-idp") ? "cognito" : "relay", status: response.status(), code: typeof code === "string" && /^[A-Za-z_]+$/.test(code) ? code : "UNAVAILABLE" });
  });
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      try {
        const event = JSON.parse(payload.toString());
        if (event.type === "audio") audioFrames++;
        if (event.type === "playback.completed") completedReplies++;
      } catch {}
    });
    socket.on("framereceived", ({ payload }) => {
      try { const event = JSON.parse(payload.toString()); events.push({ type: event.type, code: event.code, route: event.route, reason: event.reason, time: Date.now() }); } catch {}
    });
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const waitUntil = async (predicate, timeout = 65000) => {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
      const failure = events.find((event) => event.type === "error");
      if (failure) throw new Error(typeof failure.code === "string" && /^[A-Z_]+$/.test(failure.code) ? `LIVE_VOICE_${failure.code}` : "LIVE_VOICE_FAILED");
      if (Date.now() > deadline) throw new Error("LIVE_VOICE_EVENT_TIMEOUT");
      await page.waitForTimeout(200);
    }
  };
  try {
    await page.goto(base + "/voice", { timeout: 90000, waitUntil: "domcontentloaded" });
    console.log("Voice screen loaded.");
    await page.getByLabel("Voice account email", { exact: true }).fill(account.email);
    await page.getByLabel("Voice account password", { exact: true }).fill(account.password);
    await button("Sign in to voice").click();
    await button("Sign out of voice").waitFor({ timeout: 25000 });
    checks.push("real_cognito_sign_in");
    console.log("Real Cognito sign-in completed.");
    await button("Start voice conversation").click();
    if (await button("Allow voice processing").isVisible()) {
      await button("Allow voice processing").click();
      await button("Allow voice processing").waitFor({ state: "hidden" });
      await button("Start voice conversation").click();
    }
    await page.getByText("Microphone on", { exact: true }).waitFor({ timeout: 30000 });
    checks.push("real_capture_and_authenticated_relay");
    if (safety) {
      await waitUntil(() => events.some((event) => event.type === "route"));
      const decision = events.find((event) => event.type === "route");
      assert.equal(decision.route, "FIXED_RESOURCES");
      assert.equal(decision.reason, "REVIEWED_RULE_MATCH");
      assert.equal(events.filter((event) => event.type === "reply.approved").length, 0);
      await page.getByText("Microphone off", { exact: true }).waitFor();
      await button("Open Resources").waitFor();
      await page.screenshot({ path: "artifacts/live-voice-resource-route.png" });
      checks.push("completed_synthetic_transcript_matches_approved_input_rule", "no_candidate_audio_delivered", "resource_route_stops_capture");
      await button("Open Resources").click();
      await page.waitForURL("**/resources");
      checks.push("existing_resources_screen_opens");
      await button("Back").click();
      await button("Revoke voice permission").click();
      await button("Sign out of voice").click();
      assert.deepEqual(failures, []);
      fs.writeFileSync("artifacts/voice-safety-verification.json", JSON.stringify({ passed: true, checks, approvedReplies: 0, source: "synthetic safety utterance; real services" }, null, 2));
      console.log(JSON.stringify({ passed: true, checks }));
      return;
    }
    await waitUntil(() => events.filter((event) => event.type === "reply.approved").length >= 1);
    await page.getByText("Zen is speaking", { exact: true }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: "artifacts/live-voice-speaking.png" });
    checks.push("actual_transcription_checked_spoken_reply");
    await waitUntil(() => completedReplies >= 1);
    await page.getByText("I'm listening", { exact: true }).waitFor();
    checks.push("approved_playback_completes_and_listening_resumes");
    await waitUntil(() => events.filter((event) => event.type === "reply.approved").length >= 2);
    checks.push("continuous_second_turn_without_record_controls");
    await button("Interrupt Zen").click();
    await page.getByText("I'm listening", { exact: true }).waitFor();
    checks.push("explicit_interruption_returns_to_listening");
    await button("Mute").click();
    await page.getByText("Microphone off", { exact: true }).waitFor();
    await page.waitForTimeout(250);
    const mutedFrames = audioFrames;
    await page.waitForTimeout(800);
    assert.equal(audioFrames, mutedFrames);
    checks.push("mute_stops_audio_transmission");
    await button("Unmute").click();
    await page.getByText("Microphone on", { exact: true }).waitFor({ timeout: 12000 });
    checks.push("unmute_starts_fresh_capture");
    await button("Switch to text").click();
    await page.getByText("A little space for your words.", { exact: true }).waitFor({ timeout: 15000 });
    assert.ok(await page.getByText("You", { exact: true }).count());
    await page.getByLabel("Message to Zen", { exact: true }).fill("Please give me one short suggestion for winding down after work.");
    await button("Send to Zen").click();
    await button("Send to Zen").waitFor({ state: "visible" });
    await page.getByText("Zen is thinking…", { exact: true }).waitFor({ state: "hidden", timeout: 45000 });
    assert.ok(await page.getByText("Zen", { exact: true }).count());
    checks.push("live_temporary_text_handoff");
    const saved = await page.evaluate(() => localStorage.getItem("mindguard.synthetic.v1"));
    assert.ok(!saved || !saved.includes("winding down after work"));
    checks.push("live_transcript_not_in_saved_storage");
    await page.screenshot({ path: "artifacts/live-text-handoff.png" });
    await button("Return to voice").click();
    await button("Revoke voice permission").click();
    await button("Start voice conversation").waitFor();
    await button("Sign out of voice").click();
    await button("Sign in to voice").waitFor();
    checks.push("consent_revocation_and_logout_cleanup");
    assert.deepEqual(failures, []);
    fs.writeFileSync("artifacts/live-voice-verification.json", JSON.stringify({ checks, browserErrors: failures.length, audioFrames, approvedReplies: events.filter((event) => event.type === "reply.approved").length, source: "synthetic microphone; real services", passed: true }, null, 2));
    console.log(JSON.stringify({ passed: true, checks }));
  } catch (error) {
    // Operational event codes are safe; no event payloads or page text are dumped.
    fs.writeFileSync(safety ? "artifacts/voice-safety-verification.json" : "artifacts/live-voice-verification.json", JSON.stringify({ passed: false, checks, browserErrors: failures.length, events: events.slice(-12) }, null, 2));
    console.error(error instanceof Error ? error.message.split("\n")[0] : "LIVE_VOICE_TEST_FAILED");
    console.error(JSON.stringify({ checks, events: events.slice(-12), network }));
    process.exitCode = 1;
  } finally { await context.close(); await browser.close(); }
})().catch((error) => {
  console.error(JSON.stringify({ code: "LIVE_VOICE_SETUP_FAILED", stage: setupStage,
    message: setupStage === "load_account" ? "Check the local test-account file." : String(error?.message ?? "").split("\n")[0] }));
  process.exitCode = 1;
}).finally(async () => { await activeContext?.close().catch(() => {}); await activeBrowser?.close().catch(() => {}); });
