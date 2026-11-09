// One-command setup for a new install or after an update:  npm run setup
// (Start the database first:  docker compose up -d)
// Steps, stopping at the first error. Safe to run again at any time:
//   1. install the packages (only when missing or package-lock.json changed)
//   2. create .env (only if it does not exist)
//   3. wait until the database accepts connections
//   4. generate the Prisma client
//   5. create / update the tables (prisma migrate deploy: never deletes data)
//   6. production seed (offices, leave types, holidays, starter accounts)
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

/** Runs a command in this window; stops setup if it fails. */
function run(title, command) {
  console.log(`\n=== ${title} ===`);
  // shell: true so "npm" and "npx" are found on Windows too.
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\nSetup stopped: "${title}" failed. Read the message above, fix it, then run npm run setup again.`);
    process.exit(result.status ?? 1);
  }
}

// node_modules/.package-lock.json is written by npm install; if package-lock.json is newer
// (e.g. after git pull), the packages must be installed again.
const installed = "node_modules/.package-lock.json";
const needsInstall = !existsSync(installed) || (existsSync("package-lock.json") && statSync("package-lock.json").mtimeMs > statSync(installed).mtimeMs);

if (needsInstall) run("1/6 Installing packages", "npm install");
else console.log("\n=== 1/6 Packages already installed ===");
run("2/6 Creating .env", "node scripts/setup-env.mjs");
run("3/6 Waiting for the database", "node scripts/wait-for-db.mjs");
run("4/6 Generating the Prisma client", "npx prisma generate");
run("5/6 Creating / updating the tables", "npx prisma migrate deploy");
run("6/6 Loading the starting data", "npx tsx prisma/seed-production.ts");

// Show the starter password while it is still in .env.
process.loadEnvFile(".env");
console.log("\nSetup complete.\n");
console.log("Next: npm run build   (once, and after every update)");
console.log("Then: npm run start:lan   and open http://localhost:3000\n");
if (process.env.SEED_ADMIN_PASSWORD) {
  console.log("Starter accounts: hrmo and mayor");
  console.log(`First password:   ${process.env.SEED_ADMIN_PASSWORD}`);
  console.log("Sign in as each account: the system asks for a new password first. Then delete the SEED_ADMIN_PASSWORD line from .env.\n");
}
