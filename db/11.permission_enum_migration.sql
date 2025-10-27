-- Migration to convert permission column from VARCHAR to ENUM array
-- This migration should be run after the new schema is applied

-- First, create the enum type
CREATE TYPE permission_type AS ENUM ('ADMIN', 'WRITE_SOME_ENTITY', 'READ_SOME_ENTITY');

-- Add a temporary column with the new enum array type
ALTER TABLE public.user ADD COLUMN permissions_new permission_type[];

-- Update the temporary column with the existing data
-- Convert single permission string to array
UPDATE public.user SET permissions_new = ARRAY[permission::permission_type];

-- Drop the old column
ALTER TABLE public.user DROP COLUMN permission;

-- Rename the new column to the original name
ALTER TABLE public.user RENAME COLUMN permissions_new TO permissions;

-- Make the column NOT NULL
ALTER TABLE public.user ALTER COLUMN permissions SET NOT NULL;

-- Set default value
ALTER TABLE public.user ALTER COLUMN permissions SET DEFAULT ARRAY['READ_SOME_ENTITY']::permission_type[];
