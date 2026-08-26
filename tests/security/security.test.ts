// Pruebas de seguridad - mediCitas API
// Mapeadas a skills de https://github.com/mukul975/Anthropic-Cybersecurity-Skills
//   S1 JWT alg-confusion ....... exploiting-jwt-algorithm-confusion-attack
//   S2 Security headers ........ hardening web (helmet)
//   S3 Rate limiting ........... performing-api-rate-limiting-bypass
//   S4 Superficie expuesta ..... conducting-api-security-testing (Step 5)
//   S5 BOLA/BFLA ............... testing-api-for-broken-object-level-authorization
//   S6 Mass assignment ......... conducting-api-security-testing (Step 3)
//   S7 Inyección SQL/NoSQL ..... conducting-api-security-testing (Step 4)
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/shared/database/client.js';
import { signAccessToken } from '../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../helpers/test-utils.js';

const adminId = '00000000-0000-4000-8000-000000000099';
function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}

function tokenFor(sub: string, roles: string[]): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub, roles })}` };
}

let app: ReturnType<typeof buildApp>;
let patientAUserId = '';
let patientAPersonId = '';
let patientBUserId = '';

async function registerPatient(prefix: string): Promise<{ userId: string; personId: string }> {
  const email = uniqueEmail(prefix);
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'Tegucigalpa', departmentId: department.id },
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: 'SecTest123',
      accountType: 'PATIENT',
      bloodType: 'O_POSITIVE',
      person: {
        firstName: `Sec-${prefix}`,
        lastName: 'Security',
        birthDate: '1991-01-01',
        dni: uniqueDni('SEC'),
        gender: 'F',
        countryId: country.id,
        departmentId: department.id,
        municipalityId: municipality.id,
      },
    },
  });
  expect(response.statusCode).toBe(201);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: JSON.parse(response.body).user.id as string },
    include: { person: true },
  });
  return { userId: user.id, personId: user.person.id };
}

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();

  const a = await registerPatient('sec-a');
  patientAUserId = a.userId;
  patientAPersonId = a.personId;
  const b = await registerPatient('sec-b');
  patientBUserId = b.userId;
});

afterAll(async () => {
  await purgeTestUsers();
  await app.close();
  await prisma.$disconnect();
});

describe('S1 JWT: confusión de algoritmo y manipulación', () => {
  it('rechaza tokens con alg:none (sin firma)', async () => {
    const noneToken = jwt.sign(
      { sub: adminId, roles: ['ADMIN'] },
      null as unknown as string,
      { algorithm: 'none', issuer: 'medicitas-api' }
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?role=PATIENT',
      headers: { authorization: `Bearer ${noneToken}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rechaza tokens firmados con un secreto distinto (key confusion)', async () => {
    const forged = jwt.sign(
      { sub: adminId, roles: ['ADMIN'], iss: 'medicitas-api' },
      'secreto-del-atacante-super-largo-1234',
      { algorithm: 'HS256' }
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?role=PATIENT',
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rechaza claims manipulados (roles elevados sin re-firmar)', async () => {
    const token = signAccessToken({ sub: patientAUserId, roles: ['PATIENT'] });
    const [header, payload] = token.split('.');
    const tampered = `${header}.${Buffer.from(
      JSON.stringify({ sub: patientAUserId, roles: ['ADMIN'] })
    ).toString('base64url')}.${payload}`;
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?role=PATIENT',
      headers: { authorization: `Bearer ${tampered}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('issuer incorrecto es rechazado', async () => {
    const badIssuer = jwt.sign(
      { sub: adminId, roles: ['ADMIN'] },
      process.env['JWT_ACCESS_SECRET'] as string,
      { algorithm: 'HS256', issuer: 'otro-emisor' }
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?role=PATIENT',
      headers: { authorization: `Bearer ${badIssuer}` },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('S2 security headers (helmet)', () => {
  it('incluye cabeceras endurecidas y oculta X-Powered-By', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(String(response.headers['content-security-policy'])).toContain("default-src 'self'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('S3 rate limiting en autenticación (anti fuerza bruta)', () => {
  it('bloquea con 429 tras exceder el presupuesto de login', async () => {
    const limited = buildApp({ rateLimitMax: 1000, authRateLimitMax: 5 });
    await limited.ready();

    let saw429 = false;
    let lastStatus = 0;
    // Misma IP simulada en todos los intentos (atacante único)
    for (let i = 0; i < 8; i++) {
      const response = await limited.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `brute${i}@auth-test.local`, password: 'wrong' },
        remoteAddress: '10.9.9.9',
      });
      lastStatus = response.statusCode;
      if (response.statusCode === 429) saw429 = true;
    }
    expect(lastStatus).toBe(429); // al final del presupuesto siempre bloquea
    expect(saw429).toBe(true);
    await limited.close();
  }, 30000);
});

describe('S4 superficie expuesta / debug endpoints', () => {
  it('no expone .env ni rutas de depuración', async () => {
    for (const path of ['/.env', '/api/debug', '/api/metrics', '/documentation']) {
      const response = await app.inject({ method: 'GET', url: path });
      expect(response.statusCode, path).toBe(404);
    }
  });

  it('enableDocs:false oculta /docs y /docs/json (modo producción)', async () => {
    const hardened = buildApp({ enableDocs: false });
    const ui = await hardened.inject({ method: 'GET', url: '/docs' });
    const jsonSpec = await hardened.inject({ method: 'GET', url: '/docs/json' });
    expect(ui.statusCode).toBe(404);
    expect(jsonSpec.statusCode).toBe(404);
    await hardened.close();
  });

  it('entradas inválidas no revelan stack traces ni rutas internas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/countries?page=NO-NUMERICO&pageSize=-1',
    });
    const bodyText = response.body;
    expect(bodyText).not.toContain('node_modules');
    expect(bodyText).not.toContain('at Object');
    expect([200, 400]).toContain(response.statusCode);
  });
});

describe('S7 inyección (SQL/NoSQL) en parámetros', () => {
  it('payloads SQLi en login no causan bypass ni error 500', async () => {
    const payloads = ["' OR 1=1 --", "admin'--", "'; DROP TABLE users;--"];
    for (const payload of payloads) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: payload, password: payload },
      });
      expect([400, 401]).toContain(response.statusCode);
    }
    // Las tablas siguen intactas
    expect(await prisma.user.count()).toBeGreaterThanOrEqual(2);
  });

  it('operadores NoSQL ($gt/$regex) se rechazan por validación de tipos', async () => {
    for (const email of [{ $gt: '' }, { $regex: '.*' }]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: { $ne: null } },
      });
      expect([400, 401]).toContain(response.statusCode);
    }
  });

  it('filtros admin con payloads SQLi devuelven resultados vacíos de forma segura', async () => {
    for (const payload of ["' OR '1'='1", "'--"]) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/users?email=${encodeURIComponent(payload)}`,
        headers: adminToken(),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).items).toHaveLength(0);
    }
  });
});

describe('S5 BOLA/BFLA (control de acceso a objetos y funciones)', () => {
  it('BFLA: token PATIENT bloqueado en funciones administrativas', async () => {
    const patientToken = { authorization: `Bearer ${signAccessToken({ sub: patientAUserId, roles: ['PATIENT'] })}` };
    const cases: Array<{ method: 'GET' | 'POST'; url: string; payload?: object }> = [
      { method: 'GET', url: '/api/v1/users?role=PATIENT' },
      { method: 'GET', url: '/api/v1/roles' },
      { method: 'GET', url: '/api/v1/employees' },
      { method: 'POST', url: '/api/v1/roles', payload: { name: 'HACKED' } },
      { method: 'POST', url: '/api/v1/cargos', payload: { name: 'HACKED-CARGO' } },
    ];
    for (const c of cases) {
      const response = await app.inject({
        method: c.method,
        url: c.url,
        headers: patientToken,
        ...(c.payload ? { payload: c.payload } : {}),
      });
      expect(response.statusCode, `${c.method} ${c.url}`).toBe(403);
    }
  });

  it('BFLA: firma inválida con rol ADMIN fabricado → 401', async () => {
    const forged = jwt.sign(
      { sub: '00000000-0000-4000-8000-00000000dead', roles: ['ADMIN'], iss: 'medicitas-api' },
      'otro-secreto-atacante-muy-largo-9876',
      { algorithm: 'HS256' }
    );
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${patientAUserId}/roles/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('BOLA: un paciente no puede listar ni mutar teléfonos de otro', async () => {
    // A agrega su teléfono
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/phones',
      headers: tokenFor(patientAUserId, ['PATIENT']),
      payload: {
        number: '5555-SEC1',
        personId: patientAPersonId,
        extensionId: (await prisma.extension.findFirstOrThrow()).id,
      },
    });
    expect(created.statusCode).toBe(201);
    const phoneId = JSON.parse(created.body).id;

    const bToken = tokenFor(patientBUserId, ['PATIENT']);

    // Lectura cruzada del listado de A
    const readOther = await app.inject({
      method: 'GET',
      url: `/api/v1/phones?personId=${patientAPersonId}`,
      headers: bToken,
    });
    expect(readOther.statusCode).toBe(403);

    // Mutación cruzada del teléfono de A
    const patchOther = await app.inject({
      method: 'PATCH',
      url: `/api/v1/phones/${phoneId}`,
      headers: bToken,
      payload: { number: '6666-HACK' },
    });
    expect(patchOther.statusCode).toBe(403);

    // El número sigue intacto
    const phone = await prisma.phone.findUniqueOrThrow({ where: { id: phoneId } });
    expect(phone.number).toBe('5555-SEC1');

    await prisma.phone.delete({ where: { id: phoneId } });
  });
});

describe('S6 mass assignment en actualización de perfil', () => {
  it('PATCH /patients/me ignora campos privilegiados no permitidos', async () => {
    const email = uniqueEmail('mass');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'SecTest123',
        accountType: 'PATIENT',
        bloodType: 'O_POSITIVE',
        person: {
          firstName: 'Mass',
          lastName: 'Assign',
          birthDate: '1992-02-02',
          dni: uniqueDni('MAS'),
          gender: 'M',
          countryId: (await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } })).id,
          departmentId: (
            await prisma.department.findFirstOrThrow({ where: { name: 'Francisco Morazán' } })
          ).id,
          municipalityId: (
            await prisma.municipality.findFirstOrThrow({
              where: { name: 'Tegucigalpa' },
            })
          ).id,
        },
      },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'SecTest123' },
    });
    const token = tokenFor(JSON.parse(login.body).user.id, ['PATIENT']);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patients/me',
      headers: token,
      payload: {
        allergies: 'Ninguna conocida',
        userId: adminId, // intento de reasignar la cuenta
        status: 'INACTIVE',
      },
    });

    // La actualización solo aplica campos permitidos
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { patient: true },
    });
    expect(user.patient?.allergies).toBe('Ninguna conocida');
    expect(user.status).toBe('ACTIVE'); // no fue manipulado
    void response;
  });
});

describe('S8 secretos hardcodeados', () => {
  it('no hay secretos de entorno embebidos en src/', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const forbidden = [
      'medicitas_dev_password',
      'dev_access_secret_change_in_production',
      'dev_refresh_secret_change_in_production',
    ];

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.ts')) files.push(full);
      }
    };
    walk('src');

    const offenders = files.filter((f) =>
      forbidden.some((secret) => readFileSync(f, 'utf8').includes(secret))
    );
    expect(offenders).toEqual([]);
    expect(files.length).toBeGreaterThan(10); // sanity del escaneo
  });
});
