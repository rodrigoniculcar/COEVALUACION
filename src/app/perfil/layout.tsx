import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";

// Links del menú de perfil: los mismos que el rol tendría en su propio panel,
// para no perder la navegación al ir a "Mi perfil" (accesible desde
// cualquier rol, ver src/middleware.ts).
const linksPorRol: Record<string, { href: string; label: string }[]> = {
  ADMINISTRADOR: [
    { href: "/admin", label: "Resumen" },
    { href: "/admin/docentes", label: "Docentes" },
    { href: "/admin/estudiantes", label: "Estudiantes" },
    { href: "/admin/asignaturas", label: "Asignaturas" },
    { href: "/admin/periodos-academicos", label: "Años-semestre" },
  ],
  DOCENTE: [
    { href: "/docente", label: "Mis asignaturas" },
    { href: "/docente/rubricas", label: "Rúbricas" },
  ],
  ESTUDIANTE: [
    { href: "/estudiante", label: "Mis secciones" },
    { href: "/estudiante/resultados", label: "Mis resultados" },
  ],
};

export default async function PerfilLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const links = linksPorRol[session?.user?.rol ?? ""] ?? [];

  return (
    <div className="min-h-screen">
      <NavBar links={links} />
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
