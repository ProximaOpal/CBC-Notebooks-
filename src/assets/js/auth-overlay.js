import { track } from "./lib/telemetry.js";
import { validateLogin, validateRegister } from "./lib/auth-validate.js";
import {
  initGoogleGis,
  renderGoogleButton,
  promptGoogleOneTap,
  fetchGoogleProfile,
  googleLogout,
  isGoogleConfigured,
} from "./google-gis.js";

const SESSION_KEY = "cbc-auth-session";

let authOpen = () => {};

export function openAuthOverlay(view = "signin") {
  authOpen(view);
}

/** @typedef {{ id: string, name: string, email: string, startedAt: string }} AuthSession */

function $(id) {
  return document.getElementById(id);
}

function nowIso() {
  return new Date().toISOString();
}

/** @returns {AuthSession | null} */
function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(session) {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("cbc-auth-users");
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

async function credentialsRequest(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function focusables(root) {
  return Array.from(
    root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

export function initAuthOverlay() {
  const overlay = $("authOverlay");
  const panel = $("authPanel");
  const title = $("authTitle");
  const errorEl = $("authError");
  const signinView = $("authViewSignin");
  const signupView = $("authViewSignup");
  const accountView = $("authViewAccount");
  const googleWrap = $("authGoogleWrap");
  const googleLabel = $("authGoogleLabel");
  const social = $("authSocial");
  if (!overlay || !panel) return;

  let view = "signup";
  let lastFocus = null;

  function setError(message) {
    if (!errorEl) return;
    errorEl.hidden = !message;
    errorEl.textContent = message || "";
  }

  function setPending(pending) {
    overlay.querySelectorAll("[data-auth-submit], [data-auth-google]").forEach((btn) => {
      btn.disabled = pending;
    });
    overlay.querySelectorAll("[data-auth-submit]").forEach((btn) => {
      const idle = btn.dataset.labelIdle;
      const busy = btn.dataset.labelBusy;
      if (idle && busy) btn.textContent = pending ? busy : idle;
    });
  }

  function paintHeader() {
    const session = readSession();
    document.querySelectorAll(".nav__guest").forEach((el) => {
      el.hidden = Boolean(session);
    });
    document.querySelectorAll(".nav__authed").forEach((el) => {
      el.hidden = !session;
    });
    const nameEl = $("navAccountName");
    const avatarEl = $("navAvatar");
    if (session && nameEl) nameEl.textContent = session.name || "Account";
    if (session && avatarEl) {
      avatarEl.textContent = (session.name || session.email || "U").slice(0, 1).toUpperCase();
    }
    document.querySelectorAll("[data-auth-open]").forEach((btn) => {
      btn.setAttribute("aria-expanded", String(!overlay.hidden));
    });
  }

  function applyProfile(user) {
    if (!user) return;
    writeSession({
      id: user.id,
      name: user.full_name || user.given_name || "Account",
      email: user.email,
      startedAt: user.last_login_at || nowIso(),
      picture: user.picture_url,
      profile: user,
    });
  }

  function paintAccount() {
    const session = readSession();
    if (!session) return;
    const profile = session.profile || {};
    const name = $("authAccountName");
    const email = $("authAccountEmail");
    const started = $("authAccountStarted");
    const avatar = $("authAccountAvatar");
    const photo = $("authAccountPhoto");
    const verified = $("authAccountVerified");
    const locale = $("authAccountLocale");
    const googleId = $("authAccountGoogleId");
    if (name) name.textContent = profile.full_name || session.name || "Learner";
    if (email) email.textContent = profile.email || session.email;
    if (started) started.textContent = new Date(session.startedAt).toLocaleString();
    if (verified) verified.textContent = profile.email_verified ? "Verified" : "Unverified";
    if (locale) locale.textContent = profile.locale || "—";
    if (googleId) googleId.textContent = profile.google_id || "—";
    const src = profile.picture_url || session.picture;
    if (photo && src) {
      photo.src = src;
      photo.hidden = false;
      if (avatar) avatar.hidden = true;
    } else if (avatar) {
      avatar.hidden = false;
      avatar.textContent = (session.name || session.email || "U").slice(0, 1).toUpperCase();
      if (photo) photo.hidden = true;
    }
  }

  function showView(next) {
    const session = readSession();
    view = session ? "account" : next;
    const labels = {
      signin: "Log in",
      signup: "Create Account",
      account: "Your Account",
    };
    if (title) title.textContent = labels[view];
    if (signinView) signinView.hidden = view !== "signin";
    if (signupView) signupView.hidden = view !== "signup";
    if (accountView) accountView.hidden = view !== "account";
    if (googleWrap) googleWrap.hidden = view === "account";
    if (social) social.hidden = view === "account";
    if (googleLabel) {
      googleLabel.textContent = view === "signin" ? "Sign in with Google" : "Sign up with Google";
    }
    const gisHost = $("googleBtn");
    if (gisHost && view !== "account") {
      renderGoogleButton(gisHost, view === "signin" ? "signin" : "signup");
    }
    if (view === "account") paintAccount();
    const first = overlay.querySelector(
      view === "signup" ? "#authSignupName" : view === "signin" ? "#authSigninEmail" : "[data-auth-signout]"
    );
    window.setTimeout(() => first?.focus(), 40);
  }

  function closeOverlay() {
    overlay.hidden = true;
    document.body.classList.remove("is-auth-open");
    setError("");
    setPending(false);
    document.querySelectorAll("[data-auth-open]").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
    lastFocus?.focus();
  }

  function openOverlay(next = "signin") {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("is-auth-open");
    setError("");
    const session = readSession();
    showView(session ? "account" : next);
    paintHeader();
    if (!session && isGoogleConfigured()) promptGoogleOneTap();
    track(session ? "account_overlay_opened" : "auth_overlay_opened", { view: session ? "account" : next });
  }

  async function onLogin(form) {
    const email = String(form.email.value || "").trim().toLowerCase();
    const password = String(form.password.value || "");
    const invalid = validateLogin(email, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending(true);
    try {
      const data = await credentialsRequest("/api/auth/login", { email, password });
      applyProfile(data.user || { id: email, full_name: email, email });
      paintHeader();
      showView("account");
      track("auth_signed_in", { method: "credentials" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setPending(false);
    }
  }

  async function onRegister(form) {
    const name = String(form.name.value || "").trim();
    const email = String(form.email.value || "").trim().toLowerCase();
    const password = String(form.password.value || "");
    const invalid = validateRegister(name, email, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending(true);
    try {
      const data = await credentialsRequest("/api/auth/register", { name, email, password });
      applyProfile(data.user || { id: email, full_name: name, email });
      paintHeader();
      showView("account");
      track("auth_registered", { method: "credentials" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
    } finally {
      setPending(false);
    }
  }

  async function onSignOut() {
    setPending(true);
    try {
      await googleLogout();
    } catch {
      /* local sign-out still proceeds */
    }
    writeSession(null);
    paintHeader();
    showView("signin");
    track("auth_signed_out");
    closeOverlay();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.hasAttribute("data-auth-close-backdrop")) closeOverlay();
  });
  overlay.querySelectorAll("[data-auth-close]").forEach((btn) => {
    btn.addEventListener("click", closeOverlay);
  });
  document.querySelectorAll("[data-auth-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(".nav__links")?.classList.remove("is-open");
      $("burgerBtn")?.setAttribute("aria-expanded", "false");
      openOverlay(btn.dataset.authOpen || "signin");
    });
  });
  overlay.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setError("");
      showView(btn.dataset.authTab);
    });
  });
  overlay.querySelectorAll("[data-auth-eye]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.authEye);
      if (!input) return;
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    });
  });
  $("formAuthSignin")?.addEventListener("submit", (e) => {
    e.preventDefault();
    onLogin(e.currentTarget);
  });
  $("formAuthSignup")?.addEventListener("submit", (e) => {
    e.preventDefault();
    onRegister(e.currentTarget);
  });
  overlay.querySelector("[data-auth-signout]")?.addEventListener("click", onSignOut);
  overlay.querySelectorAll(".auth-card__social a").forEach((link) => {
    link.addEventListener("click", (e) => e.preventDefault());
  });

  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeOverlay();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusables(panel);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("error")) {
    openOverlay("signin");
    setError("Google authentication canceled");
  }

  initGoogleGis({
    onCredential(user) {
      applyProfile(user);
      paintHeader();
      showView("account");
      track("auth_signed_in", { method: "google" });
    },
    onError(message) {
      setError(message || "Google authentication canceled");
      if (overlay.hidden) openOverlay("signin");
    },
  }).then(async (status) => {
    const profile = await fetchGoogleProfile().catch(() => null);
    if (profile?.id) {
      applyProfile(profile);
    }
    paintHeader();
    if (status.configured && !readSession()) promptGoogleOneTap();
    const note = $("googleConfigNote");
    if (note) note.hidden = Boolean(status.configured);
  });

  authOpen = openOverlay;
  paintHeader();
}
