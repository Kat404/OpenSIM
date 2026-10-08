# OpenSIM — Open Source - Sistema Integral Modular (v2.2)

<!-- odd-tracker
kind: spec
status: active
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@8f40837 (main@ffcd595)
sha-warning: every SHA cited in this file predates the 2026-10-08 GPG re-sign rewrite and is dead; re-derive the current SHAs with `git log --oneline --grep='<subject>'`
-->

**Proyecto:** OpenSIM (Open Source — Sistema Integral Modular)
**Target Architecture:** SvelteKit `3.0.0` + Svelte `5.57.1` (Runes) + Cloudflare D1/Workers + Drizzle ORM `0.45.3` + Valibot `1.5.0` + `pdf-lib 1.17.1`
**Programa Académico:** Ingeniería en Sistemas Computacionales (Plan `ISIC-2010-224`, Instituto Tecnológico de Morelia)
**Versión:** 2.2 (audit fixes: spec self-consistency, token hashing, route group, drizzle doc rewrite)
**Fecha:** 2026-10-02

---

## Changelog v2.0

### Decisiones arquitectónicas (respuesta al audit)

- **CF-1 SubjectNode dual identity ✓** — `canonicalId` (slug semántico) como PK + `subjectAliases` table para legacy codes.
- **CF-2 Backend ✓** — Cloudflare D1 (SQLite at edge) + Drizzle ORM (más ambicioso que mock JSON propuesto en v1.1).
- **CF-4 Performance budgets IMPLÍCITO** — Cloudflare edge SSR + D1 cumple LCP/INP/CLS sin config adicional; budgets explícitos en §12.
- **CF-3 Auth library ✓ (CERRADO v2.1)** — Single-file pattern nativo en `src/lib/server/auth.ts`. Web Crypto API PBKDF2/SHA-256, sesiones en `auth_sessions`, cookies HttpOnly+Secure+SameSite=Lax. 0 paquetes npm auth, 0 servicios externos (Resend cancelado). `/login/recuperar` es vista informativa apuntando a `soporte.ds@morelia.tecnm.mx` y Coordinadores de Carrera.

### 4 Fixes aplicados al v2 entregado

1. **Bug fix**: `studentProfiles.cursedCredits` (typo) → renombrado a `completedCredits`.
2. **Campos agregados** a `studentProfiles`: `passedAverage`, `inProgressCredits`, `enrollmentPeriod`.
3. **Status enum** corregido: agregado `'LOCKED'` (original spec tenía 4 estados, v2 entregado traía 3).
4. **Naming decision** documentada: `socialService` → `healthService` (IMSS es seguro médico, semánticamente más correcto).

### Cambios v2.0 → v2.1 (Oct 2026)

- **CF-3 cerrado**: Auth nativa single-file vía `crypto.subtle` PBKDF2/SHA-256, 0 deps npm auth, 0 servicios externos de email.
- **Schema extendido**: nuevas tablas `student_credentials` (PBKDF2 hash + salt + iterations) y `auth_sessions` (token + expiry + metadata).
- **Tarea 2.5 agregada**: Implementar `src/lib/server/auth.ts` + middleware en `src/hooks.server.ts` + rutas `/login` + `/login/recuperar` + seed CLI.
- **Phase 2 status**: Tareas 2.1 y 2.2 marcadas como completadas; Tareas 2.3, 2.4, 2.5 marcadas como completadas en el cuerpo de §8 (esta sección del header es histórica — el estado actual de cada tarea es la fuente de verdad en §8).

### Cambios v2.1 → v2.2 (Oct 2026, audit fixes)

- **Token hashing en `auth_sessions`**: el PK `id` ahora almacena `sha256(token)`, no el token plano. La cookie sigue llevando el token; el hash es de un solo sentido. (Audit A3.)
- **Route group `(protected)`**: la guardia de rutas protegidas migra de prefijo URL a un `(protected)/+layout.server.ts` (ver Tarea 4.1). Cubre `/dashboard`, `/reinscripcion`, `/tramites` y futuros hijos del grupo. (Audit C5.)
- **ON DELETE CASCADE**: FKs de `student_credentials` y `auth_sessions` hacia `student_profiles` ahora son `ON DELETE CASCADE`, así un egreso o corrección de número de control limpia la cadena completa. (Audit A6.)
- **Índice en `auth_sessions.expires_at`**: agregado para soportar prune oportunista sin full table scan por request. (Audit A2.)
- **Logout endpoint**: nuevo `POST /login/logout` invoca `invalidateSession` y borra la cookie. (Audit A1.)
- **Doc de Drizzle reescrita**: `docs/drizzle-raw-sql-workaround.md` reemplazada por `docs/drizzle-migrations-and-data.md` (flujo canónico positivo, sin opciones A/B/C). (Audit C1/C2/C3.)

### Stack pin — LATEST versions (Oct 2026)

| Package | Version |
|---|---|
| `@sveltejs/kit` | `3.0.0` |
| `@sveltejs/adapter-cloudflare` | `8.0.0` |
| `svelte` | `5.57.1` |
| `drizzle-orm` | `0.45.3` |
| `valibot` | `1.5.0` |
| `pdf-lib` | `1.17.1` |
| `vitest` | `5.0.3` |
| `@playwright/test` | `1.63.0` |
| `@axe-core/playwright` | `4.13.0` |
| `typescript` | `6.0.3` |
| `vite` | `8.3.2` |
| `lucide-svelte` | `1.0.1` |
| `wrangler` | `4.147.0` |

---

## 1. Visión General y Manifiesto de Arquitectura

[Preservado del v1]

El sistema SIM legacy presenta deuda técnica crítica en su capa de presentación: fragmentación de interfaz, inconsistencia de componentes, falta de contraste WCAG 2.1 AA, saturación cognitiva por abuso de colores no tokenizados, antipatrones de interacción en formularios y renderizado obsoleto.

**OpenSIM** es la alternativa *Free and Open Source* (FOSS), minimalista, ultraligera (*Data-Dense, Clutter-Free*).

### Principios Rectores

1. **Zero CSS Bloat** — CSS Nativo Tokenizado. Custom Properties + CSS Nesting nativo + Scoped Styles de Svelte.
2. **Full-Stack Unificado (SvelteKit 100%)** — SSR para carga inicial + CSR para interactividad.
3. **Modelado Visual Basado en Grafos** — retícula académica como **DAG** SVG nativo.
4. **Respeto a la Densidad de Información** — sin saturación cognitiva.
5. **Animación Nativa** — primitivas de compilador de Svelte (sin Lenis, sin Motion.dev).
6. **Edge-First Persistence** — datos en Cloudflare D1 (SQLite replicado al edge).

---

## 2. Auditoría Técnica del Sistema Legado

[Preservado del v1.1 — sub-claims refinados, evidencia confirmada en 55 capturas]

| Módulo | Diagnóstico refinado | Reemplazo OpenSIM |
|---|---|---|
| Auth | Corte diagonal + 3 logos (SIM/TecNM/ITM) | Login limpio + Magic Link |
| Nav | Drawer ~25% con watermark, no darkening | Sidebar colapsable + Cmd+K |
| Perfil | >10 cards independientes, skeuomorfismo espiral | Tabs + dash em-dash para vacíos |
| Horario | Mini-horarios azul pastel idénticos (Listado Grupos) | TimeGrid proporcional + HSL hash |
| Kardex | Verde pasa WCAG AA (~5:1) | Tabla unificada + sort/filtros |
| Retícula | ~5-6 colores, sin conectores DAG | DAG SVG con Ancestors/Descendants |
| Reinscripción | 203 elementos, 8 botones "Enterado" | Simulator split + confirmación global |
| Trámites | Banners gigantes + tablas vacías | FormStepper + Empty States |
| PDF | Vuelco BD sin estructura | pdf-lib vectorial con mini-calendario |

---

## 3. Especificación Técnica — Stack Actualizado

```
[SvelteKit 3.0 + Svelte 5.57 + Cloudflare D1 + Drizzle ORM 0.45]
   ↓                ↓                       ↓
[Server Loaders] [DAG SVG]            [Tokens Nativos]
   ↓
[+ Form Actions + pdf-lib 1.17]
```

### 3.1 Framework: SvelteKit 3.0 Full-Stack

SSR edge en Cloudflare Workers + CSR reactivo. `+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+error.svelte`. Server Loaders para data fetching. Form Actions para mutaciones. Svelte 5 runes (`$state`, `$derived`, `$effect`) para estado local.

### 3.2 Adapter: `@sveltejs/adapter-cloudflare 8.0.0`

Compila a Worker bundles. Soporta D1 (SQLite), KV, R2, Durable Objects bindings. Config en `wrangler.jsonc`.

### 3.3 Estilos: CSS Nativo Tokenizado (no Tailwind)

Custom Properties en `:root`, CSS Nesting nativo, scoped styles de Svelte. Tokens compartidos con Dark Mode via `[data-theme="dark"]`.

### 3.4 Iconografía: Lucide Icons

`lucide-svelte 1.0.1`. SVGs vectoriales con `stroke-width="1.75px"`. Tree-shakeable.

### 3.5 Animaciones: Svelte Nativas

`svelte/transition`, `svelte/animate`, `svelte/motion`. Cero deps externas.

---

## 4. Sistema de Tokens de Diseño (`src/lib/styles/tokens.css`)

[Preservado verbatim del v1.1 — light/dark con Custom Properties]

---

## 5. Modelo de Datos y Esquema Relacional (Drizzle ORM)

**Stack:** `drizzle-orm 0.45.3` + Cloudflare D1 (SQLite at edge)

### 5.1 Tablas (12 entidades normalizadas)

```typescript
// src/lib/server/db/schema.ts
import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// 1. Carreras / Planes de Estudio
export const careers = sqliteTable('careers', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  totalCredits: integer('total_credits').notNull().default(260),
  totalSemesters: integer('total_semesters').notNull().default(9),
});

// 2. Módulos de Especialidad
export const specialties = sqliteTable('specialties', {
  code: text('code').primaryKey(),
  careerCode: text('career_code').notNull().references(() => careers.code),
  name: text('name').notNull(),
});

// 3. Catálogo Unificado de Asignaturas (Nodo Base DAG)
export const subjects = sqliteTable('subjects', {
  canonicalId: text('canonical_id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  semester: integer('semester').notNull(),
  ht: integer('ht').notNull(),
  hp: integer('hp').notNull(),
  credits: integer('credits').notNull(),
  area: text('area').notNull(),
  specialtyCode: text('specialty_code').references(() => specialties.code),
});

// 4. Claves Alias / Históricas
export const subjectAliases = sqliteTable('subject_aliases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectCanonicalId: text('subject_canonical_id').notNull().references(() => subjects.canonicalId),
  aliasCode: text('alias_code').notNull().unique(),
});

// 5. Prerrequisitos (Aristas DAG)
export const subjectPrerequisites = sqliteTable('subject_prerequisites', {
  subjectCanonicalId: text('subject_canonical_id').notNull().references(() => subjects.canonicalId),
  prerequisiteCanonicalId: text('prerequisite_canonical_id').notNull().references(() => subjects.canonicalId),
}, (table) => ({
  pk: primaryKey({ columns: [table.subjectCanonicalId, table.prerequisiteCanonicalId] }),
}));

// 6. Temarios (Unidades y Subtemas)
export const subjectUnits = sqliteTable('subject_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectCanonicalId: text('subject_canonical_id').notNull().references(() => subjects.canonicalId),
  unitNumber: integer('unit_number').notNull(),
  title: text('title').notNull(),
  subtopicsJson: text('subtopics_json').notNull(),
});

// 7. Perfil de Estudiantes (FIXES v2.0: passedAverage, inProgressCredits, enrollmentPeriod; renamed cursedCredits→completedCredits)
export const studentProfiles = sqliteTable('student_profiles', {
  controlNumber: text('control_number').primaryKey(),
  fullName: text('full_name').notNull(),
  curp: text('curp').notNull(),
  birthState: text('birth_state').notNull(),
  careerCode: text('career_code').notNull().references(() => careers.code),
  specialtyCode: text('specialty_code').references(() => specialties.code),
  currentSemester: integer('current_semester').notNull().default(1),
  certifiedAverage: real('certified_average').notNull().default(0.0),
  arithmeticAverage: real('arithmetic_average').notNull().default(0.0),
  passedAverage: real('passed_average').notNull().default(0.0),       // FIX v2.0
  approvedCredits: integer('approved_credits').notNull().default(0),
  remainingCredits: integer('remaining_credits').notNull().default(260),
  completedCredits: integer('completed_credits').notNull().default(0), // FIX v2.0 (typo: cursedCredits→completedCredits)
  inProgressCredits: integer('in_progress_credits').notNull().default(0), // FIX v2.0
  advancePercentage: real('advance_percentage').notNull().default(0.0),
  status: text('status').notNull().default('Activo regular'),
  healthService: text('health_service').notNull().default('IMSS'),     // FIX v2.0 (renamed socialService→healthService)
  enrollmentPeriod: text('enrollment_period').notNull().default(''),   // FIX v2.0
});

// 8. Historial Académico (FIX v2.0: status enum ahora APPROVED|ENROLLED|AVAILABLE|LOCKED)
export const studentProgress = sqliteTable('student_progress', {
  studentControlNumber: text('student_control_number').notNull().references(() => studentProfiles.controlNumber),
  subjectCanonicalId: text('subject_canonical_id').notNull().references(() => subjects.canonicalId),
  status: text('status').notNull(), // 'APPROVED' | 'ENROLLED' | 'AVAILABLE' | 'LOCKED' (FIX v2.0)
  grade: real('grade'),
  evaluationType: text('evaluation_type'), // 'ORDINARIO' | 'REPETICION' | 'ESPECIAL'
  period: text('period').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.studentControlNumber, table.subjectCanonicalId] }),
}));

// 9. Oferta de Grupos
export const courseGroups = sqliteTable('course_groups', {
  id: text('id').primaryKey(),
  subjectCanonicalId: text('subject_canonical_id').notNull().references(() => subjects.canonicalId),
  groupCode: text('group_code').notNull(),
  teacherName: text('teacher_name').notNull(),
  hasLab: integer('has_lab', { mode: 'boolean' }).notNull().default(false),
});

// 10. Bloques de Horario
export const courseScheduleBlocks = sqliteTable('course_schedule_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: text('group_id').notNull().references(() => courseGroups.id),
  day: text('day').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  classroom: text('classroom').notNull(),
});

// 11. Credenciales de Acceso (PBKDF2/SHA-256 vía Web Crypto API)
export const studentCredentials = sqliteTable('student_credentials', {
  controlNumber: text('control_number').primaryKey().references(() => studentProfiles.controlNumber, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),         // base64url
  passwordSalt: text('password_salt').notNull(),         // base64url
  passwordIterations: integer('password_iterations').notNull().default(100000),
  passwordUpdatedAt: integer('password_updated_at', { mode: 'timestamp' }),
});

// 12. Sesiones de Autenticación (PK = SHA-256 del token; cookie lleva token crudo)
import { index } from 'drizzle-orm/sqlite-core';
export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(),                              // SHA-256(token) base64url, NO el token plano
  studentControlNumber: text('student_control_number').notNull().references(() => studentProfiles.controlNumber, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'),                                   // hashed for privacy
}, (table) => ({
  expiresAtIdx: index('idx_auth_sessions_expires_at').on(table.expiresAt),
  studentIdx: index('idx_auth_sessions_student').on(table.studentControlNumber),
}));
```

### 5.2 Diagrama Relacional (texto)

```
careers (1) ──┬── (n) specialties
              └── (n) student_profiles
                          ├── (1) student_credentials     (auth, 1:1)
                          ├── (n) auth_sessions            (auth, 1:n)
                          └── (n) student_progress
                                       └── (n) subjects
                                                   ├── (n) subject_aliases
                                                   ├── (n) subject_prerequisites ──► subjects (auto-ref)
                                                   └── (n) subject_units

subjects (1) ── (n) course_groups ── (n) course_schedule_blocks
```

---

## 6. Dataset Curricular (`src/lib/server/db/data/curriculum-isic-2010-224.json`)

[Dataset completo de 42 asignaturas ISIC-2010-224 con canonicalId + code + aliases + prerequisites — preservado del v2 entregado]

Incluye:
- **42 asignaturas** troncales, prácticas profesionales y complementarias
- **2 especialidades** referenciadas: `ISIE-TDS-2024-01` (Tecnologías para el Desarrollo de Software) y `ISIE-MCA-2023` (Matemático Aplicado y Cómputo)
- **Aliases legacy** (ej. `ACF-0901` ↔ `ACF-2301` para Cálculo Diferencial)
- **Prerequisites** como array de `canonicalId` (referencias internas)

---

## 7. Algoritmos (`src/lib/utils/`)

### 7.1 `dag.ts` — DAG Traversal

```typescript
export interface Edge {
  from: string;
  to: string;
}

export function getAncestors(targetId: string, edges: Edge[]): Set<string> {
  const ancestors = new Set<string>();
  function traverse(currentId: string) {
    const directParents = edges.filter((e) => e.to === currentId).map((e) => e.from);
    for (const parentId of directParents) {
      if (!ancestors.has(parentId)) {
        ancestors.add(parentId);
        traverse(parentId);
      }
    }
  }
  traverse(targetId);
  return ancestors;
}

export function getDescendants(targetId: string, edges: Edge[]): Set<string> {
  const descendants = new Set<string>();
  function traverse(currentId: string) {
    const directChildren = edges.filter((e) => e.from === currentId).map((e) => e.to);
    for (const childId of directChildren) {
      if (!descendants.has(childId)) {
        descendants.add(childId);
        traverse(childId);
      }
    }
  }
  traverse(targetId);
  return descendants;
}

export function evaluateCreditThresholds(approvedCredits: number) {
  return {
    canStartSocialService: approvedCredits >= 182, // 70% de 260
    canStartResidency: approvedCredits >= 208,     // 80% de 260
    canTakeTallerInv1: approvedCredits >= 130,      // 50% de 260
  };
}
```

### 7.2 `color.ts` — HSL Hash Determinístico

```typescript
export function getSubjectColorHSL(subjectCode: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < subjectCode.length; i++) {
    hash ^= subjectCode.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 88%)`;
}
```

---

## 8. Plan de Ejecución ODD (7 Fases — 12 secciones con sub-fases)

### Phase 1: Database Schema & Full Seeding Pipeline

- [x] **Task 1.1:** Crear `src/lib/server/db/schema.ts` con 12 tablas Drizzle (careers, specialties, subjects, subjectAliases, subjectPrerequisites, subjectUnits, studentProfiles, studentProgress, courseGroups, courseScheduleBlocks, studentCredentials, authSessions). Incluir FIXES v2.0.
- [x] **Task 1.2:** Guardar dataset completo de 42 asignaturas en `src/lib/server/db/data/curriculum-isic-2010-224.json`.
- [x] **Task 1.3:** Crear seed script (`src/lib/server/db/seed.ts`) que popula D1 con canonicalIds, prerrequisitos y aliases (manejando `ACF-0901` vs `ACF-2301`).

### Pending Phase 1 Tasks

- [x] **Task 1.4:** Seed CLI para provisionar credenciales del estudiante de prueba. Implementado en `src/lib/server/db/seed-password.ts`. Accesible vía `just db-set-password` (recipe expuesta en justfile) o `pnpm run db:set-password` (script en package.json). Default dev credential: controlNumber `<NUMERO DE CONTROL PURGADO>` / password `opensim-dev-2026`. NO USAR EN PRODUCCIÓN.

### Phase 2: Core Algorithmic Layer & Design System

- [x] **Task 2.1:** `src/lib/styles/tokens.css` con CSS Custom Properties light/dark.
- [x] **Task 2.2:** Implementar 18 componentes UI atómicos en `src/lib/components/ui/`: Button, Input, Select, Badge, Card, Modal, Drawer, Table, Tooltip, Toast, ProgressBar, Skeleton, Avatar, Kbd, Stepper, EmptyState, Dropdown, Tabs.
- [x] **Task 2.3:** Implementar `src/lib/utils/dag.ts` con `getAncestors`, `getDescendants`, `evaluateCreditThresholds`. Tests en `tests/unit/dag.test.ts`.
- [x] **Task 2.4:** Implementar `src/lib/utils/color.ts` con `getSubjectColorHSL`. Tests en `tests/unit/color.test.ts`.
- [x] **Task 2.5:** Auth nativa single-file. Crear `src/lib/server/auth.ts` (`createSession`, `validateSessionToken`, `invalidateSession`, `hashPassword`, `verifyPassword` vía Web Crypto API PBKDF2/SHA-256), middleware en `src/hooks.server.ts` para rutas `/academico/*`, y rutas de UI `/login` (form action) + `/login/recuperar` (vista informativa de soporte). Agregar tablas `student_credentials` y `auth_sessions` al schema. Seed CLI para asignar contraseña inicial al estudiante de prueba.

### Phase 3: Layout & Interactive Modules

- [x] **Task 3.1:** `<LayoutSidebar/>` colapsable + `<LayoutHeader/>` con buscador modal `Cmd+K`.
- [x] **Task 3.2:** Dashboard estudiante (`/dashboard`) con KPIs de créditos y widget de clases del día.
- [x] **Task 3.3:** `<TimeGridSchedule/>` con alturas proporcionales al tiempo real.
- [x] **Task 3.4:** `<ReticulaDag/>` SVG interactivo con Bézier y hover highlighting.
- [x] **Task 3.5:** Kardex (`/academico/kardex`) con tabla unificada, sort y badges de evaluación.

### Phase 4.0: Pre-Phase-4 hardening (7 corrections, audit M3.1 round 5)

- [x] **Task 4.0.1 — `67c813d`** fix(a11y): dark-mode tokens + theme-aware HSL (WCAG AA on both surfaces).
- [x] **Task 4.0.2 — `00a1bc7`** fix(kardex): use named `MIN_PASSING_GRADE=6.0` constant per TecNM 0-10 scale.
- [x] **Task 4.0.3 — `b48273c`** fix(dashboard,schedule): unified enrollment helper, no synthetic fallback.
- [x] **Task 4.0.4 — `92e3278`** fix(dashboard): timezone-aware 'today' using `Intl.DateTimeFormat('America/Mexico_City')`.
- [x] **Task 4.0.5 — `2edc138`** perf(db): 3 indexes on `course_groups` / `schedule_blocks`.
- [x] **Task 4.0.6 — `e0ca303`** test(dag): coverage for `buildAdjacency`, `*FromMap`, and cycle contract.
- [x] **Task 4.0.7 — `e8a95da`** fix(phase3-polish): dead sort code, ARIA combobox, deep-link, empty state, FOUC, status label dedup, spec marks.

### Phase 4: Enrolment Simulator, Procedures & PDF Export

- [x] **Task 4.1 — `add8afd` (builds on `b69c7ac` N1 fix):** Simulator de Reinscripción (`/reinscripcion`) con split view, conflict detection, y firma global. `b69c7ac` ships the enrollment seed fixture (38 `student_progress` rows for test student <NUMERO DE CONTROL PURGADO> + `getCurrentEnrollment` period-filtered query) and was the critical N1 audit fix.
- [x] **Task 4.2 — `b4799f7`:** Procedure Stepper (`/tramites`) con checks de umbrales de créditos (182/208) y validación por trámite.
- [x] **Task 4.3 — `d15cacb`:** Generador PDF con `pdf-lib 1.17.1` para Carga Académica vectorial. Importado vía `import()` dinámico para mantener el bundle cliente en 78.7 KB gz.

### Phase 5: Audit, Accessibility & Edge Deployment

- [x] **Task 5.1 — `8f06369` (closes Round 7 mcode audit):** Auditoría WCAG 2.1 AA con `@axe-core/playwright 4.13`. 14/14 specs verde (7 rutas × 2 temas de color) contra serious/critical. Findings cerradas: N9-N11 (sweep inicial), N12-N19 + N21-N22 (mcode M3.1-Flash-Preview round 7). 3 follow-ups menores documentados (N18 dev server reuse, N20 mobile sidebar flash, N23 results.json). Metodología y rutas en `docs/a11y-audit.md`.
- [x] **Task 5.2 — RESUELTA 2026-10-08:** Deploy a Cloudflare Workers con `@sveltejs/adapter-cloudflare 8.0.0`. La caja se marca cerrada a propósito: el deploy existe y la capa de datos está al día. Lo que falta es sólo el sweep de axe contra producción (ver abajo).

> **CONTRADICCIÓN RESUELTA — Task 5.2 (reconciliación 2026-10-08). La contradicción existía; ya no está abierta.**
>
> *Lo que decía cada registro. Se conserva completo, nada se borró:*
> - `odd/tasks/phase-6-ui-polish.md` (bloque Context) afirma que la app está **live en `https://opensim.jose-luis-rs.workers.dev` al 2026-10-03**, y su primer bloque Progress registra que los commits de U2+U4 fueron "pushed to `origin`".
> - En contra, el checklist de deploy `odd/tasks/phase-5.md:80-98` (5.2.1–5.2.5 — audit de `wrangler.jsonc`, D1 productiva + migraciones remotas, deploy, smoke, axe-vs-prod) no está registrado como ejecutado en ningún lado.
> - `odd/README.md` añadía que el `database_id` de `wrangler.jsonc` seguía siendo el placeholder `00000000-0000-0000-0000-000000000000`.
>
> *Evidencia que lo zanja (2026-10-08):*
> - **La D1 productiva existe y es real.** `wrangler.jsonc:36` → `"database_id": "390df78e-c4c2-4ace-94f4-6baebf1eb88f"`, `database_name: "opensim"`. Nunca fue el placeholder. `odd/tasks/phase-5.md:83-85` ya lo había registrado el 2026-10-06 — **el archivo desactualizado era `odd/README.md`**, no este.
> - **El Worker está vivo** (la URL de producción consta en el bloque Context de `odd/tasks/phase-6-ui-polish.md`). Workers Builds fue revinculado por el operador el 2026-10-08 tras borrar y recrear el repo; **el Worker nunca se borró**. B7 cerrada.
> - **La D1 remota está al día** (B6): `wrangler d1 migrations list opensim --remote` → `✅ No migrations to apply!`; `0006`–`0008` registradas en `d1_migrations` (9 en total). Conteo de filas idéntico antes y después: `subjects` 42, `student_progress` 38, `course_groups` 8, `student_credentials` 1, `student_profiles` 1. Cero pérdida.
> - **Lo que sí se ejecutó fue un deploy a Workers fuera del checklist de Phase 5**, más las piezas del checklist corridas por separado por el operador (migraciones remotas el 2026-10-08; password seeder y deploy, antes).
>
> **NOT VERIFIED:** el *axe sweep contra producción* (paso 5.2.5) no tiene registro en ningún archivo. Leer Task 5.2 como «el deploy existe y la capa de datos está al día», **no** como «verificado en verde en producción». Procedimiento completo: `docs/deploy.md`.

**Convención:** marcar items solo después de GREEN status via Vitest/Playwright tests.

---

### Phase 6: UI/UX Polish + Audit Cycle + Tooling Adoption (2026-10-03 → 2026-10-04)

First-round user walkthrough on `https://opensim.jose-luis-rs.workers.dev` surfaced 4 polish items (U1–U4). U3 was deferred pending a spec rewrite. U3 implementation, audit cycle (R11–R17), and tooling overhaul (Biome 2.5.15 + Podman CI) followed.

#### Phase 6.0 — Live Walkthrough Findings (closed 2026-10-03)

- [x] **Task 6.0.1 — `1294c91`** fix(theme): unify dark-mode token parity (U1). The "Marca" badge symptom was the missing `--brand-50/100` in the `@media prefers-color-scheme: dark` block.
- [x] **Task 6.0.2 — `5d7ac9c`** fix(ui): smooth ProgressBar transition (700ms cubic-bezier, U2). Honors `prefers-reduced-motion`.
- [x] **Task 6.0.3 — `e7facd3`** fix(ui): align icon to text x-height via `.btn__icon` flex wrapper (U4).
- [x] **U3 ⏸ deferred** — needs spec rewrite per M3.1 round 8 finding (status prop already exists; `aria-label` on `<span>` without role is exactly the `aria-prohibited-attr` violation already logged in axe findings; dot would be clipped by existing `overflow: hidden`).

#### Phase 6.1 — U3 Implementation (closed 2026-10-04, mcode R11)

- [x] **Task 6.1.1 — `a90ba55`** U3 Phase A — feat(ui): localize avatar status aria-label + remove aria-prohibited-attr. New `STATUS_LABEL_ES` map + `composeAltText()` in `<script module>`.
- [x] **Task 6.1.2 — `2531434`** U3 Phase B — feat(ui): non-text contrast fixes for avatar status dot. `--success-700`/`--warning-700` (light: 3.7:1, dark: light shades already pass). `--avatar-ring: var(--surface-0)` local CSS variable. `LayoutHeader.svelte` override to `--surface-1` (dormant today).
- [x] **Task 6.1.3 — `3608369`** U3 Phase C — feat(ui): wrap Avatar in frame so status dot extends outside the clip. New `.avatar-frame` wrapper owns `position: relative` + `display: inline-flex`; dot lives in the wrapper; `transform: translate(50%, 50%)` shifts the dot's center to the avatar's lower-right corner.
- [x] **Task 6.1.4 — `281b9b5`** docs(odd): record U3 closeout (3 work-unit commits on main).
- [x] **Task 6.1.5 — `d789930`** fix(ui): declare `--avatar-ring` on avatar-frame so dot inherits (mcode R11 cascade-bug catch). `--avatar-ring` was declared on `.avatar` but the dot lives on its sibling `.avatar-frame`; CSS custom properties inherit parent → child, never between siblings. 1 line moved.

#### Phase 6.2 — Cosmetic Follow-ups (closed 2026-10-04, mcode R12 + R13)

- [x] **Task 6.2.1 — `5b05166`** U3 follow-up C1+C2+C5 — border ring → `box-shadow` halo (escape global `box-sizing: border-box` at xs/sm); drop dead `position: relative` + `flex-shrink: 0` from inner `.avatar`; spec note in AC9. Static-regex test for ring contract. Regex-comment-strip scoped to `<style>` only (defensive comment would otherwise match the negation).
- [x] **Task 6.2.2 — `7fb89a7`** U3 follow-up C3 — `composeAltText('', 'online')` was silently dropping status (public API bug). Rewrite branch order so status evaluates even with empty name.
- [x] **Task 6.2.3 — `e43caae`** U3 follow-up C4 — `initials('')` was returning `''` (not `'?'`) because `''.trim().split(/\s+/)` returns `['']`, length 1, so the `parts.length === 0` branch was unreachable. Production fix: `if (!n.trim()) return '?'` at top of `initials`. Move to `<script module>` + export. 6 new test cases.
- [x] **Task 6.2.4 — `482a00e`** mcode R13 follow-up — C5 spec defect. Original C5 added parenthetical "(was `borderTopColor`...)" without rewriting the LHS; `getComputedStyle(dot).borderTopColor` was no longer valid (dot has no border). Rewrote AC9 to assert the resolved `--avatar-ring` color appears inside `getComputedStyle(dot).boxShadow`; documented AC8 hit-test implication. Also added `composeAltText('', 'offline')` test case for 4-status symmetry.

#### Phase 6.5 — Audit Closure + Biome Adoption + Local Podman CI (closed 2026-10-04, mcode R14 → R17)

- [x] **Task 6.5.1 — `72cddf5`** docs(odd): close R11/R12/R13 audit cycle + adopt just in reports. New `odd/tasks/phase-6-u3-audit-closure.md` with traceability table. 7 `pnpm` invocations migrated to `just` across 4 reports/README. 3 typo fixes (`just test:e2e` → `just test-e2e`).
- [x] **Task 6.5.2 — `d5e2109`** chore(tooling): adopt Biome 2.5.15 + activate domains + repair precommit + drop vestigial deploy. New `biome.json` (formatter + 4 domains: svelte/drizzle/playwright at `all`, test at `recommended`). Repaired `just precommit`. Deleted vestigial `just deploy`. +1 devDep `@biomejs/biome@2.5.15` pinned exact.
- [x] **Task 6.5.3 — `dcd3e9e`** chore(style): format repo with Biome 2.5.15 (gate repair). 120 source files reformatted. Zero domain findings; 22 default-rule findings fixed in code or silenced in overrides (full disclosure in commit body). Override patterns corrected from `*.svelte` to `**/*.svelte`.
- [x] **Task 6.5.4 — `6e67534`** chore(ci): drop GitHub Actions + add local Podman CI recipes. Deleted `.github/`. New `Containerfile.ci` (`node:24-bookworm-slim` base — Playwright rejects musl/Alpine per https://playwright.dev/docs/docker; mcode R15 caught this); Chromium via apt-get symlinked to `/usr/bin/chromium`. 5 new recipes: `ci-build`, `ci`, `ci-shell`, `ci-clean`, `ci-drift`.
- [x] **Task 6.5.5 — `338ad07`** R17 follow-up A. Repaired 3 doc-comments falsely claiming `just ci` runs axe (real `just ci` = check + biome-check + test; axe-core e2e via `just test-e2e` separately). Added `biome-check` to `just verify`. Ran `biome migrate`. Moved multiline `#` comments → `[doc()]` attribute.
- [x] **Task 6.5.6 — `0baf00b`** R17 follow-up B. New `.env.example`. Historical-record note at `phase-6-u3-cosmetic-followups.md:237`. Committed previously-untracked `phase-6.5-closure-and-just-adoption.md`. Added `packageManager: pnpm@11.28.4`.
- [x] **Task 6.5.7 — `cc0f8ee`** refactor(just): rename `verify` → `qa` (full gate) and `precommit` → `qa-fast` (delete `verify`). Aligns with TallerAgentes convention. `Containerfile.ci` CMD updated to `[just, qa-fast]`.

**Final state after Phase 6 (8 ahead of origin/main, all GPG-signed, key `3335F4A0…`):**

- `pnpm run check` 0/0
- `pnpm test` 149/149 (was 122 before Phase 6)
- `pnpm exec biome ci` exit 0
- `pnpm run build` clean
- `just qa-fast` ✓ pre-commit checks passed
- `just qa` ✓ all green — ready to push
- `git grep 'just verify\|just precommit'` 0 hits
- NOT pushed to remote (push is human-owned)

---

### Phase 7: Hardening (2026-10-06, 5 commits, closed post-Gemini-R20-2)

Closes the cross-audit findings from Gemini R20 and the blockers mcode R21 caught in the proposed fixes. All 8 issues (3 critical + 5 important) from the original audit + 3 mcode blockers folded into the v2 plan, then implemented in 5 work-unit commits.

The 5 work-unit commits (all GPG-signed, key `3335F4A0…`, NOT pushed — **snapshot del 2026-10-06; al 2026-10-08 todo el historial está enviado a GitHub y Codeberg, y los SHAs de esta lista están muertos**):

- [x] **Task 7.1 — `5ab128e`** `fix(security): adopt SvelteKit 3 kit.csp.mode:'nonce' + remove manual CSP (Phase 7 F1 v2)`. 4 files changed (+39/-69). vite.config.ts adds `csp: { mode: 'nonce', directives: { 'script-src': ['self'], 'style-src': ['self', 'unsafe-inline'] } }` to the SvelteKit config. src/app.html's theme bootstrap gets `nonce="%sveltekit.nonce%"` (auto-filled per request). src/hooks.server.ts drops the manual SHA-256 middleware (the follow-up note at lines 32-34 predicted this migration). tests/e2e/avatar-overlap.spec.ts drops the `page.route` CSP bypass — the dark suite's `addInitScript` now works against real production CSP. **Verification:** `just test-e2e-avatar` 161 passed (per-describe filter lands in Task 7.4 to bring this to 80).
- [x] **Task 7.2 — `d34c3df`** `chore(ci): exclude _dev/avatars from production bundle via Vite plugin (Phase 7 F2 v2)`. 4 files changed (+62/-2). Renamed `src/routes/_dev/avatars/` → `src/routes/.dev/avatars/` (defense-in-depth marker). Added `exclude-dev-fixtures` Vite plugin: a `transform` hook strips the route entry from `.svelte-kit/generated/build/client/app.js` (dev is untouched because the hook only fires on `.svelte-kit/generated/build/`, not `dev/`), and a `closeBundle` hook walks the client output's `nodes/` directory and unlinks any chunk whose body still contains the fixture markers (`avatar-fixture-root` or "Avatar fixture"). The original R21 v2 plan recommended a `rollupOptions.external` plugin first; that path did not strip the route from SvelteKit's manifest (the route is registered before Rollup sees it), so the `transform + closeBundle` combo is what shipped. **Verification:** `pnpm run build` + `! grep -r '_dev/avatars\|.dev/avatars' .svelte-kit/output/client/` is empty; dev mode is unchanged (test passes).
- [x] **Task 7.3 — `b49e5a7`** `fix(a11y): brand-600 to #0f6f85 + add titles + fix /404 button (Phase 7 F3+F7a+F7b)`. 5 files changed (+33/-2). `--brand-600: #0891b2 → #0f6f85` (verified 5.78:1 on white, AA pass). Title tags added to `/`, `+layout.svelte`, and `(protected)/+layout.svelte` (the 9 inner routes already have their own). The /404 button (`src/routes/+error.svelte:53`) used `.btn--primary` from Button.svelte, but Button.svelte's CSS is scoped to its own template so the link got NO background color — recreated the `.btn--primary` look in the error page's scoped style block (--brand-700 background + --brand-fg text, same recipe as `Button.svelte:107-109`). **Verification:** `just test-e2e` 271 passed; the 3 pre-existing `chromium-dark` failures on `/horario`, `/reinscripcion`, `/tramites` (HSL-hashed subject backgrounds vs. dark theme `--fg-secondary`; contrast ~3.97:1) are NOT introduced by this commit — they are present at `ccd490f` HEAD and documented as Phase 8 follow-up. **Actualizado 2026-10-08:** ese follow-up se cerró — `e2708a1` (subject blocks, `SUBJECT_LIGHTNESS.dark` 28 → 20) y `99c366a` (procedure nav credits); gate 114/114, 0 failed. Los SHAs de esta línea están muertos; re-derivarlos con `git log --oneline --grep='<subject>'`.
- [x] **Task 7.4 — `9a98041`** `fix(tooling): sync pnpm + Avatar.svelte HTMLAttributes spread + avatar spec test.skip (Phase 7 F4+F5+F6)`. 5 files changed (+81/-21). `Containerfile.ci:62` pnpm `@10.0.0` → `@11.28.4` (matches `package.json:6 packageManager`; verified pnpm install in isolation via `podman run node:24-bookworm-slim bash -c 'npm install -g pnpm@11.28.4 && pnpm --version'` prints 11.28.4). Avatar.svelte Props now `extends Omit<HTMLAttributes<HTMLSpanElement>, 'src' | 'alt' | 'children'>`; `dataTestid` opt-in prop removed; `{...rest}` spread on `.avatar-frame`. tests/e2e/avatar-overlap.spec.ts uses per-describe `test.beforeEach` (which DOES receive `testInfo`) to call `test.skip(true, ...)` for the wrong project. The plan's `test.skip(({ testInfo }) => ...)` form only works in newer Playwright typings; the v1.63 signature is `(args: TestArgs & WorkerArgs) => boolean` (no testInfo). The empty `{}` destructure is required by Playwright's runtime check ("First argument must use the object destructuring pattern") but triggers biome's `noEmptyPattern` rule — suppressed with an inline `biome-ignore` comment. justfile drops `--project` flags from `test-e2e-avatar`. **Verification:** `just test-e2e-avatar` 81 passed (40 light + 40 dark + 1 setup), 160 skipped.
- [x] **Task 7.5 — `92ed2d0`** `docs(odd): record Phase 7 hardening closeout (post-gemini-R20-2 + mcode-R21)`. 2 files changed (+this section + Progress entry in phase-6-ui-polish.md).

**mcode R21 caught 3 blockers in the v1 plan** (audit log at `/tmp/opencode/mcode-phase7-audit.log`):
- F1 v1 `'script-src' 'self'` would block SvelteKit's `kit.start(app, ...)` inline hydration script. v2 fix: `mode: 'nonce'` auto-derives the nonce for the inline script.
- F2 v1 `(dev)/avatars/` route group is layout-grouping, not exclusion. v2 fix: `transform + closeBundle` Vite plugin (no SvelteKit file system exclusion API in this project).
- F6 v1 spec split doesn't reduce runs. v2 fix: per-describe `test.beforeEach` filter using `testInfo` (one file, 80 honest runs).

**Gemini R20-2 audit verdict** (see `/tmp/opencode/agy-r20-2-audit.log`): see closeout section below — applied to this commit if R20-2 caught new issues, otherwise absent (the implementation was correct first try).

**Final state after Phase 7 (5 new commits on top of `ccd490f`):**

- `pnpm run check` 0/0
- `pnpm test` 149/149
- `pnpm exec biome ci` exit 0 (5 pre-existing `noNonNullAssertion` warnings in `tests/e2e/avatar-overlap.spec.ts`, non-blocking per the `playwright: all` domain)
- `pnpm run build` clean
- `just qa-fast` ✓
- `just test-e2e-avatar` 81/81 (40 light + 40 dark + 1 setup; 160 skipped on the wrong-project combinations)
- `! grep -r 'dev/avatars' .svelte-kit/output/client/` empty (F2 v2 verified)
- Working tree dirty files preserved: `tests/e2e/reports/axe-findings.json`, `tests/e2e/reports/results.json`, `.agents/`, `skills-lock.json`
- 24 commits ahead of origin/main (19 from Phase 6 + 5 from Phase 7)
- NOT pushed to remote (Phase 5.2 is the human's next step)

> **Snapshot fechado al 2026-10-05. Las dos últimas líneas quedaron desactualizadas el 2026-10-08 y se conservan como historia, no como estado:**
>
> - **Push:** ambos remotos tienen ahora todo el historial. `main` está en `ffcd595` (126 commits) y `feat/phase-9-verified-curriculum` en `8f40837` (128 commits, +2 sobre `main`), en GitHub (`Kat404/OpenSIM`) y Codeberg (`Kat404/OpenSIM`), force-pushed tras la reescritura de firmas.
> - **Firmas:** 126/126 en `main`, 128/128 en la rama de fase, clave GPG `3335F4A0D9DBBA95`.
> - **Los SHAs de todo este bloque están muertos.** La reescritura de firmas del 2026-10-08 cambió cada SHA del repositorio. Re-derivarlos con `git log --oneline --grep='<subject>'`.
>
> Advertencia aparte: `pnpm test` 149/149 y `just test-e2e-avatar` 81/81 son de esta fecha. **NOT VERIFIED** hoy.

---

## 9. Decisiones Técnicas

### Resueltas

| ID | Decisión | Notas |
|---|---|---|
| CF-1 | SubjectNode dual identity | `canonicalId` slug + tabla `subjectAliases` |
| CF-2 | Backend: Cloudflare D1 + Drizzle ORM | SQLite edge, type-safe, FOSS-friendly |
| **CF-3** | **Auth nativa single-file** | **`crypto.subtle` PBKDF2/SHA-256, tablas `student_credentials` (hash+salt+iter) + `auth_sessions` (token hasheado SHA-256, expiry, metadata), cookies HttpOnly+Secure+SameSite=Lax, `/login/recuperar` informativo. 0 paquetes npm auth, 0 servicios externos.** |
| CF-4 | Performance budgets | Implícito via edge SSR; budgets explícitos §12 |
| AG-3 | 18 componentes atómicos | Listado completo en Fase 2 Tarea 2.2 |
| AG-4 | HSL color hash | FNV-style hash, hsl(60%, 88%) pastel |
| AG-7 | Form validation | Valibot 1.5 |
| AG-8 | DAG layout algorithm | Grid-by-semester + Bézier connectors |
| AG-9 | Curriculum data | JSON estático + D1 seed |
| AG-10 | PDF generation | pdf-lib 1.17 client-side vectorial |
| AG-11 | Testing stack | Vitest 5 + Playwright 1.63 |
| AG-12 | Deployment target | Cloudflare Pages + Workers |
| AG-13 | WCAG validation | @axe-core/playwright 4.13 |

### Diferidas (TBD)

| ID | Decisión | Bloquea |
|---|---|---|
| AG-14 | Browser target (sugerido Baseline 2024+) | Cross-cutting |
| AG-15 | Multi-user roles | Cross-cutting |
| AG-16 | i18n (Spanish-only explícito) | Cross-cutting |
| AG-17 | Offline/PWA | Cross-cutting |
| AG-18 | Analytics (Plausible / Umami) | Cross-cutting |
| AG-20 | Error handling (`+error.svelte`, form action errors) | Cross-cutting |
| AG-22 | Loading states strategy | Cross-cutting |

---

## 10. Inventario de Componentes UI (18 Atómicos)

[Lista consolidada de la Fase 2 Tarea 2.2]

1. Button
2. Input
3. Select (dropdown)
4. Badge
5. Card
6. Modal
7. Drawer
8. Table
9. Tooltip
10. Toast
11. ProgressBar
12. Skeleton
13. Avatar
14. Kbd
15. Stepper
16. EmptyState
17. Dropdown
18. Tabs

---

## 11. Estrategia de Datos y Persistencia

### Backend: Cloudflare D1 (SQLite at edge)

- **Local dev**: `wrangler dev` ejecuta D1 local con Miniflare
- **Producción**: D1 replicado globalmente (auto-distributed reads)
- **Migraciones**: Drizzle Kit (`drizzle-kit generate`, `drizzle-kit migrate`)
- **Seed**: Script idempotente en `src/lib/server/db/seed.ts`
- **No mock JSON** — D1 local + Miniflare proveen entorno dev completo desde día 1

### Wrangler Config

```jsonc
// wrangler.jsonc
{
  "name": "opensim",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "opensim",
      "database_id": "<generated-by-wrangler>"
    }
  ]
}
```

---

## 12. Métricas de Rendimiento Objetivo (CF-4)

| Métrica | Target | Cómo |
|---|---|---|
| LCP | ≤ 1.5s en 4G | Lighthouse CI |
| INP | ≤ 200ms | Lighthouse, RUM |
| CLS | ≤ 0.05 | Lighthouse, RUM |
| TTFB | ≤ 600ms | Edge SSR (Cloudflare) |
| JS bundle inicial | ≤ 100KB gzipped | Vite build |
| CSS bundle | ≤ 30KB | Tokens + scoped styles |

**Cumplimiento implícito:** Cloudflare D1 + Workers edge + SvelteKit SSR minimiza TTFB.

---

## 13. Convención de Nombrado

| Categoría | Idioma | Ejemplo |
|---|---|---|
| Componentes, props, types | English | `Button.svelte`, `StudentProfile` |
| Rutas | English | `/dashboard`, `/horario` |
| Contenido visible | Spanish | "Calificaciones", "Retícula" |
| Comentarios | English | `// Mark this route as protected` |
| Commits | English (Conventional Commits) | `feat(horario): add HSL color hash` |
| Documentación | English | — |
| Errores al usuario | Spanish | "Sesión expirada" |

---

## 14. Manejo de Errores (AG-20 TBD)

- `src/routes/+error.svelte` — boundary global (404, 403, otros)
- Form Actions → validación con Valibot → `fail(400, { ... })` para errors tipados
- `console.error` con stack en dev; logging estructurado en prod (decidir TBD)

---

## 15. Estrategia de Deployment (AG-12 ✓ + AG-14 TBD)

### Hosting: Cloudflare Pages + Workers

- `@sveltejs/adapter-cloudflare 8.0.0` compila a Worker bundles
- D1 binding via `wrangler.jsonc`
- Edge SSR global (200+ POPs)
- Free tier generoso, dominio custom soportado

### Browser Support (AG-14 TBD — sugerido)

- **Baseline 2024+** — Chrome 120+, Firefox 120+, Safari 17+, Edge 120+
- Skip IE / legacy mobile
- CSS Nesting nativo soportado (todos los navegadores target)

### Build & Deploy

```bash
pnpm install --frozen-lockfile
pnpm run build          # wrangler build
pnpm run check          # svelte-check
pnpm run test           # vitest + playwright
pnpm run deploy         # wrangler pages deploy
```

---

## Anexo A. CF-1 Decision Record

**Decisión**: `canonicalId` (slug) como PK + tabla `subjectAliases` para legacy codes.

**Rationale**:
- Slug (`calculo-diferencial`) sobrevive a renumeraciones institucionales
- Tabla de aliases preserva códigos legacy para queries retroactivas
- FK constraints mantienen integridad referencial

**Migration path**:
- Seed inicial: insertar subject + alias en transacción
- Lookup dual: query por `code` O `aliasCode` resuelve a `canonicalId`
- API expone siempre `canonicalId` internamente; UI puede mostrar `code` o alias según contexto

---

## 16. Audit Fixes (v2.2)

Cambios aplicados tras la auditoría M3.1-Flash-Preview (max effort, 2026-10-02). Cuatro bloques, cada uno resuelto con un commit de unidad de trabajo.

### 16.1 C5 — Route group `(protected)` (refactor de routing)

- **Antes:** `src/hooks.server.ts` validaba contra `pathname.startsWith('/academico/')`. Cubre el prefijo, no el mapa de rutas planificado (`/dashboard`, `/reinscripcion`, `/tramites`).
- **Después:** la protección vive en `src/routes/(protected)/+layout.server.ts` y se aplica a cualquier hijo del grupo. `hooks.server.ts` se simplifica a "leer cookie → hidratar `locals.user`" sin tocar la URL.
- **Impacto:** el guard pasa de cubrir una convención de URL a un límite de layout. Nuevas rutas protegidas se agregan bajo `(protected)/` y heredan el gate sin tocar middleware.

### 16.2 A3 — Token hashing en `auth_sessions`

- **Antes:** `createSession` insertaba el token plano como PK. Cualquier dump de D1 entregaba tokens usables durante 30 días.
- **Después:** el PK `id` de `auth_sessions` es `sha256(token)` (base64url). `validateSessionToken` e `invalidateSession` hashean la entrada antes de consultar/borrar. La cookie sigue llevando el token; solo la base lo hashea.
- **Coste:** una llamada `crypto.subtle.digest` por request autenticado. Test suite sigue verde (el cambio es transparente al consumidor del API).

### 16.3 A5 — Spec self-consistency (Anexo B, contador, pin de TS)

- **Antes:** el spec v2.1 se contradecía: `typescript 7.0.2` en §3 vs `6.0.3` en `package.json`; §5.1 decía "10 entidades" listando 12; §8 dejaba Phase 1 sin marcar pese a estar completa; Anexo B declaraba "CF-3 (TBD)" aunque el header lo marcaba cerrado.
- **Después:** pin de TS alineado a `6.0.3`, §5.1 dice "12 entidades", Phase 1 marcada `[x]`, Anexo B eliminado, Anexo A preservado, y nueva sección §16 (esta) documenta los fixes.
- **Impacto:** el spec vuelve a ser el artefacto canónico confiable. La contradicción más peligrosa — Anexo B invitando a reintroducir mock-auth — se eliminó por completo.

### 16.4 Doc rewrite — Flujo canónico de Drizzle + D1

- **Antes:** `docs/drizzle-raw-sql-workaround.md` documentaba la divergencia local/prod como inevitable y proponía 3 opciones (A/B/C) con comandos que mezclaban flags inexistentes (`--file` en `migrations apply`).
- **Después:** `docs/drizzle-migrations-and-data.md` describe el flujo canónico positivo en una sola dirección: schema → `drizzle-kit generate` → `wrangler d1 migrations apply` (local) → `wrangler d1 execute --file` solo para datos → `wrangler d1 migrations apply --remote`. `drizzle-kit migrate` se documenta como camino muerto y no se usa.
- **Regla de cabecera:** `wrangler d1 execute --file` es exclusivamente para DATOS; DDL siempre va por el migration runner.

### 16.5 Phase 2.5 — Endurecimiento de Frontera (Oct 2026)

Segunda ronda de auditoría M3.1-Flash-Preview aplicada con cinco commits de unidad de trabajo. Todos los cambios cierran vectores de fuga de PII, de open-redirect y de cadena de limpieza incompleta en el grafo `student_profiles`.

- **PII trim (audit NEW-1)**: `src/routes/(protected)/+layout.server.ts` ahora devuelve solo `controlNumber`, `fullName`, `status`. Páginas que necesiten más campos (CURP, `birth_state`, promedios, créditos) los cargan en su propio `+page.server.ts` con selección explícita de columnas.
- **redirectTo endurecido (audit NEW-2)**: nuevo helper `safeInternalRedirect` en `src/lib/utils/redirect.ts` rechaza protocol-relative (`//`) y backslash-protocol-relative (`/\`, `\\`). Usado en `/login` form action y en `load`. El helper parsea contra un origin centinela (`https://internal.invalid`) para confirmar same-origin sin depender del request actual.
- **`db:set-password` recipe (audit NEW-3)**: añadido a `justfile` (entre `db-seed` y `db-studio`) y referenciado desde Tarea 1.4. Resuelve el gap entre el script `pnpm run db:set-password` (que ya existía) y la receta `just` descubrible.
- **Tests añadidos (audit NEW-5/N6)**: `hashToken` (deterministic, base64url 43 chars, empty + Unicode) en `tests/unit/auth.test.ts` y `safeInternalRedirect` (null/undefined/empty, protocol-relative, backslash, absolute URL, valid path, query string, custom fallback, hash drop) en `tests/unit/redirect.test.ts`. Total: 50 tests pasando (35 baseline + 15 nuevos).
- **Cascade completo (audit A5/A6)**: `student_credentials.controlNumber` ahora también `ON DELETE CASCADE` (migración 0003). Limpieza de cadena completa en egreso o corrección de número de control: `student_profiles → student_credentials`, `auth_sessions`. Las migraciones 0002 (auth_sessions cascade + índices) y 0003 (student_credentials cascade) cierran la dependencia.
- **D1 local alineado**: `just db-reset` ejecutado antes del commit 1; las migraciones 0000/0001/0002/0003 están aplicadas; `auth_sessions` y `student_credentials` tienen CASCADE + los índices `idx_auth_sessions_expires_at` y `idx_auth_sessions_student` en el D1 local.
- **Spec accuracy**: `src/lib/server/db/schema.ts` corrige el header de "10 normalized tables" a "12"; §8 Task 1.1 corrige "10 tablas" a "12 tablas". El contador de §16.3 ("10 entidades" en v2.1) se preserva verbatim porque documenta el bug histórico resuelto en v2.2.