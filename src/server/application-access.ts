// Who may open one leave application (the detail page and the printable CS Form No. 6).
// Same rule as the prototype, except a department head is matched by the office they head:
//   the applicant; the HRMO and the Approving Authority (any application);
//   a department head for employees of the office they head.
import type { CurrentUser } from "./auth";

export function canViewApplication(
  user: Pick<CurrentUser, "id" | "role">,
  app: { employeeId: string; employee: { office: { headId: string | null } } },
) {
  if (app.employeeId === user.id) return true;
  if (user.role === "HRMO" || user.role === "APPROVER") return true;
  return user.role === "DEPT_HEAD" && app.employee.office.headId === user.id;
}
