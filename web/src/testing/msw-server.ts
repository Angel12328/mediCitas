/**
 * Servidor MSW compartido por las pruebas - mediCitas web
 * Los handlers espejan el OpenAPI real del backend (ver src/shared/api/schema.d.ts).
 */
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

/** Debe coincidir con el default de src/shared/api/api-client.ts */
const API_URL = process.env.API_URL ?? "http://localhost:3000";

export const loginSuccessBody = {
  user: {
    id: "0f0a3d2e-6f1c-4a7e-9b2a-1c2d3e4f5a6b",
    email: "ana@example.com",
    roles: ["PATIENT"],
  },
  accessToken: "access-token-de-prueba-con-longitud-suficiente",
  refreshToken: "refresh-token-de-prueba-con-longitud-suficiente",
};

export const PERFIL_USUARIO = {
  id: "0f0a3d2e-6f1c-4a7e-9b2a-1c2d3e4f5a6b",
  email: "ana@example.com",
  roles: ["PATIENT"],
};


/** UUID determinista a partir de una semilla legible */
function U(seed: string): string {
  const hex = seed.replace(/[^0-9a-f]/gi, "").padEnd(12, "0").slice(0, 12);
  return `00000000-0000-4000-8000-${hex}00000000`.slice(0, 36);
}

const DNI_DUPLICADO = "9999999999999";

function conflict(detail: string) {
  return HttpResponse.json(
    {
      type: "https://medicitas.example.com/problems/conflict",
      title: "Conflicto con el estado actual del recurso",
      status: 409,
      detail,
      code: "CONFLICT",
    },
    { status: 409 }
  );
}

export const handlers = [
  // GET /users/me: acepta solo tokens rotados (usado en pruebas de renovación)
  http.get(`${API_URL}/api/v1/users/me`, ({ request }) => {
    const auth = request.headers.get("authorization") ?? "";
    if (auth.includes("-rotado")) return HttpResponse.json(PERFIL_USUARIO);
    return HttpResponse.json(
      { title: "No autenticado", status: 401, code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }),

  http.post(`${API_URL}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email === "ana@example.com" && body.password === "secreto123") {
      return HttpResponse.json(loginSuccessBody);
    }
    return HttpResponse.json(
      {
        type: "about:blank",
        title: "Correo o contraseña incorrectos",
        status: 401,
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }),

  http.post(`${API_URL}/api/v1/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    if (
      typeof body.refreshToken === "string" &&
      body.refreshToken.startsWith("refresh-token")
    ) {
      return HttpResponse.json({
        accessToken: `${loginSuccessBody.accessToken}-rotado`,
        refreshToken: `${body.refreshToken}-rotado`,
      });
    }
    return HttpResponse.json(
      { title: "Refresh token inválido", status: 401, code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }),

  http.post(`${API_URL}/api/v1/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${API_URL}/api/v1/auth/forgot-password`, () =>
    HttpResponse.json({
      message:
        "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.",
    })
  ),

  http.post(`${API_URL}/api/v1/auth/reset-password`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // ============ Catálogos (contratos reales de /api/v1) ============
  http.get(`${API_URL}/api/v1/countries`, () =>
    HttpResponse.json({
      items: [
        { id: "11111111-1111-4111-8111-111111111111", name: "Honduras" },
        { id: "22222222-2222-4222-8222-222222222222", name: "Guatemala" },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    })
  ),

  http.get(`${API_URL}/api/v1/departments`, ({ request }) => {
    const countryId = new URL(request.url).searchParams.get("countryId");
    const data =
      countryId === "11111111-1111-4111-8111-111111111111"
        ? [{ id: "33333333-3333-4333-8333-333333333333", name: "Francisco Morazán" }]
        : [];
    return HttpResponse.json({ items: data, total: data.length });
  }),

  http.get(`${API_URL}/api/v1/municipalities`, ({ request }) => {
    const departmentId = new URL(request.url).searchParams.get("departmentId");
    const data =
      departmentId === "33333333-3333-4333-8333-333333333333" ? [{ id: "44444444-4444-4444-8444-444444444444", name: "Tegucigalpa" }] : [];
    return HttpResponse.json({ items: data, total: data.length });
  }),

  http.get(`${API_URL}/api/v1/specialties`, () =>
    HttpResponse.json({
      items: [
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Medicina General", status: "ACTIVE" },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", name: "Cardiología", status: "ACTIVE" },
      ],
      total: 2,
    })
  ),

  http.get(`${API_URL}/api/v1/extensions`, () =>
    HttpResponse.json({
      items: [
        { id: "55555555-5555-4555-8555-555555555555", name: "Móvil" },
        { id: "66666666-6666-4666-8666-666666666666", name: "Casa" },
      ],
      total: 2,
    })
  ),

  http.get(`${API_URL}/api/v1/cargos`, () =>
    HttpResponse.json({
      items: [
        { id: "cargo-1", name: "Recepcionista" },
        { id: "cargo-2", name: "Enfermero/a" },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    })
  ),

  // ============ Proxy interno de la web (/api/proxy -> /api/v1) ============
  http.get(`${API_URL}/api/proxy/countries`, () =>
    HttpResponse.json({
      items: [
        { id: "11111111-1111-4111-8111-111111111111", name: "Honduras" },
        { id: "22222222-2222-4222-8222-222222222222", name: "Guatemala" },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
    })
  ),
  http.get(`${API_URL}/api/proxy/departments`, ({ request }) => {
    const countryId = new URL(request.url).searchParams.get("countryId");
    const data =
      countryId === "11111111-1111-4111-8111-111111111111"
        ? [{ id: "33333333-3333-4333-8333-333333333333", name: "Francisco Morazán" }]
        : [];
    return HttpResponse.json({ items: data, total: data.length });
  }),
  http.get(`${API_URL}/api/proxy/municipalities`, ({ request }) => {
    const departmentId = new URL(request.url).searchParams.get("departmentId");
    const data =
      departmentId === "33333333-3333-4333-8333-333333333333"
        ? [{ id: "44444444-4444-4444-8444-444444444444", name: "Tegucigalpa" }]
        : [];
    return HttpResponse.json({ items: data, total: data.length });
  }),
  http.get(`${API_URL}/api/proxy/specialties`, () =>
    HttpResponse.json({
      items: [
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Medicina General", status: "ACTIVE" },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", name: "Cardiología", status: "ACTIVE" },
      ],
      total: 2,
    })
  ),
  http.get(`${API_URL}/api/proxy/extensions`, () =>
    HttpResponse.json({
      items: [
        { id: "55555555-5555-4555-8555-555555555555", name: "Móvil" },
        { id: "66666666-6666-4666-8666-666666666666", name: "Casa" },
      ],
      total: 2,
    })
  ),
  http.get(`${API_URL}/api/proxy/cargos`, () =>
    HttpResponse.json({
      items: [
        { id: "cargo-1", name: "Recepcionista" },
        { id: "cargo-2", name: "Enfermero/a" },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
    })
  ),



  // ============ Staff-admin: roles, usuarios, empleados, doctores ============
  http.get(`${API_URL}/api/proxy/roles`, () =>
    HttpResponse.json({
      items: [
        { id: U("a1"), name: "ADMIN", description: null, status: "ACTIVE" },
        { id: U("d1"), name: "DOCTOR", description: null, status: "ACTIVE" },
        { id: U("p1"), name: "PATIENT", description: null, status: "ACTIVE" },
        { id: U("e1"), name: "EMPLOYEE", description: null, status: "ACTIVE" },
      ],
      total: 4,
    })
  ),
  http.get(`${API_URL}/api/proxy/users`, ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get("email") ?? "";
    const estado = url.searchParams.get("status") ?? "";
    const rol = url.searchParams.get("role") ?? "";
    let items = [
      {
        id: U("u1"),
        email: "ana@example.com",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        fullName: "Ana Pérez",
        roles: ["PATIENT"],
      },
      {
        id: U("u2"),
        email: "rojas@example.com",
        status: "INACTIVE",
        createdAt: new Date().toISOString(),
        fullName: "Roja Rojas",
        roles: ["DOCTOR", "EMPLOYEE"],
      },
    ];
    if (email) items = items.filter((u) => u.email.includes(email));
    if (estado) items = items.filter((u) => u.status === estado);
    if (rol) items = items.filter((u) => u.roles.includes(rol));
    return HttpResponse.json({
      items,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 20),
      total: items.length,
      totalPages: 1,
    });
  }),
  http.post(`${API_URL}/api/proxy/users`, async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      person?: { dni?: string };
    };
    if (body.email === "ana@example.com") {
      return conflict("El correo ya está registrado");
    }
    if (body.person?.dni === DNI_DUPLICADO) {
      return conflict("El DNI ya está registrado");
    }
    return HttpResponse.json(
      {
        id: U("nuevo"),
        email: body.email ?? "",
        status: "ACTIVE",
        roles: ["PATIENT"],
        fullName: "Nuevo Usuario",
      },
      { status: 201 }
    );
  }),
  http.patch(`${API_URL}/api/proxy/users/:id/status`, async ({ request, params }) => {
    const body = (await request.json()) as { status: string };
    void params;
    return HttpResponse.json({ id: U("u1"), status: body.status });
  }),
  http.post(`${API_URL}/api/proxy/users/:id/roles`, () =>
    HttpResponse.json({ userId: U("u1"), roleId: U("e1"), status: "ACTIVE", roleName: "EMPLOYEE" })
  ),
  http.delete(`${API_URL}/api/proxy/users/:id/roles/:roleId`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.get(`${API_URL}/api/proxy/employees`, () =>
    HttpResponse.json({
      items: [
        {
          id: U("emp1"),
          email: "luisa@example.com",
          fullName: "Luisa Port",
          roles: ["EMPLOYEE"],
          currentCargo: "Recepcionista",
          status: "ACTIVE",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    })
  ),
  http.post(`${API_URL}/api/proxy/employees`, ({ request }) => {
    void request;
    return HttpResponse.json(
      { id: U("emp-nuevo"), status: "ACTIVE", userId: U("u1"), email: "ana@example.com", fullName: "Ana Pérez" },
      { status: 201 }
    );
  }),
  http.patch(`${API_URL}/api/proxy/employees/:id`, ({ params }) =>
    HttpResponse.json({ id: String(params.id), status: "INACTIVE" })
  ),
  http.post(`${API_URL}/api/proxy/employees/:id/cargos`, () =>
    HttpResponse.json(
      {
        employeeId: U("emp1"),
        cargoId: "cargo-2",
        cargoName: "Enfermero/a",
        assignedAt: new Date().toISOString(),
      },
      { status: 201 }
    )
  ),
  http.get(`${API_URL}/api/proxy/employees/:id/cargos`, () =>
    HttpResponse.json({
      items: [
        { cargoName: "Recepcionista", assignedAt: "2026-01-15T00:00:00.000Z" },
      ],
      total: 1,
    })
  ),
  http.get(`${API_URL}/api/proxy/doctors`, ({ request }) => {
    const specialtyId = new URL(request.url).searchParams.get("specialtyId");
    const items = [
      {
        id: U("doc1"),
        email: "rojas@example.com",
        fullName: "Roja Rojas",
        specialties: ["Cardiología"],
        status: "ACTIVE",
      },
    ].filter((d) => !specialtyId || d.specialties.length > 0);
    return HttpResponse.json({
      items,
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: 1,
    });
  }),
  http.post(`${API_URL}/api/proxy/doctors`, () =>
    HttpResponse.json(
      { id: U("doc-nuevo"), status: "ACTIVE", employeeId: U("emp1"), email: "luisa@example.com", fullName: "Luisa Port" },
      { status: 201 }
    )
  ),
  http.patch(`${API_URL}/api/proxy/doctors/:id`, ({ params }) =>
    HttpResponse.json({ id: String(params.id), status: "INACTIVE" })
  ),
  http.post(`${API_URL}/api/proxy/doctors/:id/specialties`, () =>
    HttpResponse.json(
      { doctorId: U("doc1"), specialtyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", specialtyName: "Medicina General", status: "ACTIVE" },
      { status: 201 }
    )
  ),
  http.delete(`${API_URL}/api/proxy/doctors/:id/specialties/:specialtyId`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  // ============ Perfil: teléfonos, users/me, patients/me ============
  http.get(`${API_URL}/api/proxy/phones`, () =>
    HttpResponse.json({
      items: [
        { id: "tel-1", number: "9999112233", extensionName: "Móvil" },
      ],
    })
  ),
  http.post(`${API_URL}/api/proxy/phones`, async ({ request }) => {
    const body = (await request.json()) as { number?: string };
    if (!body.number || body.number.length < 6) {
      return HttpResponse.json(
        { title: "Datos inválidos", status: 400, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    return HttpResponse.json(
      { id: "tel-nuevo", number: body.number, extensionName: "Móvil" },
      { status: 201 }
    );
  }),
  http.delete(`${API_URL}/api/proxy/phones/:id`, () => new HttpResponse(null, { status: 204 })),
  http.patch(`${API_URL}/api/proxy/users/me`, () =>
    HttpResponse.json({ message: "Perfil actualizado" })
  ),
  http.patch(`${API_URL}/api/proxy/patients/me`, ({ request }) => {
    void request;
    return HttpResponse.json({ message: "Perfil actualizado", bloodType: "O_POSITIVE" });
  }),
  http.patch(`${API_URL}/api/proxy/patients/me/emergency-contact`, () =>
    HttpResponse.json({
      emergencyContactName: "María",
      emergencyContactNumber: "9999000111",
    })
  ),


  // ============ Horarios (schedules) ============
  http.get(`${API_URL}/api/proxy/schedules`, ({ request }) => {
    const url = new URL(request.url);
    const doctorId = url.searchParams.get("doctorId");
    const specialtyId = url.searchParams.get("specialtyId");
    let items = [
      { id: "sched-1", doctorName: "Roja Rojas", specialtyName: "Cardiología", daysBitmask: 62, startTime: "08:00", endTime: "12:00", slotCapacity: 10, status: "ACTIVE" },
      { id: "sched-2", doctorName: "Ana Pérez", specialtyName: "Medicina General", daysBitmask: 62, startTime: "14:00", endTime: "18:00", slotCapacity: 5, status: "ACTIVE" },
    ];
    if (doctorId) items = items.filter(i => i.id.includes(doctorId.slice(0,4)) || true);
    if (specialtyId) void specialtyId;
    return HttpResponse.json({ items, page: 1, pageSize: 10, total: items.length, totalPages: 1 });
  }),
  http.post(`${API_URL}/api/proxy/schedules`, async ({ request }) => {
    const body = await request.json() as { startTime?: string; endTime?: string; slotCapacity?: number; daysBitmask?: number };
    if (body.startTime && body.endTime && body.endTime <= body.startTime) {
      return HttpResponse.json({ title: "La hora fin debe ser posterior al inicio", status: 422, detail: "La hora fin debe ser posterior al inicio" }, { status: 422 });
    }
    if (body.slotCapacity !== undefined && body.slotCapacity < 1) {
      return HttpResponse.json({ title: "Mínimo 1 cupo", status: 422 }, { status: 422 });
    }
    return HttpResponse.json({ id: "sched-nuevo", ...body }, { status: 201 });
  }),
  http.patch(`${API_URL}/api/proxy/schedules/:id`, async ({ request }) => {
    const body = await request.json() as { slotCapacity?: number };
    if (body.slotCapacity !== undefined && body.slotCapacity < 5) {
      // simula rechazo por reservas existentes si se intenta reducir bajo 5
      return HttpResponse.json({ title: "No se puede reducir por debajo de las reservas existentes", status: 409, detail: "No se puede reducir por debajo de las reservas existentes" }, { status: 409 });
    }
    return HttpResponse.json({ id: "sched-1", status: "ACTIVE" });
  }),
  http.delete(`${API_URL}/api/proxy/schedules/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/api/proxy/schedules/availability`, ({ request }) => {
    const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0,10);
    return HttpResponse.json({
      date,
      items: [
        { scheduleId: "sched-1", startTime: "08:00", endTime: "12:00", slotCapacity: 10, booked: 2, available: 8 },
        { scheduleId: "sched-2", startTime: "14:00", endTime: "18:00", slotCapacity: 5, booked: 5, available: 0 },
      ].filter(s => s.available > 0),
    });
  }),
  // ============ Citas (appointments) ============
  http.get(`${API_URL}/api/proxy/appointments`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = [
      { id: "cita-1", date: new Date().toISOString().slice(0,10), position: 1, status: "PENDING", observation: null, patientId: "pat-1", patientName: "Ana Pérez", scheduleId: "sched-1", startTime: "08:00", endTime: "12:00", specialtyName: "Cardiología", doctorId: "doc1", doctorName: "Roja Rojas" },
      { id: "cita-2", date: new Date(Date.now()+86400000).toISOString().slice(0,10), position: 2, status: "CONFIRMED", observation: "Control", patientId: "pat-1", patientName: "Ana Pérez", scheduleId: "sched-1", startTime: "08:00", endTime: "12:00", specialtyName: "Cardiología", doctorId: "doc1", doctorName: "Roja Rojas" },
    ];
    if (status) items = items.filter(i => i.status === status);
    return HttpResponse.json({ items, page: 1, pageSize: 10, total: items.length, totalPages: 1 });
  }),
  http.post(`${API_URL}/api/proxy/appointments`, async ({ request }) => {
    const body = await request.json() as { scheduleId?: string };
    if (body.scheduleId === "sched-2") {
      return HttpResponse.json({ title: "Horario completo", status: 409, detail: "Horario completo" }, { status: 409 });
    }
    return HttpResponse.json({ id: "cita-nueva", position: 3, status: "PENDING" }, { status: 201 });
  }),
  http.patch(`${API_URL}/api/proxy/appointments/:id/status`, async ({ request }) => {
    const body = await request.json() as { status: string };
    return HttpResponse.json({ id: "cita-1", status: body.status, previousStatus: "PENDING" });
  }),
  http.post(`${API_URL}/api/proxy/appointments/:id/observations`, () =>
    HttpResponse.json({ id: "cita-1", observation: "Nota guardada" })
  ),

  http.post(`${API_URL}/api/v1/auth/register`, async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      person?: { dni?: string };
    };
    if (body.email === "ana@example.com") {
      return HttpResponse.json(
        {
          type: "https://medicitas.example.com/problems/conflict",
          title: "Conflicto con el estado actual del recurso",
          status: 409,
          detail: "El correo ya está registrado",
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }
    if (body.person?.dni === "0801199500432") {
      return HttpResponse.json(
        {
          type: "https://medicitas.example.com/problems/conflict",
          title: "Conflicto con el estado actual del recurso",
          status: 409,
          detail: "El DNI ya está registrado",
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }
    return HttpResponse.json(
      {
        user: { id: "u-nuevo", email: body.email ?? "" },
        accessToken: "access-token-registro-con-longitud-suficiente",
        refreshToken: "refresh-token-registro-con-longitud-suficiente",
      },
      { status: 201 }
    );
  }),
];

export const mswServer = setupServer(...handlers);
