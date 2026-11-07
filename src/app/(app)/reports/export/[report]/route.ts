// CSV export of one report: GET /reports/export/employees?year=2026&office=MTO ...
// Same filters and same role check as the Reports page. The proxy is only a first gate,
// so this handler checks the session and the role itself (requireRole redirects otherwise).
import { connection } from "next/server";
import { rolesFor } from "@/config/nav";
import { toCsv } from "@/lib/csv";
import { requireRole } from "@/server/auth";
import { buildReport, parseReportFilters, REPORT_KEYS, type ReportKey } from "@/server/reports";

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  await connection();
  await requireRole(...rolesFor("/reports"));

  const { report } = await params;
  if (!REPORT_KEYS.includes(report as ReportKey)) return new Response("Unknown report", { status: 404 });

  const filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams));
  const table = await buildReport(report as ReportKey, filters);
  const csv = toCsv([table.headers, ...table.rows, ...(table.totals ? [table.totals] : [])]);

  // e.g. "mmh-leave-employees-2026-mto.csv". Only letters, digits and dashes, so the header stays valid.
  const parts = ["mmh-leave", report, filters.year, filters.office, filters.empStatus, filters.type, filters.status].filter(Boolean);
  const filename = parts.join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
