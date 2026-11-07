// E-signature images (panel revision 5). Stored in Employee.signature as a data URL,
// e.g. "data:image/png;base64,iVBORw0KGgo...". Used by the browser (before saving) and by
// the server action (before writing), so both apply exactly the same rules.

/** Largest stored image, in pixels. The browser shrinks pictures to fit inside this box. */
export const SIGNATURE_MAX_WIDTH = 400;
export const SIGNATURE_MAX_HEIGHT = 150;

/** About 200 KB of image data. */
export const SIGNATURE_MAX_BYTES = 200 * 1024;

// Only PNG and JPEG may be uploaded. (SVG is NOT accepted from users: an SVG file can contain
// scripts. Only the seed creates SVG signatures, from text it writes itself.)
const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

// The first bytes of a real PNG / JPEG file, written in base64.
const MAGIC = { png: "iVBORw0KGgo", jpeg: "/9j/" };

/** Returns an error message, or null when the value is a valid PNG/JPEG signature data URL. */
export function checkSignatureDataUrl(value: string): string | null {
  const match = DATA_URL.exec(value);
  if (!match) return "The signature must be a PNG or JPG image.";

  const [, kind, base64] = match;
  if (!base64.startsWith(MAGIC[kind as "png" | "jpeg"])) return "The signature file is not a valid PNG or JPG image.";

  // Every 4 base64 characters hold 3 bytes.
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > SIGNATURE_MAX_BYTES) return "The signature image is too large (200 KB at most).";
  return null;
}
