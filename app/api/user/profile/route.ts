import { NextResponse } from "next/server";
import { getAccount, publicAccount } from "@/lib/auth/accounts";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const file = getAccount(user.id);
    if (file) return NextResponse.json(publicAccount(file));
    return NextResponse.json({
      id: user.id,
      google_id: null,
      email: user.email || null,
      email_verified: false,
      full_name: user.name || null,
      given_name: null,
      family_name: null,
      picture_url: null,
      locale: null,
      auth_provider: "credentials",
      last_login_at: null,
      created_at: null,
      updated_at: null,
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
