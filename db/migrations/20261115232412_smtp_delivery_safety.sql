-- Additive worker-only state. Existing queue rows and account tokens are preserved.
-- Apply before approving/enabling the new mailer; the web enqueue path is unchanged.
ALTER TABLE public.email_outbox ADD COLUMN last_attempt_at timestamptz;
CREATE INDEX email_outbox_attempt_window_idx ON public.email_outbox(last_attempt_at) WHERE last_attempt_at IS NOT NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='stay_mailer') THEN
    GRANT SELECT(kind,last_attempt_at) ON public.email_outbox TO stay_mailer;
    GRANT UPDATE(last_attempt_at) ON public.email_outbox TO stay_mailer;
  END IF;
END $$;
