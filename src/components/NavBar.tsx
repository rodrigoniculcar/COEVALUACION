"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function NavBar({ links }: { links: { href: string; label: string }[] }) {
  const { data: session } = useSession();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-brand-600">
            Coevaluación
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
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
