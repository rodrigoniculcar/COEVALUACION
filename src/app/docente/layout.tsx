import { NavBar } from "@/components/NavBar";

const links = [
  { href: "/docente", label: "Mis asignaturas" },
  { href: "/docente/rubricas", label: "Rúbricas" },
];

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar links={links} />
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
