"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { AuthOverlayProvider } from "@/lib/auth-overlay-context";
import { AuthOverlay } from "@/components/auth/AuthOverlay";

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthOverlayProvider>
        {children}
        <AuthOverlay />
      </AuthOverlayProvider>
    </SessionProvider>
  );
}
