/**
 * Esquemas Zod del autoregistro de pacientes - mediCitas web
 * Espejan el contrato real de src/modules/auth/auth.schemas.ts (backend).
 */
import { z } from "zod";

/** Espeja passwordSchema del backend */
const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede exceder 72 caracteres");

export const TIPOS_DE_SANGRE = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
] as const;

const etiquetaTipoSangre: Record<(typeof TIPOS_DE_SANGRE)[number], string> = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
};

export function etiquetaSangre(valor: string): string {
  return etiquetaTipoSangre[valor as keyof typeof etiquetaTipoSangre] ?? valor;
}

export const personaSchema = z.object({
  firstName: z.string().min(1, "Ingresa tu primer nombre").max(50),
  middleName: z.string().max(50).optional(),
  lastName: z.string().min(1, "Ingresa tu primer apellido").max(50),
  secondLastName: z.string().max(50).optional(),
  birthDate: z.string().date("Ingresa una fecha válida"),
  dni: z
    .string()
    .min(5, "El DNI debe tener al menos 5 caracteres")
    .max(20, "El DNI no puede exceder 20 caracteres"),
  gender: z.string().min(1, "Selecciona tu género").max(20),
  address: z.string().max(255).optional(),
  countryId: z.string().uuid("Elige un país"),
  departmentId: z.string().uuid("Elige un departamento"),
  municipalityId: z.string().uuid("Elige un municipio"),
});

export type PersonaInput = z.infer<typeof personaSchema>;

/** Contrato exacto que espera POST /api/v1/auth/register */
export const registroApiSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: passwordSchema,
  accountType: z.literal("PATIENT"),
  bloodType: z.enum(TIPOS_DE_SANGRE, {
    message: "Selecciona tu tipo de sangre",
  }),
  person: personaSchema,
});

export type RegistroApiInput = z.infer<typeof registroApiSchema>;

/** Esquema del formulario: contrato + confirmación de contraseña */
export const registroFormSchema = z
  .object({
    email: registroApiSchema.shape.email,
    password: registroApiSchema.shape.password,
    confirmPassword: z.string(),
    bloodType: registroApiSchema.shape.bloodType,
    person: personaSchema,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegistroFormInput = z.infer<typeof registroFormSchema>;

/** Respuesta 201 de POST /api/v1/auth/register */
export const registroResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string() }),
  accessToken: z.string(),
  refreshToken: z.string(),
});
