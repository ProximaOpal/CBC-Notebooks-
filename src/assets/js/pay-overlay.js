import { $ } from "./lib/dom.js";
import { track } from "./lib/telemetry.js";
import { PAY_SKUS, skuByCode, skuForResource, quoteItems } from "./data/payments.js";
import { openAuthOverlay } from "./auth-overlay.js";

const HISTORY_KEY = "cbc-payments-history";
const SESSION_KEY = "cbc-auth-session";
const PHONE_KEY = "cbc-mpesa-phone";

let tab = "services";
let selectedSku = PAY_SKUS[1]?.sku || PAY_SKUS[0].sku;
const cart = new Set([selectedSku]);
let selectedHistory = null;
let phone = "";
let pending = false;
let seconds = 0;
let timer = 0;
let poll = 0;
let error = "";
let tx = null;
let context = { subject: "", grade: "", resource: "notes" };

function readHistory() {
  try {
    const rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeHistory(rows) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 40)));
}

function sessionName() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
    return (session && session.name) || "Learner";
  } catch {
    return "Learner";
  }
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("254")) return digits.slice(0, 12);
  if (digits.startsWith("0")) return `254${digits.slice(1, 10)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits.slice(0, 9)}`;
  return digits.slice(0, 12);
}

function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString("en-KE")}`;
}

function formatPrice(amount) {
  return `${Number(amount || 0).toLocaleString("en-KE")} KES`;
}

function formatWhen(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return { mon: "—", day: "—", yr: "—", date: "—", time: "—" };
  const mon = d.toLocaleString("en-KE", { month: "short" }).toUpperCase();
  return {
    mon,
    day: String(d.getDate()).padStart(2, "0"),
    yr: String(d.getFullYear()),
    date: d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

function flagSvg(kind) {
  if (kind === "de") {
    return `<svg class="pay-flag" viewBox="0 0 14 10" aria-hidden="true"><rect width="14" height="3.34" fill="#111"/><rect y="3.33" width="14" height="3.34" fill="#dd0000"/><rect y="6.66" width="14" height="3.34" fill="#ffce00"/></svg>`;
  }
  if (kind === "nz") {
    return `<svg class="pay-flag" viewBox="0 0 14 10" aria-hidden="true"><rect width="14" height="10" fill="#012169"/><path fill="#fff" d="M0 0h7v5H0z"/><path fill="#c8102e" d="M0 2h7v1H0zM3 0h1v5H3z"/><path fill="#c8102e" d="M0 0l7 5M7 0L0 5" stroke="#fff" stroke-width="1.2"/><path d="M0 0l7 5M7 0L0 5" stroke="#c8102e" stroke-width=".55" fill="none"/><circle cx="10.2" cy="6.1" r=".7" fill="#fff"/><circle cx="11.7" cy="4.6" r=".5" fill="#fff"/><circle cx="9.4" cy="3.8" r=".4" fill="#fff"/><circle cx="12.2" cy="7.3" r=".35" fill="#fff"/></svg>`;
  }
  return `<svg class="pay-flag" viewBox="0 0 14 10" aria-hidden="true"><rect width="4.7" height="10" fill="#0055A4"/><rect x="4.65" width="4.7" height="10" fill="#fff"/><rect x="9.3" width="4.7" height="10" fill="#EF4135"/></svg>`;
}

function receiptQr(text) {
  const size = 21;
  const src = String(text || "CBC");
  let h = 2166136261;
  for (let i = 0; i < src.length; i += 1) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  const cells = [];
  const ring = (x, y, ox, oy) => {
    const dx = x - ox;
    const dy = y - oy;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  const finder = (x, y) => {
    if (x < 7 && y < 7) return ring(x, y, 0, 0);
    if (x > 13 && y < 7) return ring(x, y, 14, 0);
    if (x < 7 && y > 13) return ring(x, y, 0, 14);
    return ((h + x * 17 + y * 31) >>> 0) % 3 !== 1;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (finder(x, y)) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`);
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${cells.join("")}</svg>`;
}

function ticketHtml(item, featured, inCart) {
  const when = formatWhen(item.at);
  return `<button class="pay-ticket pay-ticket--${item.tone || "blue"}${featured ? " is-featured" : ""}${inCart ? " is-in-cart" : ""}" type="button" data-pay-pick="${item.key}">
    <span class="pay-ticket__notch" aria-hidden="true"></span>
    <span class="pay-ticket__main">
      <span class="pay-ticket__route">${item.flagHtml}<span> ${item.title}</span></span>
      <span class="pay-ticket__block">
        <em>Time</em>
        <strong>${item.timeLabel}</strong>
      </span>
      <span class="pay-ticket__ids">
        <span class="pay-ticket__block">
          <em>Booking ID</em>
          <strong>${item.ref}</strong>
        </span>
        <span class="pay-ticket__block">
          <em>Price</em>
          <strong>${formatPrice(item.amount)}</strong>
        </span>
      </span>
    </span>
    <span class="pay-ticket__stub">
      <span class="pay-ticket__mon">${when.mon}</span>
      <span class="pay-ticket__day">${when.day}</span>
      <span class="pay-ticket__yr">${when.yr}</span>
    </span>
  </button>`;
}

function listItems() {
  if (tab === "history") {
    return readHistory().map((row, i) => {
      const when = formatWhen(row.at);
      const tone = ["teal", "blue", "navy"][i % 3];
      return {
        key: `h-${row.reference_id || i}`,
        title: `${row.label || row.sku || "Payment"} · Kenya`,
        amount: row.amount,
        ref: String(row.reference_id || "CBC0000").replace(/-/g, "").slice(-8).toUpperCase(),
        at: row.at,
        tone,
        flagHtml: flagSvg(tone === "blue" ? "de" : tone === "navy" ? "nz" : "fr"),
        timeLabel: when.time,
        history: row,
      };
    });
  }
  return PAY_SKUS.map((sku) => {
    const tone = sku.tone;
    return {
      key: sku.sku,
      title: `${sku.label} · Kenya`,
      amount: sku.amount,
      ref: `CBC${String(sku.amount).padStart(4, "0")}`,
      at: new Date().toISOString(),
      tone,
      flagHtml: flagSvg(tone === "blue" ? "de" : tone === "navy" ? "nz" : "fr"),
      timeLabel: "M-Pesa STK",
      sku,
    };
  });
}

function cartQuote() {
  try {
    return quoteItems([...cart]);
  } catch {
    return quoteItems([selectedSku]);
  }
}

function currentDetail() {
  if (tab === "history" && selectedHistory) return selectedHistory;
  const sku = skuByCode(selectedSku);
  const quote = cartQuote();
  return {
    label: sku.label,
    icon: sku.icon,
    amount: quote.totalAmount,
    currency: sku.currency,
    sku: sku.sku,
    detail: sku.detail,
    lines: quote.lines,
    reference_id: tx?.reference_id || `CBC${String(quote.totalAmount).padStart(4, "0")}`,
    at: tx?.created_at || new Date().toISOString(),
    status: tx?.status || "READY",
  };
}

function renderList() {
  const list = $("payTicketList");
  if (!list) return;
  const items = listItems();
  if (!items.length) {
    list.innerHTML = `<p class="pay-empty">No M-Pesa receipts yet. Pay a service and it appears here with the date.</p>`;
    return;
  }
  const featuredKey = tab === "history"
    ? (selectedHistory ? `h-${selectedHistory.reference_id}` : items[Math.min(1, items.length - 1)].key)
    : selectedSku;
  list.innerHTML = items.map((item) => ticketHtml(item, item.key === featuredKey, cart.has(item.key))).join("");
  list.querySelectorAll("[data-pay-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hit = items.find((item) => item.key === btn.dataset.payPick);
      if (!hit) return;
      if (hit.history) {
        selectedHistory = hit.history;
      } else {
        selectedSku = hit.key;
        selectedHistory = null;
        tx = null;
        error = "";
        if (cart.has(hit.key) && cart.size > 1) cart.delete(hit.key);
        else cart.add(hit.key);
      }
      document.getElementById("payOverlay")?.classList.add("is-details");
      render();
    });
  });
}

function renderDetails() {
  const detail = currentDetail();
  const when = formatWhen(detail.at);
  const sku = skuByCode(detail.sku || selectedSku);
  const nameEl = $("payDetailName");
  const serviceEl = $("payDetailService");
  const refEl = $("payDetailRef");
  const dateEl = $("payDetailDate");
  const timeEl = $("payDetailTime");
  const amountEl = $("payDetailAmount");
  const gradeEl = $("payDetailGrade");
  const subjectEl = $("payDetailSubject");
  const qr = $("payDetailQr");
  const phoneInput = $("payPhone");
  const err = $("payError");
  const wait = $("payWait");
  const actions = $("payActions");
  const paid = $("payPaid");
  if (nameEl) nameEl.textContent = sessionName();
  if (serviceEl) serviceEl.innerHTML = `${flagSvg("fr")} <span>M-Pesa · ${sku.label}</span>`;
  if (refEl) refEl.textContent = String(detail.reference_id || "CBC0000").replace(/-/g, "").slice(-8).toUpperCase();
  if (dateEl) dateEl.textContent = when.date;
  if (timeEl) timeEl.textContent = when.time;
  if (amountEl) amountEl.textContent = formatKes(detail.amount);
  const linesEl = $("payCartLines");
  if (linesEl) {
    const lines = detail.lines || cartQuote().lines;
    linesEl.innerHTML = lines.map((line) => `<li><span>${line.label}</span><strong>${formatKes(line.amount)}</strong></li>`).join("");
  }
  if (gradeEl) gradeEl.textContent = context.grade ? String(context.grade).split("·")[0].trim() : "Kenya";
  if (subjectEl) subjectEl.textContent = context.subject || sku.label || "Nairobi";
  if (qr) qr.innerHTML = receiptQr(String(detail.reference_id || detail.sku || "CBC"));
  if (phoneInput) {
    if (phone) phoneInput.value = phone;
    phoneInput.disabled = pending || detail.status === "SUCCESS";
  }
  if (err) {
    err.hidden = !error;
    err.textContent = error || "";
  }
  const isPaid = detail.status === "SUCCESS";
  if (wait) wait.hidden = !pending;
  if (actions) actions.hidden = pending || isPaid;
  if (paid) {
    paid.hidden = !isPaid;
    paid.textContent = isPaid ? `Paid · ${String(detail.reference_id || "").replace(/-/g, "").slice(-8).toUpperCase()}` : "";
  }
  const secondsEl = $("paySeconds");
  if (secondsEl) secondsEl.textContent = String(seconds);
}

function render() {
  document.querySelectorAll("[data-pay-tab]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.payTab === tab);
  });
  const count = tab === "history" ? readHistory().length : PAY_SKUS.length;
  const bell = $("payBellDot");
  if (bell) bell.hidden = count < 1;
  renderList();
  renderDetails();
}

function stopTimers() {
  if (timer) window.clearInterval(timer);
  if (poll) window.clearInterval(poll);
  timer = 0;
  poll = 0;
}

async function pollStatus(reference) {
  poll = window.setInterval(async () => {
    try {
      const res = await fetch(`/api/payments/status/${encodeURIComponent(reference)}`, { credentials: "include" });
      const data = await res.json();
      const status = data.transaction?.status;
      if (status === "SUCCESS") {
        pending = false;
        tx = data.transaction;
        const quote = cartQuote();
        const rows = readHistory();
        rows.unshift({
          reference_id: data.transaction.reference_id,
          sku: quote.lines.map((line) => line.sku).join("+"),
          label: quote.lines.map((line) => line.label).join(", "),
          amount: quote.totalAmount,
          at: new Date().toISOString(),
          status: "SUCCESS",
        });
        writeHistory(rows);
        tab = "history";
        selectedHistory = rows[0];
        stopTimers();
        render();
        track("payment_success", { sku: quote.lines.map((line) => line.sku).join("+"), amount: quote.totalAmount });
      } else if (status === "FAILED" || status === "TIMED_OUT") {
        pending = false;
        error = data.transaction?.failure_reason || "Payment did not complete";
        stopTimers();
        render();
      }
    } catch {
      /* keep waiting */
    }
  }, 3000);
}

async function sendStk() {
  const quote = cartQuote();
  const msisdn = formatPhone(phone || $("payPhone")?.value || "");
  phone = msisdn;
  error = "";
  if (!quote.lines.length) {
    error = "Select at least one service";
    render();
    return;
  }
  if (!/^254[17]\d{8}$/.test(msisdn)) {
    error = "Enter a valid M-Pesa number (2547… or 2541…)";
    render();
    $("payPhone")?.focus();
    return;
  }
  try {
    localStorage.setItem(PHONE_KEY, msisdn);
  } catch {
    /* ignore */
  }
  pending = true;
  seconds = 60;
  stopTimers();
  timer = window.setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      pending = false;
      error = "STK prompt timed out. Try again.";
      stopTimers();
    }
    render();
  }, 1000);
  render();
  try {
    const res = await fetch("/api/payments/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        method: "MPESA",
        items: quote.lines.map((line) => line.sku),
        sku: quote.lines[0].sku,
        totalAmount: quote.totalAmount,
        currency: "KES",
        country: "KE",
        phone: msisdn,
        description: quote.lines.map((line) => line.label).join(", ").slice(0, 80),
        metadata: {
          item: quote.lines[0].sku,
          items: quote.lines.map((line) => line.sku),
          resource_type: context.resource,
          subject_name: context.subject,
          grade_level: context.grade,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      openAuthOverlay("signin");
      throw new Error("Sign in to send the M-Pesa prompt");
    }
    if (!res.ok) throw new Error(data.error || "STK Push failed");
    tx = data.transaction;
    if (tx?.reference_id) pollStatus(tx.reference_id);
    track("payment_stk_sent", { sku: quote.lines.map((line) => line.sku).join("+"), amount: quote.totalAmount });
  } catch (err) {
    pending = false;
    stopTimers();
    error = err instanceof Error ? err.message : "Unable to send M-Pesa prompt";
    render();
  }
}

export function openPayOverlay(opts = {}) {
  const overlay = $("payOverlay");
  if (!overlay) return;
  context = {
    subject: opts.subject || "",
    grade: opts.grade || "",
    resource: opts.resource || "notes",
  };
  const seed = (opts.items && opts.items.length
    ? opts.items
    : [opts.sku || (opts.resource ? skuForResource(opts.resource).sku : PAY_SKUS[1]?.sku || PAY_SKUS[0].sku)]
  ).map((code) => skuByCode(code).sku);
  cart.clear();
  seed.forEach((sku) => cart.add(sku));
  selectedSku = seed[0];
  tab = "services";
  selectedHistory = null;
  pending = false;
  error = "";
  tx = null;
  overlay.hidden = false;
  overlay.classList.remove("is-details");
  document.body.classList.add("is-pay-open");
  render();
  window.setTimeout(() => $("payPhone")?.focus(), 80);
  track("payment_overlay_opened", { sku: selectedSku });
}

function closePayOverlay() {
  const overlay = $("payOverlay");
  if (overlay) overlay.hidden = true;
  overlay?.classList.remove("is-details");
  document.body.classList.remove("is-pay-open");
  stopTimers();
  pending = false;
}

export function initPayOverlay() {
  const overlay = $("payOverlay");
  if (!overlay) return;
  try {
    phone = formatPhone(localStorage.getItem(PHONE_KEY) || "");
  } catch {
    phone = "";
  }
  overlay.querySelectorAll("[data-pay-close]").forEach((btn) => {
    btn.addEventListener("click", closePayOverlay);
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.hasAttribute("data-pay-dim")) closePayOverlay();
  });
  overlay.querySelectorAll("[data-pay-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tab = btn.dataset.payTab;
      selectedHistory = tab === "history" ? readHistory()[0] || null : null;
      overlay.classList.remove("is-details");
      render();
    });
  });
  $("payBackDetails")?.addEventListener("click", () => {
    overlay.classList.remove("is-details");
  });
  $("payPhone")?.addEventListener("input", (e) => {
    phone = formatPhone(e.target.value);
    e.target.value = phone;
  });
  $("paySendStk")?.addEventListener("click", () => void sendStk());
  $("payChange")?.addEventListener("click", () => overlay.classList.remove("is-details"));
  $("payShare")?.addEventListener("click", async () => {
    const detail = currentDetail();
    const text = `${detail.label} · ${formatKes(detail.amount)} · ${detail.reference_id || ""}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  });
  document.querySelectorAll("[data-pay-open]").forEach((btn) => {
    btn.addEventListener("click", () => openPayOverlay());
  });
  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closePayOverlay();
    }
  });
  render();
}

export { closePayOverlay };
