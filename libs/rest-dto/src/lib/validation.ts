import { z } from 'zod';
import { Permission } from './rest-dto';

/**
 * Runtime validation contracts for the API, kept here in `@dto` so the schema
 * is a single source of truth shared by the backend (request validation) and,
 * if needed, the frontend (form validation). The API never trusts req.body /
 * query / params directly — it parses them through these schemas first.
 *
 * Input schemas are `.strict()`: unknown keys are rejected, which closes
 * mass-assignment / over-posting at the edge (defense-in-depth on top of the
 * service-layer field allow-list).
 */

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

export const userCreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(150),
    name: z.string().trim().min(1).max(150),
    lastName: z.string().trim().max(150).optional(),
    permissions: z.array(z.nativeEnum(Permission)).nonempty().optional(),
    password: passwordSchema,
  })
  .strict();

export const userUpdateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(150).optional(),
    name: z.string().trim().min(1).max(150).optional(),
    lastName: z.string().trim().max(150).optional(),
    permissions: z.array(z.nativeEnum(Permission)).nonempty().optional(),
    // Empty string => "leave password unchanged" (handled by the service).
    password: z.union([passwordSchema, z.literal('')]).optional(),
  })
  .strict();

/** Reusable query/param schemas for paged CRUD endpoints. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
