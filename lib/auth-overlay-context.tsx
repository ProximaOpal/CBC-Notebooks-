"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthView = "signin" | "signup" | "account";

type AuthOverlayContextValue = {
  isOpen: boolean;
  activeTab: AuthView;
  openOverlay: (view?: AuthView) => void;
  closeOverlay: () => void;
  setActiveTab: (view: AuthView) => void;
};

const AuthOverlayContext = createContext<AuthOverlayContextValue | null>(null);

export function AuthOverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AuthView>("signin");

  const openOverlay = useCallback((view: AuthView = "signin") => {
    setActiveTab(view);
    setOpen(true);
  }, []);

  const closeOverlay = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, activeTab, openOverlay, closeOverlay, setActiveTab }),
    [isOpen, activeTab, openOverlay, closeOverlay]
  );

  return <AuthOverlayContext.Provider value={value}>{children}</AuthOverlayContext.Provider>;
}

export function useAuthOverlay() {
  const ctx = useContext(AuthOverlayContext);
  if (!ctx) throw new Error("useAuthOverlay must be used within AuthOverlayProvider");
  return ctx;
}
