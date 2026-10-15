# Retícula ISIC-2010-224 — versión autoritativa del SIM

> Fuente: la retícula del propio sistema del portal, no el PDF institucional.
> Ésta **pisa** a `reticula-isc-2010-224.md` cuando discrepan, y hay 4 discrepancias.

| Campo | Valor |
| --- | --- |
| Ruta | `https://sim.morelia.tecnm.mx/estudiante/datos/reticula` |
| Programa | ISIC-2010-224 — INGENIERÍA EN SISTEMAS COMPUTACIONALES |
| Plan | "Plan de estudios por competencias actualizado 2016 (2017)" |
| Modalidad | ESCOLARIZADA |
| Retrieved | 2026-10-07 |

## Por qué esta tabla pisa a la del PDF

El PDF institucional (`reticula-isc-2010-224.md`) se reconstruyó por coordenadas y cuadra
perfecto en créditos, pero en **4 materias asigna mal el semestre**. El SIM, que es el
registro vivo del sistema, las corrige:

| Materia | PDF (columna) | SIM (plan) | Sufijo `/AxLy` del PDF |
| --- | --- | --- | --- |
| `SCD-1003` Arquitectura de Computadoras | 7 | **5** | `A5L6` → el PDF tenía razón el sufijo |
| `SCD-1015` Lenguajes y Autómatas I | 6 | **7** | `A6L1` → el PDF tenía razón la columna |
| `SCD-1016` Lenguajes y Autómatas II | 7 | **8** | `A7L1` → el PDF tenía razón la columna |
| `SCC-1014` Lenguajes de Interfaz | 8 | **6** | `A6L6` → el PDF tenía razón el sufijo |
| `SCC-1023` Sistemas Programables | 5 | **7** | `A4L5` → ni columna ni sufijo |

Nadie acierta siempre: el PDF se contradice a sí mismo. **El SIM manda.**

## Plan completo según el SIM

Estado: `APROVED` muestra calificación, `Ordinario`/`Repetición`/`Especial` es el tipo de
evaluación, sin calificación = no cursada.

### Semestre 1

| Código | Nombre | Estado |
| --- | --- | --- |
| `ITM-100` | Tutoría | — |
| `ITM-104` | Actividades Físicas para la Salud y la Prevención | — |
| `ACF-0901` / `ACF-2301` | Cálculo Diferencial (clave nueva / clave legacy) | 80 / — |
| `ACC-0906` | Fundamentos de Investigación | 86 |
| `AED-1285` | Fundamentos de Programación | 97 |
| `AEF-1041` | Matemáticas Discretas | 89 |
| `SCH-1024` | Taller de Administración | 83 |
| `ACH-2307` / `ACA-0907` | Taller de Ética (clave legacy / clave nueva) | — / 85 |

### Semestre 2

| Código | Nombre | Estado |
| --- | --- | --- |
| `ITM-105` | Apreciación de Artes y Diversidad Cultural | — |
| `ACF-0903` | Álgebra Lineal | 77 |
| `ACF-0902` | Cálculo Integral | 70 |
| `AEC-1008` | Contabilidad Financiera | 79 |
| `AEF-1052` | Probabilidad y Estadística | 82 |
| `AED-1286` | Programación Orientada a Objetos | 72 |
| `AEC-1058` | Química | 81 |

### Semestre 3

| Código | Nombre | Estado |
| --- | --- | --- |
| `ACF-0904` | Cálculo Vectorial | 89 |
| `SCC-1005` | Cultura Empresarial | 80 |
| `ACD-0908` | Desarrollo Sustentable | 89 |
| `AED-1026` | Estructura de Datos | 100 |
| `SCF-1006` | Física General | 70 |
| `SCC-1013` | Investigación de Operaciones | 70 |

### Semestre 4

| Código | Nombre | Estado |
| --- | --- | --- |
| `ACF-0905` | Ecuaciones Diferenciales | 90 |
| `AEF-1031` | Fundamentos de Bases de Datos | 73 |
| `SCC-1017` | Métodos Numéricos | 89 |
| `SCD-1018` | Principios Eléctricos y Aplicaciones Digitales | 80 |
| `SCD-1022` | Simulación | 91 |
| `SCD-1027` | Tópicos Avanzados de Programación | 100 |

### Semestre 5

| Código | Nombre | Estado |
| --- | --- | --- |
| `SCD-1003` | Arquitectura de Computadoras | Ordinario |
| `SCC-1007` | Fundamentos de Ingeniería de Software | Ordinario |
| `AEC-1034` | Fundamentos de Telecomunicaciones | Ordinario |
| `SCC-1010` | Graficación | 90 |
| `AEC-1061` | Sistemas Operativos | 78 |
| `SCA-1025` | Taller de Base de Datos | Ordinario |

### Semestre 6

| Código | Nombre | Estado |
| --- | --- | --- |
| `SCB-1001` | Administración de Base de Datos | — |
| `SCD-1011` | Ingeniería de Software | — |
| `SCC-1014` | Lenguajes de Interfaz | — |
| `AEB-1055` | Programación Web | 100 |
| `SCD-1021` | Redes de Computadoras | — |
| `SCA-1026` | Taller de Sistemas Operativos | Ordinario |

### Semestre 7

| Código | Nombre | Estado |
| --- | --- | --- |
| `SCD-1004` | Conmutación y Enrutamiento en Redes de Datos | — |
| `SCG-1009` | Gestión de Proyectos de Software | — |
| `SCD-1015` | Lenguajes y Autómatas I | 81 |
| `SCC-1023` | Sistemas Programables | — |
| `ACA-0909` | Taller de Investigación I | — |
| `ITM-101` | Actividades Complementarias | — |

### Semestre 8

| Código | Nombre | Estado |
| --- | --- | --- |
| `SCA-1002` | Administración de Redes | — |
| `SCD-1016` | Lenguajes y Autómatas II | Ordinario |
| `SCC-1019` | Programación Lógica y Funcional | Ordinario |
| `ACA-0910` | Taller de Investigación II | — |
| `ITM-102` | Servicio Social | — |

### Semestre 9

| Código | Nombre | Estado |
| --- | --- | --- |
| `SCC-1012` | Inteligencia Artificial | — |
| `ITM-103` | Residencia Profesional | — |

## Hallazgos que sólo aparecen en el SIM

1. **Los módulos de especialidad NO aparecen en la retícula del SIM.** El semestre 9 sólo
   lista Inteligencia Artificial y Residencia Profesional. La pestaña
   `/estudiante/datos/especialidad` responde "No hay especialidades asignadas" para el
   estudiante de referencia. Las 25 créditos de especialidad quedan fuera de la retícula
   visible, igual que en el PDF.
2. **Materias `ITM-xxx` que no estaban en el PDF:** `ITM-100` Tutoría, `ITM-101` Actividades
   Complementarias, `ITM-102` Servicio Social, `ITM-103` Residencia Profesional, `ITM-104`
   Actividades Físicas, `ITM-105` Apreciación de Artes. Son asignaturas TecNM transversales.
3. **Claves legacy confirmadas:** el sistema muestra `ACF-2301` junto a `ACF-0901` y
   `ACH-2307` junto a `ACA-0907`. El catálogo local de OpenSIM ya tenía los alias
   `ACF-2301…2308` correctos.
4. **`AEF-1041`, no `AEF-104`.** El PDF imprime `AEF-104`; el sistema registra `AEF-1041`.
   El sistema manda.
5. **`SCH-1024` se llama "Taller de Administración"**, no "Administración". El PDF lo
   renderiza en dos líneas y seem "Administración"; el nombre real incluye "Taller de".

## Lo que el SIM NO tiene

- **Temarios (unidades y temas).** Ninguna ruta del menú de estudiante las expone. Los
  falsos positivos de "UNIDAD"/"TEMAS" en el HTML venían de `OPORTUNIDAD` y `SISTEMAS`.
- **Seriación / prerrequisitos.** Tampoco está.
- **Créditos por materia.** Sólo vienen del PDF institucional.

Los temarios hay que buscarlos en otro sistema (catálogo de asignaturas del TecNM o el
programa analítico que entrega cada docente), no en el SIM.

## Nota de privacidad

Este documento contiene el **plan de estudios** (dato institucional) y, en la columna
"Estado", el avance académico de una persona concreta. No se copiaron nombre, matrícula,
CURP, correo ni teléfono. Si el documento se versiona en un repositorio público, conviene
vaciar la columna "Estado".