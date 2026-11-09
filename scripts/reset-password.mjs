// Password recovery from the server console, e.g. when the only HRMO forgot their password.
//   npm run reset-password -- hrmo
// Asks for the new password twice (what you type is not shown), then saves it hashed exactly
// as the app does (resetPasswordFromConsole() in src/server/employee-rules.ts) and writes an
// Audit Trail row with no actor. The password and its hash are never printed.
// The account must change this password at its next sign-in, and a sign-in lock is lifted.
//
// Unlike the other scripts it runs with tsx (see package.json), because it reuses the app's
// TypeScript rules and the Prisma client instead of copying them. Works on Windows, macOS and Linux.
import "dotenv/config";
import { db } from "../src/lib/db.ts";
import { normalizeUsername } from "../src/lib/utils.ts";
import { resetPasswordFromConsole } from "../src/server/employee-rules.ts";
import { LeaveError } from "../src/server/leave/errors.ts";

/**
 * Reads one line from the terminal without showing the characters.
 * Raw mode gives us each key press instead of a whole line, so nothing is echoed.
 */
function askHidden(question) {
  return new Promise((resolve) => {
    const input = process.stdin;
    process.stdout.write(question);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    let typed = "";

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          // Enter: done.
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(typed);
          return;
        } else if (ch === "\u0003") {
          // Ctrl+C: stop without changing anything.
          input.setRawMode(false);
          process.stdout.write("\nCancelled. Nothing was changed.\n");
          process.exit(130);
        } else if (ch === "\u007f" || ch === "\b") {
          typed = typed.slice(0, -1); // Backspace
        } else if (ch >= " ") {
          typed += ch;
        }
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: npm run reset-password -- <username>");
    console.error("Example: npm run reset-password -- hrmo");
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error("Run this command in a terminal window (Command Prompt, PowerShell or Terminal), so the password can be typed.");
    return 1;
  }

  // Check the account before asking for a password, so a wrong username is reported at once.
  // (resetPasswordFromConsole() checks the same again when saving.)
  const found = await db.employee.findUnique({ where: { username: normalizeUsername(username) }, select: { active: true } });
  if (!found) {
    console.error(`There is no account with the username "${normalizeUsername(username)}". Nothing was changed.`);
    return 1;
  }
  if (!found.active) {
    console.error(`The account "${normalizeUsername(username)}" is deactivated. Nothing was changed.`);
    return 1;
  }

  const password = await askHidden("New password (at least 8 characters): ");
  if (password.length < 8) {
    console.error("The password must have at least 8 characters. Nothing was changed.");
    return 1;
  }
  const again = await askHidden("Type the new password again: ");
  if (again !== password) {
    console.error("The two passwords do not match. Nothing was changed.");
    return 1;
  }

  try {
    const name = await resetPasswordFromConsole(db, username, password);
    console.log(`Password of ${name} was reset and the account is unlocked. Sign in with it: the system then asks for a new password.`);
    return 0;
  } catch (error) {
    if (!(error instanceof LeaveError)) throw error;
    console.error(error.message);
    return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
