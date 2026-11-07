"use client";
// The frame around every signed-in page: sidebar (filtered by role), header, mobile menu.
// A client component only because the mobile menu needs useState and the active link
// needs usePathname. All data comes in as props from src/app/(app)/layout.tsx.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { NAV } from "@/config/nav";
import { APP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { logout } from "@/server/auth-actions";
import { Seal } from "./seal";

interface Props {
  user: { name: string; initials: string; role: Role; roleLabel: string; position: string; officeName: string };
  badges: { approvals: number; notifications: number };
  children: React.ReactNode;
}

export function AppShell({ user, badges, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <Seal className="h-10 w-10 shrink-0" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">{APP.name}</p>
          <p className="text-[11px] text-brand-100/80">{APP.agency}</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((n) => {
          // Also active on nested pages: /applications/abc highlights "My Applications".
          // (The "/" after the href keeps /apply from matching /applications.)
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          const count = n.badge ? badges[n.badge] : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active ? "bg-white/15 font-semibold text-white" : "text-brand-100/85 hover:bg-white/10 hover:text-white",
              )}
            >
              <n.icon size={18} />
              <span className="flex-1">{n.label}</span>
              {count > 0 && (
                <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-bold text-brand-900">{count}</span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-[11px] text-brand-100/70">{APP.issuer}</div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted lg:pl-64 print:bg-white print:pl-0">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-brand-900 lg:block print:hidden">{sidebar}</aside>

      {/* Mobile sidebar: a plain overlay opened by the menu button */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-900">
            <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-5 text-white/70" aria-label="Close menu">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur sm:px-6 print:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{APP.subtitle}</p>
          <p className="truncate text-xs text-slate-500">{user.officeName}</p>
        </div>

        <Link href="/notifications" className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
          <Bell size={20} />
          {badges.notifications > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {badges.notifications}
            </span>
          )}
        </Link>

        {/* The name opens My Profile (where the e-signature is set). */}
        <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100" title="My Profile">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {user.initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-slate-800">{user.name}</span>
            <span className="block text-[11px] text-slate-500">
              {user.roleLabel} · {user.position}
            </span>
          </span>
        </Link>

        {/* Sign out is a form so it works through the logout server action. */}
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50"
            aria-label="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
