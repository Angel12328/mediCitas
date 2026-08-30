import type { Metadata } from "next";
import { AgendarWizard } from "@/modules/appointments/components/agendar-wizard";

export const metadata: Metadata = {
  title: "Agendar cita",
  description:
    "Elige especialidad, doctor y horario disponible para agendar tu cita médica en mediCitas.",
  openGraph: {
    title: "Agendar cita · mediCitas",
    description:
      "Elige especialidad, doctor y horario disponible para agendar tu cita médica.",
  },
};

export default function AgendarPage() {
  return (
    <section className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-balance">Agendar cita</h1>
        <p className="text-sm text-muted-foreground">
          Elige especialidad, doctor y fecha para ver disponibilidad.
        </p>
      </header>
      <AgendarWizard />
    </section>
  );
}
