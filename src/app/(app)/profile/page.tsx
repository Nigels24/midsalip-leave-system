// My Profile: the user's own details (read only) and their e-signature.
// The signature is copied onto each approval step when they act (ApprovalAction.signature),
// and will be printed on CS Form No. 6.
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rolesFor } from "@/config/nav";
import { EMPLOYMENT_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { fullName } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { ChangePasswordForm } from "./change-password-form";
import { SignatureEditor } from "./signature-editor";

export default async function ProfilePage() {
  await connection();
  const user = await requireRole(...rolesFor("/profile"));
  // getCurrentUser() leaves the (large) signature out, so read it here, for this user only.
  const own = await db.employee.findUniqueOrThrow({
    where: { id: user.id },
    select: { signature: true, signatureUpdatedAt: true },
  });

  const details = [
    { label: "Name", value: fullName(user) },
    { label: "Username", value: user.username },
    { label: "Position", value: user.position },
    { label: "Office", value: user.office.name },
    { label: "Role", value: ROLE_LABELS[user.role] },
    { label: "Employment status", value: EMPLOYMENT_STATUS_LABELS[user.status] },
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your account details and e-signature. Ask the HRMO to correct any detail.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs text-slate-500">{d.label}</dt>
                  <dd className="font-medium text-slate-800">{d.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>E-signature</CardTitle>
            <CardDescription>
              Placed automatically on CS Form No. 6 at every step you sign. A later change does not alter forms you already signed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Plain data only: the data URL string and a formatted date text. */}
            <SignatureEditor
              current={own.signature}
              updatedText={own.signatureUpdatedAt ? fmtDateTime(own.signatureUpdatedAt) : null}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Use at least 8 characters. Forgot it? Ask the HRMO to reset it.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
