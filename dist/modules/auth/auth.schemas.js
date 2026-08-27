// Esquemas de validación del módulo de autenticación - mediCitas API
import { z } from 'zod';
export const passwordSchema = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede exceder 72 caracteres');
export const registerPersonSchema = z.object({
    firstName: z.string().min(1).max(50),
    middleName: z.string().max(50).optional(),
    lastName: z.string().min(1).max(50),
    secondLastName: z.string().max(50).optional(),
    birthDate: z.string().date(),
    dni: z.string().min(5).max(20),
    gender: z.string().min(1).max(20),
    address: z.string().max(255).optional(),
    countryId: z.string().uuid(),
    departmentId: z.string().uuid(),
    municipalityId: z.string().uuid(),
});
export const registerSchema = z
    .object({
    email: z.string().email().max(150),
    password: passwordSchema,
    accountType: z.enum(['PATIENT', 'EMPLOYEE']),
    bloodType: z.enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
    ]),
    person: registerPersonSchema,
})
    .refine((data) => data.accountType !== 'PATIENT' || data.bloodType !== undefined, {
    message: 'bloodType es requerido para pacientes',
    path: ['bloodType'],
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const refreshSchema = z.object({
    refreshToken: z.string().min(20),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
});
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
export const resetPasswordSchema = z.object({
    token: z.string().min(20),
    newPassword: passwordSchema,
});
//# sourceMappingURL=auth.schemas.js.map