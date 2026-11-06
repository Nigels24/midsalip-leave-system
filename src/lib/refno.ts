// Reference numbers printed on approved leave forms and encoded in the QR code.

// 32 characters: no I, O, 0 or 1, so the number is easy to read and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(count: number) {
  // Cryptographically secure random bytes. 256 is divisible by 32, so `byte % 32` is unbiased.
  const bytes = crypto.getRandomValues(new Uint8Array(count));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** makeRefNo(2026) -> "MMH-2026-K7QX-3MPA" */
export function makeRefNo(year: number = new Date().getFullYear()) {
  return `MMH-${year}-${randomChars(4)}-${randomChars(4)}`;
}
