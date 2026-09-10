import { NextResponse } from "next/server";
import { googleClientId } from "@/lib/auth/google";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    client_id: googleClientId(),
    callback_url: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
    scopes: ["openid", "email", "profile"],
  });
}
