/**
 * Esquemas Zod del módulo auth - mediCitas web
 * Espejan los contratos de src/modules/auth/auth.schemas.ts del backend.
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Respuesta de POST /api/v1/auth/login */
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    roles: z.array(z.string()),
  }),
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Respuesta de POST /api/v1/auth/refresh */
export const refreshResponseSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Espeja passwordSchema del backend */
const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede exceder 72 caracteres");

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: passwordSchema,
});

/** Esquema del formulario: solo campos registrados + coincidencia */
export const resetFormSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetFormInput = z.infer<typeof resetFormSchema>;
