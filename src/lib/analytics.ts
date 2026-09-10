/**
 * CBC Notebooks analytics client (TypeScript).
 * Additive to assets/js/lib/telemetry.js — do not delete the JS client.
 * Non-blocking, zero PII, object_action snake_case events.
 */

export type UserPersona = "parent" | "teacher" | "student" | "professor" | "unknown";
export type FileType = "notes" | "exams" | "videos" | "gallery" | "experiments" | "audiobooks" | "immersive" | "labs_3d";
export type DeviceType = "phone" | "tablet" | "laptop";

export interface TelemetryBase {
  session_id: string;
  user_id: string;
  user_persona: UserPersona;
  grade_level: string | null;
  subject_name: string | null;
  timestamp: string;
  path_url: string;
  device_type: DeviceType;
}

export interface SearchFilters {
  grade_level?: string | null;
  subject_name?: string | null;
  file_type?: FileType | string | null;
}

export interface SearchPerformed extends TelemetryBase {
  event: "search_performed";
  query: string;
  query_id: string;
  result_count: number;
  latency_ms: number;
  file_type: string | null;
  zero_results: boolean;
}

export interface SearchZeroResults extends TelemetryBase {
  event: "search_zero_results";
  query: string;
  query_id: string;
}

export interface SearchResultClicked extends TelemetryBase {
  event: "search_result_clicked";
  query_id: string;
  position: number;
}

export interface ExamDownload extends TelemetryBase {
  event: "exam_download";
  term_number: number | null;
  document_type: string;
  filename: string | null;
  marking_scheme_accessed: boolean;
}

export interface NotesDownload extends TelemetryBase {
  event: "notes_download";
  term_number: number | null;
  filename: string | null;
}

export interface VideoEngagement extends TelemetryBase {
  event:
    | "video_play"
    | "video_pause"
    | "video_completed"
    | "video_heatmap_tick"
    | "video_progress_25"
    | "video_progress_50"
    | "video_progress_75";
  video_title: string;
  timestamp_s: number | null;
  progress: number | null;
  rewatch_count: number | null;
}

export interface LabEvent extends TelemetryBase {
  event:
    | "experiment_started"
    | "step_completed"
    | "simulation_reset"
    | "lab_simulation_started";
  experiment_name: string;
  model_id: string | null;
  step_completed: number | null;
  simulation_reset_count: number | null;
  completion_time_seconds: number | null;
  success_rate: number | null;
}

export type TelemetryEvent =
  | SearchPerformed
  | SearchZeroResults
  | SearchResultClicked
  | ExamDownload
  | NotesDownload
  | VideoEngagement
  | LabEvent
  | (TelemetryBase & { event: string; [key: string]: unknown });

const ENDPOINT = "/api/telemetry";
const DEBOUNCE_MS = 500;
const SESSION_KEY = "cbc_session_id";
const ANON_KEY = "cbc_anon_id";
const PERSONA_KEY = "cbc_persona";
const PII = /email|e-mail|phone|mobile|password|token|address|^name$/i;

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function deviceType(): DeviceType {
  if (typeof window === "undefined") return "laptop";
  const w = window.innerWidth;
  if (w < 760) return "phone";
  if (w < 1100) return "tablet";
  return "laptop";
}

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function sessionId(): string {
  if (typeof sessionStorage === "undefined") return uuid();
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function anonId(): string {
  let id = read(ANON_KEY, "");
  if (!id) {
    id = uuid();
    write(ANON_KEY, id);
  }
  return id;
}

function scrub<T>(value: T): T {
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (PII.test(key)) return;
      out[key] = scrub(val);
    });
    return out as T;
  }
  return value;
}

function baseContext(): TelemetryBase {
  const path =
    typeof location === "undefined" ? "/" : location.pathname + location.search;
  return {
    session_id: sessionId(),
    user_id: anonId(),
    user_persona: (read(PERSONA_KEY, "unknown") as UserPersona) || "unknown",
    grade_level: null,
    subject_name: null,
    timestamp: new Date().toISOString(),
    path_url: path,
    device_type: deviceType(),
  };
}

function post(payload: TelemetryEvent): void {
  const body = JSON.stringify(payload);
  const run = (): void => {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    if (typeof fetch === "undefined") return;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  };
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else setTimeout(run, 0);
}

export function track(event: string, props: Record<string, unknown> = {}): void {
  post(scrub({ event, ...baseContext(), ...props }) as TelemetryEvent);
}

export function setPersona(persona: UserPersona): void {
  write(PERSONA_KEY, persona);
  track("persona_set", { user_persona: persona });
}

export function inferPersona(meta: {
  onboarding_path?: string;
  referrer?: string;
  query?: string;
}): UserPersona {
  const blob = `${meta.onboarding_path || ""} ${meta.referrer || ""} ${meta.query || ""}`.toLowerCase();
  if (/teacher|scheme of work|rubric|lesson plan|kicd design/.test(blob)) return "teacher";
  if (/parent|child|result portal|combination 2026/.test(blob)) return "parent";
  if (/kuccps|formative assessment framework|professor|research/.test(blob)) return "professor";
  if (/grade [4-9]|past exam|notes pdf|virtual lab/.test(blob)) return "student";
  return "unknown";
}

export function newQueryId(): string {
  return uuid();
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
export function debounceSearch(fn: () => void, ms = DEBOUNCE_MS): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(fn, ms);
}

export function trackSearch(args: {
  query: string;
  filters?: SearchFilters;
  result_count: number;
  latency_ms: number;
  query_id?: string;
}): void {
  const query_id = args.query_id || uuid();
  const filters = args.filters || {};
  track("search_performed", {
    query: String(args.query || "").slice(0, 200),
    query_id,
    result_count: args.result_count,
    latency_ms: args.latency_ms,
    grade_level: filters.grade_level || null,
    subject_name: filters.subject_name || null,
    file_type: filters.file_type || null,
    zero_results: args.result_count === 0,
  });
  if (args.result_count === 0) {
    track("search_zero_results", {
      query: String(args.query || "").slice(0, 200),
      query_id,
      grade_level: filters.grade_level || null,
      alert: "missing_content",
    });
  }
}

export function trackSearchResultClicked(args: {
  query_id: string;
  position: number;
  subject_name?: string;
  grade_level?: string;
}): void {
  track("search_result_clicked", args);
}

export function trackExamDownload(args: {
  grade_level?: string;
  subject_name?: string;
  term_number?: number;
  filename?: string;
  marking_scheme_accessed?: boolean;
}): void {
  track("exam_download", {
    grade_level: args.grade_level || null,
    subject_name: args.subject_name || null,
    term_number: args.term_number ?? null,
    document_type: "exams",
    filename: args.filename || null,
    marking_scheme_accessed: Boolean(args.marking_scheme_accessed),
  });
}

export function trackNotesDownload(args: {
  grade_level?: string;
  subject_name?: string;
  term_number?: number;
  filename?: string;
}): void {
  track("notes_download", {
    grade_level: args.grade_level || null,
    subject_name: args.subject_name || null,
    term_number: args.term_number ?? null,
    filename: args.filename || null,
  });
}

export function trackVideo(args: {
  video_title: string;
  action: "play" | "pause" | "completed" | "heatmap_tick";
  timestamp_s?: number;
  progress?: number;
  rewatch_count?: number;
}): void {
  const event =
    args.action === "heatmap_tick"
      ? "video_heatmap_tick"
      : args.progress === 25 || args.progress === 50 || args.progress === 75
        ? `video_progress_${args.progress}`
        : `video_${args.action}`;
  track(event, {
    video_title: args.video_title,
    timestamp_s: args.timestamp_s ?? null,
    progress: args.progress ?? null,
    rewatch_count: args.rewatch_count ?? null,
  });
}

export function trackExperimentStarted(args: {
  experiment_name: string;
  model_id?: string;
  grade_level?: string;
}): void {
  track("experiment_started", {
    experiment_name: args.experiment_name,
    model_id: args.model_id || null,
    grade_level: args.grade_level || null,
  });
}

export function trackExperimentStep(args: {
  experiment_name: string;
  step_completed: number;
  simulation_reset_count?: number;
  success_rate?: number;
}): void {
  track("step_completed", {
    experiment_name: args.experiment_name,
    step_completed: args.step_completed,
    simulation_reset_count: args.simulation_reset_count ?? 0,
    success_rate: args.success_rate ?? null,
  });
}

export function trackSimulationReset(args: {
  experiment_name: string;
  simulation_reset_count: number;
}): void {
  track("simulation_reset", args);
}

export function trackLabCompletion(args: {
  experiment_name: string;
  completion_time_seconds: number;
  success_rate?: number;
}): void {
  track("lab_simulation_started", {
    experiment_name: args.experiment_name,
    completion_time_seconds: args.completion_time_seconds,
    success_rate: args.success_rate ?? null,
  });
}

export function bindHtml5Video(el: HTMLVideoElement, video_title: string): void {
  const heat = new Map<number, number>();
  el.addEventListener("play", () => trackVideo({ video_title, action: "play", timestamp_s: el.currentTime }));
  el.addEventListener("pause", () => trackVideo({ video_title, action: "pause", timestamp_s: el.currentTime }));
  el.addEventListener("ended", () => trackVideo({ video_title, action: "completed", progress: 100, timestamp_s: el.duration }));
  el.addEventListener("timeupdate", () => {
    const bucket = Math.floor(el.currentTime);
    const prev = heat.get(bucket) || 0;
    heat.set(bucket, prev + 1);
    if (prev === 1) {
      trackVideo({
        video_title,
        action: "heatmap_tick",
        timestamp_s: bucket,
        rewatch_count: prev + 1,
      });
    }
  });
}
