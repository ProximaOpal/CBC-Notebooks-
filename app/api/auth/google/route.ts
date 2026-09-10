import { NextResponse } from "next/server";
import { googleClientId } from "@/lib/auth/google";
import { publicCallbackUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    client_id: googleClientId(),
    callback_url: publicCallbackUrl("/api/auth/google/callback"),
    scopes: ["openid", "email", "profile"],
  });
}
