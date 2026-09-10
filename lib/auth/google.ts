import { OAuth2Client } from "google-auth-library";
import { googleClientId as resolvedGoogleClientId } from "@/lib/security/secrets";

const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export function googleClientId() {
  return resolvedGoogleClientId();
}

export function hiResPicture(url?: string | null) {
  if (!url) return "";
  return url.replace(/=s\d+-c/, "=s256-c").replace(/sz=\d+/, "sz=256");
}

export type GoogleProfile = {
  google_id: string;
  email: string;
  email_verified: boolean;
  full_name: string;
  given_name: string;
  family_name: string;
  picture_url: string;
  locale: string;
  auth_provider: "GOOGLE";
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const audience = googleClientId();
  if (!audience) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const client = new OAuth2Client(audience);
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("Token payload missing sub");
  if (!ISSUERS.has(String(payload.iss))) throw new Error("Google token issuer mismatch");
  const given = payload.given_name || "";
  const family = payload.family_name || "";
  return {
    google_id: payload.sub,
    email: payload.email || "",
    email_verified: Boolean(payload.email_verified),
    full_name: payload.name || [given, family].filter(Boolean).join(" ").trim(),
    given_name: given,
    family_name: family,
    picture_url: hiResPicture(payload.picture),
    locale: payload.locale || "",
    auth_provider: "GOOGLE",
  };
}

export async function revokeGoogleToken(token?: string | null) {
  if (!token) return { revoked: false };
  const res = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return { revoked: res.status === 200, status: res.status };
}
