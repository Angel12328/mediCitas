import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DoctorCard } from "./doctor-card"
import type { DoctorItem } from "@/modules/staff-admin/queries"
import type { AvailabilitySlot } from "@/modules/schedules/queries"
import type { ScheduleItem } from "@/modules/schedules/queries"

const baseDoctor: DoctorItem = {
  id: "doc-1",
  email: "dr@example.com",
  fullName: "Dr. Test",
  specialties: ["Cardiología"],
  status: "ACTIVE",
}

const availabilitySummary = {
  hasAvailabilityThisWeek: true,
  hasAvailabilityThisMonth: true,
  nextAvailableDate: "2026-09-08",
  nextSlot: { scheduleId: "sched-1", startTime: "08:00", endTime: "12:00", available: 8, total: 10 },
  totalSlotsThisMonth: 20,
  totalAvailableThisMonth: 80,
}

const noAvailabilitySummary = {
  hasAvailabilityThisWeek: false,
  hasAvailabilityThisMonth: false,
  nextAvailableDate: null,
  nextSlot: null,
  totalSlotsThisMonth: 0,
  totalAvailableThisMonth: 0,
}

describe("DoctorCard", () => {
  it("renders doctor name and specialty", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={availabilitySummary}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={vi.fn()}
      />
    )
    expect(screen.getByText("Dr. Test")).toBeInTheDocument()
    expect(screen.getByText("Cardiología")).toBeInTheDocument()
  })

  it("shows next slot time and available cups", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={availabilitySummary}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={vi.fn()}
      />
    )
    const card = screen.getByTestId("doctor-card-doc-1")
    expect(within(card).getByText(/Próximo:/)).toBeInTheDocument()
    expect(within(card).getByText(/08:00/)).toBeInTheDocument()
    expect(within(card).getByText(/cupos próximo/)).toBeInTheDocument()
  })

  it("shows 'Sin disponibilidad' when no availabilitySummary", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={undefined}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={vi.fn()}
      />
    )
    expect(screen.getByText("Sin disponibilidad")).toBeInTheDocument()
  })

  it("calls onSelect with doctor id when clicked", async () => {
    const onSelect = vi.fn()
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={availabilitySummary}
        selected={false}
        disabled={false}
        onSelect={onSelect}
        onViewAgenda={vi.fn()}
      />
    )
    // Click the main card button (not the "Ver agenda" button)
    await userEvent.click(screen.getByTestId("doctor-card-doc-1"))
    expect(onSelect).toHaveBeenCalledWith("doc-1")
  })

  it("calls onViewAgenda when 'Ver agenda' button clicked", async () => {
    const onViewAgenda = vi.fn()
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={availabilitySummary}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={onViewAgenda}
      />
    )
    await userEvent.click(screen.getByText("Ver agenda"))
    expect(onViewAgenda).toHaveBeenCalledWith("doc-1")
  })

  it("is disabled when availabilitySummary has no availability this month", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={noAvailabilitySummary}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={vi.fn()}
      />
    )
    const card = screen.getByTestId("doctor-card-doc-1")
    expect(card).toBeDisabled()
    expect(screen.getByText("Sin disponibilidad")).toBeInTheDocument()
  })

  it("has aria-pressed true when selected", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={availabilitySummary}
        selected={true}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={vi.fn()}
      />
    )
    const card = screen.getByTestId("doctor-card-doc-1")
    expect(card).toHaveAttribute("aria-pressed", "true")
  })

  it("has aria-pressed false when not selected", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        availabilitySummary={availabilitySummary}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
        onViewAgenda={vi.fn()}
      />
    )
    const card = screen.getByTestId("doctor-card-doc-1")
    expect(card).toHaveAttribute("aria-pressed", "false")
  })
})