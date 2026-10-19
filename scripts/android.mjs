import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localPath = path.join(root, "android.local.json");
const local = existsSync(localPath)
  ? JSON.parse(readFileSync(localPath, "utf8"))
  : {};
const portable = path.join(root, ".tools", "jdk17");
const portableJdk = existsSync(portable)
  ? readdirSync(portable)
      .map((name) => path.join(portable, name))
      .find((dir) => existsSync(path.join(dir, "bin", "java.exe")))
  : undefined;
const javaHome = local.javaHome ?? portableJdk ?? process.env.JAVA_HOME;
const sdk =
  local.androidHome ??
  process.env.ANDROID_HOME ??
  (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
    : undefined);
if (!javaHome || !sdk || !existsSync(javaHome) || !existsSync(sdk)) {
  console.error(
    "Android tooling is not configured. Set JAVA_HOME and ANDROID_HOME, or use android.local.json. See docs/ANDROID-SETUP.md.",
  );
  process.exit(1);
}
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  GRADLE_OPTS: [
    process.env.GRADLE_OPTS || "",
    `-Dorg.gradle.workers.max=${local.maxWorkers ?? 2}`,
  ].join(" "),
  PATH: [
    path.join(javaHome, "bin"),
    path.join(sdk, "platform-tools"),
    process.env.PATH,
  ].join(path.delimiter),
};
if (process.platform === "win32") {
  const ninja = path.join(sdk, "cmake", "3.22.1", "bin", "ninja.exe");
  if (existsSync(ninja)) {
    const version = execFileSync(ninja, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    })
      .trim()
      .split(".")
      .map(Number);
    if (version[0] === 1 && version[1] < 12) {
      console.error(
        "Update Ninja to 1.12 or later before building on Windows. See docs/ANDROID-SETUP.md for the long-path fix.",
      );
      process.exit(1);
    }
  }
}
const cli = path.join(root, "node_modules", "expo", "bin", "cli");
const child = spawn(
  process.execPath,
  [cli, "run:android", ...process.argv.slice(2)],
  { cwd: path.join(root, "apps", "mobile"), env, stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
