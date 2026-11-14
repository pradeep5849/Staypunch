-- Forward-only foundation readiness; migrations 001-003 are deliberately unchanged.
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE sessions ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
CREATE INDEX sessions_user_expiry_idx ON sessions(user_id,expires_at);
ALTER TABLE email_outbox ADD COLUMN kind text NOT NULL DEFAULT 'account_notification'
 CHECK(kind IN ('verification','password_reset','staff_invitation','account_notification','booking_confirmation','reservation_cancellation'));
ALTER TABLE email_outbox ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5);
ALTER TABLE email_outbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE email_outbox ADD COLUMN provider_receipt text;
ALTER TABLE email_outbox ADD COLUMN last_error_code text;
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check CHECK(status IN ('queued','sent','failed','simulated'));
CREATE INDEX email_outbox_pending_idx ON email_outbox(next_attempt_at,created_at) WHERE status='queued';

-- Privileged lookups are not part of the Supabase Data API surface.
CREATE SCHEMA stay_private;
REVOKE ALL ON SCHEMA stay_private FROM PUBLIC;
ALTER FUNCTION public.is_platform_admin() SET SCHEMA stay_private;
ALTER FUNCTION public.has_property_access(uuid) SET SCHEMA stay_private;
ALTER FUNCTION public.accept_staff_invitation(text,uuid) SET SCHEMA stay_private;
CREATE OR REPLACE FUNCTION stay_private.accept_staff_invitation(secret_hash text,actor uuid)
RETURNS TABLE(property_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invitation public.staff_invitations; BEGIN
 IF actor IS DISTINCT FROM public.current_actor() THEN RETURN; END IF;
 SELECT i.* INTO invitation FROM public.staff_invitations i JOIN public.users u ON u.email=i.email
 WHERE i.token_hash=secret_hash AND u.id=actor AND u.status='active' AND i.accepted_at IS NULL AND i.expires_at>now()
 FOR UPDATE OF i;
 IF invitation.id IS NULL THEN RETURN; END IF;
 INSERT INTO public.memberships(property_id,user_id,role) VALUES(invitation.property_id,actor,invitation.role) ON CONFLICT DO NOTHING;
 UPDATE public.staff_invitations SET accepted_at=now() WHERE id=invitation.id;
 UPDATE public.users SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=actor;
 RETURN QUERY SELECT invitation.property_id;
END $$;
CREATE FUNCTION stay_private.has_organization_access(oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.properties p JOIN public.memberships m ON m.property_id=p.id
 WHERE p.organization_id=oid AND m.user_id=public.current_actor())
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stay_private FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_actor() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;

-- Server-only account/configuration data: never authorized by a client JWT.
-- The stay_app SQL credential is trusted backend infrastructure, not a customer identity.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','auth_identities','sessions','auth_tokens','roles','permissions','role_permissions','plans','feature_registry','feature_entitlements','leads','ota_providers','audit_logs','platform_settings','rate_limits','email_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY trusted_server ON public.%I FOR ALL USING (current_user = %L) WITH CHECK (current_user = %L)',t,'stay_app','stay_app');
 END LOOP;
END $$;
-- The separate mailer can read/process only the queue; grants further restrict columns.
CREATE POLICY mailer_queue ON email_outbox FOR ALL USING(current_user='stay_mailer') WITH CHECK(current_user='stay_mailer');
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_read ON organizations FOR SELECT USING(owner_id=public.current_actor() OR stay_private.is_platform_admin() OR stay_private.has_organization_access(id));
CREATE POLICY organization_insert ON organizations FOR INSERT WITH CHECK(owner_id=public.current_actor());
CREATE POLICY organization_update ON organizations FOR UPDATE USING(owner_id=public.current_actor() OR stay_private.is_platform_admin()) WITH CHECK(owner_id=public.current_actor() OR stay_private.is_platform_admin());
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON memberships FOR SELECT USING(user_id=public.current_actor() OR stay_private.has_property_access(property_id) OR stay_private.is_platform_admin());
-- Organization owners may see a newly created property before its first membership exists.
CREATE POLICY property_owner_read ON properties FOR SELECT USING(EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=organization_id AND o.owner_id=public.current_actor()));
CREATE POLICY membership_insert ON memberships FOR INSERT WITH CHECK(user_id=public.current_actor() AND role='owner' AND EXISTS(SELECT 1 FROM public.properties p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=property_id AND o.owner_id=public.current_actor()));
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_message_read ON ticket_messages FOR SELECT USING(stay_private.is_platform_admin() OR EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND stay_private.has_property_access(t.property_id)));
CREATE POLICY ticket_message_insert ON ticket_messages FOR INSERT WITH CHECK(user_id=public.current_actor() AND (stay_private.is_platform_admin() OR EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND stay_private.has_property_access(t.property_id))));

-- Revoke legacy hosted automatic grants only on StayPunch-owned objects.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','auth_identities','sessions','auth_tokens','roles','permissions','role_permissions','organizations','properties','memberships','room_types','rooms','amenities','plans','subscriptions','feature_registry','feature_entitlements','property_entitlements','leads','support_tickets','ticket_messages','ota_providers','integration_connections','audit_logs','platform_settings','staff_invitations','rate_limits','email_outbox','schema_migrations','auth_factors','auth_challenges','recovery_codes'] LOOP EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t); END LOOP;
END $$;
DO $$ DECLARE r text; t text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   FOREACH t IN ARRAY ARRAY['users','auth_identities','sessions','auth_tokens','roles','permissions','role_permissions','organizations','properties','memberships','room_types','rooms','amenities','plans','subscriptions','feature_registry','feature_entitlements','property_entitlements','leads','support_tickets','ticket_messages','ota_providers','integration_connections','audit_logs','platform_settings','staff_invitations','rate_limits','email_outbox','schema_migrations','auth_factors','auth_challenges','recovery_codes'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t,r);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
   END LOOP;
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',r);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',r);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',r);
   EXECUTE format('REVOKE ALL ON SEQUENCE public.audit_logs_id_seq FROM %I',r);
   EXECUTE format('REVOKE ALL ON SCHEMA stay_private FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA stay_private FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION public.current_actor() FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION public.touch_updated_at() FROM %I',r);
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON SEQUENCE audit_logs_id_seq FROM PUBLIC;
-- No new function created by this migration owner should inherit PUBLIC EXECUTE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA stay_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
