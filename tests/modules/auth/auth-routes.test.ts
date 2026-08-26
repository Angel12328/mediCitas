// Tests de integración de los endpoints de autenticación (tareas 4.4–4.10, 4.13)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import {
  FakeMailer,
  getSeedLocation,
  purgeTestUsers,
  uniqueEmail,
} from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const mailer = new FakeMailer();

beforeAll(() => {
  app = buildApp({ mailer });
});

afterAll(async () => {
  await purgeTestUsers();
  await app.close();
  await (await import('../../../src/shared/database/client.js')).prisma.$disconnect();
});

describe('POST /api/v1/auth/register', () => {
  it('crea usuario + persona + paciente + rol y retorna tokens', async () => {
    const location = await getSeedLocation();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail('paciente'),
        password: 'ClaveSegura123',
        accountType: 'PATIENT',
        bloodType: 'O_POSITIVE',
        person: {
          firstName: 'Ana',
          lastName: 'Martínez',
          birthDate: '1995-05-15',
          dni: `0801${Date.now()}`,
          gender: 'F',
          ...location,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.user.email).toContain('@auth-test.local');
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();

    // Verificar persistencia completa en BD
    const dbUser = await (
      await import('../../../src/shared/database/client.js')
    ).prisma.user.findUniqueOrThrow({
      where: { id: body.user.id },
      include: { patient: true, roles: { include: { role: true } }, person: true },
    });
    expect(dbUser.patient?.bloodType).toBe('O_POSITIVE');
    expect(dbUser.roles[0]?.role.name).toBe('PATIENT');
    expect(dbUser.person.firstName).toBe('Ana');
  });

  it('rechaza correo duplicado con CONFLICT', async () => {
    const location = await getSeedLocation();
    const email = uniqueEmail('dup');
    const base = {
      password: 'ClaveSegura123',
      accountType: 'PATIENT',
      bloodType: 'A_POSITIVE',
      person: {
        firstName: 'Dup',
        lastName: 'Duplicado',
        birthDate: '1990-01-01',
        gender: 'F',
        ...location,
      },
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, ...base, person: { ...base.person, dni: `DUP1${Date.now()}` } },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, ...base, person: { ...base.person, dni: `DUP2${Date.now()}` } },
    });
    expect(second.statusCode).toBe(409);
    expect(JSON.parse(second.body)['detail']).toContain('correo');
  });

  it('rechaza jerarquía de ubicación inconsistente', async () => {
    const location = await getSeedLocation();
    // Municipio de otro departamento
    const wrongMunicipality = await (
      await import('../../../src/shared/database/client.js')
    ).prisma.municipality.findFirstOrThrow({
      where: { name: 'San Pedro Sula' }, // pertenece a Cortés
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail('geo'),
        password: 'ClaveSegura123',
        accountType: 'PATIENT',
        bloodType: 'AB_POSITIVE',
        person: {
          firstName: 'Geo',
          lastName: 'Inconsistente',
          birthDate: '1988-03-03',
          dni: `GEO${Date.now()}`,
          gender: 'M',
          countryId: location.countryId,
          departmentId: location.departmentId,
          municipalityId: wrongMunicipality.id,
        },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('jerarquía');
  });
});

describe('POST /api/v1/auth/login', () => {
  let credentials: { email: string; password: string };

  beforeAll(async () => {
    credentials = { email: uniqueEmail('login'), password: 'MiClave456seg' };
    const location = await getSeedLocation();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        ...credentials,
        accountType: 'PATIENT',
        bloodType: 'B_NEGATIVE',
        person: {
          firstName: 'Login',
          lastName: 'Test',
          birthDate: '1992-07-07',
          dni: `LGN${Date.now()}`,
          gender: 'F',
          ...location,
        },
      },
    });
    expect(response.statusCode).toBe(201);
  });

  it('devuelve access + refresh tokens y roles con credenciales válidas', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: credentials,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.roles).toEqual(['PATIENT']);
  });

  it('error genérico idéntico ante correo inexistente o contraseña incorrecta', async () => {
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: credentials.email, password: 'contraseña-equivocada' },
    });
    const unknownEmail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: `nadie${credentials.email}`, password: 'loquesea123' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.body).toBe(unknownEmail.body); // mismo mensaje anti-enumeración
  });
});
