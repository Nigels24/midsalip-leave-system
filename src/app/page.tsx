// "/" has no content of its own: signed-in users go to the dashboard, everyone else to login.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
