/**
 * Pruebas del esquema de registro - specs/web/patient-onboarding/spec.md
 */
import { describe, expect, it } from "vitest";
import {
  registroApiSchema,
  registroFormSchema,
} from "./schemas";

const PERSONA_VALIDA = {
  firstName: "Ana",
  lastName: "Pérez",
  birthDate: "1995-04-12",
  dni: "0801199500432",
  gender: "Femenino",
  countryId: "9db9be73-7b84-4364-b099-e16059d4f71f",
  departmentId: "e1d8d733-90f9-4338-9265-4c16e6d981f2",
  municipalityId: "56f3d9db-70ac-4128-8178-c71a61974fbc",
};

const FORM_VALIDO = {
  email: "nueva@persona.com",
  password: "secreto123",
  confirmPassword: "secreto123",
  bloodType: "O_POSITIVE",
  person: PERSONA_VALIDA,
};

describe("Esquema de autoregistro (contrato API)", () => {
  it("acepta un cuerpo completo válido", () => {
    const parsed = registroApiSchema.safeParse({
      email: "nueva@persona.com",
      password: "secreto123",
      accountType: "PATIENT",
      bloodType: "O_POSITIVE",
      person: PERSONA_VALIDA,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza sin tipo de sangre (requerido para pacientes)", () => {
    const parsed = registroApiSchema.safeParse({
      email: "nueva@persona.com",
      password: "secreto123",
      accountType: "PATIENT",
      person: PERSONA_VALIDA,
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza ubicación incompleta (municipio faltante)", () => {
    const personaSinMuni = { ...PERSONA_VALIDA } as Record<string, unknown>;
    delete personaSinMuni.municipalityId;
    void personaSinMuni;
    const parsed = registroApiSchema.safeParse({
      email: "nueva@persona.com",
      password: "secreto123",
      accountType: "PATIENT",
      bloodType: "O_POSITIVE",
      person: personaSinMuni,
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza DNI demasiado corto", () => {
    const parsed = registroApiSchema.safeParse({
      email: "nueva@persona.com",
      password: "secreto123",
      accountType: "PATIENT",
      bloodType: "O_POSITIVE",
      person: { ...PERSONA_VALIDA, dni: "123" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("Esquema del formulario de registro", () => {
  it("acepta el formulario completo con confirmación correcta", () => {
    expect(registroFormSchema.safeParse(FORM_VALIDO).success).toBe(true);
  });

  it("rechaza cuando las contraseñas no coinciden", () => {
    const parsed = registroFormSchema.safeParse({
      ...FORM_VALIDO,
      confirmPassword: "distinta456",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path.join(".");
      expect(path).toBe("confirmPassword");
    }
  });

  it("rechaza correo inválido", () => {
    const parsed = registroFormSchema.safeParse({
      ...FORM_VALIDO,
      email: "no-es-correo",
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza contraseña menor a 8 caracteres", () => {
    const parsed = registroFormSchema.safeParse({
      ...FORM_VALIDO,
      password: "corta12",
      confirmPassword: "corta12",
    });
    expect(parsed.success).toBe(false);
  });
});
