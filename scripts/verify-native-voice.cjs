const fs = require("node:fs");
const assert = require("node:assert/strict");
const ui = require("./android-ui.cjs");
const account = JSON.parse(fs.readFileSync("artifacts/voice-test-account.local.json", "utf8"));
let stage = "setup";
const checks = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const labelMatches = (node, label) => node["content-desc"] === label || node.text === label;
const visible = (label) => ui.nodes().some((node) => labelMatches(node, label) && node.rectangle && node.rectangle[3] - node.rectangle[1] >= 30);
const scroll = (up = false) => ui.adb("shell", "input", "swipe", "540", up ? "650" : "1900", "540", up ? "1900" : "650", "250");
async function find(label) {
  for (let pass = 0; pass < 2; pass++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (visible(label)) return;
      scroll(pass === 1);
      await sleep(150);
    }
  }
  throw new Error("NATIVE_CONTROL_UNAVAILABLE");
}
async function tap(label) { await find(label); ui.tap(label); await sleep(200); }
async function wait(label, timeout = 25000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (visible(label)) return;
    await sleep(300);
  }
  throw new Error("NATIVE_STATE_TIMEOUT");
}
async function input(label, value) {
  await tap(label);
  ui.adb("shell", "input", "keycombination", "KEYCODE_CTRL_LEFT", "KEYCODE_A");
  ui.adb("shell", "input", "keyevent", "KEYCODE_DEL");
  // Generated test credentials are never printed, including on adb failures.
  try { ui.adb("shell", "input", "text", value); } catch { throw new Error("NATIVE_TEST_INPUT_FAILED"); }
  ui.adb("shell", "input", "keyevent", "KEYCODE_BACK");
}
function recording() {
  return /\(running\)|running=true|active=true/i.test(ui.adb("shell", "cmd", "appops", "get", "com.mindguard.capstone", "RECORD_AUDIO"));
}
(async () => {
  for (const setting of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"])
    ui.adb("shell", "settings", "put", "global", setting, "0");
  ui.adb("reverse", "tcp:3001", "tcp:3001");
  ui.adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "mindguard:///voice", "com.mindguard.capstone");
  stage = "sign_in";
  if (visible("Sign out of voice")) await tap("Sign out of voice");
  await input("Voice account email", account.email);
  await input("Voice account password", account.password);
  await tap("Sign in to voice");
  await wait("Sign out of voice");
  checks.push("native_real_cognito_sign_in");
  console.log("Native real-service sign-in passed.");
  stage = "consent_and_permission";
  await tap("Start voice conversation");
  await sleep(400);
  if (visible("Allow voice processing")) { await tap("Allow voice processing"); await tap("Start voice conversation"); }
  await sleep(800);
  const permission = ui.nodes().find((node) => /permission_allow_foreground_only_button|permission_allow_one_time_button/.test(node["resource-id"] || ""));
  if (permission?.rectangle) {
    const [left, top, right, bottom] = permission.rectangle;
    ui.adb("shell", "input", "tap", String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
    await sleep(800);
    // Android's first permission sheet can background the app; cleanup must still win.
    if (visible("Start voice conversation")) await tap("Start voice conversation");
  }
  stage = "capture";
  await wait("Microphone on", 35000);
  assert.equal(recording(), true);
  checks.push("native_audio_recorder_and_server_session_active");
  console.log("Native microphone capture passed.");
  ui.screenshot("artifacts/native-live-voice-listening.png");
  stage = "mute";
  await tap("Mute");
  await wait("Microphone off");
  await sleep(500);
  assert.equal(recording(), false);
  checks.push("native_mute_stops_os_recording");
  console.log("Native mute cleanup passed.");
  stage = "unmute";
  await tap("Unmute");
  await wait("Microphone on");
  assert.equal(recording(), true);
  checks.push("native_unmute_starts_new_capture");
  console.log("Native unmute capture passed.");
  stage = "background_cleanup";
  ui.adb("shell", "input", "keyevent", "KEYCODE_HOME");
  await sleep(1000);
  assert.equal(recording(), false);
  ui.adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "mindguard:///voice", "com.mindguard.capstone");
  await wait("Microphone off");
  checks.push("native_backgrounding_stops_recording_without_autorestart");
  console.log("Native background cleanup passed.");
  stage = "logout";
  await tap("Revoke voice permission");
  await tap("Sign out of voice");
  await find("Sign in to voice");
  assert.equal(recording(), false);
  checks.push("native_revocation_and_logout_cleanup");
  fs.writeFileSync("artifacts/native-voice-verification.json", JSON.stringify({ passed: true, checks,
    platform: "Android Studio emulator, Android 36, x86_64", input: "emulator microphone with host audio disabled", limitations: "No acoustic, physical-device, or native iOS verification" }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
})().catch(() => { console.error(JSON.stringify({ passed: false, stage, checks })); process.exitCode = 1; });
