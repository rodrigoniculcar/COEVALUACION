# Coevaluación

Plataforma de **Autoevaluación y Coevaluación grupal** para cursos: rúbricas ponderadas, autoevaluación,
coevaluación entre pares y evaluación docente combinadas en una nota final, con un panel de resultados por
curso/equipo/individuo, detección de indicadores críticos y retroalimentación automática.

El diseño completo (modelo de datos, algoritmo de cálculo, user journey y seguridad) está en
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Stack

Next.js 14 (App Router + TypeScript) · Prisma + PostgreSQL · NextAuth (Credentials + bcrypt) · Tailwind CSS ·
Recharts · Zod.

## Requisitos

- Node.js 20+
- Una base de datos PostgreSQL (local, Docker, Neon, Vercel Postgres o Supabase)

## Desarrollo local

```bash
cp .env.example .env   # completar DATABASE_URL y NEXTAUTH_SECRET

# Postgres local con Docker (opcional, si no tienes uno a mano):
docker compose up -d

npm install
npm run db:migrate     # aplica las migraciones (modo interactivo, crea una nueva si cambiaste el schema)
npm run db:seed        # datos de demo: docente + 6 estudiantes + 2 equipos + 1 periodo abierto
npm run dev
```

Abrir http://localhost:3000. Credenciales de demo (tras `db:seed`):

- Docente: `docente@demo.edu` / `Demo1234`
- Estudiantes: `ana.torres@demo.edu`, `luis.perez@demo.edu`, `camila.rojas@demo.edu`,
  `diego.soto@demo.edu`, `valentina.cruz@demo.edu`, `martin.ibanez@demo.edu` — todas con `Demo1234`.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run db:push` | Sincroniza el esquema sin generar migración (prototipado rápido) |
| `npm run db:migrate` | Crea/aplica migraciones (`prisma migrate dev`) |
| `npm run db:seed` | Carga datos de demo |

## Despliegue en Vercel

El proyecto ya está vinculado a Vercel y GitHub. Pasos:

1. En **Vercel → Project Settings → Environment Variables** agregar:
   - `DATABASE_URL`: cadena de conexión a tu Postgres administrado (Neon, Vercel Postgres o Supabase).
   - `NEXTAUTH_SECRET`: generar con `openssl rand -base64 32`.
   - `NEXTAUTH_URL`: la URL pública del deployment (`https://<tu-proyecto>.vercel.app`).
2. Antes del primer deploy (o después de cambiar `prisma/schema.prisma`), aplicar las migraciones a la base
   de producción: `DATABASE_URL="<prod>" npx prisma migrate deploy`.
3. Hacer push a la rama conectada — Vercel construye con `npm run build`, que ya incluye `prisma generate`.
4. (Opcional) Correr `npm run db:seed` contra la base de producción solo si quieres datos de demo; en un
   entorno real, el primer docente se crea desde `/registro` y carga sus propios estudiantes.

## Estructura del proyecto

```
prisma/schema.prisma        Modelo de datos
prisma/seed.ts               Datos de demo
src/lib/grading.ts           Algoritmo de cálculo de la nota ponderada + retroalimentación
src/lib/resultados.ts        Orquesta el recálculo y guardado de Resultado por periodo
src/lib/auth.ts              Configuración de NextAuth (Credentials + bcrypt)
src/middleware.ts             Protección de rutas /docente y /estudiante por rol
src/app/api/**                API routes (cursos, estudiantes, grupos, rúbricas, periodos, evaluaciones...)
src/app/docente/**            UI del docente
src/app/estudiante/**         UI del estudiante
```
