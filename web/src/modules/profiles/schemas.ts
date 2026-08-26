/**
 * Esquemas Zod del módulo de perfil - mediCitas web
 * Espejan los contratos de users/patients/contacts del backend.
 */
import { z } from "zod";
import { TIPOS_DE_SANGRE } from "@/modules/onboarding/schemas";

/** PATCH /api/v1/users/me */
export const updatePerfilSchema = z.object({
  person: z.object({
    firstName: z.string().min(1, "El primer nombre es obligatorio").max(50),
    middleName: z.string().max(50).optional(),
    lastName: z.string().min(1, "El primer apellido es obligatorio").max(50),
    secondLastName: z.string().max(50).optional(),
    gender: z.string().min(1, "Selecciona tu género").max(20),
    address: z.string().max(255).optional(),
  }),
});

export type UpdatePerfilInput = z.infer<typeof updatePerfilSchema>;

/** POST /api/v1/phones (contrato real: number + personId + extensionId) */
export const crearTelefonoSchema = z.object({
  number: z
    .string()
    .min(6, "El número debe tener al menos 6 dígitos")
    .max(20, "El número no puede exceder 20 dígitos"),
  extensionId: z.string().uuid("Selecciona una extensión"),
});

export type CrearTelefonoInput = z.infer<typeof crearTelefonoSchema>;

/** PATCH /api/v1/patients/me — tipo de sangre validado contra el catálogo */
export const datosClinicosSchema = z.object({
  bloodType: z.enum(TIPOS_DE_SANGRE, {
    message: "Selecciona un tipo de sangre válido",
  }),
  allergies: z.string().max(500, "Máximo 500 caracteres").optional(),
});

export type DatosClinicosInput = z.infer<typeof datosClinicosSchema>;

/** PATCH contacto de emergencia del paciente */
export const emergenciaSchema = z.object({
  emergencyContactName: z.string().min(1, "Ingresa el nombre").max(150),
  emergencyContactNumber: z
    .string()
    .min(5, "Mínimo 5 caracteres")
    .max(20, "Máximo 20 caracteres"),
});

export type EmergenciaInput = z.infer<typeof emergenciaSchema>;

/** Forma de GET /users/me que consume la vista */
export interface PerfilResponse {
  id: string;
  email: string;
  status: string;
  roles: string[];
  person: {
    id: string;
    fullName: string;
    birthDate: string;
    dni: string;
    gender: string;
    address: string | null;
  };
  patient?: {
    id: string;
    bloodType: string;
    emergencyContactName: string | null;
    emergencyContactNumber: string | null;
  };
  employeeId?: string;
}
