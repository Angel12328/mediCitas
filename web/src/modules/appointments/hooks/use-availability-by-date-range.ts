"use client"
import { useQueries } from "@tanstack/react-query"
import { appUrl } from "@/shared/api/client-url"
import type { AvailabilitySlot } from "@/modules/schedules/queries"

interface UseAvailabilityByDateRangeParams {
  specialtyId?: string
  doctorId?: string
  startDate: string
  endDate: string
  enabled?: boolean
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const current = new Date(start)
  const last = new Date(end)
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

async function fetchAvailabilityForDate(
  specialtyId: string,
  doctorId: string | undefined,
  date: string
): Promise<AvailabilitySlot[]> {
  const params = new URLSearchParams({ specialtyId, date })
  if (doctorId) params.set("doctorId", doctorId)
  const r = await fetch(appUrl(`/api/proxy/schedules/availability?${params}`), { cache: "no-store" })
  if (!r.ok) {
    const b = await r.json().catch(() => null) as { title?: string } | null
    throw new Error(b?.title ?? `Error ${r.status}`)
  }
  const data = await r.json() as { date: string; items: AvailabilitySlot[] }
  return data.items
}

export function useAvailabilityByDateRange({
  specialtyId,
  doctorId,
  startDate,
  endDate,
  enabled = true,
}: UseAvailabilityByDateRangeParams) {
  const dates = generateDateRange(startDate, endDate)
  const canFetch = Boolean(specialtyId && enabled)

  const queries = useQueries({
    queries: dates.map((date) => ({
      queryKey: ["availability", doctorId ?? null, specialtyId, date],
      queryFn: () => fetchAvailabilityForDate(specialtyId!, doctorId, date),
      enabled: canFetch,
      staleTime: 1000 * 60 * 5,
    })),
  })

  const availabilityByDate = new Map<string, AvailabilitySlot[]>()
  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)

  queries.forEach((q, i) => {
    if (q.data) {
      availabilityByDate.set(dates[i], q.data)
    }
  })

  return { availabilityByDate, isLoading, isError }
}
