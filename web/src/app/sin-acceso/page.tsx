export default function SinAccesoPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="text-center" data-testid="sin-acceso">
        <h1 className="text-2xl font-semibold">Acceso denegado</h1>
        <p className="mt-2 text-muted-foreground">
          No tienes permiso para ver esta página.
        </p>
        <a href="/login" className="mt-4 inline-block underline underline-offset-2">
          Volver al inicio de sesión
        </a>
      </div>
    </main>
  );
}
