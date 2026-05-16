-- Legacy migration kept as a no-op for backward compatibility.
-- Permission enum + array column are already created by 10.user.sql in
-- this starter. Recreating the type aborts the init pipeline (it would
-- prevent later migrations like 20.refresh_token_family.sql from
-- running), so we only assert the enum exists and exit cleanly.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_type') THEN
        CREATE TYPE permission_type AS ENUM (
            'ADMIN',
            'WRITE_SOME_ENTITY',
            'READ_SOME_ENTITY'
        );
    END IF;
END $$;
