/**
 * Auth schemas — login credentials and JWT token response.
 *
 * JWT is issued as an HttpOnly cookie; the token response shape is used
 * for the refresh endpoint and internal session validation.
 */

import { z } from "zod";
import { RoleEnum } from "./user.js";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type Login = z.infer<typeof LoginSchema>;

// ---------------------------------------------------------------------------
// Token response
// ---------------------------------------------------------------------------

/**
 * Returned by POST /api/v1/auth/login and POST /api/v1/auth/refresh.
 * The actual JWT is set as an HttpOnly cookie; this payload carries
 * the non-sensitive session metadata the client needs for UI rendering.
 */
export const TokenSchema = z.object({
  /** JWT expiry as ISO datetime string. */
  expires_at: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.string().email(),
    role: RoleEnum,
  }),
});
export type Token = z.infer<typeof TokenSchema>;
