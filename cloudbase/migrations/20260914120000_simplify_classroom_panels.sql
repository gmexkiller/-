ALTER TABLE public.classroom_groups
  ADD COLUMN IF NOT EXISTS measurement_status text NOT NULL DEFAULT 'waiting'
    CHECK (measurement_status IN ('waiting', 'submitted', 'needs_changes', 'locked')),
  ADD COLUMN IF NOT EXISTS route_status text NOT NULL DEFAULT 'waiting'
    CHECK (route_status IN ('waiting', 'submitted', 'needs_changes', 'locked'));

UPDATE public.classroom_groups
SET measurement_status = CASE
      WHEN measurements IS NOT NULL THEN status
      ELSE 'waiting'
    END,
    route_status = CASE
      WHEN route_plan IS NOT NULL OR route_type IS NOT NULL THEN status
      ELSE 'waiting'
    END;

-- Rollback (manual):
-- ALTER TABLE public.classroom_groups DROP COLUMN IF EXISTS measurement_status;
-- ALTER TABLE public.classroom_groups DROP COLUMN IF EXISTS route_status;
