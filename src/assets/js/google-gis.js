function waitForGsi(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("Google Identity Services failed to load"));
      }
    }, 40);
  });
}

let configured = false;
let gisReady = false;
let onUser = null;
let onFail = null;

export async function initGoogleGis(handlers = {}) {
  onUser = handlers.onCredential || null;
  onFail = handlers.onError || null;
  try {
    const cfg = await fetch("/api/auth/google", { credentials: "include" }).then((res) => res.json());
    const clientId = cfg.client_id;
    if (!clientId) return { configured: false };
    await waitForGsi();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      itp_support: true,
      use_fedcm_for_prompt: true,
    });
    configured = true;
    gisReady = true;
    return { configured: true };
  } catch (error) {
    return { configured: false, error: error instanceof Error ? error.message : "GIS init failed" };
  }
}

async function handleCredentialResponse(response) {
  try {
    const res = await fetch("/api/auth/google/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
      body: JSON.stringify({
        credential: response.credential,
        select_by: response.select_by || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Google sign-in failed");
    onUser?.(data.user);
  } catch (error) {
    onFail?.(error instanceof Error ? error.message : "Google sign-in failed");
  }
}

export function renderGoogleButton(target, mode = "signup") {
  if (!gisReady || !target || !window.google?.accounts?.id) return false;
  target.innerHTML = "";
  window.google.accounts.id.renderButton(target, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: mode === "signin" ? "signin_with" : "signup_with",
    shape: "pill",
    logo_alignment: "left",
    width: Math.min(320, target.clientWidth || 320),
  });
  return true;
}

export function promptGoogleOneTap() {
  if (!gisReady || !window.google?.accounts?.id) return;
  window.google.accounts.id.prompt();
}

export function disableGoogleAutoSelect() {
  window.google?.accounts?.id?.disableAutoSelect?.();
}

export function isGoogleConfigured() {
  return configured;
}

export async function fetchGoogleProfile() {
  const res = await fetch("/api/user/profile", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function googleLogout() {
  disableGoogleAutoSelect();
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
