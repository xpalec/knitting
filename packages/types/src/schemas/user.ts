/**
 * User schemas — editorial team members.
 *
 * Users are not exposed to public readers.
 * password_hash is excluded from all API response schemas.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const RoleEnum = z.enum(["editor", "reviewer", "admin"]);
export type Role = z.infer<typeof RoleEnum>;

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/**
 * Full user row — used internally and in admin user management.
 * password_hash is never included in API responses; omit it at the service layer.
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleEnum,
  created_at: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

/**
 * Safe user shape — password_hash excluded.
 * Use this for any response that includes user data.
 */
export const SafeUserSchema = UserSchema;
export type SafeUser = z.infer<typeof SafeUserSchema>;
