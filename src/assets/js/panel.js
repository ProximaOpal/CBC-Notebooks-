import { LIST_PAGE, RESOURCE_LABEL, LEVEL_LABEL } from "./config.js";
import { $, pad2, withPeriod } from "./lib/dom.js";
import { SUBJECTS, matchesSubject } from "./data/subjects.js";
import { parsePath } from "./data/catalog.js";
import { subjectUrl } from "./lib/routes.js";
import { slideToPhoto, pauseAutoplay, restartAutoplay } from "./hero.js";
import {
  trackResourceOpened,
  trackDownload,
  trackSearchResultClicked,
  debounceSearch,
  trackSearch,
  newQueryId,
  track,
} from "./lib/telemetry.js";

let resource = "notes";
let activeSubject = null;
const selected = new Set();
let listCursor = 0;

function searchQuery() {
  const search = $("panelSearch");
  return (search && search.value ? search.value : "").trim().toLowerCase();
}

function visibleSubjects() {
  const q = searchQuery();
  return SUBJECTS.filter((sub) => matchesSubject(sub, q));
}

function displayedItems() {
  if (!activeSubject) return visibleSubjects();
  const q = searchQuery();
  return activeSubject.topics.filter((t) =>
    (t.name + " " + t.detail).toLowerCase().includes(q)
  );
}

function listPageState() {
  const items = displayedItems();
  if (listCursor < 0) listCursor = 0;
  if (items.length && listCursor >= items.length) listCursor = items.length - 1;
  const pages = Math.max(1, Math.ceil(items.length / LIST_PAGE));
  const page = Math.floor(listCursor / LIST_PAGE);
  const start = page * LIST_PAGE;
  return {
    items,
    page,
    pages,
    start,
    slice: items.slice(start, start + LIST_PAGE),
  };
}

function goBackToSubjects() {
  if (!activeSubject) return;
  const idx = SUBJECTS.findIndex((sub) => sub.id === activeSubject.id);
  activeSubject = null;
  listCursor = idx >= 0 ? idx : 0;
  selected.clear();
  const search = $("panelSearch");
  if (search) search.value = "";
  renderPanel();
}

function stepSubject(dir) {
  if (activeSubject) {
    const idx = SUBJECTS.findIndex((sub) => sub.id === activeSubject.id);
    const from = idx >= 0 ? idx : 0;
    const next = SUBJECTS[(from + dir + SUBJECTS.length) % SUBJECTS.length];
    activeSubject = next;
    listCursor = 0;
    selected.clear();
    const search = $("panelSearch");
    if (search) search.value = "";
    slideToPhoto(next.photo);
    renderPanel();
    return;
  }
  stepList(dir);
}

function applyPhoto(url, fallback) {
  const photo = $("panelPhoto");
  const run = (src) => {
    if (photo) photo.style.backgroundImage = "url('" + src + "')";
    slideToPhoto(src);
  };
  if (!url) {
    run(fallback);
    return;
  }
  const probe = new Image();
  probe.onload = () => run(url);
  probe.onerror = () => run(fallback || url);
  probe.src = url;
}

function activePhoto() {
  if (activeSubject) {
    const topic = activeSubject.topics[listCursor];
    return (topic && topic.photo) || activeSubject.photo;
  }
  const items = displayedItems();
  const current = items[listCursor] || items[0];
  return current ? current.photo : "/assets/img/subjects/up-math.png";
}

function updateChrome() {
  const kicker = $("panelKicker");
  const title = $("panelTitle");
  const num = $("panelNum");
  const dots = $("panelDots");
  const back = $("panelBack");
  const titleBack = $("titleBack");
  if (kicker) kicker.textContent = RESOURCE_LABEL[resource];
  if (titleBack) titleBack.hidden = !activeSubject;
  if (back) back.hidden = true;

  const items = displayedItems();
  if (activeSubject) {
    if (title) title.textContent = withPeriod(activeSubject.name);
    const idx = SUBJECTS.findIndex((sub) => sub.id === activeSubject.id);
    if (num) num.textContent = pad2(idx + 1);
    applyPhoto(activePhoto(), activeSubject.photo);
    if (dots) {
      dots.innerHTML = items.map((_, i) =>
        '<button type="button" data-dot="' + i + '" class="' + (i === listCursor ? "is-on" : "") + '" aria-label="Topic ' + (i + 1) + '"></button>'
      ).join("");
    }
  } else {
    const current = items[listCursor] || items[0];
    if (title) title.textContent = current ? withPeriod(current.name) : "The Subjects.";
    if (num) num.textContent = pad2(listCursor + 1);
    applyPhoto(current ? current.photo : null, "/assets/img/subjects/up-math.png");
    if (dots) {
      dots.innerHTML = items.slice(0, 8).map((_, i) =>
        '<button type="button" data-dot="' + i + '" class="' + (i === listCursor ? "is-on" : "") + '" aria-label="Item ' + (i + 1) + '"></button>'
      ).join("");
    }
  }

  if (dots) {
    dots.querySelectorAll("[data-dot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        listCursor = Number(btn.dataset.dot);
        if (!activeSubject) {
          const hit = visibleSubjects()[listCursor];
          if (hit) slideToPhoto(hit.photo);
        }
        renderPanel();
      });
    });
  }
}

function stepList(dir) {
  const items = displayedItems();
  if (items.length === 0) return;
  listCursor = (listCursor + dir + items.length) % items.length;
  if (!activeSubject) {
    const hit = items[listCursor];
    if (hit) slideToPhoto(hit.photo);
  }
  renderPanel();
}

function pageList(dir) {
  const { items, page, pages } = listPageState();
  const next = page + dir;
  if (next < 0 || next >= pages) return;
  listCursor = next * LIST_PAGE;
  if (!activeSubject) {
    const hit = items[listCursor];
    if (hit) slideToPhoto(hit.photo);
  }
  renderPanel();
}

function statusMessage(text) {
  const el = $("panelStatus");
  if (el) el.textContent = text;
}

function selectedCount() {
  if (!activeSubject) return 0;
  return activeSubject.topics.filter((t) => selected.has(t.id)).length;
}

function groupBlock(label, items, flat) {
  if (items.length === 0) return "";
  return '<p class="panel__group">' + label + "</p>" + items.map((s) => {
    const idx = flat.findIndex((x) => x.id === s.id);
    const on = idx === listCursor;
    return '<a class="panel__item' + (on ? " is-active" : "") + '" href="' + subjectUrl(s, resource) + '" data-subject="' + s.id + '">' +
      '<span class="panel__item-body">' +
        '<span class="panel__item-name">' + s.name + '</span>' +
        '<span class="panel__item-detail">' + s.topics.length + ' topics</span>' +
      '</span></a>';
  }).join("");
}

function renderPanel() {
  const list = $("panelList");
  const search = $("panelSearch");
  if (!list) return;

  const { items, start, slice } = listPageState();
  updateChrome();

  if (!activeSubject) {
    const up = slice.filter((sub) => sub.level === "up");
    const jss = slice.filter((sub) => sub.level === "jss");
    const ss = slice.filter((sub) => sub.level === "ss");
    list.innerHTML = groupBlock(LEVEL_LABEL.up, up, items) + groupBlock(LEVEL_LABEL.jss, jss, items) + groupBlock(LEVEL_LABEL.ss, ss, items);
    list.querySelectorAll("[data-subject]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        const found = SUBJECTS.find((sub) => sub.id === btn.dataset.subject);
        if (!found) return;
        const gradeLevel = found.level === "up" ? "Upper Primary" : found.level === "ss" ? "Senior School" : "Junior Secondary";
        trackSearchResultClicked({
          query_id: newQueryId(),
          position: items.findIndex((x) => x.id === found.id),
          subject_name: found.name,
          grade_level: gradeLevel,
        });
        activeSubject = found;
        listCursor = 0;
        slideToPhoto(found.photo);
        if (search) search.value = "";
        renderPanel();
      });
    });
    const current = items[listCursor];
    statusMessage(current
      ? RESOURCE_LABEL[resource] + " for " + current.name + " — " + current.topics.length + " topics."
      : "");
    updateActions();
    syncListNav();
    return;
  }

  list.innerHTML = slice.map((t, i) => {
    const on = selected.has(t.id);
    const active = start + i === listCursor;
    return '<label class="panel__item' + (on ? " is-checked" : "") + (active ? " is-active" : "") + '">' +
      '<input class="panel__check" type="checkbox" data-topic="' + t.id + '" ' + (on ? "checked" : "") + ' />' +
      '<span class="panel__item-body">' +
        '<span class="panel__item-name">' + t.name + '</span>' +
        '<span class="panel__item-detail">' + t.detail + '</span>' +
      '</span></label>';
  }).join("");

  list.querySelectorAll("[data-topic]").forEach((box) => {
    box.addEventListener("change", () => {
      const id = box.dataset.topic;
      if (!id) return;
      if (box.checked) selected.add(id); else selected.delete(id);
      const row = box.closest(".panel__item");
      if (row) row.classList.toggle("is-checked", box.checked);
      const n = selectedCount();
      statusMessage(n ? n + " topic" + (n === 1 ? "" : "s") + " selected" : "Select topics to preview, download or share");
      updateActions();
    });
  });
  const n = selectedCount();
  statusMessage(n ? n + " topic" + (n === 1 ? "" : "s") + " selected" : "Select topics to preview, download or share");
  updateActions();
  syncListNav();
}

export function openPanel(kind, query) {
  resource = kind;
  activeSubject = null;
  listCursor = 0;
  const panel = $("panel");
  const search = $("panelSearch");
  if (!panel) return;
  panel.hidden = false;
  if (search) search.value = query || "";
  renderPanel();
  if (search) search.focus();
  pauseAutoplay();
  trackResourceOpened(kind);
}

function closePanel() {
  const panel = $("panel");
  if (panel) panel.hidden = true;
  restartAutoplay();
}

function selectedNames() {
  if (!activeSubject) return [];
  return activeSubject.topics.filter((t) => selected.has(t.id)).map((t) => t.name);
}

function updateActions() {
  const ready = activeSubject ? selectedCount() > 0 : true;
  ["actPreview", "actDownload", "actShare"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("is-ready", ready);
    el.classList.toggle("is-off", !ready);
  });
}

function syncListNav() {
  const up = $("listUp");
  const down = $("listDown");
  if (!up || !down) return;
  const { page, pages, items } = listPageState();
  const many = items.length > LIST_PAGE;
  up.classList.toggle("is-off", !many || page <= 0);
  down.classList.toggle("is-off", !many || page >= pages - 1);
}

function hydrateFromLocation() {
  const route = parsePath(location.pathname);
  if (route.type && route.type !== "home" && route.type !== "unknown") {
    document.body.classList.add("is-seo-page");
  }
  if (route.resource && RESOURCE_LABEL[route.resource]) {
    resource = route.resource;
  } else if (route.type === "lab") {
    resource = "experiments";
  }
  if (route.subject) {
    activeSubject = route.subject;
    listCursor = 0;
  }
}

export function initPanel() {
  document.querySelectorAll(".res-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const kind = btn.dataset.resource;
      if (!kind || !RESOURCE_LABEL[kind]) return;
      event.preventDefault();
      openPanel(kind);
    });
  });
  const closeBtn = $("panelClose");
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  const panel = $("panel");
  if (panel) panel.addEventListener("click", (e) => {
    if (e.target === panel) closePanel();
  });
  const back = $("panelBack");
  if (back) back.addEventListener("click", goBackToSubjects);
  const titleBack = $("titleBack");
  if (titleBack) titleBack.addEventListener("click", goBackToSubjects);
  const subjPrev = $("subjPrev");
  const subjNext = $("subjNext");
  if (subjPrev) subjPrev.addEventListener("click", () => stepSubject(-1));
  if (subjNext) subjNext.addEventListener("click", () => stepSubject(1));
  const search = $("panelSearch");
  if (search) search.addEventListener("input", () => {
    listCursor = 0;
    renderPanel();
    const q = search.value.trim();
    debounceSearch(() => {
      const rows = displayedItems();
      trackSearch({
        query: q,
        filters: { file_type: resource },
        result_count: rows.length,
        latency_ms: 0,
        query_id: newQueryId(),
      });
    });
  });
  const prev = $("panelPrev");
  const next = $("panelNext");
  const left = $("panelLeft");
  const right = $("panelRight");
  if (prev) prev.addEventListener("click", () => stepList(-1));
  if (next) next.addEventListener("click", () => stepList(1));
  if (left) left.addEventListener("click", () => stepList(-1));
  if (right) right.addEventListener("click", () => stepList(1));
  const listUp = $("listUp");
  const listDown = $("listDown");
  if (listUp) listUp.addEventListener("click", () => pageList(-1));
  if (listDown) listDown.addEventListener("click", () => pageList(1));

  const act = (verb) => {
    if (!activeSubject) {
      const items = visibleSubjects();
      const current = items[listCursor];
      if (current) {
        activeSubject = current;
        listCursor = 0;
        slideToPhoto(current.photo);
        renderPanel();
        statusMessage(verb + ": " + current.name);
        return;
      }
      statusMessage("Choose a subject first");
      return;
    }
    const names = selectedNames();
    if (names.length === 0) {
      if (verb === "Download") track("download_abandoned", { file_type: resource });
      statusMessage("Select topics first");
      return;
    }
    statusMessage(verb + ": " + names.join(", "));
    if (verb === "Download") {
      trackDownload({
        subject_name: activeSubject.name,
        grade_level: activeSubject.level === "up" ? "Upper Primary" : activeSubject.level === "ss" ? "Senior School" : "Junior Secondary",
        document_type: resource,
        filename: names.join(", "),
      });
    } else if (verb === "Preview") {
      track("resource_preview_clicked", {
        subject_name: activeSubject.name,
        file_type: resource,
      });
    } else if (verb === "Share") {
      track("resource_share_clicked", {
        subject_name: activeSubject.name,
        file_type: resource,
      });
    }
  };
  const preview = $("actPreview");
  const download = $("actDownload");
  const share = $("actShare");
  if (preview) preview.addEventListener("click", () => act("Preview"));
  if (download) download.addEventListener("click", () => act("Download"));
  if (share) share.addEventListener("click", () => act("Share"));

  hydrateFromLocation();
  const kind = new URLSearchParams(location.search).get("resource");
  if (kind && RESOURCE_LABEL[kind]) openPanel(kind);
}
