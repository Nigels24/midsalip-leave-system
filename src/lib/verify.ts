// Public QR verification (panel revision 8). Pure functions with no database and no request,
// shared by the pages and by `npm run verify:engine` (scenario p).
import type { ApplicationStatus } from "../generated/prisma/client";

/** " mmh-2026-k7qx -3mpa " -> "MMH-2026-K7QX-3MPA": uppercase, all spaces removed. */
export function normalizeRefNo(input: string) {
  return input.toUpperCase().replace(/\s/g, "");
}

/**
 * The address the QR code opens.
 *   appUrl: the optional APP_URL setting, used as is when set (e.g. "https://mmh-leave.onrender.com").
 *   host / proto: from the incoming request, so a phone on the same Wi-Fi gets the laptop's
 *   LAN address (e.g. "192.168.1.10:3000") instead of "localhost".
 */
export function verifyUrl(refNo: string, base: { appUrl?: string | null; host?: string | null; proto?: string | null }) {
  const origin = base.appUrl?.trim() || `${base.proto || "http"}://${base.host || "localhost:3000"}`;
  return `${origin.replace(/\/+$/, "")}/verify/${encodeURIComponent(normalizeRefNo(refNo))}`;
}

/** Everything the server loaded about the application. Only part of it may be shown publicly. */
export interface VerifyRecord {
  refNo: string;
  status: ApplicationStatus;
  employeeName: string;
  officeName: string;
  leaveTypeName: string;
  dates: string; // already formatted, e.g. "Dec 1, 2026 – Dec 3, 2026"
  days: string; // already formatted, e.g. "3"
  approvedAt: string | null; // already formatted
  officers: { step: string; name: string; position: string }[];
}

/** What the public page may show. Nothing else ever reaches it. */
export type VerifyResult =
  | { kind: "NOT_FOUND"; refNo: string }
  | { kind: "NOT_APPROVED"; refNo: string; status: ApplicationStatus }
  | {
      kind: "AUTHENTIC";
      refNo: string;
      employeeName: string;
      officeName: string;
      leaveTypeName: string;
      dates: string;
      days: string;
      approvedAt: string | null;
      officers: { label: string; name: string; position: string }[];
    };

const OFFICER_LABELS: Record<string, string> = {
  RECOMMENDED: "Recommended by",
  CERTIFIED: "Certified by",
  APPROVED: "Approved by",
};

/**
 * Decides what the public page may show:
 *  - not found         -> the reference number only;
 *  - not approved yet  -> the status only (no name, no office, no dates);
 *  - approved          -> the minimum details and the signing officers.
 * Salary, leave details, remarks and credits are never part of the result.
 */
export function publicVerifyResult(refNo: string, record: VerifyRecord | null): VerifyResult {
  if (!record) return { kind: "NOT_FOUND", refNo };
  if (record.status !== "APPROVED") return { kind: "NOT_APPROVED", refNo: record.refNo, status: record.status };
  return {
    kind: "AUTHENTIC",
    refNo: record.refNo,
    employeeName: record.employeeName,
    officeName: record.officeName,
    leaveTypeName: record.leaveTypeName,
    dates: record.dates,
    days: record.days,
    approvedAt: record.approvedAt,
    officers: record.officers
      .filter((o) => o.step in OFFICER_LABELS)
      .map((o) => ({ label: OFFICER_LABELS[o.step], name: o.name, position: o.position })),
  };
}
