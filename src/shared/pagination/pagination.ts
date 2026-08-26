// Helpers de paginación (offset y cursor) - mediCitas API
import { AppError } from '../errors/app-error.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface OffsetQuery {
  page?: unknown;
  pageSize?: unknown;
}

export interface OffsetParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface OffsetPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

/** Parsea page/pageSize de un query string con valores por defecto y límites. */
export function parseOffsetQuery(query: OffsetQuery): OffsetParams {
  const page = toPositiveInt(query.page, DEFAULT_PAGE);
  const pageSize = Math.min(toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Construye la respuesta de página a partir de items y el total. */
export function buildOffsetPage<T>(
  items: T[],
  total: number,
  params: Pick<OffsetParams, 'page' | 'pageSize'>
): OffsetPage<T> {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}

export interface CursorPayload {
  createdAt: string;
  id: string;
}

/** Codifica un cursor opaco (base64url de JSON con createdAt + id). */
export function encodeCursor(createdAt: Date | string, id: string): string {
  const payload: CursorPayload = {
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Decodifica un cursor; lanza VALIDATION_ERROR si es inválido. */
export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('estructura inválida');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch (cause) {
    throw new AppError('VALIDATION_ERROR', 'El cursor proporcionado no es válido', { cause });
  }
}

/** Cláusula where para Prisma: registros posteriores al cursor. */
export function cursorAfter(cursor: CursorPayload): Record<string, unknown> {
  return {
    OR: [
      { createdAt: { gt: new Date(cursor.createdAt) } },
      {
        createdAt: { equals: new Date(cursor.createdAt) },
        id: { gt: cursor.id },
      },
    ],
  };
}
