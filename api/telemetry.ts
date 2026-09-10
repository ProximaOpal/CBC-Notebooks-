/**
 * POST /api/telemetry — production handler (TypeScript).
 * Additive: the Node JSONL logger in scripts/dev-server.mjs remains in place.
 * Zero PII. Inserts into telemetry_events asynchronously.
 */

export type TelemetryRecord = {
  event: string;
  session_id?: string;
  user_id?: string;
  user_persona?: string;
  grade_level?: string | null;
  subject_name?: string | null;
  file_type?: string | null;
  query?: string | null;
  query_id?: string | null;
  result_count?: number | null;
  latency_ms?: number | null;
  zero_results?: boolean | null;
  position?: number | null;
  document_type?: string | null;
  filename?: string | null;
  term_number?: number | null;
  marking_scheme_accessed?: boolean | null;
  video_title?: string | null;
  progress?: number | null;
  timestamp_s?: number | null;
  rewatch_count?: number | null;
  experiment_name?: string | null;
  model_id?: string | null;
  step_completed?: number | null;
  simulation_reset_count?: number | null;
  completion_time_seconds?: number | null;
  success_rate?: number | null;
  path_url?: string | null;
  device_type?: string | null;
  timestamp?: string;
  [key: string]: unknown;
};

const PII_KEYS = new Set([
  "email",
  "name",
  "firstname",
  "lastname",
  "phone",
  "mobile",
  "msisdn",
  "nationalid",
  "idnumber",
  "address",
  "password",
  "token",
  "ip",
  "ipaddress",
  "clientip",
  "xforwardedfor",
  "useragent",
  "cookie",
]);

export function stripPii(input: TelemetryRecord): TelemetryRecord {
  const clean: TelemetryRecord = { event: String(input.event || "unknown") };
  Object.entries(input).forEach(([key, value]) => {
    if (PII_KEYS.has(key.toLowerCase())) return;
    clean[key] = value;
  });
  return clean;
}

export const INSERT_TELEMETRY_SQL = `
INSERT INTO telemetry_events (
  event, session_id, user_id, user_persona, grade_level, subject_name,
  file_type, query, query_id, result_count, latency_ms, zero_results,
  position, document_type, filename, term, video_title, progress,
  timestamp_s, experiment_name, model_id, step_completed, path_url,
  device_type, timestamp
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
)
`;

export type SqlClient = {
  query: (sql: string, params: unknown[]) => Promise<unknown>;
};

export async function logTelemetry(db: SqlClient, raw: TelemetryRecord): Promise<void> {
  const e = stripPii(raw);
  await db.query(INSERT_TELEMETRY_SQL, [
    e.event,
    e.session_id || "anon",
    e.user_id || "anon",
    e.user_persona || "unknown",
    e.grade_level || null,
    e.subject_name || null,
    e.file_type || null,
    e.query || null,
    e.query_id || null,
    e.result_count ?? null,
    e.latency_ms ?? null,
    e.zero_results ?? null,
    e.position ?? null,
    e.document_type || null,
    e.filename || null,
    e.term_number ?? null,
    e.video_title || null,
    e.progress ?? null,
    e.timestamp_s ?? e.completion_time_seconds ?? null,
    e.experiment_name || null,
    e.model_id || null,
    e.step_completed ?? null,
    e.path_url || null,
    e.device_type || null,
    e.timestamp || new Date().toISOString(),
  ]);
}

/** Next.js / Express-style route handler */
export async function telemetryRouteHandler(
  req: { method?: string; body?: TelemetryRecord },
  res: {
    status: (code: number) => { json: (body: unknown) => unknown; end: () => unknown };
    json: (body: unknown) => unknown;
  },
  db: SqlClient
): Promise<void> {
  if (req.method && req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const payload = stripPii(req.body || { event: "unknown" });
  if (payload.zero_results) {
    payload.alert = "missing_content";
  }
  setImmediate(() => {
    logTelemetry(db, payload).catch(() => undefined);
  });
  res.status(204).end();
}

export default telemetryRouteHandler;
