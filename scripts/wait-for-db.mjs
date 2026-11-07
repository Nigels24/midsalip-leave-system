// Waits until PostgreSQL (DATABASE_URL in .env) accepts connections, for up to 60 seconds.
//   npm run db:wait        (npm run setup runs it for you)
// Plain Node: it opens a network connection and sends PostgreSQL's tiny "SSLRequest" message.
// A running PostgreSQL always answers it with one letter ("S" or "N").
import { existsSync } from "node:fs";
import net from "node:net";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run: npm run setup:env");
  process.exit(1);
}
const { hostname, port } = new URL(url);
const host = hostname || "localhost";
const portNumber = Number(port || 5432);
const TIMEOUT_SECONDS = 60;

/** Resolves true when PostgreSQL answers, false otherwise. */
function ping() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: portNumber });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(3000, () => done(false));
    socket.on("error", () => done(false));
    socket.on("connect", () => {
      // SSLRequest: length 8, code 80877103.
      const message = Buffer.alloc(8);
      message.writeInt32BE(8, 0);
      message.writeInt32BE(80877103, 4);
      socket.write(message);
    });
    socket.on("data", (data) => done(data.length > 0 && (data[0] === 0x53 || data[0] === 0x4e))); // "S" or "N"
  });
}

process.stdout.write(`Waiting for the database at ${host}:${portNumber} `);
for (let second = 0; second < TIMEOUT_SECONDS; second += 2) {
  if (await ping()) {
    console.log("ready.");
    process.exit(0);
  }
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, 2000));
}
console.error(`\n\nThe database did not answer within ${TIMEOUT_SECONDS} seconds.`);
console.error("  - Is Docker Desktop running?");
console.error("  - Did you start the database?   docker compose up -d");
console.error("  - Does the port in DATABASE_URL (.env) match POSTGRES_PORT (default 5433)?");
process.exit(1);
