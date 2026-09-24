import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../../modules/auth/token.service.js';
import { prisma } from '../database/client.js';
import type { RoleName } from '../auth/types.js';

interface AppointmentEvent {
  type: 'APPOINTMENT_STATUS_CHANGED' | 'APPOINTMENT_CREATED' | 'APPOINTMENT_OBSERVATION_ADDED';
  payload: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    scheduleId: string;
    status?: string;
    previousStatus?: string;
    date: string;
    position?: number;
  };
  timestamp: string;
}

interface WsSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  readyState: number;
}

const connections = new Map<string, Set<WsSocket>>();

function getDoctorConnections(doctorId: string): Set<WsSocket> {
  if (!connections.has(doctorId)) {
    connections.set(doctorId, new Set());
  }
  return connections.get(doctorId)!;
}

export function broadcastToDoctor(doctorId: string, event: AppointmentEvent): void {
  const conns = getDoctorConnections(doctorId);
  const message = JSON.stringify(event);
  for (const ws of conns) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}

function removeConnection(doctorId: string, ws: WsSocket): void {
  const conns = connections.get(doctorId);
  if (conns) {
    conns.delete(ws);
    if (conns.size === 0) {
      connections.delete(doctorId);
    }
  }
}

export async function websocketRoutes(app: FastifyInstance): Promise<void> {
  app.register(async function (instance) {
    instance.route({
      method: 'GET',
      url: '/ws/appointments',
      websocket: true,
      // @ts-expect-error - Fastify websocket types are tricky
      handler: async (socket: WsSocket, request: FastifyRequest) => {
        let user = request.user;

        if (!user) {
          const url = new URL(request.url, `http://${request.headers.host}`);
          const token = url.searchParams.get('token');
          if (token) {
            try {
              const payload = verifyAccessToken(token);
              user = {
                id: payload.sub,
                roles: (payload.roles ?? []) as RoleName[],
              };
            } catch {
              socket.close(4001, 'Invalid token');
              return;
            }
          }
        }

        if (!user || (!user.roles.includes('DOCTOR') && !user.roles.includes('ADMIN'))) {
          socket.close(4003, 'Forbidden');
          return;
        }

        const employee = await prisma.employee.findFirst({
          where: { userId: user.id, deletedAt: null },
          include: { doctor: { select: { id: true } } },
        });
        const doctorId = employee?.doctor?.id;
        if (!doctorId && !user.roles.includes('ADMIN')) {
          socket.close(4003, 'Doctor profile not found');
          return;
        }

        const targetDoctorId = doctorId ?? 'ADMIN';
        const conns = getDoctorConnections(targetDoctorId);
        conns.add(socket);

        socket.on('close', () => {
          removeConnection(targetDoctorId, socket);
        });

        socket.on('error', () => {
          removeConnection(targetDoctorId, socket);
        });

        socket.send(JSON.stringify({
          type: 'CONNECTED',
          payload: { doctorId: targetDoctorId },
          timestamp: new Date().toISOString(),
        }));
      },
    });
  });
}

export { AppointmentEvent };