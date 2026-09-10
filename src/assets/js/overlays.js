import { $ } from "./lib/dom.js";
import { track } from "./lib/telemetry.js";

function closeAll() {
  document.querySelectorAll(".overlay").forEach((el) => {
    el.hidden = true;
  });
}

function openOverlay(id) {
  closeAll();
  const el = $(id);
  if (el) el.hidden = false;
  if (id === "overlayPrivacy") track("privacy_policy_opened");
  if (id === "overlayAdd") track("add_resource_opened");
  if (id === "overlayRequest") track("request_resource_opened");
}

function bindForm(id, eventName) {
  const form = $(id);
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    track(eventName, {
      file_type: data.get("type") || null,
      grade_level: data.get("grade") || null,
      subject_name: data.get("subject") || null,
    });
    const done = form.querySelector(".overlay__done");
    const submit = form.querySelector(".overlay__submit");
    form.querySelectorAll("input, select, textarea, button").forEach((field) => {
      if (field.classList.contains("overlay__submit")) return;
      field.disabled = true;
    });
    if (submit) submit.hidden = true;
    if (done) done.hidden = false;
  });
}

export function initOverlays() {
  document.querySelectorAll("[data-overlay]").forEach((btn) => {
    btn.addEventListener("click", () => openOverlay(btn.dataset.overlay));
  });
  document.querySelectorAll(".overlay").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) closeAll();
    });
  });
  document.querySelectorAll("[data-overlay-close]").forEach((btn) => {
    btn.addEventListener("click", closeAll);
  });
  bindForm("formAdd", "add_resource_submitted");
  bindForm("formRequest", "request_resource_submitted");
}
