/**
 * CBC Notebooks telemetry client.
 * Non-blocking, no PII. Events use object_action snake_case.
 */

const ENDPOINT = "/api/telemetry";
const DEBOUNCE_MS = 500;
const QUEUE_KEY = "cbc_telemetry_queue";
const SESSION_KEY = "cbc_session_id";
const ANON_KEY = "cbc_anon_id";
const PERSONA_KEY = "cbc_persona";
const MAX_QUEUE = 200;

const PERSONAS = new Set(["parent", "teacher", "student", "professor", "unknown"]);

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function deviceType() {
  const w = window.innerWidth;
  if (w < 760) return "phone";
  if (w < 1100) return "tablet";
  return "laptop";
}

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function anonId() {
  let id = read(ANON_KEY, "");
  if (!id) {
    id = uuid();
    write(ANON_KEY, id);
  }
  return id;
}

const PII = /email|e-mail|phone|mobile|name|password|token|address/i;

function scrub(value) {
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((key) => {
      if (PII.test(key)) return;
      out[key] = scrub(value[key]);
    });
    return out;
  }
  return value;
}

function loadQueue() {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    /* ignore */
  }
}

function send(payload) {
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(ENDPOINT, blob);
    if (ok) return;
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    const q = loadQueue();
    q.push(payload);
    saveQueue(q);
  });
}

function baseContext() {
  return {
    session_id: sessionId(),
    user_id: anonId(),
    user_persona: read(PERSONA_KEY, "unknown"),
    grade_level: null,
    subject_name: null,
    timestamp: new Date().toISOString(),
    path_url: location.pathname + location.search,
    device_type: deviceType(),
  };
}

/**
 * @param {string} event object_action snake_case
 * @param {Record<string, unknown>} [props]
 */
export function track(event, props = {}) {
  const payload = scrub({
    event,
    ...baseContext(),
    ...props,
  });
  queueMicrotask(() => send(payload));
}

export function setPersona(persona) {
  const value = PERSONAS.has(persona) ? persona : "unknown";
  write(PERSONA_KEY, value);
  track("persona_set", { user_persona: value });
}

export function trackSearch({
  query,
  filters = {},
  result_count = 0,
  latency_ms = 0,
  query_id,
}) {
  track("search_performed", {
    query: String(query || "").slice(0, 200),
    query_id,
    result_count,
    latency_ms,
    grade_level: filters.grade_level || null,
    subject_name: filters.subject_name || null,
    file_type: filters.file_type || null,
    zero_results: result_count === 0,
  });
  if (result_count === 0) {
    track("search_zero_results", {
      query: String(query || "").slice(0, 200),
      query_id,
      grade_level: filters.grade_level || null,
    });
  }
}

export function trackSearchResultClicked({ query_id, position, subject_name, grade_level }) {
  track("search_result_clicked", { query_id, position, subject_name, grade_level });
}

export function trackDownload({
  grade_level,
  subject_name,
  term,
  document_type,
  filename,
}) {
  track("exam_download_clicked", {
    grade_level: grade_level || null,
    subject_name: subject_name || null,
    term: term || null,
    document_type: document_type || "notes",
    filename: filename || null,
  });
}

export function trackVideo({ video_title, action, progress, timestamp_s }) {
  const event = action === "progress"
    ? `video_progress_${progress}`
    : `video_${action}`;
  track(event, {
    video_title,
    progress: progress ?? null,
    timestamp_s: timestamp_s ?? null,
  });
}

export function trackGallery({ category, image_id, action }) {
  track(`gallery_${action}`, { category, image_id });
}

export function trackLab({ model_id, grade_level, action, extra = {} }) {
  track(`lab_${action}`, { model_id, grade_level, ...extra });
}

export function trackExperimentStep({
  experiment_name,
  step_completed,
  simulation_reset_count,
  success_rate,
}) {
  track("lab_simulation_started", {
    experiment_name,
    step_completed,
    simulation_reset_count,
    success_rate,
  });
}

export function trackResourceOpened(resource) {
  track("resource_opened", { file_type: resource });
}

let searchTimer;
export function debounceSearch(fn) {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(fn, DEBOUNCE_MS);
}

let lastClick = { t: 0, el: null, n: 0 };
export function initFrictionTracking() {
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const now = Date.now();
    if (el && lastClick.el === el && now - lastClick.t < 800) {
      lastClick.n += 1;
      if (lastClick.n >= 3) {
        track("rage_click", { path_url: location.pathname });
        lastClick.n = 0;
      }
    } else {
      lastClick = { t: now, el, n: 1 };
    }
  }, true);

  window.addEventListener("pagehide", () => track("session_ended"));
}

export function newQueryId() {
  return uuid();
}
