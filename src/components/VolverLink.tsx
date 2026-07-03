import Link from "next/link";

export function VolverLink({ href, texto = "Volver" }: { href: string; texto?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
      ← {texto}
    </Link>
  );
}
