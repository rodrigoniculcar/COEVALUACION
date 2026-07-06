import { NavBar } from "@/components/NavBar";

const links = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/docentes", label: "Docentes" },
  { href: "/admin/estudiantes", label: "Estudiantes" },
  { href: "/admin/asignaturas", label: "Asignaturas" },
  { href: "/admin/periodos-academicos", label: "Años-semestre" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar links={links} />
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
