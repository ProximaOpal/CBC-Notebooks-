-- CBC Notebooks telemetry (no PII)
CREATE TABLE IF NOT EXISTS telemetry_events (
  id              BIGSERIAL PRIMARY KEY,
  event           TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  user_persona    TEXT,
  grade_level     TEXT,
  subject_name    TEXT,
  file_type       TEXT,
  query           TEXT,
  query_id        TEXT,
  result_count    INTEGER,
  latency_ms      INTEGER,
  zero_results    BOOLEAN,
  position        INTEGER,
  document_type   TEXT,
  filename        TEXT,
  term            TEXT,
  video_title     TEXT,
  progress        INTEGER,
  timestamp_s     INTEGER,
  experiment_name TEXT,
  model_id        TEXT,
  step_completed  INTEGER,
  path_url        TEXT,
  device_type     TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telemetry_events_event_idx ON telemetry_events (event, timestamp DESC);
CREATE INDEX IF NOT EXISTS telemetry_events_query_idx ON telemetry_events (query);

-- 1. Top 10 search terms by grade
CREATE OR REPLACE VIEW top_search_terms_by_grade AS
SELECT grade_level, query, COUNT(*) AS searches
FROM telemetry_events
WHERE event = 'search_performed' AND query IS NOT NULL AND query <> ''
GROUP BY grade_level, query
ORDER BY searches DESC
LIMIT 10;

-- 2. Downloads vs missing-content searches
CREATE OR REPLACE VIEW downloads_vs_missing_searches AS
SELECT
  COALESCE(subject_name, 'unknown') AS subject_name,
  SUM(CASE WHEN event = 'exam_download_clicked' THEN 1 ELSE 0 END) AS downloads,
  SUM(CASE WHEN event = 'search_zero_results' THEN 1 ELSE 0 END) AS missing_searches
FROM telemetry_events
GROUP BY 1
ORDER BY missing_searches DESC, downloads DESC;

-- 3. Average time in 3D / lab experiments
CREATE OR REPLACE VIEW avg_lab_duration AS
SELECT
  COALESCE(experiment_name, model_id, 'unknown') AS experiment,
  AVG(timestamp_s)::NUMERIC(10, 2) AS avg_seconds_interacting,
  COUNT(*) AS sessions
FROM telemetry_events
WHERE event IN ('lab_closed', 'lab_simulation_started', 'lab_time_spent')
GROUP BY 1
ORDER BY avg_seconds_interacting DESC;
