// Tests de helpers de paginación (tarea 3.4)
import { describe, expect, it } from 'vitest';
import {
  buildOffsetPage,
  cursorAfter,
  decodeCursor,
  encodeCursor,
  parseOffsetQuery,
} from '../../../src/shared/pagination/pagination.js';
import { AppError } from '../../../src/shared/errors/app-error.js';

describe('paginación por offset', () => {
  it('aplica valores por defecto (page=1, pageSize=20)', () => {
    expect(parseOffsetQuery({})).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });

  it('limita pageSize a un máximo de 100', () => {
    const result = parseOffsetQuery({ page: '2', pageSize: '500' });
    expect(result.pageSize).toBe(100);
    expect(result.skip).toBe(100);
    expect(result.take).toBe(100);
  });

  it('usa valores por defecto ante entradas inválidas', () => {
    expect(parseOffsetQuery({ page: 'cero', pageSize: -5 })).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    });
  });

  it('calcula metadatos de página correctamente', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const page = buildOffsetPage(items, 95, { page: 3, pageSize: 20 });

    expect(page.total).toBe(95);
    expect(page.totalPages).toBe(5);
    expect(page.hasNextPage).toBe(true);
    expect(page.hasPreviousPage).toBe(true);

    const last = buildOffsetPage([], 95, { page: 5, pageSize: 20 });
    expect(last.hasNextPage).toBe(false);
    expect(last.hasPreviousPage).toBe(true);
  });
});

describe('paginación por cursor', () => {
  it('codifica y decodifica en roundtrip con Date y string', () => {
    const date = new Date('2026-08-22T12:00:00.000Z');
    const cursor = encodeCursor(date, 'abc-123');
    expect(decodeCursor(cursor)).toEqual({
      createdAt: '2026-08-22T12:00:00.000Z',
      id: 'abc-123',
    });
  });

  it('rechaza cursores inválidos con VALIDATION_ERROR', () => {
    for (const bad of ['no-es-base64!!!', Buffer.from('[1,2]').toString('base64url')]) {
      try {
        decodeCursor(bad);
        expect.unreachable(`debió lanzar error para: ${bad}`);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(400);
      }
    }
  });

  it('genera cláusula OR para orden estable (createdAt, id)', () => {
    const where = cursorAfter({ createdAt: '2026-08-01T00:00:00.000Z', id: 'x1' });
    expect(where).toHaveProperty('OR');
    const or = where['OR'] as Array<Record<string, unknown>>;
    expect(or).toHaveLength(2);
    expect(JSON.stringify(or)).toContain('gt');
  });
});
