const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const base = process.env.MINDGUARD_URL || "http://localhost:8081";
const out = path.resolve("artifacts");
const key = "mindguard.synthetic.v1";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage(),
    errors = [],
    consoleErrors = [],
    requests = [],
    checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (!request.url().startsWith(base) && /^https?:/.test(request.url()))
      requests.push(request.url());
  });
  const b = (name) => page.getByRole("button", { name, exact: true });
  const bodyHas = (text) =>
    page.getByText(text, { exact: false }).first().waitFor();
  const stored = () =>
    page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  const waitStored = (predicate) =>
    page.waitForFunction(
      ({ key, predicate }) => {
        const raw = localStorage.getItem(key);
        return (
          raw && new Function("s", `return (${predicate})(s)`)(JSON.parse(raw))
        );
      },
      { key, predicate: predicate.toString() },
    );
  const go = async (label) => {
    await b("Explore").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: label, exact: true })
      .click();
  };
  const scenario = async (label) => {
    await b("Explore").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: label, exact: true })
      .click();
    await b("Load scenario").click();
    await bodyHas("Talk with Zen");
  };
  const send = async (text) => {
    await page.getByLabel("Message Zen", { exact: true }).fill(text);
    await b("Send").click();
    await b("Send").waitFor();
    await page.waitForTimeout(1100);
  };
  try {
    await page.goto(base);
    await b("Create account").waitFor();
    checks.push(
      "Welcome launches; account actions lead to teammate placeholders",
    );
    await b("Create account").click();
    await bodyHas("Munsif owns this screen");
    await go("23 Conversation Preferences and Auto-delete");
    await page
      .getByRole("switch", { name: "Save conversation history", exact: true })
      .check();
    await b("Save conversation preferences").click();
    await bodyHas("Choose when saved conversations should be deleted.");
    await page
      .getByRole("switch", { name: "After 30 days", exact: true })
      .check();
    await b("Save conversation preferences").click();
    await waitStored(
      (s) => s.preferences.saveHistory && s.preferences.retentionDays === 30,
    );
    await b("Conversation history").click();
    await b("New conversation").click();
    await send("I would like space after a busy day.");
    await bodyHas("That sounds like a lot to carry.");
    await waitStored((s) => s.conversations[0]?.messages.length === 2);
    await b("Remember a detail").click();
    await page
      .getByLabel("Detail", { exact: true })
      .fill("I prefer short, practical suggestions.");
    await b("Remember this detail").click();
    await waitStored((s) => s.memories.length === 1);
    await page.screenshot({ path: path.join(out, "chat.png") });
    await page.reload();
    await bodyHas("Talk with Zen");
    await b("History").click();
    await b("Continue: I would like space after a busy day.").click();
    await bodyHas("I would like space after a busy day.");
    checks.push(
      "Explicit retention required; opted-in messages and remembered details persist across reload",
    );
    await b("History").click();
    await b("Delete conversation").click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("switch", {
        name: "Also delete linked emotion observations",
        exact: true,
      })
      .uncheck();
    await dialog
      .getByRole("switch", {
        name: "Also delete linked remembered details",
        exact: true,
      })
      .uncheck();
    await dialog
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await waitStored(
      (s) =>
        !s.conversations.length &&
        s.memories.length === 1 &&
        s.observations.length === 1,
    );
    checks.push("Selective deletion retains unchecked linked records");
    const beforeTemporary = await stored();
    await b("Temporary chat").click();
    await send("A temporary reflection.");
    await b("Voice").click();
    await b("Start voice conversation").click();
    await b("Allow voice simulation").click();
    await bodyHas("LISTENING");
    await b("Switch to text").click();
    await bodyHas("A temporary reflection.");
    await b("Home").click();
    await page.waitForTimeout(1100);
    const afterTemporary = await stored();
    assert.equal(
      afterTemporary.conversations.length,
      beforeTemporary.conversations.length,
    );
    assert.equal(
      afterTemporary.memories.length,
      beforeTemporary.memories.length,
    );
    assert.equal(
      afterTemporary.observations.length,
      beforeTemporary.observations.length,
    );
    await go("06 Text Chat");
    assert.equal(
      await page.getByText("A temporary reflection.", { exact: true }).count(),
      0,
    );
    checks.push(
      "Temporary text/voice switching preserves session; leaving clears it without saving",
    );
    await scenario("Failure and retry");
    await bodyHas("Your message could not be processed.");
    await b("Retry reply").click();
    await bodyHas("We are back.");
    assert.equal(
      await page
        .getByText("Can we talk about my sleep?", { exact: true })
        .count(),
      1,
    );
    checks.push(
      "Failure/retry returns the JSON output without duplicating the message",
    );
    await scenario("Reconnecting");
    await b("Voice").click();
    await b("Start voice conversation").click();
    await b("Allow voice simulation").click();
    await b("Reconnect").waitFor();
    await b("Reconnect").click();
    await bodyHas("LISTENING");
    await b("Mute").click();
    await bodyHas("MUTED");
    await b("Unmute").click();
    await b("Stop").click();
    await bodyHas("STOPPED");
    checks.push("Voice consent, reconnection, mute, unmute and stop work");
    await scenario("Sample saved records");
    await go("21 Personalized Recommendations");
    await page.screenshot({ path: path.join(out, "recommendations.png") });
    await page
      .getByRole("button", { name: /^Explore / })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document
          .querySelector('[role="dialog"]')
          .contains(document.activeElement),
      ),
      true,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const expectedVideos = await page
      .getByText("Illustrative video", { exact: true })
      .count();
    const expectedGuides = await page
      .getByText("Guide", { exact: true })
      .count();
    await b("Videos").click();
    assert.equal(
      await page.getByRole("button", { name: /^Explore / }).count(),
      expectedVideos,
    );
    await b("Guides").click();
    assert.equal(
      await page.getByRole("button", { name: /^Explore / }).count(),
      expectedGuides,
    );
    checks.push(
      "JSON recommendations, filters, details and dialog keyboard containment work",
    );
    await go("22 Conversation History");
    await b("History and auto-delete").click();
    await page.screenshot({ path: path.join(out, "preferences.png") });
    await scenario("Expired history");
    await waitStored(
      (s) =>
        s.conversations.length === 1 &&
        s.conversations[0].id === "sample-chat" &&
        !s.memories.some((m) => m.id === "expired-memory"),
    );
    checks.push(
      "Expired seeded history and linked records are pruned before display",
    );
    const routes = [
      "/",
      "/chat",
      "/voice",
      "/voice-tone",
      "/for-you",
      "/history",
      "/conversation-preferences",
      "/remembered-details",
    ];
    for (const large of [false, true]) {
      await b("Explore").click();
      const toggle = page.getByRole("switch", {
        name: "Larger text",
        exact: true,
      });
      if (large) await toggle.check();
      else await toggle.uncheck();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      for (const width of [320, 390, 430, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        for (const route of routes) {
          await page.goto(base + route);
          await b("Explore").waitFor();
          await page.waitForFunction(
            () => !document.body.innerText.includes("Opening your space"),
          );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert.equal(
            overflow,
            false,
            `${route}: horizontal page overflow at ${width}, large=${large}`,
          );
        }
      }
    }
    checks.push(
      "64 route/viewport/text-size combinations render without horizontal page overflow",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/voice");
    await page.screenshot({ path: path.join(out, "voice.png") });
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(requests, []);
    const report = {
      checks,
      pageErrors: errors,
      consoleErrors,
      externalRequests: requests,
    };
    fs.writeFileSync(
      path.join(out, "web-verification.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error("Current URL:", page.url());
    console.error((await page.locator("body").innerText()).slice(-6000));
    console.error({ errors, consoleErrors });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
