import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
