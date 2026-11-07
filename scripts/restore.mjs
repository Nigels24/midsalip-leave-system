// Restores a backup made by npm run db:backup. THIS REPLACES ALL CURRENT DATA.
//   npm run db:restore                         (lists the backups and asks which one)
//   npm run db:restore -- backups/<file>.sql   (restores that file)
// Stop the system first (Ctrl+C in the window running npm run start:lan).
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

if (existsSync(".env")) process.loadEnvFile(".env");
const container = process.env.POSTGRES_CONTAINER || "midsalip-postgres";
const { username, pathname } = new URL(process.env.DATABASE_URL ?? "postgresql://postgres@localhost/midsalip_leave");
const user = decodeURIComponent(username || "postgres");
const database = decodeURIComponent(pathname.slice(1)) || "midsalip_leave";

const ask = createInterface({ input: process.stdin, output: process.stdout });
let file = process.argv[2];

if (!file) {
  const files = existsSync("backups") ? readdirSync("backups").filter((f) => f.endsWith(".sql")).sort().reverse() : [];
  if (files.length === 0) {
    console.error("No backups found in the backups folder.");
    process.exit(1);
  }
  console.log("Backups (newest first):");
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  const choice = Number(await ask.question("\nNumber of the backup to restore: "));
  if (!Number.isInteger(choice) || choice < 1 || choice > files.length) {
    console.error("No backup chosen. Nothing was changed.");
    process.exit(1);
  }
  file = join("backups", files[choice - 1]);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

console.log(`\nThis will REPLACE ALL DATA in "${database}" with ${file}.`);
console.log("Make sure the system is stopped first.");
const typed = await ask.question('Type RESTORE (in capitals) to continue: ');
ask.close();
if (typed.trim() !== "RESTORE") {
  console.log("Cancelled. Nothing was changed.");
  process.exit(0);
}

const input = openSync(file, "r");
// One transaction: if anything fails, the database stays as it was.
const result = spawnSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", user, "-d", database, "--single-transaction", "-v", "ON_ERROR_STOP=1", "--quiet"],
  { stdio: [input, "ignore", "inherit"] },
);
closeSync(input);

if (result.error || result.status !== 0) {
  console.error("\nRestore FAILED. The database was not changed. Is Docker running and the system stopped?");
  process.exit(1);
}
console.log("Restore complete. Start the system again with: npm run start:lan");
