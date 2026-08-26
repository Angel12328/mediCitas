import { DoctoresView } from "@/modules/staff-admin/components/doctores-view";

export default function DoctoresPage() {
  return (
    <section className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-balance">Doctores</h1>
        <p className="text-sm text-muted-foreground">
          Médicos del consultorio y sus especialidades.
        </p>
      </header>
      <DoctoresView />
    </section>
  );
}
