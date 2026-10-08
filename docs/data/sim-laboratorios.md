# Laboratorios en ISIC-2010-224 — respuesta con evidencia del SIM

> **Pregunta que originó este documento:** ¿es posible visualizar las materias que dependen
> de ser llevadas con laboratorio?
> **Respuesta: sí.** El SIM marca cada grupo con laboratorio dedicado con un icono de matraz
> y publica el catálogo completo de grupos en `/reinscripcion/grupos`.

## Dónde está el dato

| Campo | Valor |
| --- | --- |
| Ruta | `https://sim.morelia.tecnm.mx/reinscripcion/grupos` |
| Marcador | icono Font Awesome `fa-flask` (matraz) en la fila del grupo |
| Nota textual del portal | "Notas: Los grupos marcados con [matraz] indican que tienen laboratorio." |
| Filtros | `show` (10…1000) y `numero_periodo` (1…12), ambos Livewire |
| Retrieved | 2026-10-07 |
| Grupos extraídos | 468 filas únicas (560 antes de deduplicar) |
| Muestra completa | `sim-grupos-oferta.json` |

## Las 6 materias con laboratorio dedicado

Cada una tiene **un grupo de teoría con créditos + un grupo de laboratorio separado con 0
créditos**, en aula y horario distintos. Ese par es exactamente la definición del proyecto:
teoría y ejercicios en salón normal, práctica en laboratorio dedicado de la institución.

| # | Teoría | Cr | Grupos lab | Código lab | Nombre del grupo lab | Periodo | Grupos con matraz |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `AEC-1058` Química | 4 | 30 | `B2L4` | LABORATORIO DE QUIMICA | 2 | 30/30 |
| 2 | `SCF-1006` Física General | 5 | 56 | `B3LA` | LABORATORIO DE FISICA GENERAL | 3 | 56/56 |
| 3 | `SCD-1018` Principios Eléctricos y Aplicaciones Digitales | 5 | 18 | `B4LA` | LAB PRINCIPIOS ELECTRICOS | 4 | 18/18 |
| 4 | `SCD-1003` Arquitectura de Computadoras | 5 | 10 | `B5LB` | LABORATORIO DE ARQUITECTURA DE COMPUTADORAS | 5 | 10/10 |
| 5 | `SCC-1014` Lenguajes de Interfaz | 4 | 30 | `B6LE` | LAB LENGUAJES DE INTERFAZ | 6 | 30/30 |
| 6 | `SCC-1023` Sistemas Programables | 4 | 10 | `B5LA` | LABORATORIO DE SISTEMAS PROGRAMABLES | 7 | 10/10 |

**Las 6 tienen el 100 % de sus grupos con matraz.** No existe el caso "materia con algunos
grupos con laboratorio y otros sin él": o todos o ninguno.

## Validación de la hipótesis del usuario

El usuario recordaba de memoria 4 materias: **Química, Física, Principios Eléctricos y
Arquitectura de Computadora**. **Las 4 quedan confirmadas** por el SIM, con su clave exacta.
El SIM agrega **2 que no estaban en la lista**: Lenguajes de Interfaz y Sistemas
Programables.

## Cómo se ve en la práctica (ejemplo real)

De la carga académica del periodo AGOSTO-DICIEMBRE/2026 del estudiante de referencia:

```
SCD-1003 ARQUITECTURA DE COMPUTADORAS   grupo C   · 5 cr · K5 / K8   (aula normal)
B5LB     LABORATORIO DE ARQUITECTURA DE COMPUTADORAS  grupo CA · 0 cr · Y6
```

Mismo docente (DOC-001), distinto salón, distinta clave, 0 créditos. Ese par es
la huella digital del laboratorio en cualquier portal del TecNM.

## Por qué los otros métodos fallaban

| Método | Resultado |
| --- | --- |
| Retícula en PDF | No tiene ningún marcador de laboratorio, sólo el reparto HT/HP |
| Reparto HT/HP | Las 6 caen en `2-2-4`, `2-3-5` y `3-2-5`, patrones que comparte con 34 materias más. **No predice nada** |
| Nombre de la materia | `Taller de …` no implica laboratorio: `SCA-1025 Taller de Base de Datos` va en `LC1` sin grupo lab |
| Aula del horario | Sí funciona, pero sólo para las materias del periodo en curso; no da el catálogo completo |

## Recomendación de modelado

El atributo pertenece a la **oferta del grupo**, no a la materia:

- `course_groups.hasLab` es el dato nativo.
- `subjects.hasLab` se deriva: `true` si algún grupo de esa materia tiene `hasLab`.
- Vale la pena guardar también `labGroupCode` (`B5LB`) y `labClassroom` (`Y6`), que es la
  evidencia dura y permite mostrar "teoría en K5, laboratorio en Y6".

Los grupos de laboratorio siguen un patrón de código: prefijo `B` + semestre + `L` + letra
(`B2L4`, `B3LA`, `B5LB`, `B6LE`). El prefijo es consistente en los 154 grupos de laboratorio
del periodo corriente y sirve como atajo, pero **el campo autoritativo es el icono**, no el
prefijo.

## Verificación

```bash
curl -sS -b cookies.txt https://sim.morelia.tecnm.mx/reinscripcion/grupos \
  | grep -c 'fa-flask'
```

Con una sesión de alumno activa, `fa-flask` aparece **154 veces** en el catálogo del periodo.