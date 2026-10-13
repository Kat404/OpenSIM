<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-10
reconciled-against: feat/phase-9-verified-curriculum@d3db09e
sha-warning: re-derive current SHAs with `git log --oneline --grep='<subject>'`
-->

# Phase 9 — UI: horario, temario, trámites y la oferta que no cabe

Creado 2026-10-10, después de que T9.1–T9.10 cerraran. Cubre T9.11, T9.12, T9.13 y
T9.14, e incorpora el resultado de H11.

---

## H11 — resuelto, y no es un hueco

**Verificado contra las fuentes que ya teníamos.** No hace falta iniciar sesión para
saberlo:

| Endpoint del SIM | Qué publica | ¿Horario? |
| --- | --- | --- |
| `/reinscripcion/grupos` | el catálogo: 468 grupos con docente, periodo, créditos y el matraz de laboratorio | **no** |
| `/estudiante/datos/carga-academica` | los grupos **en los que el alumno ya está inscrito**, con aula y horario | **sí** |

El horario de un grupo sólo existe **después** de la inscripción. El catálogo se publica
antes de la asignación, porque un grupo abierto a sesenta alumnos todavía no tiene aula
ni hora: se asigna al formalizar la inscripción. Es la forma del SIM, no una omisión
nuestra.

### Consecuencia que atraviesa todo el plan

**`/reinscripcion` no puede detectar traslapes, por diseño.** Se elige entre grupos cuyo
horario aún no existe. El SIM asigna el horario al inscribir y ahí es donde choca.

Esto confirma el texto que ya muestra el simulador: *"El SIM no publica horarios para los
grupos de la oferta, por lo que no se pueden detectar traslapes entre las materias que
elijas."* La nota ya no es un placeholder: es la explicación correcta.

**Lo que queda abierto y no podemos resolver sin ti**: si existe un endpoint del SIM que
no conozco. La sesión del 2026-10-07 expiró. Si tienes una sesión viva, un vistazo a la
pestaña de inscripción del propio SIM cerraría el tema en dos minutos. **No bloquea este
plan** — el plan es correcto con o sin ese endpoint.

---

## Orden

```
  T9.14  paginación de la oferta        ← primero: sin esto los otros tres
                                            se construyen sobre una caja negra
  T9.13  /tramites: la regla de los 5   ← independiente, pequeño
  T9.11  /horario con aulas reales       ← depende de lo que salga de T9.14
  T9.12  detalle de temario             ← el primer consumidor real de subject_units
```

T9.14 va primero por una razón medida, no estética: **`/reinscripcion` renderiza 2 450
nodos de accesibilidad.** Con el agente de `e2e explore` eso son 65 890 tokens por paso
contra un presupuesto de 64 000, y el bug bash murió en el primer paso con cero hallazgos.
Un alumno tiene el mismo problema en forma de 475 filas de una vez.

---

## T9.14 — la oferta cabe en una pantalla

**Estado actual.** `load` devuelve los 475 grupos de golpe y la tabla los pinta todos.
La búsqueda y los filtros existen pero se aplican **después** de renderizar.

**Qué hay que hacer.** Paginación o scroll virtual del lado del servidor, con los filtros
aplicados **antes** de la consulta, no después. Preferir filtros de servidor: reduce el
`load`, y con él el presupuesto del agente.

**Filtros que ya existen y no llegan al servidor**: materia, semestre, disponibilidad,
sólo-conflictos. El de área es inerte por diseño (H4) y no debe volver.

**Verificación.** El `load` devuelve un conjunto acotado; `pnpm test` lo afirma; y
`e2e explore --max-steps 4` sobre `/reinscripcion` deja de morir con `STEP_BUDGET_EXHAUSTED`
y corre a término. Ese segundo es el criterio de aceptación real: **si el bug bash no
llega a su assessment, la página sigue siendo demasiado grande.**

---

## T9.13 — la regla de los 5 complementarios

**Regla de negocio, del operador, sin ambigüedad:** 5 créditos complementarios son
necesarios para titularidad y **desbloquean el Servicio Social**. Los complementary
**no aportan créditos reticulares**: sirven sólo para dar el complementario.

**Estado actual.** `complementary_credit_activities` existe con 3 filas. El perfil del
alumno tiene `approvedCredits: 175` contra un total de 260. `/tramites` calcula umbrales
182 y 208 sobre los créditos reticulares, que **no incluyen** los complementarios.

**Decisión del operador, 2026-10-10: (a) puerta ADICIONAL.** El Servicio Social se
desbloquea con `reticulares ≥ 182` **y** `complementarios ≥ 5`. No se sustituyen.

La alternativa descartada era (b), que los complementarios reemplazaran los 182
reticulares. Ningún alumno real distingue las dos lecturas, porque con 175 reticulares y
3 de 5 ambos dan bloqueado; se separan sólo con 200 reticulares y 2 complementarios, o
con 150 reticulares y 5 complementarios. Lo que decided es que la regla institucional
son **dos puertas**, no una: los complementarios existen porque el plan los exige como
requisito de egreso, y si reemplazaran a los 182 reticulares no aportarían nada que los
182 no hicieran ya.

`evaluateCreditThresholds` hoy calcula únicamente con reticulares y no recibe el conteo
de complementarios. T9.13 le pasa el segundo número y `canStartSocialService` exige las
dos condiciones. La Residencia (208) y el Taller de Investigación (130) **no** cambian:
su regla nunca involucró complementarios.

**Verificación.** Un test por cada rama de la decisión; el copy de `/tramites` refleja la
misma regla; y el alumno de prueba (3 de 5) queda en el estado que la regla diga.

---

## T9.11 — horario con aulas reales

**Lo que ya funciona.** `/horario` renderiza los 14 bloques del fixture, con aula, día y
hora. Las aulas son reales: vienen de la carga académica del alumno.

**Lo que falta.** El catálogo de oferta tiene 468 grupos y **ninguno tiene horario**
(H11). Así que "aulas reales para el catálogo" **no es un trabajo de integración: es
imposible con esta fuente.**

**Lo que sí es un trabajo real**, y es lo que propongo:

1. El horario del alumno es real y ya está. **Verificar que se ve bien** en la pantalla
   actual y que no tiene datos inventados alrededor.
2. Cuando el alumno inscribe un grupo nuevo del catálogo, ese grupo entra al horario **sin
   hora conocida**. La UI debe decirlo, igual que hizo `/reinscripcion`. Hoy
   `enrollments` registra la elección pero **nadie lee esa tabla todavía**: el paso que
   falta es que `/horario` pinte los grupos inscritos cuyos bloques no existen, marcados
   como "aún sin horario publicado".
3. Eso convierte `enrollments` en el primer consumidor real de la tabla que T9.7 creó.

**Verificación.** Un test que afirme que un grupo inscrito sin bloques aparece marcado y
no como horario vacío.

---

## T9.12 — detalle de temario

**Lo que hay.** `subject_units`: 32 unidades, 223 subtemas, con ventanas de evaluación e
instrumentos. Vienen de la única fuente que los publica: `/calificaciones-curso`, que sólo
expone las materias **del periodo activo**. De ahí el 24 % de cobertura.

**Lo que falta.** El consumidor. No hay ninguna vista que lea `subject_units`.

**Decisión del operador, 2026-10-13: (A) cobertura explícita.** Una vista de temario por
materia, que nombre la cobertura real en pantalla. Se descarta (B), sólo buscador.

**Qué obliga la decisión.** La opción A es honesta, pero por sí sola invita a que el alumno
piense que las otras materias no tienen temario. La respuesta correcta es mostrar *la causa*
junto al número: el temario falta porque el portal sólo publica el del periodo activo, no
porque la institución no lo tenga. Así el dato ausente se lee como una limitación de la
fuente, no como una ausencia real.

**Verificación.** La vista nombra la cobertura real en pantalla. Un temario que no existe se
distingue de uno vacío: "el portal no lo publica" **no** es "no hay unidades".

---

## Estado

| Task | Qué | Estado | Commit |
| --- | --- | --- | --- |
| T9.14 | la oferta cabe en una pantalla | cerrada | `ab39e95` |
| T9.13 | `/tramites`: regla de los 5 complementarios | cerrada | `1282ec4` |
| T9.11 | horario con aulas reales | cerrada | `3df4bca` |
| T9.12 | detalle de temario | cerrada | `756246a` |

Las dos decisiones que bloqueaban el plan están tomadas: **T9.13** puerta adicional (ya
dictada el 2026-10-10) y **T9.12** cobertura explícita (2026-10-13). Ninguna task quedó
bloqueada.

---

## Fuera de alcance

- Cualquier dato real de alumno. Todo lo que se muestra es inventado salvo las materias.
- Reimplementar la detección de conflictos. H11 dice que no hay contra qué.
- Cambiar el seed o el esquema más allá de lo que T9.12 necesite para leer.

---

## Log

- **2026-10-13 — L1.** El operador responde las dos decisiones que bloqueaban el plan:
  *"T9.13 Habíamos que 5 complementarios + 182 reticulares / T9.12 Cobertura explícita.
  Procede."* T9.13 confirma la puerta adicional ya escrita el 2026-10-10; T9.12 elige la
  opción A. Se reescriben las secciones afectadas, se corrigen dos corrupciones de texto
  del documento (`emm涉及`, `unaplaceholder`) y este bloque sustituye a la sección que
  declaraba el bloqueo.
- **2026-10-13 — T9.14 cerrada** (`ab39e95`). Paginación server-side de la oferta con
  filtros aplicados en SQL antes del conteo, y deduplicación de los grupos que el SIM
  publica dos veces. 22/22 en `tests/unit/reinscripcion.test.ts`.
- **2026-10-13 — T9.13 cerrada** (`1282ec4`). `evaluateCreditThresholds` recibe el conteo
  de complementarios y `canStartSocialService` exige las dos puertas. La Residencia (208)
  y el Taller (130) no cambian. RED observado: 3 tests fallan antes del cambio (182 con 4,
  260 con 0, y 208 con 0 esperando false en Servicio Social); GREEN tras el cambio.
  El copy de `/tramites` nombra las dos puertas y el motivo de bloqueo cambia según cuál
  falte.
- **2026-10-13 — T9.11 cerrada** (`3df4bca`). `/horario` devuelve `pending`: los grupos
  inscritos cuyos bloques no existen. La grilla ya no se muestra vacía cuando el alumno sí
  tiene clases; la lista nombrada lo dice. `getCurrentEnrollment` ya acota `groups` a las
  inscripciones del propio alumno, así que una fila de catálogo (`student_control_number`
  NULL) nunca llega al bucle: hay un test que lo afirma, porque sin él se pintarían 468
  materias fantasma.
- **2026-10-13 — T9.12 cerrada** (`756246a`). Ruta `/temario` con cobertura explícita
  leída de las filas, nunca codificada: 7 de 68, 32 unidades, 223 subtemas, contra lo que
  la D1 local reporta. La lista se parte en dos grupos —con temario y sin temario— y la
  fila del segundo dice "El portal no publica el temario de esta materia", que es un hecho
  distinto de un temario vacío. Las unidades viven en un `<details>` colapsado: abiertas
  serían los mismos ~2 000 nodos que T9.14 quitó de `/reinscripcion`.
- **2026-10-13 — verificación.** `just qa-fast` en verde sobre las cuatro tareas (344
  tests, svelte-check 0, Biome limpio). e2e: `axe/reinscripcion` 10/10 con
  `--repeat-each=3`, `axe/tramites` 4/4, `axe/horario` 4/4, `axe/temario` 7/7 (spec nuevo,
  con el escaneo a11y y las aserciones de cobertura).
- **2026-10-13 — Flake observado, no resuelto.** En la corrida completa de `just
  test-e2e`, `axe/reinscripcion` falló una vez con *"Execution context was destroyed,
  most likely because of a navigation"* en el proyecto `chromium-data-theme-dark`. No
  reprodujo en 10 corridas seguidas de ese spec y no hay navegación en el código que
  T9.14 tocó. Queda registrado como flake no explicado, no como verde.
