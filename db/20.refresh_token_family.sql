-- Refresh-token family table: tracks each refresh JWT issued so the api
-- can detect refresh-token reuse and revoke the whole family when it
-- happens. A "family" is the chain of rotated refresh tokens belonging
-- to one login session.

CREATE TABLE public.refresh_token_family (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    family_id uuid NOT NULL,
    jti uuid NOT NULL UNIQUE,
    parent_jti uuid,
    used boolean NOT NULL DEFAULT false,
    revoked_at timestamp without time zone,
    createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp without time zone
);

ALTER TABLE public.refresh_token_family OWNER TO postgres;

CREATE INDEX idx_refresh_family_family_id
    ON public.refresh_token_family (family_id);
CREATE INDEX idx_refresh_family_user_id
    ON public.refresh_token_family (user_id);
CREATE INDEX idx_refresh_family_active
    ON public.refresh_token_family (jti)
    WHERE used = false AND revoked_at IS NULL;
