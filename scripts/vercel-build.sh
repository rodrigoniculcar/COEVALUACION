#!/usr/bin/env bash
# Build de Vercel: genera el cliente Prisma, aplica migraciones y crea las
# cuentas iniciales (admin/docente) antes de compilar Next.js. Cada paso
# tiene un aviso no-fatal: si la base de datos aún no está configurada,
# el sitio igual se despliega (solo login/registro no funcionarán).
set -e

npx prisma generate

if ! npx prisma migrate deploy; then
  echo "AVISO: no se aplico la migracion (faltan DATABASE_URL/DIRECT_URL o son incorrectas). El sitio se despliega igual; revisa este log para confirmar que la migracion corrio."
fi

if ! npx tsx prisma/bootstrap-admin.ts; then
  echo "AVISO: no se pudieron crear las cuentas iniciales de administrador/docente. Revisa este log; probablemente la base de datos aun no esta disponible."
fi

npx next build
