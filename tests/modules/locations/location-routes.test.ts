// Tests del módulo de ubicaciones (tareas 5.1–5.5)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';

let app: ReturnType<typeof buildApp>;
const adminToken = () =>
  `Bearer ${signAccessToken({ sub: '00000000-0000-4000-8000-0000000000a1', roles: ['ADMIN'] })}`;
const patientToken = () =>
  `Bearer ${signAccessToken({ sub: '00000000-0000-4000-8000-0000000000p1', roles: ['PATIENT'] })}`;

// Recursos creados por los tests para limpieza
const createdCountryIds: string[] = [];
const createdDepartmentIds: string[] = [];
const createdMunicipalityIds: string[] = [];

beforeAll(() => {
  app = buildApp();
});

afterAll(async () => {
  // Limpieza en orden inverso de dependencias
  await prisma.municipality.deleteMany({ where: { id: { in: createdMunicipalityIds } } });
  await prisma.department.deleteMany({ where: { id: { in: createdDepartmentIds } } });
  await prisma.country.deleteMany({ where: { id: { in: createdCountryIds } } });
  await app.close();
  await prisma.$disconnect();
});

async function seedLocation(): Promise<{ countryId: string; departmentId: string }> {
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  return { countryId: country.id, departmentId: department.id };
}

describe('GET /api/v1/countries (listado público)', () => {
  it('lista países sembrados sin autenticación y con metadatos de paginación', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/countries' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.map((c: { name: string }) => c.name)).toContain('Honduras');
    expect(body).toHaveProperty('page', 1);
    expect(body).toHaveProperty('totalPages');
  });

  it('respeta paginación (pageSize=1 → una sola página de items)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/countries?page=1&pageSize=1',
    });
    const body = JSON.parse(response.body);
    expect(body.items).toHaveLength(1);
    expect(body.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/v1/countries (solo ADMIN)', () => {
  const name = `Testilandia-${Date.now()}`;

  it('rechaza sin token con UNAUTHORIZED', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/countries',
      payload: { name },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rechaza rol PATIENT con FORBIDDEN', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/countries',
      headers: { authorization: patientToken() },
      payload: { name },
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN crea país; duplicado genera CONFLICT', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/countries',
      headers: { authorization: adminToken() },
      payload: { name },
    });
    expect(created.statusCode).toBe(201);
    const country = JSON.parse(created.body);
    createdCountryIds.push(country.id);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/countries',
      headers: { authorization: adminToken() },
      payload: { name },
    });
    expect(duplicate.statusCode).toBe(409);
  });
});

describe('GET /api/v1/departments?countryId= (filtro requerido)', () => {
  it('sin filtro responde VALIDATION_ERROR (400)', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/departments' });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['title']).toBeDefined();
  });

  it('filtra departamentos por país', async () => {
    const { countryId } = await seedLocation();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/departments?countryId=${countryId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const names = body.items.map((d: { name: string }) => d.name);
    expect(names).toContain('Francisco Morazán');
    expect(names).not.toContain('San Pedro Sula'); // es un municipio, no departamento

    // Todos los items pertenecen al país filtrado
    for (const item of body.items) {
      expect(item.countryId).toBe(countryId);
    }
  });
});

describe('POST /api/v1/departments (solo ADMIN)', () => {
  let testlandiaId = '';

  beforeAll(async () => {
    const name = `Testlandia-dept-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/countries',
      headers: { authorization: adminToken() },
      payload: { name },
    });
    testlandiaId = JSON.parse(created.body).id;
    createdCountryIds.push(testlandiaId);
  });

  it('valida que el país exista antes de crear', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/departments',
      headers: { authorization: adminToken() },
      payload: {
        name: `Departamento-fantasma-${Date.now()}`,
        countryId: '00000000-0000-4000-8000-000000000000',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('país');
  });

  it('ADMIN crea departamento; duplicado en mismo país genera CONFLICT', async () => {
    const deptName = `DepartamentoNuevo-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/departments',
      headers: { authorization: adminToken() },
      payload: { name: deptName, countryId: testlandiaId },
    });
    expect(created.statusCode).toBe(201);
    const department = JSON.parse(created.body);
    createdDepartmentIds.push(department.id);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/departments',
      headers: { authorization: adminToken() },
      payload: { name: deptName, countryId: testlandiaId },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('el mismo nombre de departamento en OTRO país es válido', async () => {
    const honduras = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
    const deptName = `Compartido-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/departments',
      headers: { authorization: adminToken() },
      payload: { name: deptName, countryId: honduras.id },
    });
    expect(created.statusCode).toBe(201);
    createdDepartmentIds.push(JSON.parse(created.body).id);
  });
});

describe('GET/POST /api/v1/municipalities', () => {
  it('sin departmentId responde 400', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/municipalities' });
    expect(response.statusCode).toBe(400);
  });

  it('filtra municipios por departamento', async () => {
    const { departmentId } = await seedLocation();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/municipalities?departmentId=${departmentId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const names = body.items.map((m: { name: string }) => m.name);
    expect(names).toContain('Tegucigalpa');
    expect(names).not.toContain('San Pedro Sula'); // pertenece a Cortés
    for (const item of body.items) {
      expect(item.departmentId).toBe(departmentId);
    }
  });

  it('ADMIN crea municipio bajo departamento existente', async () => {
    const { departmentId } = await seedLocation();
    const munName = `AldeaNueva-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/municipalities',
      headers: { authorization: adminToken() },
      payload: { name: munName, departmentId },
    });
    expect(created.statusCode).toBe(201);
    createdMunicipalityIds.push(JSON.parse(created.body).id);

    // Duplicado en mismo departamento → CONFLICT
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/municipalities',
      headers: { authorization: adminToken() },
      payload: { name: munName, departmentId },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('valida que el departamento exista', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/municipalities',
      headers: { authorization: adminToken() },
      payload: {
        name: `Fantasma-${Date.now()}`,
        departmentId: '00000000-0000-4000-8000-000000000000',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('departamento');
  });
});

describe('GET /api/v1/locations/tree', () => {
  it('devuelve jerarquía completa país → departamento → municipio', async () => {
    const { countryId } = await seedLocation();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/locations/tree?countryId=${countryId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.countries).toHaveLength(1);

    const honduras = body.countries[0];
    expect(honduras.name).toBe('Honduras');

    const fmorazan = honduras.departments.find(
      (d: { name: string }) => d.name === 'Francisco Morazán'
    );
    expect(fmorazan).toBeDefined();
    const munNames = fmorazan.municipalities.map((m: { name: string }) => m.name);
    expect(munNames).toContain('Tegucigalpa');
  });
});

describe('GET /api/v1/municipalities/:id (ruta completa)', () => {
  it('devuelve municipio con departamento y país padre', async () => {
    const tegucigalpa = await prisma.municipality.findFirstOrThrow({
      where: { name: 'Tegucigalpa' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/municipalities/${tegucigalpa.id}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.name).toBe('Tegucigalpa');
    expect(body.department.name).toBe('Francisco Morazán');
    expect(body.country.name).toBe('Honduras');
  });

  it('responde NOT_FOUND problem+json ante UUID inexistente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/municipalities/00000000-0000-4000-8000-00000000dead',
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});
