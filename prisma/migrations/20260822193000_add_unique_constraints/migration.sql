-- Agregar constraints únicos para integridad de catálogos de ubicaciones
-- y soporte de upserts en el seed.

CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");
CREATE UNIQUE INDEX "departments_name_country_id_key" ON "departments"("name", "country_id");
CREATE UNIQUE INDEX "municipalities_name_department_id_key" ON "municipalities"("name", "department_id");
