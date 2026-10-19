const fs = require("node:fs");
const path = require("node:path");
const { validateBundle } = require("./validate.cjs");
const names = [
  "chat",
  "voice",
  "recommendations",
  "conversations",
  "emotions",
  "remembered-details",
  "scenarios",
  "screen-copy",
];
const bundle = {},
  errors = [];
for (const name of names) {
  try {
    bundle[name] = JSON.parse(
      fs.readFileSync(path.join(__dirname, name + ".json"), "utf8"),
    );
  } catch (error) {
    errors.push(`${name}.json: ${error.message}`);
  }
}
if (!errors.length) errors.push(...validateBundle(bundle));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `All ${names.length} fixture files, schemas, IDs, references and voice transitions are valid.`,
  );
