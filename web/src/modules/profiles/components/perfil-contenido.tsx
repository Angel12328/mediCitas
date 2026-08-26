/**
 * Contenido de la vista de perfil - mediCitas web
 * Componente puro (testeable): compone editor, teléfonos y datos clínicos
 * según el rol/perfil recibido.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileEditor } from "./profile-editor";
import { PhonesManager } from "./phones-manager";
import { ClinicalData } from "./clinical-data";
import type { PerfilResponse } from "../schemas";

export function PerfilContenido({ perfil }: { perfil: PerfilResponse }) {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-balance">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          {perfil.person.fullName} · {perfil.email}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Datos personales</CardTitle>
          <CardDescription>
            Actualiza tu información de contacto y residencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8">
          <ProfileEditor perfil={perfil} />
          <PhonesManager personId={perfil.person.id} />
        </CardContent>
      </Card>

      {perfil.patient ? (
        <Card data-testid="clinicos-card">
          <CardHeader>
            <CardTitle className="text-balance">Datos clínicos</CardTitle>
            <CardDescription>
              Información médica útil para tu atención.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClinicalData
              bloodTypeInicial={perfil.patient.bloodType}
              allergiesInicial={null}
              contactoNombre={perfil.patient.emergencyContactName}
              contactoNumero={perfil.patient.emergencyContactNumber}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
