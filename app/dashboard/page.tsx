import { getAuthenticatedUser } from "@/middleware/isAuthenticated";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Account</h1>
      <p className="mt-2 text-sm opacity-80">{user.email || user.id}</p>
    </main>
  );
}
