// Placeholder home page. Shows live counts from PostgreSQL to prove the database wiring works.
import { connection } from "next/server";
import { db } from "@/lib/db";
import { APP } from "@/lib/constants";

export default async function HomePage() {
  // Render on every request, not at build time (the counts come from the database).
  await connection();

  const [offices, employees, leaveTypes] = await Promise.all([
    db.office.count(),
    db.employee.count(),
    db.leaveType.count(),
  ]);

  const stats = [
    { label: "Offices", value: offices },
    { label: "Employees", value: employees },
    { label: "Leave types", value: leaveTypes },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{APP.issuer}</p>
        <h1 className="mt-2 text-2xl font-bold">{APP.name}</h1>
        <p className="text-sm text-muted-foreground">{APP.subtitle}</p>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted p-3 text-center">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-2xl font-semibold text-primary">{s.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-xs text-muted-foreground">Database connected. Login and modules come in the next steps.</p>
      </div>
    </main>
  );
}
