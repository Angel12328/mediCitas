import { PersonalView } from "@/modules/staff-admin/components/personal-view";

export default function PersonalPage() {
  return (
    <section className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-balance">Personal</h1>
        <p className="text-sm text-muted-foreground">
          Empleados del consultorio, cargos e historial.
        </p>
      </header>
      <PersonalView />
    </section>
  );
}
