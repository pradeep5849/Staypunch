-- Run after migrations as owner. Provision stay_app separately with an operator-generated secret.
-- This server login must be NOSUPERUSER NOBYPASSRLS and must not own application objects.
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO stay_app',current_database()); END $$;
REVOKE ALL ON SCHEMA stay_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stay_private FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_actor(),public.touch_updated_at() FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA stay_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT USAGE ON SCHEMA public,stay_private TO stay_app;
-- Clear legacy application grants, including future-table catch-all privileges.
DO $$ DECLARE t text; r text; BEGIN FOREACH t IN ARRAY ARRAY['users','auth_identities','sessions','auth_tokens','roles','permissions','role_permissions','organizations','properties','memberships','room_types','rooms','amenities','plans','subscriptions','feature_registry','feature_entitlements','property_entitlements','leads','support_tickets','ticket_messages','ota_providers','integration_connections','audit_logs','platform_settings','staff_invitations','rate_limits','email_outbox','schema_migrations','auth_factors','auth_challenges','recovery_codes'] LOOP
 EXECUTE format('REVOKE ALL ON public.%I FROM stay_app',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r);
 END LOOP;
 END LOOP;
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
  EXECUTE format('REVOKE ALL ON SEQUENCE public.audit_logs_id_seq FROM %I',r);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stay_private FROM %I',r);
  EXECUTE format('REVOKE ALL ON SCHEMA stay_private FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION public.current_actor(),public.touch_updated_at() FROM %I',r);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',r);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',r);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',r);
 END LOOP;
END $$;
GRANT SELECT ON users,auth_identities,sessions,auth_tokens,roles,permissions,role_permissions,organizations,properties,memberships,room_types,rooms,amenities,plans,subscriptions,feature_registry,feature_entitlements,property_entitlements,leads,support_tickets,ticket_messages,ota_providers,integration_connections,audit_logs,platform_settings,staff_invitations,rate_limits TO stay_app;
GRANT INSERT(id,email,name,password_hash) ON users TO stay_app;
GRANT UPDATE(password_hash,status,email_verified_at,updated_at) ON users TO stay_app;
GRANT INSERT ON auth_identities,sessions,auth_tokens,organizations,properties,memberships,room_types,amenities,subscriptions,feature_entitlements,property_entitlements,leads,support_tickets,ticket_messages,staff_invitations,rate_limits,audit_logs TO stay_app;
GRANT UPDATE ON properties,plans,subscriptions,feature_registry,feature_entitlements,property_entitlements,leads,support_tickets,platform_settings,rate_limits TO stay_app;
GRANT INSERT ON plans TO stay_app;
GRANT DELETE ON sessions,auth_tokens,amenities TO stay_app;
GRANT INSERT(recipient,subject,body,kind) ON email_outbox TO stay_app;
REVOKE ALL ON SEQUENCE audit_logs_id_seq FROM PUBLIC;
GRANT USAGE,SELECT ON SEQUENCE audit_logs_id_seq TO stay_app;
GRANT EXECUTE ON FUNCTION public.current_actor(),stay_private.is_platform_admin(),stay_private.has_property_access(uuid),stay_private.has_organization_access(uuid),stay_private.accept_staff_invitation(text,uuid) TO stay_app;
