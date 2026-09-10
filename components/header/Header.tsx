"use client";

import { useSession } from "next-auth/react";
import { useAuthOverlay } from "@/lib/auth-overlay-context";

type HeaderProps = {
  brand?: string;
};

export function Header({ brand = "CBC Notebooks" }: HeaderProps) {
  const { data: session, status } = useSession();
  const { isOpen, openOverlay } = useAuthOverlay();
  const authed = status === "authenticated" && Boolean(session?.user);

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4">
      <p className="font-semibold tracking-tight">{brand}</p>
      <div className="flex items-center gap-2">
        {authed ? (
          <button
            type="button"
            className="flex items-center gap-2 border border-white/30 px-3 py-2 text-sm"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            onClick={() => openOverlay("account")}
          >
            <span className="grid h-8 w-8 place-items-center bg-[#00E5C8] text-xs font-bold text-[#031211]">
              {(session?.user?.name || session?.user?.email || "U").slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[140px] truncate">{session?.user?.name || "Account"}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="px-3 py-2 text-sm"
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              onClick={() => openOverlay("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className="border border-current px-4 py-2 text-sm"
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              onClick={() => openOverlay("signup")}
            >
              Register
            </button>
          </>
        )}
      </div>
    </header>
  );
}
