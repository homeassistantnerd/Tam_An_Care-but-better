-- Schema parity with Production Test for fresh installations.
-- These objects already exist on Production Test but their DDL was never committed:
--   * finance_entries: column contract from docs/finance/production-schema-20261009-readonly-baseline.md
--   * staff_actors_role_check: canonical roles from api/src/security/actor-roles.ts (verified 2026-10-16)
--   * notifications, push_subscriptions: DDL from NotificationsService, which only verifies them in production
--   * year-only birth dates, staff contact fields and psychological_assessments: reconstructed from the
--     SQL in admission/resident/staff-actor/behavioral-cognitive services (Production Test baseline 63f9248)
-- On Production Test this is expected to be a no-op; if existing rows use a role outside
-- the canonical list, ADD CONSTRAINT fails and the whole transaction rolls back.
BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_entries (
  finance_entry_id text PRIMARY KEY,
  entry_type text NOT NULL,
  category text,
  description text,
  amount_vnd numeric(18,2) NOT NULL,
  recognition_date date NOT NULL,
  cash_date date,
  resident_id text,
  source_mode text,
  source_domain text,
  source_entity_type text,
  source_entity_id text,
  status text NOT NULL,
  reference_number text,
  note text,
  created_by text,
  created_by_role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_entries_system_source
  ON public.finance_entries(source_domain, source_entity_type, source_entity_id, entry_type)
  WHERE source_mode = 'SYSTEM' AND source_domain IS NOT NULL
    AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id TEXT PRIMARY KEY,
  staff_actor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SHIFT_ASSIGNMENT',
  sound TEXT NOT NULL DEFAULT 'ALERT_CHIME',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  staff_actor_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_staff ON public.notifications(staff_actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_sub_staff ON public.push_subscriptions(staff_actor_id);

-- Year-only birth dates store birth_year with a NULL date_of_birth (AdmissionService.normalizeBirthValue).
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS birth_date_precision text,
  ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE public.admission_cases
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS birth_date_precision text,
  ALTER COLUMN date_of_birth DROP NOT NULL;

ALTER TABLE public.staff_actors
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE IF NOT EXISTS public.psychological_assessments (
  psychological_assessment_id text PRIMARY KEY,
  resident_id text NOT NULL REFERENCES public.residents(resident_id),
  assessment_date date NOT NULL,
  period text,
  period_label text,
  emotional_state text,
  emotional_notes text,
  social_communication text,
  social_notes text,
  cognitive_memory text,
  sleep_quality text,
  overall_conclusion text,
  care_recommendations text,
  evaluator_id text NOT NULL,
  evaluator_name text,
  evaluator_role text NOT NULL,
  evaluator_role_label text,
  shared_with_family_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psychological_assessments_resident
  ON public.psychological_assessments(resident_id, assessment_date DESC);

ALTER TABLE public.staff_actors DROP CONSTRAINT IF EXISTS staff_actors_role_check;
ALTER TABLE public.staff_actors ADD CONSTRAINT staff_actors_role_check CHECK (
  primary_operational_role IN (
    'ADMIN', 'SUPERVISOR', 'CARE_MANAGER', 'MEDICAL_HEAD', 'NURSE', 'CAREGIVER',
    'NUTRITIONIST', 'ACCOUNTANT', 'RECEPTIONIST', 'PSYCHOLOGIST', 'SOCIAL_WORKER',
    'REHABILITATION_SPECIALIST', 'COMMUNICATIONS', 'HOUSEKEEPING', 'SECURITY', 'GUARDIAN'
  )
);

-- Every canonical staff role must be able to hold a session (login inserts actor_role).
ALTER TABLE public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_role_check;
ALTER TABLE public.auth_sessions ADD CONSTRAINT auth_sessions_role_check CHECK (
  actor_role IN (
    'ADMIN', 'SUPERVISOR', 'CARE_MANAGER', 'MEDICAL_HEAD', 'NURSE', 'CAREGIVER',
    'NUTRITIONIST', 'ACCOUNTANT', 'RECEPTIONIST', 'PSYCHOLOGIST', 'SOCIAL_WORKER',
    'REHABILITATION_SPECIALIST', 'COMMUNICATIONS', 'HOUSEKEEPING', 'SECURITY', 'GUARDIAN'
  )
);

COMMIT;
