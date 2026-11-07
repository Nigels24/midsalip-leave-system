// Audit Trail (HRMO only, see src/config/nav.ts): every AuditLog row, newest first, read only.
// Filters in the URL: ?action=&actor=&from=&to=&page= (dates are Philippine calendar days).
// Nothing here can edit or delete a row.
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { buildHref, Pagination, selectClass } from "@/components/list-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rolesFor } from "@/config/nav";
import { db } from "@/lib/db";
import { isIsoDate } from "@/lib/dates";
import { fmtDateTime } from "@/lib/format";
import { safeAuditDetail } from "@/lib/report-math";
import { fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";

const PAGE_SIZE = 25;

type SearchParams = { action?: string; actor?: string; from?: string; to?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  await requireRole(...rolesFor("/audit"));
  const params = await searchParams;

  const action = params.action || undefined;
  const actor = (params.actor ?? "").trim();
  const from = isIsoDate(params.from) ? params.from : undefined;
  const to = isIsoDate(params.to) ? params.to : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  // Actor: every word must match the first or last name (any case). Public QR scans and server console scripts have no actor.
  const words = actor.split(/\s+/).filter(Boolean);
  const where: Prisma.AuditLogWhereInput = {
    action,
    // A whole Philippine day: from 00:00 of `from` to the end of `to`, in Manila time (UTC+8).
    createdAt: {
      gte: from ? new Date(`${from}T00:00:00+08:00`) : undefined,
      lte: to ? new Date(`${to}T23:59:59.999+08:00`) : undefined,
    },
    AND: words.map((w) => ({
      actor: { OR: [{ firstName: { contains: w, mode: "insensitive" } }, { lastName: { contains: w, mode: "insensitive" } }] },
    })),
  };

  const [total, logs, actions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      // Only the actor's name: never the password hash or the signature.
      include: { actor: { select: { firstName: true, middleInitial: true, lastName: true, username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(action || actor || from || to);
  const pageHref = (n: number) => buildHref("/audit", { action, actor, from, to, page: n > 1 ? n : undefined });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Trail</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every action performed in the system, with the acting user and time (Data Privacy Act compliance). Read only.
        </p>
      </div>

      <Card className="gap-0 py-0">
        <form className="grid gap-2 border-b p-4 sm:grid-cols-2 lg:grid-cols-5">
          <select name="action" defaultValue={action ?? ""} className={selectClass} aria-label="Action">
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.action.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input name="actor" defaultValue={actor} className="pl-9" placeholder="Actor name…" />
          </div>
          <Input name="from" type="date" defaultValue={from} aria-label="From date" />
          <Input name="to" type="date" defaultValue={to} aria-label="To date" />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Filter
            </Button>
            {filtered && (
              <Button asChild variant="outline">
                <Link href="/audit">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        {logs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {filtered ? "No audit entries match these filters." : "No audit entries yet."}
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-4">Date &amp; time</TableHead>
                <TableHead className="px-4">Actor</TableHead>
                <TableHead className="px-4">Action</TableHead>
                <TableHead className="px-4">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap px-4 text-xs text-slate-500">{fmtDateTime(log.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap px-4">
                    {log.actor ? (
                      <>
                        <p className="font-medium text-slate-800">{fullName(log.actor)}</p>
                        <p className="font-mono text-xs text-slate-500">{log.actor.username}</p>
                      </>
                    ) : (
                      // No actor: a public QR scan, or the setup / reset-password scripts on the server.
                      <span className="text-slate-500">{log.action === "VERIFY_QR" ? "Public (QR scan)" : "Server console"}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant="outline">{log.action.replaceAll("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words px-4 text-sm text-slate-600">{safeAuditDetail(log.detail)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pages={pages} shown={logs.length} total={total} hrefFor={pageHref} />
      </Card>
    </>
  );
}
