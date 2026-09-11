"use client";

import { useEffect, useMemo, useState } from "react";
import { offeredMethods, type PaymentProvider } from "@/lib/payments/types";

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  amount?: number;
  sku?: string;
  currency?: string;
  country?: string;
  email?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type TxState = {
  reference_id: string;
  status: string;
  failure_reason?: string | null;
};

export function PaymentModal({
  open,
  onClose,
  amount,
  sku,
  currency = "KES",
  country = "KE",
  email,
  description = "CBC Notebooks resource",
  metadata,
}: PaymentModalProps) {
  const offers = useMemo(() => offeredMethods(currency, country), [currency, country]);
  const [method, setMethod] = useState<PaymentProvider>(offers.defaultMethod);
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [tx, setTx] = useState<TxState | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod(offers.defaultMethod);
      setError("");
      setPending(false);
      setSeconds(0);
      setTx(null);
      setDone(false);
    }
  }, [open, offers.defaultMethod]);

  useEffect(() => {
    if (!pending || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [pending, seconds]);

  useEffect(() => {
    if (!pending || !tx?.reference_id) return;
    const poll = window.setInterval(async () => {
      const res = await fetch(`/api/payments/status/${tx.reference_id}`, { credentials: "include" });
      const data = await res.json();
      const status = data.transaction?.status as string | undefined;
      if (status === "SUCCESS") {
        setPending(false);
        setDone(true);
        setTx(data.transaction);
      } else if (status === "FAILED" || status === "TIMED_OUT") {
        setPending(false);
        setError(data.transaction?.failure_reason || "Payment did not complete");
        setTx(data.transaction);
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [pending, tx?.reference_id]);

  useEffect(() => {
    if (pending && seconds === 0 && tx && !done) {
      setPending(false);
      setError("STK prompt timed out. Ask the user to retry or pay by card.");
    }
  }, [pending, seconds, tx, done]);

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("254")) return digits.slice(0, 12);
    if (digits.startsWith("0")) return `254${digits.slice(1, 10)}`;
    if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits.slice(0, 9)}`;
    return digits.slice(0, 12);
  }

  async function payMpesa() {
    setError("");
    setPending(true);
    setSeconds(60);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: "MPESA",
          sku: sku || String(metadata?.item || metadata?.sku || ""),
          items: sku ? [sku] : undefined,
          totalAmount: amount,
          currency,
          country,
          phone,
          email,
          description,
          metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "STK Push failed");
      setTx(data.transaction);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Unable to send M-Pesa prompt");
    }
  }

  async function payStripe() {
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: "STRIPE",
          sku: sku || String(metadata?.item || metadata?.sku || ""),
          items: sku ? [sku] : undefined,
          totalAmount: amount,
          currency,
          country,
          email,
          description,
          metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
        return;
      }
      throw new Error("Stripe did not return a checkout URL");
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Unable to start card checkout");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payTitle"
        className="relative z-10 w-[min(440px,96vw)] rounded-[28px] bg-white p-6 text-[#111] shadow-2xl"
      >
        <button type="button" className="absolute right-4 top-4 text-lg" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#888]">Checkout</p>
        <h2 id="payTitle" className="mt-1 text-2xl font-bold tracking-tight">
          {done ? "Payment received" : "Pay for this resource"}
        </h2>
        <p className="mt-1 text-sm text-[#666]">
          {currency} {(amount ?? 0).toLocaleString()} · {description}
        </p>

        {done ? (
          <div className="mt-6 rounded-2xl bg-[#f6f6f6] p-4 text-sm">
            Access is unlocked. Receipt {tx?.reference_id}
          </div>
        ) : (
          <>
            {offers.methods.length > 1 ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {offers.methods.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`h-10 text-xs font-bold uppercase tracking-wider ${
                      method === item ? "bg-[#031211] text-white" : "bg-[#f4f4f4]"
                    }`}
                    onClick={() => setMethod(item)}
                    disabled={pending}
                  >
                    {item === "MPESA" ? "M-Pesa" : "Credit / Debit Card"}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-xl bg-[#fdecec] px-3 py-2 text-sm text-[#9b1c1c]" role="alert">
                {error}
              </p>
            ) : null}

            {method === "MPESA" ? (
              <form
                className="mt-5 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void payMpesa();
                }}
              >
                <label className="text-left text-[0.72rem] font-bold uppercase tracking-wider text-[#888]">
                  Phone
                  <input
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    required
                    inputMode="tel"
                    placeholder="2547XXXXXXXX"
                    className="mt-2 h-12 w-full rounded-full border border-[#e6e6e6] px-4 text-sm outline-none"
                    disabled={pending}
                  />
                </label>
                <p className="text-left text-xs text-[#888]">Safaricom or Airtel: 2547… or 2541…</p>
                {pending ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <span className="h-10 w-10 animate-pulse rounded-full bg-[#00E5C8]" />
                    <p className="text-sm">Waiting for PIN on your phone… {seconds}s</p>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="h-12 rounded-full bg-[#ff7a00] font-bold text-white"
                  >
                    Send Prompt
                  </button>
                )}
              </form>
            ) : (
              <div className="mt-5">
                <p className="mb-4 text-sm text-[#666]">
                  Cards, Apple Pay and Google Pay via Stripe Checkout.
                </p>
                <button
                  type="button"
                  onClick={() => void payStripe()}
                  disabled={pending}
                  className="h-12 w-full rounded-full bg-[#031211] font-bold text-white disabled:opacity-60"
                >
                  {pending ? "Redirecting…" : "Continue to card checkout"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
