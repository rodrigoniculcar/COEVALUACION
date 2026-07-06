"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function NavBar({ links }: { links: { href: string; label: string }[] }) {
  const { data: session } = useSession();
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFotoUrl(d?.fotoUrl ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-brand-600">
            <span className="text-brand-500">Duoc</span>
            <span className="text-navy-700">UC</span>
            <span className="hidden text-slate-400 sm:inline">· Coevaluación</span>
          </Link>
          <nav className="flex gap-5 text-sm text-slate-600">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-brand-600">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">{session?.user?.name}</span>
          <Link
            href="/perfil"
            title="Mi perfil"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 hover:border-brand-400"
          >
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="Mi perfil" className="h-full w-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="currentColor">
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
              </svg>
            )}
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
