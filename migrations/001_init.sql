CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  supplier_ids JSONB NOT NULL DEFAULT '[]',
  allowed_services JSONB NOT NULL DEFAULT '[]',
  preferred_lookup_protocol TEXT NOT NULL DEFAULT 'x402',
  budget_asset TEXT NOT NULL,
  budget_atomic BIGINT NOT NULL,
  budget_decimals INTEGER NOT NULL,
  budget_scope TEXT NOT NULL,
  fee_policy_id TEXT NOT NULL,
  network_fee_allowance_atomic BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  capability TEXT NOT NULL,
  description TEXT NOT NULL,
  input_schema JSONB NOT NULL,
  output_schema JSONB NOT NULL,
  payment_profiles JSONB NOT NULL,
  advertised_terms JSONB NOT NULL,
  terms_updated_at TIMESTAMPTZ NOT NULL,
  data_provenance TEXT NOT NULL,
  usage_restrictions TEXT NOT NULL,
  expected_result_format TEXT NOT NULL,
  availability JSONB
);

CREATE TABLE IF NOT EXISTS invocations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES research_tasks(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  operation_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  invocation_state TEXT NOT NULL,
  delivery_state TEXT NOT NULL,
  result_reference TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reconciled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  invocation_id TEXT NOT NULL REFERENCES invocations(id),
  protocol TEXT NOT NULL,
  profile_version TEXT NOT NULL,
  challenge_reference TEXT,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  authorization_state TEXT NOT NULL,
  settlement_state TEXT NOT NULL,
  settlement_kind TEXT NOT NULL,
  receipt_reference TEXT,
  transaction_reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metered_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES research_tasks(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  native_session_id TEXT NOT NULL UNIQUE,
  funded_atomic BIGINT NOT NULL,
  authorized_usage_atomic BIGINT NOT NULL DEFAULT 0,
  settled_atomic BIGINT NOT NULL DEFAULT 0,
  usage_sequence INTEGER NOT NULL DEFAULT 0,
  close_state TEXT NOT NULL,
  unused_funds_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_journal (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES research_tasks(id),
  entry_type TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  operation_ref TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES metered_sessions(id),
  sequence INTEGER NOT NULL,
  units INTEGER NOT NULL,
  amount_atomic BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, id),
  UNIQUE (session_id, sequence)
);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  invocation_id TEXT NOT NULL UNIQUE REFERENCES invocations(id),
  payload JSONB NOT NULL,
  schema_version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_events (
  id TEXT PRIMARY KEY,
  invocation_id TEXT REFERENCES invocations(id),
  session_id TEXT REFERENCES metered_sessions(id),
  protocol TEXT NOT NULL,
  stage TEXT NOT NULL,
  redacted_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  task_id TEXT PRIMARY KEY REFERENCES research_tasks(id),
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invocations_task_idx ON invocations(task_id);
CREATE INDEX IF NOT EXISTS payment_attempts_invocation_idx ON payment_attempts(invocation_id);
CREATE INDEX IF NOT EXISTS budget_journal_task_idx ON budget_journal(task_id);
CREATE INDEX IF NOT EXISTS protocol_events_invocation_idx ON protocol_events(invocation_id);
