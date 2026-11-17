import { constants, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const relative of [".env", "apps/mobile/.env", "apps/voice-relay/.env"]) {
  const destination = path.join(root, relative);
  try {
    copyFileSync(`${destination}.example`, destination, constants.COPYFILE_EXCL);
    console.log(`Created ${relative} from its example.`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Kept existing ${relative}; no values were changed.`);
  }
}
console.log("Add the shared OpenAI project key only to apps/voice-relay/.env when available.");
console.log("Each member also needs an authorized local AWS login; see docs/ENVIRONMENT-SETUP.md.");
