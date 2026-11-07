// QR code for an approved application, made on the server (no browser code needed).
// It encodes the public address of /verify/[refNo], which anyone can open without logging in.
import { headers } from "next/headers";
import QRCode from "qrcode";
import { verifyUrl } from "../lib/verify";

/**
 * Full public verify URL for this request. APP_URL (in .env) wins when it is set; otherwise
 * the address the browser used to reach us, so a phone on the same Wi-Fi can open it.
 */
export async function publicVerifyUrl(refNo: string) {
  const h = await headers();
  return verifyUrl(refNo, {
    appUrl: process.env.APP_URL,
    // Behind a proxy (e.g. Render) the original host and protocol are in the x-forwarded-* headers.
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto")?.split(",")[0],
  });
}

/** The QR code as a PNG data URL, ready for <img src>. Returns the URL it encodes too. */
export async function verifyQr(refNo: string) {
  const url = await publicVerifyUrl(refNo);
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { url, dataUrl };
}
