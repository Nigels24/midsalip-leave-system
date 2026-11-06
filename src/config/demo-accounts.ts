// Demo accounts created by prisma/seed.ts. The login page lists them only when
// SHOW_DEMO_ACCOUNTS="true" in .env (turn it off on the real municipal server).
import type { Role } from "../generated/prisma/client";

/** Password of every seeded account. The seed uses this same constant. */
export const DEMO_PASSWORD = "demo123";

export const DEMO_ACCOUNTS: { username: string; name: string; role: Role }[] = [
  { username: "mayor", name: "Ramon T. Villarosa", role: "APPROVER" },
  { username: "hrmo", name: "Liza M. Dalisay", role: "HRMO" },
  { username: "treasurer", name: "Eduardo P. Salcedo", role: "DEPT_HEAD" },
  { username: "accountant", name: "Grace L. Manalo", role: "DEPT_HEAD" },
  { username: "engineer", name: "Nestor B. Alcantara", role: "DEPT_HEAD" },
  { username: "mswdo", name: "Teresita C. Robles", role: "DEPT_HEAD" },
  { username: "mho", name: "Arnel D. Fuentes", role: "DEPT_HEAD" },
  { username: "jpepito", name: "Joanna R. Pepito", role: "EMPLOYEE" },
  { username: "mdizon", name: "Mark A. Dizon", role: "EMPLOYEE" },
  { username: "klumbay", name: "Kristine S. Lumbay", role: "EMPLOYEE" },
  { username: "rtampus", name: "Rodel G. Tampus", role: "EMPLOYEE" },
  { username: "abacus", name: "Aileen J. Bacus", role: "EMPLOYEE" },
  { username: "lcabahug", name: "Lorna F. Cabahug", role: "EMPLOYEE" },
  { username: "jomandam", name: "Jerome V. Omandam", role: "EMPLOYEE" },
  { username: "cgalarrita", name: "Cherry N. Galarrita", role: "EMPLOYEE" },
  { username: "psumalpong", name: "Paolo E. Sumalpong", role: "EMPLOYEE" },
];
