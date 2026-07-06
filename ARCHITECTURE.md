# Arquitectura — Sistema de Autoevaluación y Coevaluación grupal

Este documento describe el diseño de la plataforma implementada en este repositorio: modelo de datos, stack
tecnológico, algoritmo de cálculo de la nota final ponderada, el user journey y las decisiones de seguridad.
El código en `src/` y `prisma/schema.prisma` es la implementación real de lo aquí descrito, no solo una
propuesta.

## 1. Roles y flujo general

| Rol | Puede hacer |
|---|---|
| **Administrador** | Crear cuentas docente y estudiante directamente (`/admin`), sin pasar por el registro público; activar/desactivar cualquier cuenta; ver y matricular estudiantes en cualquier sección de la plataforma, sin importar el docente dueño. |
| **Docente** | Tener varias asignaturas a cargo, cada una con una o más secciones (una por año-semestre); cargar estudiantes a cada sección (roster fijo, incluida importación desde Excel/CSV); crear/reutilizar/editar rúbricas de una biblioteca **compartida entre todos los docentes**; crear y editar evaluaciones por sección con pesos auto/co/docente y exigencia de nota (60%/70%); definir equipos **propios de cada evaluación**; agregar a otro docente ya existente como **coevaluador** de una evaluación específica; calificar a cada estudiante, abrir/cerrar evaluaciones, restablecer contraseñas de estudiantes, ver y descargar el panel de resultados (PDF/Excel) con la nota final en porcentaje y en escala chilena 1.0-7.0. |
| **Estudiante** | Iniciar sesión con las credenciales que le entrega el docente; ver cuántas evaluaciones tiene pendientes y sus plazos antes de entrar a autoevaluarse/coevaluar; ver sus resultados agrupados por asignatura y sección (por defecto solo el año-semestre actual, con filtro para revisar semestres anteriores) y descargarlos en PDF/Excel por asignatura. |

El campo `User.activo` permite al administrador desactivar una cuenta sin borrarla: `authorize()` en
`src/lib/auth.ts` rechaza el login si `activo = false`, aunque la contraseña sea correcta. Por diseño, no se
puede desactivar una cuenta `ADMINISTRADOR` desde el panel (evita bloqueos accidentales de la administración).

Las cuentas iniciales de Administrador y Docente se crean automáticamente en cada build de Vercel mediante
`prisma/bootstrap-admin.ts` (idempotente: si la cuenta ya existe, no la modifica). Las credenciales de esas
cuentas deben rotarse después del primer login (`PATCH /api/perfil/password`), ya que el valor inicial queda
en el código fuente.

Flujo de datos: `Asignatura (docente) → Seccion (año-semestre, roster fijo) → PeriodoEvaluacion ("evaluación":
rúbrica + pesos + exigencia) → Grupo/MiembroGrupo (equipos propios de esa evaluación) → Evaluacion/
DetalleEvaluacion (auto/co/docente, con posibles coevaluadores docentes) → Resultado (nota final + feedback)`.
Las Rubrica/CriterioRubrica son transversales a todo esto: viven fuera de la jerarquía Asignatura→Sección,
como una biblioteca pública que cualquier docente puede asignar a sus propias evaluaciones (ver sección 2).

## 2. Modelo de datos

Implementado en `prisma/schema.prisma`. Entidades principales:

- **User** — cuenta única con `rol` (`ADMINISTRADOR` | `DOCENTE` | `ESTUDIANTE`). Un mismo modelo de usuario
  para los tres roles simplifica la autenticación; el rol determina qué puede hacer (ver sección de
  seguridad).
- **Asignatura** — pertenece a un docente (`docenteId`), quien la dicta/coordina. Es reutilizable a través de
  distintos años-semestre: un mismo docente puede tener muchas asignaturas, y cada asignatura puede tener
  varias secciones a su cargo.
- **PeriodoAcademico** — catálogo compartido de años-semestre (ej. "2026-1", "2026-2"). Es global a toda la
  plataforma (no por docente) para evitar variantes de escritura del mismo periodo; cualquier docente puede
  crear uno nuevo si no existe (`upsert` por `nombre`). El campo `actual` marca cuál es el semestre vigente
  (solo uno a la vez); lo gestiona el administrador (`PATCH /api/periodos-academicos/[id]`, no cada docente
  por separado) y el panel de resultados del estudiante lo usa para decidir qué mostrar por defecto.
- **Seccion** — instancia concreta de una `Asignatura` ofrecida en un `PeriodoAcademico` específico, con su
  propio roster **fijo** de estudiantes (`Inscripcion`). Un mismo docente puede tener varias secciones a
  cargo de la misma asignatura en el mismo semestre (ej. Sección A y Sección B), y la lista de secciones se
  puede filtrar/buscar por año-semestre desde la UI (`/docente/asignaturas/[id]`).
- **Inscripcion** — matrícula de un estudiante en una sección (N:M entre `User` y `Seccion`). El roster de
  una sección no cambia entre sus evaluaciones.
- **PeriodoEvaluacion** (la "evaluación") — pertenece a una `Seccion`, usa una `Rubrica` y define
  `pesoAutoevaluacion`/`pesoCoevaluacion`/`pesoDocente` (deben sumar 100) y `escalaExigencia` (60 o 70, el %
  que se traduce a la nota de aprobación 4.0 en la escala 1-7). Tiene un `estado`:
  `BORRADOR → ABIERTO → CERRADO`. Siempre debe tener rúbrica, fechas y (antes de abrirse) equipos asignados.
- **Grupo** / **MiembroGrupo** — equipo de trabajo que pertenece a **una evaluación** (`periodoId`, no a la
  sección en general) y su relación N:M con estudiantes. Una misma sección puede tener conformaciones de
  equipo completamente distintas en cada evaluación (p. ej. Equipos 1-5 en el Corte 1 y una reorganización
  distinta con otros nombres en el Corte 2); por eso el equipo se crea y se filtra dentro de la evaluación
  (`/docente/asignaturas/[id]/secciones/[seccionId]/evaluaciones/[evalId]/grupos`,
  `src/app/api/periodos/[id]/grupos/route.ts`).
- **Rubrica** — **biblioteca pública entre docentes**: cualquier docente puede verla, asignarla a sus propias
  evaluaciones y editarla, sin importar quién la creó (`creadorId` es solo atribución/historial, no una
  restricción de acceso). Define una escala (`escalaMin`–`escalaMax`, admite `escalaMin = 0`). Editar los
  criterios o la escala de una rúbrica ya usada en una evaluación abierta o cerrada está bloqueado (ver
  `PATCH /api/rubricas/[id]`), por la misma razón que cambiar la rúbrica de una evaluación después de
  `BORRADOR`.
- **CriterioRubrica** — criterio de la rúbrica con su `ponderacion` (%) y tres flags independientes,
  `aplicaAutoevaluacion` / `aplicaCoevaluacion` / `aplicaDocente` (todas `true` por defecto), que controlan
  qué tipos de evaluador ven y llenan ese criterio — por ejemplo, un criterio de "puntualidad" puede
  restringirse a que solo lo califique el docente. La suma de ponderaciones de los criterios de una rúbrica
  debe ser 100 (validado en `POST /api/rubricas`) y cada criterio debe aplicar a al menos un tipo de
  evaluador.
- **DocenteEvaluador** — coevaluador docente de una evaluación específica: un docente titular (dueño de la
  asignatura de esa sección) puede agregar a **otro docente ya existente en el sistema** para que también
  registre evaluaciones de tipo `DOCENTE` en esa evaluación puntual (`POST /api/periodos/[id]/coevaluadores`).
  El coevaluador no puede editar la configuración de la evaluación ni gestionar equipos — solo calificar.
- **Evaluacion** — una "planilla" de rúbrica llenada por un `evaluador` sobre un `evaluado`, de tipo
  `AUTOEVALUACION` (evaluador = evaluado), `COEVALUACION` (evaluador = compañero de equipo) o `DOCENTE`
  (evaluador = el docente titular o un coevaluador agregado). Restringida por una clave única
  `(periodoId, tipo, evaluadorId, evaluadoId)` que impide doble envío (el reenvío actualiza la evaluación
  existente en vez de duplicarla) y permite que cada docente evaluador (titular + coevaluadores) registre la
  suya propia sobre el mismo estudiante. El backend valida que los `detalles` enviados correspondan
  exactamente a los criterios aplicables a ese `tipo` (ver `criteriosAplicables()` en
  `src/app/api/periodos/[id]/evaluaciones/route.ts`).
- **DetalleEvaluacion** — puntaje (dentro de la escala de la rúbrica, que puede partir en 0) que una
  `Evaluacion` asigna a cada `CriterioRubrica`. En la UI se captura con un control de estrellas
  (`src/components/EscalaRating.tsx`) en vez de un slider numérico, para que sea más intuitivo distinguir
  "menos" de "más".
- **Resultado** — nota final ya calculada y cacheada por estudiante y evaluación: `notaAutoevaluacion`,
  `notaCoevaluacion`, `notaDocente` (promedio de todos los docentes evaluadores, titular + coevaluadores),
  `notaFinal` (0-100), `notaEscala1a7` (1.0-7.0, ver sección 4), un JSON `detalleCriterios` (promedio por
  criterio, usado para detectar puntos críticos) y un texto `retroalimentacion` generado automáticamente. Se
  recalcula cada vez que se registra una evaluación y al cerrar la evaluación (`src/lib/resultados.ts`).

```
User ──< Asignatura ──< Seccion >── PeriodoAcademico
 │            │              │
 │            │              └──< PeriodoEvaluacion >── Rubrica ──< CriterioRubrica
 │            │                       │        │
 │            │                       │        └──< DocenteEvaluador >── User (coevaluador)
 │            │                       └──< Grupo ──< MiembroGrupo >── User
 │            │
 │            └── (roster) Seccion ──< Inscripcion >── User
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
- `notaDocente` = **promedio** de las notas de todos los docentes evaluadores de esa evaluación: el titular
  (dueño de la asignatura) y, si los hay, los coevaluadores agregados (`DocenteEvaluador`). Funciona igual
  que la coevaluación entre compañeros — cada docente evaluador registra su propia `Evaluacion` y todas se
  promedian en un solo `notaDocente`.

**Paso 4 — Nota final ponderada.**

```
notaFinal = ( notaAutoevaluacion * pesoAutoevaluacion
            + notaCoevaluacion   * pesoCoevaluacion
            + notaDocente        * pesoDocente ) / 100
```

Los tres pesos se configuran por evaluación (`PeriodoEvaluacion.pesoAutoevaluacion/pesoCoevaluacion/
pesoDocente`) y deben sumar 100 (validado al crearla). Si algún componente todavía no existe (p. ej. ningún
docente ha evaluado), su peso se **redistribuye proporcionalmente** entre los componentes disponibles en vez
de tratarse como 0 — así una nota parcial no penaliza injustamente al estudiante mientras la evaluación sigue
abierta; el resultado se marca como `completo: false` y el texto de retroalimentación lo indica.

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

El resultado se redondea a un decimal. Cambiar la exigencia de una evaluación ya cerrada dispara un
recálculo (`PATCH /api/periodos/[id]`), igual que un cambio de pesos.

**Puntos críticos (indicadores más bajos).** Además del total, se calcula el mismo promedio ponderado
*por criterio* (no solo el agregado), lo que permite ordenar los criterios de menor a mayor puntaje y
marcar como "punto crítico" a los que caen bajo un umbral (60/100). Este mismo cálculo se agrega por
equipo y por sección (promediando los resultados individuales) para el panel de resultados.

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
cualquier momento (`PATCH /api/grupos/[id]`) porque la conformación de un equipo puede cambiar de una
evaluación a otra. Para que esto no altere reportes ya calculados, `Resultado` guarda una foto congelada
del equipo (`grupoNombre`, `integrantesHistoricos`) en el momento en que se crea (primera evaluación
registrada para ese estudiante en esa evaluación) y **nunca se vuelve a sobreescribir** en recálculos
posteriores — así, aunque el docente reorganice los equipos para la siguiente evaluación, el reporte de una
evaluación cerrada sigue mostrando el equipo real de ese momento.

**Evaluaciones editables.** El nombre, las fechas y los pesos de una evaluación se pueden editar en
cualquier momento; la rúbrica solo se puede cambiar mientras está en `BORRADOR`, ya que las evaluaciones
registradas guardan referencias a los criterios de la rúbrica original y cambiarla después corrompería el
cálculo (`PATCH /api/periodos/[id]`).

**Reportes descargables.** El panel de resultados del docente incluye gráficos de barra, un radar
(auto/coevaluación/docente por criterio) a nivel de sección y por estudiante, exportación a Excel de la
tabla de resultados individuales (librería `xlsx`, ya usada para la importación de estudiantes) y un botón
"Descargar reporte (PDF)" que usa la función de impresión del navegador con CSS `@media print` dedicado
(oculta la navegación y botones, deja las gráficas y el detalle de cada estudiante listos para guardar como
PDF).

## 5. User Journey simplificado

1. **Docente** crea su cuenta (`/registro`) y crea una asignatura (`/docente` → "Crear asignatura").
2. **Docente** crea una sección de esa asignatura eligiendo (o creando) el año-semestre
   (`/docente/asignaturas/[id]` → "Nueva sección"). Puede repetir este paso para tener varias secciones a
   cargo de la misma asignatura en el mismo semestre.
3. **Docente** carga estudiantes a esa sección pegando `Nombre, correo` por línea
   (`/docente/asignaturas/[id]/secciones/[seccionId]/estudiantes`). Si el correo no existe, se crea la
   cuenta con una contraseña temporal que se muestra **una sola vez** para que el docente la comparta por un
   canal seguro. El roster queda fijo para todas las evaluaciones de esa sección.
4. **Docente** configura una rúbrica (o reutiliza una ya creada por él u otro docente) con criterios y
   ponderaciones que suman 100%, ajustando opcionalmente qué tipo de evaluador ve cada criterio
   (`/docente/rubricas`, biblioteca compartida entre todos los docentes).
5. **Docente** crea una evaluación dentro de la sección eligiendo la rúbrica, las fechas, los pesos de
   auto/co/docente y la exigencia para la nota 1-7
   (`/docente/asignaturas/[id]/secciones/[seccionId]/evaluaciones`), opcionalmente agrega a otro docente
   existente como coevaluador, y luego la **abre**.
6. **Docente** arma los equipos de esa evaluación seleccionando estudiantes de la sección — puede repetir
   este paso con una conformación distinta en cada evaluación de la misma sección.
7. **Estudiante** inicia sesión y ve en `/estudiante` un aviso con cuántas evaluaciones tiene pendientes y el
   plazo de cada una, luego completa su autoevaluación y la coevaluación de cada compañero de equipo
   (`/estudiante/periodos/[id]/evaluar`), con un checklist de pendientes.
8. **Docente** (y, si los hay, sus coevaluadores) evalúan a cada estudiante con la misma rúbrica; el
   comentario que escribe es propio de cada estudiante — cambiar de estudiante dentro del mismo equipo
   recarga el comentario ya guardado para ese estudiante (o lo deja vacío si aún no lo evalúa), nunca
   conserva el que estaba escribiendo para el anterior.
9. **Docente** cierra la evaluación; el sistema recalcula automáticamente la nota final de todos los
   estudiantes y genera la retroalimentación.
10. **Docente** revisa el panel de resultados por sección, equipo e individuo, con los indicadores más bajos.
11. **Estudiante** ve sus resultados (`/estudiante/resultados`) — solo visible una vez la evaluación está
    cerrada, para no sesgar la coevaluación mientras está en curso — agrupados por asignatura y, dentro de
    cada una, por sección/año-semestre. Por defecto solo se muestra el año-semestre marcado como "actual"
    (ver sección 2); un checkbox "Ver semestres anteriores" revela el resto. Cada asignatura tiene sus
    propios botones para descargar el detalle en Excel o en PDF (impresión filtrada a esa asignatura).

## 6. Seguridad y autenticación

- **Contraseñas**: nunca se almacenan en texto plano. Se guarda solo el hash (`bcryptjs`, 12 rounds) en
  `User.passwordHash`. Las contraseñas temporales generadas al cargar estudiantes se muestran una única vez
  en la respuesta de la API y no se pueden recuperar después (`src/app/api/secciones/[id]/estudiantes/route.ts`).
- **Autenticación**: NextAuth con `CredentialsProvider` y estrategia de sesión **JWT** (no requiere tablas de
  sesión en la base de datos). El `authorize()` corre en el servidor y compara el hash con `bcrypt.compare`.
- **Autorización por rol**: el rol viaja dentro del JWT/sesión (`src/types/next-auth.d.ts`,
  `src/lib/auth.ts`). `src/middleware.ts` bloquea a nivel de ruta el acceso cruzado (`/docente/*` exige rol
  `DOCENTE`, `/estudiante/*` exige rol `ESTUDIANTE`). Cada API route además revalida el rol y la propiedad
  del recurso en el servidor (`src/lib/session.ts`, `src/lib/academico.ts`) — el middleware protege la UI,
  pero la autorización real vive en el backend.
- **Aislamiento de datos entre docentes**: cada operación verifica que la asignatura/sección/evaluación
  pertenezca al docente autenticado (`requireAsignaturaDelDocente`, `requireSeccionDelDocente`,
  `requirePeriodoDelDocente` en `src/lib/academico.ts`) o que el estudiante esté inscrito
  (`requireInscripcion`) antes de leer o escribir. Para registrar una evaluación de tipo `DOCENTE` basta con
  ser el titular **o** un coevaluador agregado (`requireAccesoEvaluacionDocente`), pero solo el titular puede
  editar la configuración de la evaluación, sus equipos o su lista de coevaluadores.
- **Rúbricas como biblioteca pública**: a diferencia del resto del modelo (aislado por docente), cualquier
  cuenta con rol `DOCENTE` puede leer, asignar y editar cualquier rúbrica — es una decisión de diseño
  explícita para permitir reutilización entre docentes de la misma institución. Editar los criterios o la
  escala está bloqueado si la rúbrica ya está en uso en una evaluación no-`BORRADOR`, para no corromper
  cálculos ya hechos.
- **Validación de entrada**: todos los payloads de API se validan con Zod antes de tocar Prisma, evitando
  inyecciones de tipos inesperados; Prisma además parametriza las consultas SQL (protección contra
  inyección SQL).
- **Cambio de contraseña**: `PATCH /api/perfil/password` permite a cualquier usuario autenticado (docente o
  estudiante) cambiar su contraseña temporal por una propia. Se recomienda como buena práctica exigir este
  cambio en el primer login (no forzado en este MVP, pero el endpoint ya existe para agregarlo fácilmente).
- **Nunca auto-registro de estudiantes**: `/api/auth/registro` crea exclusivamente cuentas `DOCENTE`; los
  estudiantes solo obtienen credenciales cuando el docente los carga a una sección, evitando que cualquiera
  se autoasigne el rol estudiante o se inscriba en secciones ajenas.
- **Secretos**: `NEXTAUTH_SECRET` y `DATABASE_URL` viven en variables de entorno (`.env`, nunca commiteadas;
  ver `.env.example`) y se configuran como Environment Variables en Vercel para producción.
- **No se pueden "ver" contraseñas existentes**: solo se guarda el hash, nunca el valor original, así que ni
  el docente ni el administrador pueden recuperar la contraseña de un estudiante. En su lugar, el docente
  puede **restablecerla** (`POST /api/secciones/[id]/estudiantes/[estudianteId]/restablecer-password`) y el
  administrador puede restablecer la de cualquier estudiante o docente
  (`POST /api/admin/usuarios/[id]/restablecer-password`); ambos endpoints generan una contraseña nueva y la
  devuelven una única vez para volver a compartirla.
- **Importación de Excel/CSV**: el archivo se procesa por completo en el navegador (librería `xlsx`), nunca
  se sube el binario al servidor — solo se extraen RUT/nombre/correo y se reutiliza el mismo endpoint de
  carga manual (tanto en el panel del administrador como en la sección del docente). Esto acota el riesgo de
  las vulnerabilidades conocidas de `xlsx` (CVE de prototype pollution/ReDoS, sin parche en la versión
  publicada en npm) al navegador de quien importa su propio archivo, sin exponer al servidor. Si el correo
  de una fila ya existe en el sistema, la carga NUNCA sobreescribe sus datos (nombre/RUT/contraseña): solo
  matricula a ese estudiante existente en la sección/asignatura correspondiente.
- **Carga masiva con RUT y contraseña genérica**: tanto `/api/admin/estudiantes` como `/api/admin/docentes`
  aceptan un arreglo de filas (manual o desde Excel) con `rut` opcional, y una `passwordGenerica` opcional
  que, si se define, se asigna a todas las cuentas nuevas de esa carga (si no, cada una recibe una
  contraseña aleatoria distinta). El campo `User.rut` es único pero nullable, ya que no todas las cuentas
  (como las creadas por `bootstrap-admin`) lo tienen.
- **Buscar estudiante existente antes de crear uno nuevo**: desde la sección, el docente primero ve el
  roster ya matriculado; si el estudiante que busca no está, `GET /api/estudiantes?q=` permite buscarlo por
  nombre, apellido, correo o RUT entre **todos** los estudiantes de la plataforma (estén o no en otra
  sección) y agregarlo con un clic sin volver a escribir sus datos. Solo si de verdad no existe en el
  sistema, el docente lo crea (vía el mismo formulario de carga manual/Excel) — esa cuenta queda disponible
  globalmente para cualquier otro docente, igual que si la hubiera creado el administrador.

## 7. Cómo correr el proyecto

```bash
cp .env.example .env          # completar DATABASE_URL y NEXTAUTH_SECRET
npm install
npm run db:push               # crea las tablas según prisma/schema.prisma
npm run db:seed                # datos de demo: 2 docentes (titular + coevaluador) + 6 estudiantes +
                                # 1 asignatura con 1 sección + 1 evaluación abierta con 2 equipos
npm run dev
```

Credenciales de demo tras el seed: `docente@demo.edu` (titular), `coevaluador@demo.edu` (coevaluador de
ejemplo) y estudiantes `nombre.apellido@demo.edu`, todos con contraseña `Demo1234` (ver salida del script
`db:seed`).

### Despliegue en Vercel + Supabase

La app no guarda archivos, solo datos relacionales, por lo que Supabase (PostgreSQL administrado) cubre toda
la persistencia. Como Vercel es serverless, se usan dos conexiones de Supabase: el *Transaction pooler*
(puerto 6543, `DATABASE_URL`) para la app y la *conexión directa* (puerto 5432, `DIRECT_URL`) para las
migraciones. El `schema.prisma` ya declara `url` + `directUrl` para este esquema. Los pasos detallados están
en el `README.md`; en resumen: configurar `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` y `NEXTAUTH_URL` en
Vercel, correr `prisma migrate deploy` contra Supabase, y hacer push (el `build` ya ejecuta
`prisma generate`).
