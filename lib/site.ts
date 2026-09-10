export const PRODUCTION_ORIGIN = "https://cbcnotebooks.co.ke";

export function isLoopbackUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw, PRODUCTION_ORIGIN);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/.test(raw);
  }
}

/** Public origin for live Render / production. Never falls back to localhost there. */
export function publicSiteOrigin() {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, process.env.AUTH_URL, process.env.RENDER_EXTERNAL_URL];
  for (const raw of candidates) {
    const value = String(raw || "").trim().replace(/\/$/, "");
    if (!value || isLoopbackUrl(value)) continue;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return `https://${value}`;
  }
  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;
  return "http://localhost:8080";
}

export function publicAbsoluteUrl(configured: string | undefined, path: string) {
  const raw = String(configured || "").trim();
  if (raw && !isLoopbackUrl(raw)) return raw;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return isLoopbackUrl(path) ? `${publicSiteOrigin()}${new URL(path).pathname}` : path;
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${publicSiteOrigin()}${suffix}`;
}

export function publicCallbackUrl(fallbackPath = "/api/auth/google/callback") {
  return publicAbsoluteUrl(process.env.GOOGLE_CALLBACK_URL, fallbackPath);
}

