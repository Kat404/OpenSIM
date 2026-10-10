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
elijas."* La nota ya no es unaplaceholder: es la explicación correcta.

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

**La ambigüedad que hay que resolver antes de codear**, y que es del operador:
`evaluateCreditThresholds` usa 182 y 208 porque el complementario no suma a los
reticulares. Entonces, ¿el complementario es una **puerta adicional** para el Servicio
Social — además de los 182 reticulares — o **reemplaza** ese umbral? Hoy la tabla
existe pero nada la lee: la decisión es si `unlocked` significa `count ≥ 5` o
`reticulares ≥ 182 ∧ complementarios ≥ 5`.

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

**Lo que hay que decidir, y es del operador**, porque cambia la forma:

| | |
| --- | --- |
| **A** | Una vista de temario por materia, con cobertura explícita: 7 de 68 tienen temario, las otras 61 no |
| **B** | Sólo un buscador, y el temario aparece cuando existe |

La diferencia es de producto, no de código. La opción A es honesta pero invita a que el
alumno piense que las otras 61 no tienen temario — que es exactamente lo que ocurre, pero
la causa es el portal, no la institución.

**Verificación.** La vista nombra la cobertura real en pantalla. Un temario que no existe se
distingue de uno vacío.

---

## Fuera de alcance

- Cualquier dato real de alumno. Todo lo que se muestra es inventado salvo las materias.
- Reimplementar la detección de conflictos. H11 dice que no hay contra qué.
- Cambiar el seed o el esquema más allá de lo que T9.12 necesite para leer.

---

## La decisión que bloquea el plan

**T9.13**: ¿los 5 complementarios son una puerta **adicional** a los 182 reticulares, o
**reemplazan** ese umbral? Y **T9.12**: ¿vista con cobertura explícita o sólo buscador?

T9.14 y el resto de T9.11 no dependen de ninguna de las dos.
