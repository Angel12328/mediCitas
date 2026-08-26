-- Agregar descripción opcional al catálogo de roles (spec auth/role-based-access)

ALTER TABLE "roles" ADD COLUMN "description" VARCHAR(255);
