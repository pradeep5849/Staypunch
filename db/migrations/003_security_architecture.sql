-- Reserved for a future audited MFA implementation; no enrollment or verification API exists.
CREATE TABLE auth_factors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,type text NOT NULL CHECK(type='totp'),encrypted_secret bytea NOT NULL,key_version text NOT NULL,verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX auth_factors_user_idx ON auth_factors(user_id);
CREATE TABLE auth_challenges(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,factor_id uuid NOT NULL REFERENCES auth_factors(id) ON DELETE CASCADE,attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),expires_at timestamptz NOT NULL);
CREATE INDEX auth_challenges_user_idx ON auth_challenges(user_id);
CREATE TABLE recovery_codes(user_id uuid REFERENCES users(id) ON DELETE CASCADE,code_hash text NOT NULL,used_at timestamptz,PRIMARY KEY(user_id,code_hash));
REVOKE ALL ON auth_factors,auth_challenges,recovery_codes FROM PUBLIC;
