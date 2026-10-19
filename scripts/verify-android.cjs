const { adb, nodes, screenshot } = require("./android-ui.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visible = (list, label) => {
  const valid = list.filter(
    (n) =>
      n.rectangle &&
      n.rectangle[2] > n.rectangle[0] &&
      n.rectangle[3] > n.rectangle[1],
  );
  return (
    valid.find((n) => n["content-desc"] === label) ||
    valid.find((n) => n.text === label)
  );
};
async function press(label, scrolls = 6) {
  for (let i = 0; i <= scrolls; i++) {
    const found = visible(nodes(), label);
    if (found) {
      const [l, t, r, b] = found.rectangle;
      adb(
        "shell",
        "input",
        "tap",
        String(Math.round((l + r) / 2)),
        String(Math.round((t + b) / 2)),
      );
      await pause(300);
      return;
    }
    if (i < scrolls)
      adb("shell", "input", "swipe", "540", "2050", "540", "650", "350");
  }
  throw new Error(`Native control not visible after scrolling: ${label}`);
}
async function wait(label) {
  for (let i = 0; i < 15; i++) {
    try {
      if (visible(nodes(), label)) return;
    } catch {}
    await pause(500);
  }
  throw new Error(`Native screen did not show ${label}`);
}
async function go(label) {
  await press("Explore", 0);
  await press(label);
}
const launch = () =>
  adb(
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    "exp+mindguard://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081",
    "com.mindguard.capstone",
  );
(async () => {
  const checks = [];
  await wait("Explore");
  // Explicitly replace the dedicated emulator's demo profile before this test.
  await press("Explore", 0);
  await press("Normal");
  await press("Load scenario");
  await go("23 Conversation Preferences and Auto-delete");
  await press("Save conversation history");
  assert.equal(visible(nodes(), "Save conversation history").checked, "true");
  await press("After 30 days");
  assert.equal(visible(nodes(), "After 30 days").checked, "true");
  await press("Save conversation preferences");
  checks.push("Native history opt-in and retention controls");
  console.log(checks.at(-1));
  await press("Conversation history");
  await press("New conversation");
  await press("Message Zen");
  adb("shell", "input", "text", "A%ssynthetic%snative%sreflection.");
  screenshot("artifacts/android-keyboard.png");
  await press("Send", 0);
  await pause(1300);
  adb("shell", "input", "keyevent", "4");
  await press("History");
  await wait("Continue: A synthetic native reflection.");
  checks.push("Native keyboard entry, send, JSON reply and saved history");
  console.log(checks.at(-1));
  await press("Continue: A synthetic native reflection.");
  await press("Remember a detail");
  await press("Detail");
  adb("shell", "input", "text", "I%sprefer%sshort%ssuggestions.");
  screenshot("artifacts/android-memory-keyboard.png");
  await press("Remember this detail", 0);
  await go("24 Remembered Details");
  await wait("I prefer short suggestions.");
  screenshot("artifacts/android-memories.png");
  checks.push("Explicit native remembered details");
  console.log(checks.at(-1));
  adb("shell", "am", "force-stop", "com.mindguard.capstone");
  launch();
  await wait("Explore");
  await go("22 Conversation History");
  await wait("Continue: A synthetic native reflection.");
  screenshot("artifacts/android-history.png");
  await press("Continue: A synthetic native reflection.");
  await press("Voice");
  await press("Start voice conversation");
  await press("Allow voice simulation");
  await press("Mute");
  await wait("MUTED · microphone off");
  screenshot("artifacts/android-voice.png");
  await press("Unmute");
  await press("Stop");
  await wait("STOPPED · microphone off");
  await press("Switch to text");
  checks.push(
    "Native relaunch persistence, text/voice switching, consent, mute and stop",
  );
  console.log(checks.at(-1));
  const manifest = adb("shell", "dumpsys", "package", "com.mindguard.capstone");
  assert.equal(manifest.includes("android.permission.RECORD_AUDIO"), false);
  const runtime = adb("logcat", "-d", "-s", "AndroidRuntime:E");
  assert.equal(runtime.includes("FATAL EXCEPTION"), false);
  checks.push(
    "Installed package requests no microphone permission and has no AndroidRuntime fatal error",
  );
  await go("08 Voice Tone Settings");
  if (visible(nodes(), "Allow optional tone analysis").checked !== "true")
    await press("Allow optional tone analysis");
  assert.equal(
    visible(nodes(), "Allow optional tone analysis").checked,
    "true",
  );
  screenshot("artifacts/android-tone.png");
  await press("Return to voice");
  await press("Start voice conversation");
  await pause(11000);
  await press("Mute");
  await press("Confirm");
  assert(nodes().some((n) => n.text.includes("Confirmed")));
  await go("21 Personalized Recommendations");
  assert(nodes().some((n) => n.text.includes("showed up most often")));
  screenshot("artifacts/android-recommendations.png");
  checks.push(
    "Native tone opt-in and completed-turn confirmation",
    "Native personalized recommendations render from shared observations",
  );
  fs.writeFileSync(
    "artifacts/android-verification.json",
    JSON.stringify(
      { device: "MindGuard_API_36", package: "com.mindguard.capstone", checks },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
