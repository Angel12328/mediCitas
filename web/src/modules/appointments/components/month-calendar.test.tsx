import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MonthCalendar } from "./month-calendar"
import type { AvailabilitySlot } from "@/modules/schedules/queries"

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const slotWithAvailability: AvailabilitySlot = {
  scheduleId: "sched-1",
  startTime: "08:00",
  endTime: "12:00",
  slotCapacity: 10,
  booked: 2,
  available: 8,
}

describe("MonthCalendar", () => {
  it("renders the current month name in Spanish", () => {
    const now = new Date()
    const monthName = MONTHS_ES[now.getMonth()]
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={new Map()}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument()
  })

  it("renders 7 day-of-week headers", () => {
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={new Map()}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    days.forEach((d) => {
      expect(screen.getByText(new RegExp(`^${d}$`))).toBeInTheDocument()
    })
  })

  it("calls onDateSelect when clicking a day with availability", async () => {
    const onDateSelect = vi.fn()
    const tomorrow = addDays(todayStr(), 1)
    const availMap = new Map<string, AvailabilitySlot[]>()
    availMap.set(tomorrow, [slotWithAvailability])
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={availMap}
        onDateSelect={onDateSelect}
        onMonthChange={vi.fn()}
      />
    )
    const btn = screen.getByTestId(`cal-day-${tomorrow}`)
    expect(btn).not.toBeDisabled()
    await userEvent.click(btn)
    expect(onDateSelect).toHaveBeenCalledWith(tomorrow)
  })

  it("disables past days", () => {
    const yesterday = addDays(todayStr(), -1)
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={new Map()}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    const btn = screen.getByTestId(`cal-day-${yesterday}`)
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute("aria-disabled", "true")
  })

  it("has role grid with month aria-label", () => {
    const now = new Date()
    const monthName = MONTHS_ES[now.getMonth()]
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={new Map()}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    const grid = screen.getByRole("grid")
    expect(grid).toHaveAttribute("aria-label", monthName)
  })

  it("marks selected date with aria-selected true when has availability", () => {
    const today = todayStr()
    const availMap = new Map<string, AvailabilitySlot[]>()
    availMap.set(today, [slotWithAvailability])
    render(
      <MonthCalendar
        selectedDate={today}
        availabilityByDate={availMap}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    const btn = screen.getByTestId(`cal-day-${today}`)
    expect(btn).toHaveAttribute("aria-selected", "true")
  })

  it("navigates to previous month", async () => {
    const onMonthChange = vi.fn()
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={new Map()}
        onDateSelect={vi.fn()}
        onMonthChange={onMonthChange}
      />
    )
    const prevBtn = screen.getByRole("button", { name: /mes anterior/i })
    await userEvent.click(prevBtn)
    expect(onMonthChange).toHaveBeenCalled()
  })

  it("navigates to next month", async () => {
    const onMonthChange = vi.fn()
    render(
      <MonthCalendar
        selectedDate={todayStr()}
        availabilityByDate={new Map()}
        onDateSelect={vi.fn()}
        onMonthChange={onMonthChange}
      />
    )
    const nextBtn = screen.getByRole("button", { name: /mes siguiente/i })
    await userEvent.click(nextBtn)
    expect(onMonthChange).toHaveBeenCalled()
  })
})
