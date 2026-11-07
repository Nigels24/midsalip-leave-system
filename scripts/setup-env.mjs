// Creates .env from .env.example on a new install (plain Node, no packages, works on Windows).
//   npm run setup:env        (npm run setup runs it for you)
// It fills SESSION_SECRET and SEED_ADMIN_PASSWORD with new random values.
// An existing .env is NEVER overwritten or changed.
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV = ".env";
const EXAMPLE = ".env.example";

if (existsSync(ENV)) {
  console.log(".env already exists: left unchanged.");
  process.exit(0);
}
if (!existsSync(EXAMPLE)) {
  console.error(`${EXAMPLE} is missing. Run this from the project folder.`);
  process.exit(1);
}

// 36 random bytes -> exactly 48 characters of URL-safe text.
const sessionSecret = randomBytes(36).toString("base64url");
// 12 random bytes -> 16 characters; the first password of the starter accounts.
const adminPassword = randomBytes(12).toString("base64url");

copyFileSync(EXAMPLE, ENV);
const text = readFileSync(ENV, "utf8")
  .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET="${sessionSecret}"`)
  .replace(/^SEED_ADMIN_PASSWORD=.*$/m, `SEED_ADMIN_PASSWORD="${adminPassword}"`);
writeFileSync(ENV, text);

console.log("Created .env with a new SESSION_SECRET and SEED_ADMIN_PASSWORD.");
