-- Federated identity table: links a local public.user account to an external
-- OIDC/SSO identity provider (IdP). One user may have at most one active link
-- per provider (enforced by uq_federated_identity_user_provider). A given
-- (provider, subject) pair is globally unique across active rows
-- (uq_federated_identity_provider_subject), preventing two local users from
-- claiming the same external identity.
--
-- Soft-delete is the only supported removal path. ON DELETE CASCADE from
-- public.user is intentional: removing a user removes their federated links
-- with no further cascade chain (federated_identity has no children).
--
-- email_at_link is PII captured at link time for audit purposes. It is
-- nullable (the IdP may not return an email claim). Soft-delete satisfies
-- retention requirements — hard deletion of PII must go through the data
-- erasure runbook, not a direct DELETE.

CREATE TABLE IF NOT EXISTS public.federated_identity (
    id            bigserial PRIMARY KEY,
    user_id       bigint NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    provider      varchar(50) NOT NULL,
    subject       varchar(255) NOT NULL,
    email_at_link varchar(150),
    deleted       boolean DEFAULT false,
    createdAt     timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt     timestamp without time zone,
    deletedAt     timestamp without time zone
);

ALTER TABLE public.federated_identity OWNER TO postgres;

-- Natural key of a federated identity: (provider, subject) must be unique
-- across active (non-deleted) rows. The partial index allows re-linking after
-- a soft-delete without violating uniqueness — the old soft-deleted row is
-- excluded from the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_federated_identity_provider_subject
    ON public.federated_identity (provider, subject)
    WHERE deleted = false;

-- Prevent double-linking the same provider to the same local user while the
-- link is active. A user can re-link the same provider only after the
-- previous link has been soft-deleted.
CREATE UNIQUE INDEX IF NOT EXISTS uq_federated_identity_user_provider
    ON public.federated_identity (user_id, provider)
    WHERE deleted = false;

-- FK support index: fast lookup of all federated identities for a given user.
CREATE INDEX IF NOT EXISTS idx_federated_identity_user_id
    ON public.federated_identity (user_id);
