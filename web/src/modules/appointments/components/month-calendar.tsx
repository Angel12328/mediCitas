"use client"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MonthCalendarProps {
  selectedDate?: string
  availabilityByDate: Map<string, { available: number }[]>
  onDateSelect: (date: string) => void
  onMonthChange: (year: number, month: number) => void
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function MonthCalendar({
  selectedDate,
  availabilityByDate,
  onDateSelect,
  onMonthChange,
}: MonthCalendarProps) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startOffset = firstDayOfMonth(viewYear, viewMonth)

  const cells = useMemo(() => {
    const result: { day: number | null; date: string | null }[] = []
    for (let i = 0; i < startOffset; i++) {
      result.push({ day: null, date: null })
    }
    for (let d = 1; d <= totalDays; d++) {
      result.push({ day: d, date: toISODate(viewYear, viewMonth, d) })
    }
    while (result.length % 7 !== 0) {
      result.push({ day: null, date: null })
    }
    return result
  }, [viewYear, viewMonth, startOffset, totalDays])

  const goToPrevMonth = () => {
    const m = viewMonth === 0 ? 11 : viewMonth - 1
    const y = viewMonth === 0 ? viewYear - 1 : viewYear
    setViewYear(y)
    setViewMonth(m)
    onMonthChange(y, m)
  }

  const goToNextMonth = () => {
    const m = viewMonth === 11 ? 0 : viewMonth + 1
    const y = viewMonth === 11 ? viewYear + 1 : viewYear
    setViewYear(y)
    setViewMonth(m)
    onMonthChange(y, m)
  }

  const todayISO = toISODate(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="w-full" role="group" aria-label="Calendario de disponibilidad">
      <div className="flex items-center justify-between mb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={goToPrevMonth}
          aria-label="Mes anterior"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <h3 className="text-sm font-semibold">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={goToNextMonth}
          aria-label="Mes siguiente"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={MONTHS[viewMonth]}>
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-xs font-medium text-muted-foreground py-1"
            role="columnheader"
            aria-label={wd}
          >
            {wd}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={`empty-${i}`} className="size-9" role="gridcell" aria-hidden="true" />
          }
          const isPast = cell.date! < todayISO
          const isSelected = cell.date === selectedDate
          const slots = availabilityByDate.get(cell.date!) ?? []
          const hasAvailability = slots.some((s) => s.available > 0)
          const totalAvailable = slots.reduce((sum, s) => sum + s.available, 0)
          const isDisabled = isPast || !hasAvailability

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => !isDisabled && onDateSelect(cell.date!)}
              disabled={isDisabled}
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              aria-label={`${cell.day} de ${MONTHS[viewMonth]}${hasAvailability ? `, ${totalAvailable} cupos disponibles` : isPast ? ", pasado" : ", sin disponibilidad"}`}
              data-testid={`cal-day-${cell.date}`}
              role="gridcell"
              className={cn(
                "size-9 rounded-md text-sm flex flex-col items-center justify-center gap-0.5 transition-all",
                "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isDisabled && "text-muted-foreground/40 cursor-not-allowed",
                !isDisabled && !isSelected && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                isSelected && "bg-primary text-primary-foreground font-semibold",
                isPast && "line-through"
              )}
            >
              <span>{cell.day}</span>
              {hasAvailability && (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-primary"
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
