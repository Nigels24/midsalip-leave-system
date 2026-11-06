// Dashboard (placeholder): a welcome card. The real dashboard comes in a later step.
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { EMPLOYMENT_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";

export default async function DashboardPage() {
  await connection(); // reads the signed-in user from the database on every request
  const user = await requireRole(...rolesFor("/dashboard"));

  const details = [
    { label: "Role", value: ROLE_LABELS[user.role] },
    { label: "Office", value: user.office.name },
    { label: "Position", value: user.position },
    { label: "Employment status", value: EMPLOYMENT_STATUS_LABELS[user.status] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Welcome, {fullName(user)}!</CardTitle>
        <CardDescription>Your leave summary and pending items come in a later step.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label} className="rounded-lg bg-muted p-3">
              <dt className="text-xs text-muted-foreground">{d.label}</dt>
              <dd className="font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
