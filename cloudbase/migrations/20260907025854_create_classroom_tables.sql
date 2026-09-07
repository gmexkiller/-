CREATE TABLE public.classroom_sessions (
  code varchar(6) PRIMARY KEY,
  teacher_token_hash char(64) NOT NULL,
  group_count smallint NOT NULL CHECK (group_count BETWEEN 4 AND 8),
  scene smallint NOT NULL DEFAULT 0 CHECK (scene BETWEEN 0 AND 8),
  answer_revealed boolean NOT NULL DEFAULT false,
  engineering_revealed boolean NOT NULL DEFAULT false,
  submissions_paused boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX classroom_sessions_expires_at_idx
  ON public.classroom_sessions (expires_at);

CREATE TABLE public.classroom_groups (
  session_code varchar(6) NOT NULL
    REFERENCES public.classroom_sessions (code) ON DELETE CASCADE,
  group_number smallint NOT NULL CHECK (group_number BETWEEN 1 AND 8),
  device_token_hash char(64),
  joined_at timestamptz,
  last_seen_at timestamptz,
  prediction text,
  measurements jsonb,
  conclusion varchar(120),
  route_type text,
  route_reason varchar(120),
  route_plan jsonb,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'submitted', 'needs_changes', 'locked')),
  PRIMARY KEY (session_code, group_number)
);

CREATE UNIQUE INDEX classroom_groups_device_token_idx
  ON public.classroom_groups (session_code, device_token_hash)
  WHERE device_token_hash IS NOT NULL;

REVOKE ALL ON public.classroom_sessions FROM anon, authenticated;
REVOKE ALL ON public.classroom_groups FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_groups TO service_role;

ALTER TABLE public.classroom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY classroom_sessions_server_access
  ON public.classroom_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY classroom_groups_server_access
  ON public.classroom_groups
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Rollback (manual):
-- DROP TABLE IF EXISTS public.classroom_groups CASCADE;
-- DROP TABLE IF EXISTS public.classroom_sessions CASCADE;
