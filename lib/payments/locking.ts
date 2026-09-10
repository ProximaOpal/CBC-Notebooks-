import type { PaymentStatus } from "./types";

export const TERMINAL_STATUSES: PaymentStatus[] = ["SUCCESS", "FAILED", "TIMED_OUT"];

export function isTerminal(status: PaymentStatus | string | undefined | null) {
  return TERMINAL_STATUSES.includes(String(status || "") as PaymentStatus);
}

/** PENDING → terminal only once. Terminal rows cannot be overwritten. */
export function canTransition(from: PaymentStatus, to: PaymentStatus) {
  if (from === to) return true;
  if (isTerminal(from)) return false;
  return from === "PENDING";
}
