# OpenSIM — Open Source - Sistema Integral Modular (v2.2)

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

## 8. Plan de Ejecución ODD (5 Fases)

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

### Phase 4: Enrolment Simulator, Procedures & PDF Export

- [ ] **Task 4.1:** Simulator de Reinscripción (`/reinscripcion`) con split view y firma global.
- [ ] **Task 4.2:** Procedure Stepper (`/tramites`) con checks de umbrales de créditos.
- [ ] **Task 4.3:** Generador PDF con `pdf-lib 1.17.1` para Carga Académica vectorial.

### Phase 5: Audit, Accessibility & Edge Deployment

- [ ] **Task 5.1:** Auditoría WCAG 2.1 AA con `@axe-core/playwright 4.13`.
- [ ] **Task 5.2:** Deploy a Cloudflare Pages/Workers con `@sveltejs/adapter-cloudflare 8.0.0`.

**Convención:** marcar items solo después de GREEN status via Vitest/Playwright tests.

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