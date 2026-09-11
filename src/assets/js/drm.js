import { $ } from "./lib/dom.js";

function lockKeys(e) {
  const key = e.key;
  const combo = e.ctrlKey || e.metaKey;
  if (key === "F12" || (combo && ["s", "S", "p", "P", "u", "U"].includes(key))) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export function openDrmViewer({ title, blob, payload }) {
  const overlay = $("drmViewer");
  const stage = $("drmStage");
  const heading = $("drmTitle");
  if (!overlay || !stage) return;
  if (heading) heading.textContent = title || "Resource";
  stage.innerHTML = "";
  if (blob) {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.src = url;
    frame.title = title || "Resource";
    frame.setAttribute("sandbox", "allow-scripts");
    stage.appendChild(frame);
    overlay.addEventListener("hidden", () => URL.revokeObjectURL(url), { once: true });
  } else {
    const p = document.createElement("p");
    p.className = "drm-viewer__empty";
    p.textContent = payload?.message || "Unlocked. The private blob for this title is not stored on this host yet — nothing is served from a public URL.";
    stage.appendChild(p);
  }
  overlay.hidden = false;
  document.body.classList.add("is-drm-open");
}

function closeDrmViewer() {
  const overlay = $("drmViewer");
  const stage = $("drmStage");
  if (stage) stage.innerHTML = "";
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("is-drm-open");
}

export function initDrmViewer() {
  const overlay = $("drmViewer");
  if (!overlay) return;
  overlay.querySelectorAll("[data-drm-close]").forEach((btn) => {
    btn.addEventListener("click", closeDrmViewer);
  });
  overlay.addEventListener("contextmenu", (e) => e.preventDefault());
  overlay.addEventListener("keydown", lockKeys);
  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    lockKeys(e);
    if (e.key === "Escape") closeDrmViewer();
  });
}
