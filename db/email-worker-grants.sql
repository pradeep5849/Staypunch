-- Provision stay_mailer as a separate NOSUPERUSER NOBYPASSRLS login; never use migration-owner credentials.
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO stay_mailer',current_database()); END $$;
GRANT USAGE ON SCHEMA public TO stay_mailer;
GRANT SELECT(id,recipient,subject,body,kind,attempts,status,next_attempt_at,created_at,last_attempt_at) ON email_outbox TO stay_mailer;
GRANT UPDATE(status,attempts,next_attempt_at,last_attempt_at,provider_receipt,last_error_code,body) ON email_outbox TO stay_mailer;
