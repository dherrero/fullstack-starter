
-- Create enum type for permissions
CREATE TYPE permission_type AS ENUM ('ADMIN', 'WRITE_SOME_ENTITY', 'READ_SOME_ENTITY');

CREATE TABLE public.user (
    id bigint NOT NULL,
    email character varying(150) NOT NULL UNIQUE,
    name character varying(150) NOT NULL,
    lastname character varying(150),
    permissions permission_type[] NOT NULL DEFAULT ARRAY['READ_SOME_ENTITY']::permission_type[],
    password character varying(250) NOT NULL,
    deleted boolean DEFAULT false,
    createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt timestamp without time zone,
    deletedAt timestamp without time zone,
    PRIMARY KEY(id)
);


ALTER TABLE public.user OWNER TO postgres;


CREATE SEQUENCE public.user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_id_seq OWNER TO postgres;


ALTER SEQUENCE public.user_id_seq OWNED BY public.user.id;

ALTER TABLE ONLY public.user ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);

-- NOTE: this schema file intentionally seeds NO users. A bootstrap admin is
-- created only by the gated, dev-only script `db/zz-dev-seed.sh`, which runs
-- after this file and does nothing unless DEV_SEED_ADMIN=true is set with an
-- explicit BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD_HASH. Never ship a
-- known credential as part of the schema.
