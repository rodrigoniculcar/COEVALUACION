# Arquitectura — Sistema de Autoevaluación y Coevaluación grupal

Este documento describe el diseño de la plataforma implementada en este repositorio: modelo de datos, stack
tecnológico, algoritmo de cálculo de la nota final ponderada, el user journey y las decisiones de seguridad.
El código en `src/` y `prisma/schema.prisma` es la implementación real de lo aquí descrito, no solo una
propuesta.

## 1. Roles y flujo general

| Rol | Puede hacer |
|---|---|
| **Docente** | Crear cursos, cargar estudiantes (credenciales), definir equipos, configurar rúbricas ponderadas, crear periodos de evaluación con pesos auto/co/docente, evaluar el desempeño de cada estudiante, abrir/cerrar periodos, ver el panel de resultados. |
| **Estudiante** | Iniciar sesión con las credenciales que le entrega el docente, autoevaluarse, coevaluar a cada integrante de su equipo bajo la misma rúbrica, ver sus propios resultados una vez cerrado el periodo. |

Flujo de datos: `Curso → Inscripcion (matrícula) → Grupo/MiembroGrupo (equipos) → Rubrica/CriterioRubrica →
PeriodoEvaluacion (pesos) → Evaluacion/DetalleEvaluacion (auto/co/docente) → Resultado (nota final + feedback)`.

## 2. Modelo de datos

Implementado en `prisma/schema.prisma`. Entidades principales:

- **User** — cuenta única con `rol` (`DOCENTE` | `ESTUDIANTE`). Un mismo modelo de usuario para ambos roles
  simplifica la autenticación; el rol determina qué puede hacer (ver sección de seguridad).
- **Curso** — pertenece a un docente (`docenteId`). Contiene inscripciones, grupos, rúbricas y periodos.
- **Inscripcion** — matrícula de un estudiante en un curso (N:M entre `User` y `Curso` con datos propios).
- **Grupo** / **MiembroGrupo** — equipo de trabajo dentro de un curso y su relación N:M con estudiantes.
- **Rubrica** — reutilizable dentro de un curso; define una escala (`escalaMin`–`escalaMax`, ej. 1-5).
- **CriterioRubrica** — criterio de la rúbrica con su `ponderacion` (%). La suma de ponderaciones de los
  criterios de una rúbrica debe ser 100 (validado en `POST /api/cursos/[id]/rubricas`).
- **PeriodoEvaluacion** — ventana de tiempo que usa una rúbrica y define `pesoAutoevaluacion`,
  `pesoCoevaluacion` y `pesoDocente` (deben sumar 100). Tiene un `estado`: `BORRADOR → ABIERTO → CERRADO`.
- **Evaluacion** — una "planilla" de rúbrica llenada por un `evaluador` sobre un `evaluado`, de tipo
  `AUTOEVALUACION` (evaluador = evaluado), `COEVALUACION` (evaluador = compañero de equipo) o `DOCENTE`
  (evaluador = docente del curso). Restringida por una clave única
  `(periodoId, tipo, evaluadorId, evaluadoId)` que impide doble envío (el reenvío actualiza la evaluación
  existente en vez de duplicarla).
- **DetalleEvaluacion** — puntaje (dentro de la escala de la rúbrica) que una `Evaluacion` asigna a cada
  `CriterioRubrica`.
- **Resultado** — nota final ya calculada y cacheada por estudiante y periodo: `notaAutoevaluacion`,
  `notaCoevaluacion`, `notaDocente`, `notaFinal`, un JSON `detalleCriterios` (promedio por criterio, usado
  para detectar puntos críticos) y un texto `retroalimentacion` generado automáticamente. Se recalcula cada
  vez que se registra una evaluación y al cerrar el periodo (`src/lib/resultados.ts`).

```
User ──< Inscripcion >── Curso ──< Grupo ──< MiembroGrupo >── User
 │                          │
 │                          ├──< Rubrica ──< CriterioRubrica
 │                          └──< PeriodoEvaluacion >── Rubrica
 │
 ├──< Evaluacion (evaluador) ──< DetalleEvaluacion >── CriterioRubrica
 ├──< Evaluacion (evaluado)
 └──< Resultado
```

## 3. Stack tecnológico

| Capa | Elección | Motivo |
|---|---|---|
| Frontend + Backend | **Next.js 14 (App Router) + TypeScript** | Un solo repo/deploy en Vercel (ya vinculado), API Routes para el backend, Server Components para lecturas iniciales rápidas. |
| Autenticación | **NextAuth.js** (Credentials Provider) + **bcryptjs** | Sesión JWT sin tablas adicionales, control fino de roles vía middleware. |
| Base de datos | **PostgreSQL** (Neon / Vercel Postgres / Supabase) | Relacional, ideal para el modelo con muchas relaciones N:M (inscripciones, equipos, evaluaciones) e integridad referencial. |
| ORM | **Prisma** | Migraciones versionadas, tipado end-to-end del modelo de datos. |
| Validación | **Zod** | Valida payloads de cada API route antes de tocar la base de datos. |
| UI | **Tailwind CSS** | Velocidad de desarrollo, consistente con un MVP. |
| Gráficos | **Recharts** | Barras para indicadores críticos y promedios por equipo en el panel de resultados. |
| Hosting | **Vercel** (ya vinculado) | Despliegue nativo de Next.js, variables de entorno, previews por PR. |

## 4. Algoritmo de cálculo de la nota final ponderada

Implementado en `src/lib/grading.ts` (funciones puras, testeables) y orquestado por
`src/lib/resultados.ts` (que trae los datos de Prisma y persiste el `Resultado`).

**Paso 1 — Normalizar cada puntaje.** Cada `DetalleEvaluacion.puntaje` vive en la escala de la rúbrica
(p. ej. 1-5). Se normaliza a 0-100:

```
normalizado = (puntaje - escalaMin) / (escalaMax - escalaMin) * 100
```

**Paso 2 — Nota de una Evaluacion individual.** Se pondera cada criterio según `CriterioRubrica.ponderacion`:

```
notaEvaluacion = Σ ( normalizado_criterio_i * ponderacion_i / 100 )
```

**Paso 3 — Agregar por tipo.**
- `notaAutoevaluacion` = nota de la (única) autoevaluación del estudiante.
- `notaCoevaluacion` = **promedio** de las notas que le asignó cada compañero de equipo.
- `notaDocente` = nota que el docente asignó a ese estudiante.

**Paso 4 — Nota final ponderada.**

```
notaFinal = ( notaAutoevaluacion * pesoAutoevaluacion
            + notaCoevaluacion   * pesoCoevaluacion
            + notaDocente        * pesoDocente ) / 100
```

Los tres pesos se configuran por periodo (`PeriodoEvaluacion.pesoAutoevaluacion/pesoCoevaluacion/pesoDocente`)
y deben sumar 100 (validado al crear el periodo). Si algún componente todavía no existe (p. ej. el docente
no ha evaluado), su peso se **redistribuye proporcionalmente** entre los componentes disponibles en vez de
tratarse como 0 — así una nota parcial no penaliza injustamente al estudiante mientras el periodo sigue
abierto; el resultado se marca como `completo: false` y el texto de retroalimentación lo indica.

**Puntos críticos (indicadores más bajos).** Además del total, se calcula el mismo promedio ponderado
*por criterio* (no solo el agregado), lo que permite ordenar los criterios de menor a mayor puntaje y
marcar como "punto crítico" a los que caen bajo un umbral (60/100). Este mismo cálculo se agrega por
equipo y por curso (promediando los resultados individuales) para el panel de resultados.

**Retroalimentación automática.** `generarRetroalimentacion()` es una función determinística basada en
reglas (mismo input → mismo output): identifica el criterio más débil y el más fuerte, arma un mensaje según
el rango de la nota final, y lista los indicadores críticos con una sugerencia de mejora. Se implementó
como reglas explícitas (no un LLM) para que sea auditable y reproducible; el diseño deja espacio para en el
futuro reemplazar o enriquecer esa función con una llamada a un modelo de lenguaje (ej. Claude) que redacte
el mensaje en lenguaje más natural a partir de los mismos datos estructurados.

## 5. User Journey simplificado

1. **Docente** crea su cuenta (`/registro`) y crea un curso (`/docente` → "Crear curso").
2. **Docente** carga estudiantes pegando `Nombre, correo` por línea (`/docente/cursos/[id]/estudiantes`).
   Si el correo no existe, se crea la cuenta con una contraseña temporal que se muestra **una sola vez** para
   que el docente la comparta por un canal seguro.
3. **Docente** arma los equipos seleccionando estudiantes (`/docente/cursos/[id]/grupos`).
4. **Docente** configura una rúbrica con criterios y ponderaciones que suman 100%
   (`/docente/cursos/[id]/rubricas`).
5. **Docente** crea un periodo de evaluación eligiendo la rúbrica, las fechas y los pesos de
   auto/co/docente (`/docente/cursos/[id]/periodos`) y lo **abre**.
6. **Estudiante** inicia sesión, ve el periodo abierto (`/estudiante`) y completa su autoevaluación y la
   coevaluación de cada compañero de equipo (`/estudiante/periodos/[id]/evaluar`), con un checklist de
   pendientes.
7. **Docente** evalúa a cada estudiante con la misma rúbrica (`/docente/cursos/[id]/periodos/[id]/evaluar`).
8. **Docente** cierra el periodo; el sistema recalcula automáticamente la nota final de todos los
   estudiantes y genera la retroalimentación.
9. **Docente** revisa el panel de resultados por curso, equipo e individuo, con los indicadores más bajos
   (`/docente/cursos/[id]/periodos/[id]/resultados`).
10. **Estudiante** ve su nota final, el detalle por criterio y su retroalimentación
    (`/estudiante/resultados`) — solo visible una vez el periodo está cerrado, para no sesgar la
    coevaluación mientras está en curso.

## 6. Seguridad y autenticación

- **Contraseñas**: nunca se almacenan en texto plano. Se guarda solo el hash (`bcryptjs`, 12 rounds) en
  `User.passwordHash`. Las contraseñas temporales generadas al cargar estudiantes se muestran una única vez
  en la respuesta de la API y no se pueden recuperar después (`src/app/api/cursos/[id]/estudiantes/route.ts`).
- **Autenticación**: NextAuth con `CredentialsProvider` y estrategia de sesión **JWT** (no requiere tablas de
  sesión en la base de datos). El `authorize()` corre en el servidor y compara el hash con `bcrypt.compare`.
- **Autorización por rol**: el rol viaja dentro del JWT/sesión (`src/types/next-auth.d.ts`,
  `src/lib/auth.ts`). `src/middleware.ts` bloquea a nivel de ruta el acceso cruzado (`/docente/*` exige rol
  `DOCENTE`, `/estudiante/*` exige rol `ESTUDIANTE`). Cada API route además revalida el rol y la propiedad
  del recurso en el servidor (`src/lib/session.ts`, `src/lib/cursos.ts`) — el middleware protege la UI, pero
  la autorización real vive en el backend.
- **Aislamiento de datos entre docentes/cursos**: cada operación verifica que el curso pertenezca al
  docente autenticado (`requireCursoDelDocente`) o que el estudiante esté matriculado
  (`requireInscripcion`) antes de leer o escribir.
- **Validación de entrada**: todos los payloads de API se validan con Zod antes de tocar Prisma, evitando
  inyecciones de tipos inesperados; Prisma además parametriza las consultas SQL (protección contra
  inyección SQL).
- **Cambio de contraseña**: `PATCH /api/perfil/password` permite a cualquier usuario autenticado (docente o
  estudiante) cambiar su contraseña temporal por una propia. Se recomienda como buena práctica exigir este
  cambio en el primer login (no forzado en este MVP, pero el endpoint ya existe para agregarlo fácilmente).
- **Nunca auto-registro de estudiantes**: `/api/auth/registro` crea exclusivamente cuentas `DOCENTE`; los
  estudiantes solo obtienen credenciales cuando el docente los carga a un curso, evitando que cualquiera se
  autoasigne el rol estudiante o se inscriba en cursos ajenos.
- **Secretos**: `NEXTAUTH_SECRET` y `DATABASE_URL` viven en variables de entorno (`.env`, nunca commiteadas;
  ver `.env.example`) y se configuran como Environment Variables en Vercel para producción.

## 7. Cómo correr el proyecto

```bash
cp .env.example .env          # completar DATABASE_URL y NEXTAUTH_SECRET
npm install
npm run db:push               # crea las tablas según prisma/schema.prisma
npm run db:seed                # datos de demo: docente + 6 estudiantes + 2 equipos + 1 periodo abierto
npm run dev
```

Credenciales de demo tras el seed: `docente@demo.edu` / `Demo1234` y estudiantes
`nombre.apellido@demo.edu` / `Demo1234` (ver salida del script `db:seed`).

### Despliegue en Vercel

1. En el proyecto de Vercel (ya vinculado a este repo), agregar las variables de entorno `DATABASE_URL`
   (Postgres administrado: Vercel Postgres, Neon o Supabase), `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
   y `NEXTAUTH_URL` (la URL pública del despliegue).
2. El `build` (`package.json`) ya ejecuta `prisma generate` antes de `next build`.
3. Antes del primer despliegue (o tras cambios de esquema) correr las migraciones contra la base de datos de
   producción: `npx prisma migrate deploy` (recomendado para producción en vez de `db push`).
