import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DoctorCard } from "./doctor-card"
import type { DoctorItem } from "@/modules/staff-admin/queries"
import type { AvailabilitySlot } from "@/modules/schedules/queries"

const baseDoctor: DoctorItem = {
  id: "doc-1",
  email: "dr@example.com",
  fullName: "Dr. Test",
  specialties: ["Cardiología"],
  status: "ACTIVE",
}

const slot: AvailabilitySlot = {
  scheduleId: "sched-1",
  startTime: "08:00",
  endTime: "12:00",
  slotCapacity: 10,
  booked: 2,
  available: 8,
}

const fullSlot: AvailabilitySlot = {
  scheduleId: "sched-2",
  startTime: "14:00",
  endTime: "18:00",
  slotCapacity: 5,
  booked: 5,
  available: 0,
}

describe("DoctorCard", () => {
  it("renders doctor name and specialty", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
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
        nextSlot={slot}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
      />
    )
    const card = screen.getByTestId("doctor-card-doc-1")
    expect(within(card).getByText(/08:00/)).toBeInTheDocument()
    expect(within(card).getByText(/12:00/)).toBeInTheDocument()
    expect(within(card).getByText(/cupos/)).toBeInTheDocument()
  })

  it("shows 'Sin disponibilidad' when no nextSlot", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        nextSlot={null}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
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
        nextSlot={slot}
        selected={false}
        disabled={false}
        onSelect={onSelect}
      />
    )
    await userEvent.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledWith("doc-1")
  })

  it("is aria-disabled when disabled prop is true", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        nextSlot={fullSlot}
        selected={false}
        disabled={true}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true")
  })

  it("is aria-disabled when nextSlot has 0 available", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        nextSlot={fullSlot}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true")
  })

  it("has aria-pressed true when selected", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        nextSlot={slot}
        selected={true}
        disabled={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
  })

  it("has aria-pressed false when not selected", () => {
    render(
      <DoctorCard
        doctor={baseDoctor}
        specialtyName="Cardiología"
        nextSlot={slot}
        selected={false}
        disabled={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
  })
})
