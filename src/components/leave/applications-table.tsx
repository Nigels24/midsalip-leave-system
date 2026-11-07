// Table of leave applications. Used by My Applications, and later by Leave Records
// (with showEmployee) and For My Action. Rendered on the server; it only displays rows.
import Link from "next/link";
import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtNum, fmtRange } from "@/lib/format";
import { fullName } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export interface ApplicationRow {
  id: string;
  refNo: string;
  startDate: Date;
  endDate: Date;
  days: Prisma.Decimal;
  filedAt: Date;
  status: ApplicationStatus;
  leaveType: { name: string };
  employee?: { firstName: string; middleInitial: string | null; lastName: string; office: { id: string; name: string } };
}

interface Props {
  applications: ApplicationRow[];
  showEmployee?: boolean;
  showOffice?: boolean; // separate Office column (Leave Records); otherwise the office code is shown under the name
  actionLabel?: string; // e.g. "Review": adds a last column with a button to open the application
  empty: string;
}

export function ApplicationsTable({ applications, showEmployee = false, showOffice = false, actionLabel, empty }: Props) {
  if (applications.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="px-4">Reference No.</TableHead>
          {showEmployee && <TableHead className="px-4">Employee</TableHead>}
          {showOffice && <TableHead className="px-4">Office</TableHead>}
          <TableHead className="px-4">Leave Type</TableHead>
          <TableHead className="px-4">Inclusive Dates</TableHead>
          <TableHead className="px-4 text-right">Days</TableHead>
          <TableHead className="px-4">Filed</TableHead>
          <TableHead className="px-4">Status</TableHead>
          {actionLabel && <TableHead className="px-4" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="px-4">
              <Link href={`/applications/${a.id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">
                {a.refNo}
              </Link>
            </TableCell>
            {showEmployee && a.employee && (
              <TableCell className="px-4">
                <p className="font-medium text-slate-800">{fullName(a.employee)}</p>
                {!showOffice && <p className="text-xs text-slate-500">{a.employee.office.id}</p>}
              </TableCell>
            )}
            {showOffice && a.employee && <TableCell className="max-w-56 whitespace-normal px-4 text-slate-600">{a.employee.office.name}</TableCell>}
            <TableCell className="px-4">{a.leaveType.name}</TableCell>
            <TableCell className="px-4">{fmtRange(a.startDate, a.endDate)}</TableCell>
            <TableCell className="px-4 text-right tabular-nums">{fmtNum(a.days)}</TableCell>
            <TableCell className="px-4 text-slate-500">{fmtDate(a.filedAt)}</TableCell>
            <TableCell className="px-4">
              <StatusBadge status={a.status} />
            </TableCell>
            {actionLabel && (
              <TableCell className="px-4 text-right">
                <Button asChild size="sm">
                  <Link href={`/applications/${a.id}`}>{actionLabel}</Link>
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
