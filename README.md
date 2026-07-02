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

## Primer acceso en producción (Administrador)

En cada build (incluido Vercel) se ejecuta `prisma/bootstrap-admin.ts`, que crea automáticamente **una cuenta
Administrador y una cuenta Docente** si todavía no existen (es idempotente: si ya existen, no las toca). Las
credenciales iniciales están definidas en ese archivo. Después de entrar por primera vez con cualquiera de
las dos, **cambia la contraseña de inmediato** desde `PATCH /api/perfil/password` (ese valor inicial queda en
el código fuente del repositorio, así que no debe usarse de forma permanente).

Desde `/admin`, el Administrador puede crear más cuentas de docentes y estudiantes, activar/desactivar
cualquier cuenta, y ver/matricular estudiantes en cualquier curso de la plataforma.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run db:push` | Sincroniza el esquema sin generar migración (prototipado rápido) |
| `npm run db:migrate` | Crea/aplica migraciones (`prisma migrate dev`) |
| `npm run db:seed` | Carga datos de demo |
| `npm run db:bootstrap-admin` | Crea la cuenta Administrador y Docente iniciales (idempotente) |

## Despliegue en Vercel + Supabase

La app **no almacena archivos**: todos los datos (usuarios, cursos, rúbricas, evaluaciones, notas) viven en
PostgreSQL, así que con Supabase como base de datos es suficiente. No necesitas Supabase Storage.

### Paso 1 — Crear la base de datos en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) y elige una contraseña para la base de datos.
2. Ve a **Project Settings → Database → Connection string** y copia **dos** cadenas:
   - **Transaction pooler** (puerto `6543`) → será tu `DATABASE_URL`. Agrégale `?pgbouncer=true` al final.
   - **Direct connection** (puerto `5432`) → será tu `DIRECT_URL`.

   > Vercel es serverless: cada request abre una conexión nueva, por eso la app usa el *pooler* (6543). Las
   > migraciones, en cambio, necesitan la conexión directa (5432). El `schema.prisma` ya está configurado con
   > `url` + `directUrl` para esto.

### Paso 2 — Aplicar las migraciones a Supabase

Desde tu máquina, con las variables apuntando al proyecto Supabase:

```bash
DATABASE_URL="<transaction-pooler-6543>?pgbouncer=true" \
DIRECT_URL="<direct-5432>" \
npx prisma migrate deploy
```

### Paso 3 — Configurar Vercel

En **Vercel → Project Settings → Environment Variables** agregar:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | cadena Transaction pooler de Supabase (`...6543/postgres?pgbouncer=true`) |
| `DIRECT_URL` | cadena Direct connection de Supabase (`...5432/postgres`) |
| `NEXTAUTH_SECRET` | generar con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | la URL pública del deployment (`https://<tu-proyecto>.vercel.app`) |

### Paso 4 — Desplegar

Hacer push a la rama conectada — Vercel construye con `npm run build`, que ya incluye `prisma generate`.

(Opcional) Para cargar datos de demo en Supabase: `DATABASE_URL=... DIRECT_URL=... npm run db:seed`. En un
entorno real no hace falta: el primer docente se crea desde `/registro` y carga sus propios estudiantes.

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
