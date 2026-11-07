// Backup of the whole database into backups/midsalip-leave-YYYY-MM-DD_HH-MM-SS.sql
//   npm run db:backup
// Runs pg_dump INSIDE the database container (docker exec), so nothing extra is installed.
// The file is plain SQL; restore it with: npm run db:restore
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
const container = process.env.POSTGRES_CONTAINER || "midsalip-postgres";
const { username, pathname } = new URL(process.env.DATABASE_URL ?? "postgresql://postgres@localhost/midsalip_leave");
const user = decodeURIComponent(username || "postgres");
const database = decodeURIComponent(pathname.slice(1)) || "midsalip_leave";

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace("T", "_").replaceAll(":", "-"); // UTC time
const file = join("backups", `midsalip-leave-${stamp}.sql`);

console.log(`Backing up database "${database}" from container "${container}"...`);
const out = openSync(file, "w");
// --clean --if-exists: the file first drops each table, so a restore replaces everything cleanly.
const result = spawnSync("docker", ["exec", container, "pg_dump", "-U", user, "-d", database, "--clean", "--if-exists", "--no-owner"], {
  stdio: ["ignore", out, "inherit"],
});
closeSync(out);

if (result.error || result.status !== 0) {
  unlinkSync(file); // do not leave a broken backup behind
  console.error("\nBackup FAILED. Is Docker Desktop running and the database started (docker compose up -d)?");
  process.exit(1);
}
console.log(`Backup saved: ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
console.log("Copy the backups folder to a USB drive or another computer regularly.");
