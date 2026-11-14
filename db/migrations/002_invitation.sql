-- Token redemption is narrow and atomic; invitations remain hidden from nonmembers.
CREATE FUNCTION accept_staff_invitation(secret_hash text,actor uuid) RETURNS TABLE(property_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invitation staff_invitations; BEGIN
 IF actor IS DISTINCT FROM current_actor() THEN RETURN; END IF;
 SELECT i.* INTO invitation FROM staff_invitations i JOIN users u ON u.email=i.email WHERE i.token_hash=secret_hash AND u.id=actor AND u.status='active' AND i.accepted_at IS NULL AND i.expires_at>now() FOR UPDATE OF i;
 IF invitation.id IS NULL THEN RETURN; END IF;
 INSERT INTO memberships(property_id,user_id,role) VALUES(invitation.property_id,actor,invitation.role) ON CONFLICT DO NOTHING;
 UPDATE staff_invitations SET accepted_at=now() WHERE id=invitation.id;
 RETURN QUERY SELECT invitation.property_id;
END $$;
