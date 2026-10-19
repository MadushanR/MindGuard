// Small adb harness for repeatable native UI checks. Run only against a test emulator.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const sdk =
  process.env.ANDROID_HOME ||
  path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const adbPath =
  process.env.ADB_PATH ||
  path.join(
    sdk,
    "platform-tools",
    process.platform === "win32" ? "adb.exe" : "adb",
  );
const prefix = process.env.ANDROID_SERIAL
  ? ["-s", process.env.ANDROID_SERIAL]
  : [];
function adb(...args) {
  return execFileSync(adbPath, [...prefix, ...args], {
    encoding: "utf8",
    timeout: 30000,
    windowsHide: true,
  });
}
function dump() {
  const result = adb(
    "shell",
    "uiautomator",
    "dump",
    "--compressed",
    "/sdcard/mindguard-window.xml",
  );
  if (!result.includes("dumped to"))
    throw new Error(
      "Android UI did not become idle; no stale hierarchy will be used. Disable emulator animations before inspection.",
    );
  return adb("shell", "cat", "/sdcard/mindguard-window.xml");
}
function nodes(xml = dump()) {
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(([tag]) => {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [
        k,
        v
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#10;/g, "\n"),
      ]),
    );
    const bounds = (attrs.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    return { ...attrs, rectangle: bounds ? bounds.slice(1).map(Number) : null };
  });
}
function tap(label) {
  const list = nodes().filter(
    (n) =>
      n.rectangle &&
      n.rectangle[2] > n.rectangle[0] &&
      n.rectangle[3] > n.rectangle[1],
  );
  const node =
    list.find((n) => n["content-desc"] === label) ||
    list.find((n) => n.text === label);
  if (!node) throw new Error(`Native control not visible: ${label}`);
  const [l, t, r, b] = node.rectangle;
  adb(
    "shell",
    "input",
    "tap",
    String(Math.round((l + r) / 2)),
    String(Math.round((t + b) / 2)),
  );
}
function screenshot(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const buffer = execFileSync(
    adbPath,
    [...prefix, "exec-out", "screencap", "-p"],
    { timeout: 30000, windowsHide: true },
  );
  fs.writeFileSync(filename, buffer);
}
module.exports = { adb, dump, nodes, tap, screenshot };
if (require.main === module)
  console.log(
    nodes()
      .filter((n) => n.text || n["content-desc"])
      .map((n) => ({
        text: n.text,
        label: n["content-desc"],
        bounds: n.bounds,
      })),
  );
