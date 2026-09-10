import { $ } from "./lib/dom.js";

let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function setInstalled(on) {
  document.documentElement.classList.toggle("is-pwa", on);
  document.querySelectorAll("a[data-install]").forEach((btn) => {
    btn.hidden = on;
  });
}

export async function promptInstall() {
  if (isStandalone()) return;

  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    return;
  }

  if (isIos()) {
    const tip = $("installTip");
    if (tip) tip.hidden = false;
    return;
  }

  const tip = $("installTip");
  const copy = $("installTipCopy");
  if (copy) {
    copy.textContent = "Use your browser menu and choose Install app or Add to Home screen.";
  }
  if (tip) tip.hidden = false;
}

export function initPwa() {
  if (isStandalone()) setInstalled(true);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setInstalled(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setInstalled(true);
  });

  document.querySelectorAll("[data-install]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      promptInstall();
    });
  });

  const close = $("installTipClose");
  const tip = $("installTip");
  if (close && tip) {
    close.addEventListener("click", () => { tip.hidden = true; });
    tip.addEventListener("click", (e) => {
      if (e.target === tip) tip.hidden = true;
    });
  }
}
