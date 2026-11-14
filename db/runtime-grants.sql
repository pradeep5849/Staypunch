-- Run as migration owner after creating stay_app with an operator-provided password.
-- The app role must not own tables, be superuser, or possess BYPASSRLS.
GRANT CONNECT ON DATABASE staypunch TO stay_app;
GRANT USAGE ON SCHEMA public TO stay_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO stay_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO stay_app;
REVOKE ALL ON schema_migrations FROM stay_app;
REVOKE UPDATE ON users FROM stay_app;
GRANT UPDATE(password_hash,status,updated_at) ON users TO stay_app;
REVOKE UPDATE,DELETE ON audit_logs FROM stay_app;
REVOKE UPDATE,DELETE ON ota_providers FROM stay_app;
REVOKE ALL ON email_outbox FROM stay_app;
GRANT INSERT ON email_outbox TO stay_app;
REVOKE ALL ON FUNCTION accept_staff_invitation(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_staff_invitation(text,uuid) TO stay_app;

REVOKE ALL ON auth_factors,auth_challenges,recovery_codes FROM stay_app;
