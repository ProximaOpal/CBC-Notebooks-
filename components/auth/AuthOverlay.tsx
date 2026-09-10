"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { signIn, useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  handleCredentialsLogin,
  handleRegisterUser,
  handleSignOut,
} from "@/actions/auth-actions";
import { useAuthOverlay } from "@/lib/auth-overlay-context";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

export function AuthOverlay() {
  const { isOpen, closeOverlay, activeTab, setActiveTab } = useAuthOverlay();
  const { data: session, status } = useSession();
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const view = session?.user ? "account" : activeTab;

  useEffect(() => {
    if (isOpen && session?.user) setActiveTab("account");
  }, [isOpen, session, setActiveTab]);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setShowPassword(false);
    const t = window.setTimeout(() => firstField.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, activeTab, closeOverlay]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const root = panelRef.current;
    const items = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", trap);
    return () => root.removeEventListener("keydown", trap);
  }, [isOpen, activeTab]);

  function onLogin(formData: FormData) {
    setError("");
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your details");
      return;
    }
    startTransition(async () => {
      const result = await handleCredentialsLogin(formData);
      if (!result.ok) setError(result.error || "Invalid credentials");
      else setActiveTab("account");
    });
  }

  function onRegister(formData: FormData) {
    setError("");
    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your details");
      return;
    }
    startTransition(async () => {
      const result = await handleRegisterUser(formData);
      if (!result.ok) setError(result.error || "Email already exists");
      else setActiveTab("account");
    });
  }

  function onGoogle() {
    setError("");
    startTransition(async () => {
      try {
        await signIn("google", { callbackUrl: "/" });
      } catch {
        setError("Google authentication canceled");
      }
    });
  }

  function onSignOut() {
    startTransition(async () => {
      await handleSignOut();
      setActiveTab("signin");
      closeOverlay();
    });
  }

  const title =
    view === "account" ? "Your Account" : view === "signin" ? "Log in" : "Create Account";

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute -inset-10 bg-[url('/assets/img/auth-backdrop.jpg')] bg-cover bg-center blur-[22px] scale-110 saturate-105"
            aria-hidden="true"
          />
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={closeOverlay}
          />
          <motion.article
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 grid w-[min(920px,96vw)] min-h-[540px] grid-cols-1 overflow-hidden rounded-[36px] bg-white p-3.5 text-[#222] shadow-2xl md:grid-cols-[1.08fr_1fr] md:gap-[18px]"
            initial={{ y: 18, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 18, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeOverlay}
              className="absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center text-lg"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="relative min-h-[220px] overflow-hidden rounded-[28px] bg-[#1a1410] md:min-h-[512px]">
              <img src="/assets/img/auth-art.png" alt="" className="h-full w-full object-cover object-[58%_50%]" />
              <p className="absolute left-[22px] top-[22px] m-0 font-bold uppercase tracking-[0.14em] text-white drop-shadow">
                FREELANCER
              </p>
            </div>
            <div className="flex flex-col items-center justify-center px-6 py-7 text-center md:px-9">
              <h2 id={titleId} className="mb-5 text-[1.7rem] font-bold tracking-tight text-[#1c1c1c]">
                {title}
              </h2>
              {error ? (
                <p className="mb-3 w-full rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {error}
                </p>
              ) : null}

              {view !== "account" ? (
                <>
                  <button
                    type="button"
                    onClick={onGoogle}
                    disabled={pending}
                    className="flex h-[42px] w-full items-center justify-center gap-2.5 rounded-full border border-[#e7e7e7] bg-white text-[0.78rem] font-medium text-[#8a8a8a] disabled:opacity-60"
                  >
                    {view === "signin" ? "Sign in with Google" : "Sign up with Google"}
                    <GoogleMark />
                  </button>
                  <p className="relative my-4 w-full text-[0.78rem] text-[#b3b3b3] before:absolute before:left-0 before:top-1/2 before:h-px before:w-[38%] before:bg-[#ececec] after:absolute after:right-0 after:top-1/2 after:h-px after:w-[38%] after:bg-[#ececec]">
                    or
                  </p>
                </>
              ) : null}

              {view === "signup" ? (
                <form action={onRegister} className="flex w-full flex-col gap-3">
                  <input
                    ref={firstField}
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Full Name"
                    className="h-11 w-full rounded-full border border-[#e6e6e6] px-[18px] text-sm outline-none placeholder:text-[#c0c0c0] focus:border-[#ffb067]"
                  />
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Email Address"
                    className="h-11 w-full rounded-full border border-[#e6e6e6] px-[18px] text-sm outline-none placeholder:text-[#c0c0c0] focus:border-[#ffb067]"
                  />
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Password"
                      className="h-11 w-full rounded-full border border-[#e6e6e6] px-[18px] pr-11 text-sm outline-none placeholder:text-[#c0c0c0] focus:border-[#ffb067]"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-[#b0b0b0]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      ⌕
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="mx-auto mt-2 h-11 w-[min(220px,70%)] rounded-full bg-[#ff7a00] text-[0.92rem] font-bold text-white shadow-[0_8px_18px_rgba(255,122,0,0.28)] disabled:opacity-65"
                  >
                    {pending ? "Creating…" : "Create Account"}
                  </button>
                </form>
              ) : null}

              {view === "signin" ? (
                <form action={onLogin} className="flex w-full flex-col gap-3">
                  <input
                    ref={firstField}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Email Address"
                    className="h-11 w-full rounded-full border border-[#e6e6e6] px-[18px] text-sm outline-none placeholder:text-[#c0c0c0] focus:border-[#ffb067]"
                  />
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      minLength={8}
                      placeholder="Password"
                      className="h-11 w-full rounded-full border border-[#e6e6e6] px-[18px] pr-11 text-sm outline-none placeholder:text-[#c0c0c0] focus:border-[#ffb067]"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-[#b0b0b0]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      ⌕
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="mx-auto mt-2 h-11 w-[min(220px,70%)] rounded-full bg-[#ff7a00] text-[0.92rem] font-bold text-white shadow-[0_8px_18px_rgba(255,122,0,0.28)] disabled:opacity-65"
                  >
                    {pending ? "Signing in…" : "Log in"}
                  </button>
                </form>
              ) : null}

              {view === "account" ? (
                <div className="flex w-full flex-col items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[#ff7a00] font-bold text-white">
                    {(session?.user?.name || session?.user?.email || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <p className="font-bold">{session?.user?.name || "Learner"}</p>
                  <p className="text-sm text-[#888]">{session?.user?.email}</p>
                  <p className="text-sm text-[#888]">Session {status === "authenticated" ? "Active" : status}</p>
                  <button
                    type="button"
                    onClick={onSignOut}
                    disabled={pending}
                    className="mt-2 h-11 w-[min(220px,70%)] rounded-full bg-[#ff7a00] text-[0.92rem] font-bold text-white disabled:opacity-65"
                  >
                    {pending ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              ) : null}

              {view === "signup" ? (
                <p className="mt-3.5 text-[0.78rem] text-[#9a9a9a]">
                  Already have an account?{" "}
                  <button type="button" className="font-bold text-[#ff7a00]" onClick={() => setActiveTab("signin")}>
                    Log in
                  </button>
                </p>
              ) : null}
              {view === "signin" ? (
                <p className="mt-3.5 text-[0.78rem] text-[#9a9a9a]">
                  Don&apos;t have an account?{" "}
                  <button type="button" className="font-bold text-[#ff7a00]" onClick={() => setActiveTab("signup")}>
                    Create Account
                  </button>
                </p>
              ) : null}
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
