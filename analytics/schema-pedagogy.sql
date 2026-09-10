-- Additive pedagogy columns for CBC telemetry (do not drop existing tables)
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS term_number INTEGER;
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS marking_scheme_accessed BOOLEAN;
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS rewatch_count INTEGER;
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS simulation_reset_count INTEGER;
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS completion_time_seconds INTEGER;
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS success_rate NUMERIC(6, 3);
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS alert TEXT;
