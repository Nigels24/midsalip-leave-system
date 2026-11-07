// Sidebar menu per role (same as the prototype). Add, remove or reorder items here.
// Each page also calls requireRole(...rolesFor(href)), so the menu and the page guard
// always allow the same roles.
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  QrCode,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../generated/prisma/client";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: "approvals" | "notifications";
}

const ALL: Role[] = ["EMPLOYEE", "DEPT_HEAD", "HRMO", "APPROVER"];
const FILERS: Role[] = ["EMPLOYEE", "DEPT_HEAD", "HRMO"];
const SIGNATORIES: Role[] = ["DEPT_HEAD", "HRMO", "APPROVER"];

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/approvals", label: "For My Action", icon: ClipboardCheck, roles: SIGNATORIES, badge: "approvals" },
  { href: "/apply", label: "File Leave", icon: FilePlus2, roles: FILERS },
  { href: "/applications", label: "My Applications", icon: FileText, roles: FILERS },
  { href: "/credits", label: "Leave Credits", icon: Wallet, roles: ALL }, // the approver views any leave card
  { href: "/records", label: "Leave Records", icon: FolderOpen, roles: SIGNATORIES },
  { href: "/calendar", label: "Leave Calendar", icon: CalendarDays, roles: ALL }, // employees: their own office
  { href: "/employees", label: "Employees & Accounts", icon: Users, roles: ["HRMO"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["HRMO", "APPROVER"] },
  { href: "/audit", label: "Audit Trail", icon: History, roles: ["HRMO"] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: ALL, badge: "notifications" },
  { href: "/profile", label: "My Profile", icon: UserRound, roles: ALL },
  { href: "/verify", label: "Verify QR Code", icon: QrCode, roles: ALL },
];

/** The roles allowed on a page, taken from its menu item. Used by requireRole() in each page. */
export function rolesFor(href: string): Role[] {
  const item = NAV.find((n) => n.href === href);
  if (!item) throw new Error(`No menu item for ${href} in src/config/nav.ts`);
  return item.roles;
}
