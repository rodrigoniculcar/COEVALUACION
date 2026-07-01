import { NavBar } from "@/components/NavBar";

const links = [
  { href: "/docente", label: "Mis cursos" },
];

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar links={links} />
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
