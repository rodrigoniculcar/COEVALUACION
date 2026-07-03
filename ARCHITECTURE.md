# Arquitectura — Sistema de Autoevaluación y Coevaluación grupal

Este documento describe el diseño de la plataforma implementada en este repositorio: modelo de datos, stack
tecnológico, algoritmo de cálculo de la nota final ponderada, el user journey y las decisiones de seguridad.
El código en `src/` y `prisma/schema.prisma` es la implementación real de lo aquí descrito, no solo una
propuesta.

## 1. Roles y flujo general

| Rol | Puede hacer |
|---|---|
| **Administrador** | Crear cuentas docente y estudiante directamente (`/admin`), sin pasar por el registro público; activar/desactivar cualquier cuenta; ver y matricular estudiantes en cualquier curso de la plataforma, sin importar el docente dueño. |
| **Docente** | Crear cursos, cargar estudiantes (credenciales, incluida importación desde Excel/CSV), configurar rúbricas ponderadas (con criterios cuya visibilidad se puede restringir por tipo de evaluador), crear y **editar** periodos de evaluación con pesos auto/co/docente y exigencia de nota (60%/70%), definir y **editar** los equipos **de cada periodo** por separado, evaluar el desempeño de cada estudiante, abrir/cerrar periodos, restablecer contraseñas de estudiantes, ver y descargar el panel de resultados (PDF/Excel) con la nota final tanto en porcentaje como en escala chilena 1.0-7.0. |
| **Estudiante** | Iniciar sesión con las credenciales que le entrega el docente, autoevaluarse, coevaluar a cada integrante de su equipo bajo la misma rúbrica, ver sus propios resultados una vez cerrado el periodo. |

El campo `User.activo` permite al administrador desactivar una cuenta sin borrarla: `authorize()` en
`src/lib/auth.ts` rechaza el login si `activo = false`, aunque la contraseña sea correcta. Por diseño, no se
puede desactivar una cuenta `ADMINISTRADOR` desde el panel (evita bloqueos accidentales de la administración).

Las cuentas iniciales de Administrador y Docente se crean automáticamente en cada build de Vercel mediante
`prisma/bootstrap-admin.ts` (idempotente: si la cuenta ya existe, no la modifica). Las credenciales de esas
cuentas deben rotarse después del primer login (`PATCH /api/perfil/password`), ya que el valor inicial queda
en el código fuente.

Flujo de datos: `Curso → Inscripcion (matrícula) → Rubrica/CriterioRubrica → PeriodoEvaluacion (pesos +
exigencia) → Grupo/MiembroGrupo (equipos propios del periodo) → Evaluacion/DetalleEvaluacion (auto/co/docente)
→ Resultado (nota final + feedback)`. Los equipos cuelgan del periodo (no del curso) porque la conformación de
grupos puede cambiar de una evaluación a otra dentro del mismo curso (ver sección 2).

## 2. Modelo de datos

Implementado en `prisma/schema.prisma`. Entidades principales:

- **User** — cuenta única con `rol` (`DOCENTE` | `ESTUDIANTE`). Un mismo modelo de usuario para ambos roles
  simplifica la autenticación; el rol determina qué puede hacer (ver sección de seguridad).
- **Curso** — pertenece a un docente (`docenteId`). Contiene inscripciones, rúbricas y periodos.
- **Inscripcion** — matrícula de un estudiante en un curso (N:M entre `User` y `Curso` con datos propios).
- **PeriodoEvaluacion** — ventana de tiempo que usa una rúbrica y define `pesoAutoevaluacion`,
  `pesoCoevaluacion` y `pesoDocente` (deben sumar 100) y `escalaExigencia` (60 o 70, el % que se traduce a la
  nota de aprobación 4.0 en la escala 1-7). Tiene un `estado`: `BORRADOR → ABIERTO → CERRADO`.
- **Grupo** / **MiembroGrupo** — equipo de trabajo que pertenece a un **periodo** (`periodoId`, no al curso) y
  su relación N:M con estudiantes. Un mismo curso puede tener conformaciones de equipo completamente distintas
  en cada periodo de evaluación (p. ej. Equipos 1-5 en el Corte 1 y una reorganización distinta en el Corte 2);
  por eso el equipo se crea y se filtra dentro del periodo (`/docente/cursos/[id]/periodos/[periodoId]/grupos`,
  `src/app/api/periodos/[id]/grupos/route.ts`) en vez de vivir a nivel de curso.
- **Rubrica** — reutilizable dentro de un curso y asignable a uno o más periodos; define una escala
  (`escalaMin`–`escalaMax`, admite `escalaMin = 0`).
- **CriterioRubrica** — criterio de la rúbrica con su `ponderacion` (%) y tres flags independientes,
  `aplicaAutoevaluacion` / `aplicaCoevaluacion` / `aplicaDocente` (todas `true` por defecto), que controlan
  qué tipos de evaluador ven y llenan ese criterio — por ejemplo, un criterio de "puntualidad" puede
  restringirse a que solo lo califique el docente. La suma de ponderaciones de los criterios de una rúbrica
  debe ser 100 (validado en `POST /api/cursos/[id]/rubricas`) y cada criterio debe aplicar a al menos un tipo
  de evaluador.
- **Evaluacion** — una "planilla" de rúbrica llenada por un `evaluador` sobre un `evaluado`, de tipo
  `AUTOEVALUACION` (evaluador = evaluado), `COEVALUACION` (evaluador = compañero de equipo) o `DOCENTE`
  (evaluador = docente del curso). Restringida por una clave única
  `(periodoId, tipo, evaluadorId, evaluadoId)` que impide doble envío (el reenvío actualiza la evaluación
  existente en vez de duplicarla). El backend valida que los `detalles` enviados correspondan exactamente a
  los criterios aplicables a ese `tipo` (ver `criteriosAplicables()` en
  `src/app/api/periodos/[id]/evaluaciones/route.ts`).
- **DetalleEvaluacion** — puntaje (dentro de la escala de la rúbrica, que puede partir en 0) que una
  `Evaluacion` asigna a cada `CriterioRubrica`. En la UI se captura con un control de estrellas
  (`src/components/EscalaRating.tsx`) en vez de un slider numérico, para que sea más intuitivo distinguir
  "menos" de "más".
- **Resultado** — nota final ya calculada y cacheada por estudiante y periodo: `notaAutoevaluacion`,
  `notaCoevaluacion`, `notaDocente`, `notaFinal` (0-100), `notaEscala1a7` (1.0-7.0, ver sección 4), un JSON
  `detalleCriterios` (promedio por criterio, usado para detectar puntos críticos) y un texto
  `retroalimentacion` generado automáticamente. Se recalcula cada vez que se registra una evaluación y al
  cerrar el periodo (`src/lib/resultados.ts`).

```
User ──< Inscripcion >── Curso ──< Rubrica ──< CriterioRubrica
 │                          └──< PeriodoEvaluacion >── Rubrica
 │                                  │
 │                                  └──< Grupo ──< MiembroGrupo >── User
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

**Visibilidad de criterios por tipo de evaluador.** Antes de calcular `notaEvaluacion` para una fuente dada
(auto/co/docente), la lista de criterios se filtra a los que tienen el flag correspondiente en `true`
(`aplicaAutoevaluacion`/`aplicaCoevaluacion`/`aplicaDocente`). El filtrado ocurre **antes** de sumar
`pesoTotal`, no después, para que los criterios no aplicables a esa fuente no diluyan el promedio ponderado
de los que sí aplican (`calcularResultadoEstudiante` en `src/lib/grading.ts`).

**Nota final en escala chilena 1.0-7.0.** Además de `notaFinal` (0-100), se calcula `notaEscala1a7`
mediante `convertirAEscala1a7(porcentaje, exigencia)`: la `exigencia` (`PeriodoEvaluacion.escalaExigencia`,
60 o 70) es el porcentaje que se traduce a la nota de aprobación 4.0. Bajo la exigencia, la nota interpola
linealmente entre 1.0 y 4.0; en o sobre la exigencia, interpola entre 4.0 y 7.0:

```
si pct < exigencia:  nota = 1 + (pct / exigencia) * 3
si pct >= exigencia: nota = 4 + ((pct - exigencia) / (100 - exigencia)) * 3
```

El resultado se redondea a un decimal. Cambiar la exigencia de un periodo ya cerrado dispara un
recálculo (`PATCH /api/periodos/[id]`), igual que un cambio de pesos.

**Puntos críticos (indicadores más bajos).** Además del total, se calcula el mismo promedio ponderado
*por criterio* (no solo el agregado), lo que permite ordenar los criterios de menor a mayor puntaje y
marcar como "punto crítico" a los que caen bajo un umbral (60/100). Este mismo cálculo se agrega por
equipo y por curso (promediando los resultados individuales) para el panel de resultados.

**Retroalimentación automática.** `generarRetroalimentacion()` es una función determinística basada en
reglas (mismo input → mismo output). Cada criterio guarda, además del promedio combinado, el desglose por
fuente (`promedioAuto`, `promedioCoevaluacion`, `promedioDocente`), lo que permite:
- Para cada punto crítico (hasta 3): mostrar cómo lo calificó cada fuente y una sugerencia distinta según el
  patrón detectado (el estudiante se autocalifica más alto que los demás, los compañeros lo ven peor que el
  docente o viceversa, o las tres fuentes coinciden).
- Para cada fortaleza (hasta 2, promedio ≥ 80): resaltar si hay consenso entre compañeros y docente.
- Un plan de acción general al final del mensaje.

Se implementó como reglas explícitas (no un LLM) para que sea auditable y reproducible; el diseño deja
espacio para en el futuro reemplazar o enriquecer esa función con una llamada a un modelo de lenguaje (ej.
Claude) que redacte el mensaje en lenguaje más natural a partir de los mismos datos estructurados.

**Equipos editables + historial.** Los equipos (`Grupo`) se pueden renombrar y reasignar sus integrantes en
cualquier momento (`PATCH /api/grupos/[id]`) porque la conformación de un equipo puede cambiar de un periodo
de evaluación a otro. Para que esto no altere reportes ya calculados, `Resultado` guarda una foto congelada
del equipo (`grupoNombre`, `integrantesHistoricos`) en el momento en que se crea (primera evaluación
registrada para ese estudiante en ese periodo) y **nunca se vuelve a sobreescribir** en recálculos
posteriores — así, aunque el docente reorganice los equipos para el siguiente periodo, el reporte de un
periodo cerrado sigue mostrando el equipo real de ese momento.

**Periodos editables.** El nombre, las fechas y los pesos de un periodo se pueden editar en cualquier
momento; la rúbrica solo se puede cambiar mientras el periodo está en `BORRADOR`, ya que las evaluaciones
registradas guardan referencias a los criterios de la rúbrica original y cambiarla después corrompería el
cálculo (`PATCH /api/periodos/[id]`).

**Reportes descargables.** El panel de resultados del docente incluye gráficos de barra, un radar
(auto/coevaluación/docente por criterio) a nivel de curso y por estudiante, exportación a Excel de la tabla
de resultados individuales (librería `xlsx`, ya usada para la importación de estudiantes) y un botón
"Descargar reporte (PDF)" que usa la función de impresión del navegador con CSS `@media print` dedicado
(oculta la navegación y botones, deja las gráficas y el detalle de cada estudiante listos para guardar como
PDF).

## 5. User Journey simplificado

1. **Docente** crea su cuenta (`/registro`) y crea un curso (`/docente` → "Crear curso").
2. **Docente** carga estudiantes pegando `Nombre, correo` por línea (`/docente/cursos/[id]/estudiantes`).
   Si el correo no existe, se crea la cuenta con una contraseña temporal que se muestra **una sola vez** para
   que el docente la comparta por un canal seguro.
3. **Docente** configura una rúbrica con criterios y ponderaciones que suman 100%, ajustando opcionalmente
   qué tipo de evaluador ve cada criterio (`/docente/cursos/[id]/rubricas`).
4. **Docente** crea un periodo de evaluación eligiendo la rúbrica, las fechas, los pesos de auto/co/docente
   y la exigencia para la nota 1-7 (`/docente/cursos/[id]/periodos`) y lo **abre**.
5. **Docente** arma los equipos de ese periodo seleccionando estudiantes
   (`/docente/cursos/[id]/periodos/[periodoId]/grupos`) — puede repetir este paso con una conformación
   distinta en cada periodo del mismo curso.
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
- **No se pueden "ver" contraseñas existentes**: solo se guarda el hash, nunca el valor original, así que ni
  el docente ni el administrador pueden recuperar la contraseña de un estudiante. En su lugar, el docente
  puede **restablecerla** (`POST /api/cursos/[id]/estudiantes/[estudianteId]/restablecer-password`), que
  genera una contraseña nueva y la muestra una única vez para volver a compartirla.
- **Importación de Excel/CSV**: el archivo se procesa por completo en el navegador (librería `xlsx`), nunca
  se sube el binario al servidor — solo se extraen nombre/correo y se reutiliza el mismo endpoint de carga
  manual. Esto acota el riesgo de las vulnerabilidades conocidas de `xlsx` (CVE de prototype pollution/ReDoS,
  sin parche en la versión publicada en npm) al navegador de quien importa su propio archivo, sin exponer al
  servidor.

## 7. Cómo correr el proyecto

```bash
cp .env.example .env          # completar DATABASE_URL y NEXTAUTH_SECRET
npm install
npm run db:push               # crea las tablas según prisma/schema.prisma
npm run db:seed                # datos de demo: docente + 6 estudiantes + 1 periodo abierto con 2 equipos
npm run dev
```

Credenciales de demo tras el seed: `docente@demo.edu` / `Demo1234` y estudiantes
`nombre.apellido@demo.edu` / `Demo1234` (ver salida del script `db:seed`).

### Despliegue en Vercel + Supabase

La app no guarda archivos, solo datos relacionales, por lo que Supabase (PostgreSQL administrado) cubre toda
la persistencia. Como Vercel es serverless, se usan dos conexiones de Supabase: el *Transaction pooler*
(puerto 6543, `DATABASE_URL`) para la app y la *conexión directa* (puerto 5432, `DIRECT_URL`) para las
migraciones. El `schema.prisma` ya declara `url` + `directUrl` para este esquema. Los pasos detallados están
en el `README.md`; en resumen: configurar `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` y `NEXTAUTH_URL` en
Vercel, correr `prisma migrate deploy` contra Supabase, y hacer push (el `build` ya ejecuta
`prisma generate`).
