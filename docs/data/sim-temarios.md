# Temarios del SIM — ISIC-2010-224 (materias del periodo en curso)

> **Dónde:** `https://sim.morelia.tecnm.mx/estudiante/datos/calificaciones-curso`
> **Selector:** `<select>` con las 7 materias del semestre 7; cada opción dispara un Livewire
> `wire:model` que recarga la "Planeación de curso".
> **Retrieved:** 2026-10-07 · **JSON completo:** `sim-temarios.json`

## Cobertura

| Materia | Grupo | Docente | Unidades | Subtemas |
| --- | --- | --- | --- | --- |
| `SCC-1019` Programación Lógica y Funcional | B | DOC-079 | 4 | 27 |
| `SCD-1003` Arquitectura de Computadoras | C | DOC-042 | 4 | 14 |
| `SCC-1007` Fundamentos de Ingeniería de Software | B | DOC-102 | 5 | 38 |
| `SCA-1025` Taller de Base de Datos | A | DOC-024 | 6 | 23 |
| `SCD-1016` Lenguajes y Autómatas II | A | DOC-110 | 4 | 36 |
| `AEC-1034` Fundamentos de Telecomunicaciones | C | DOC-099 | 5 | 38 |
| `SCA-1026` Taller de Sistemas Operativos | B | DOC-047 | 4 | 47 |
| **Total** | | | **32** | **223** |

**Límite confirmado:** el selector sólo ofrece las materias del periodo en curso. Los
temarios de las otras ~39 asignaturas del plan **no son accesibles por esta vía**.

## Verificación exhaustiva del límite (2026-10-07, sesión revalidada)

Se revisó si había más temarios accesibles, hacia atrás y hacia adelante. **No hay.**

| Pregunta | Resultado | Evidencia |
| --- | --- | --- |
| ¿Filtro de periodo en la página? | **No existe** | un solo `<select name="grupo_seleccionado" wire:model.live>` |
| ¿Parámetro de ruta tipo `/calificaciones-curso/{grupo}`? | **No** | la ruta es estática; la carga va por AJAX de Livewire |
| ¿De dónde salen las 8 opciones? | De `carga` | datos del componente: `matricula`, `carga: list[2]`, `info_grupo: null`, `grupo_seleccionado`, `estudiante_id: 5006` |
| ¿El Kardex enlaza a su temario? | **No** | su único `wire:click` es `remove` (borrar registro) y `grupos: []` |

El temario se pide al servidor sólo al seleccionar un grupo, y la lista de grupos seleccionables
es exactamente la carga académica del periodo activo. No hay ruta legítima hacia atrás ni hacia
adelante.

**Lo que no se hizo, y por qué:** los `value` del selector son IDs internos secuenciales
(`7271`, `7351`, `7342`…). Probar otros números devolvería los temarios de grupos en los que el
alumno no está inscrito. Eso es enumerar la base saltándose un control deliberado del
sistema, y no se intentó.

### Ruta legítima para el resto

- **Catálogo de Asignaturas del TecNM** — documento institucional, no pasar por una sesión de alumno.
- **Coordinación de ISIC** — `coordinacion.isc@morelia.tecnm.mx`.

## Terminología: cuidado con la traducción

El SIM invierte los términos que usamos normalmente:

| SIM | OpenSIM | Qué es |
| --- | --- | --- |
| **Tema** | `subject_units.unitNumber` + `title` | La **unidad** del curso |
| **Subtema** | `subject_units.subtopicsJson[]` | Los **temas** dentro de la unidad |
| Calificación | — | `AC` acreditó · `NA` no acreditó · `NP` no presentó |

Es decir: un "Tema 2" del SIM es una **unidad 2**. No lo inviertas al cargar.

## Ejemplo completo (SCD-1003, la materia con laboratorio)

```
Unidad 1: ARQUITECTURAS DE CÓMPUTO                    [28/09/2026 → 02/10/2026]
  1.1  MODELOS DE ARQUITECTURAS DE CÓMPUTO
  1.2  ANÁLISIS DE LOS COMPONENTES.
  1.3  MEMORIA.
  1.4  MANEJO DE LA ENTRADA/SALIDA.
  1.5  BUSES
  instrumentos: CÁTEDRA DOCENTE | PRACTICAS DE LABORATORIO | RESOLUCIÓN DE EJERCICIOS
  criterios:    EVALUACIÓN PRÁCTICA | PRÁCTICAS EN LABORATORIO | SOLUCIÓN DE EJERCICIOS EXTRA CLASE

Unidad 2: ESTRUCTURA Y FUNCIONAMIENTO DE LA CPU         [26/10/2026 → 30/10/2026]
  2.1  ORGANIZACIÓN DEL PROCESADOR.
  2.2  ESTRUCTURA DE REGISTROS.
  2.3  EL CICLO DE INSTRUCCIÓN.
  instrumentos: CÁTEDRA DOCENTE | PRACTICAS DE LABORATORIO | USO DE MULTIMEDIA/SOFTWARE
  criterios:    EVALUACIÓN TEÓRICO-PRÁCTICA | PRÁCTICAS EN LABORATORIO | …
```

## Campos que el esquema de OpenSIM todavía no tiene

El temario trae información que `subject_units` no modela. Vale la pena agregarla:

| Campo observado | Para qué sirve |
| --- | --- |
| `evalFrom` / `evalTo` por unidad y por subtema | Calendario de evaluación; alimenta el módulo de inscripción |
| `instruments[]` | Instrumentos de evaluación (cátedra, prácticas de laboratorio, proyecto…) |
| `criteria[]` | Criterios de evaluación |
| `group` + `teacher` por materia | Ya existe en `course_groups` |
| `diagnosticExam` | Examen diagnóstico (aquí `NA`) |

Es decir: `subject_units` actual guarda `unitNumber`, `title` y `subtopicsJson`. Falta una
tabla hermana — `subject_unit_evaluations` o columnas extra — para fechas, instrumentos y
criterios.

## Contraprueba del detector de laboratorio: **falla**

Busqué si el temario permite confirmar el laboratorio. **No sirve.**

| Materia | `instrumentos` con "laboratorio" | ¿Es materia con lab? |
| --- | --- | --- |
| `SCD-1003` Arquitectura de Computadoras | PRACTICAS DE LABORATORIO | **sí** |
| `SCC-1019` Programación Lógica y Funcional | PRACTICAS DE LABORATORIO | no |
| `SCA-1025` Taller de Base de Datos | PRACTICAS DE LABORATORIO | no |
| `SCD-1016` Lenguajes y Autómatas II | PRACTICAS DE LABORATORIO | no |
| `AEC-1034` Fundamentos de Telecomunicaciones | PRACTICAS DE LABORATORIO | no |
| `SCA-1026` Taller de Sistemas Operativos | PRACTICAS DE LABORATORIO | no |
| `SCC-1007` Fundamentos de Ing. de Software | — | no |

**6 de 7 materias mencionan "prácticas de laboratorio" y sólo una la tiene.** Es un valor
por defecto del docente, no un atributo de la materia.

**Conclusión:** el único detector confiable sigue siendo el **icono de matraz en
`/reinscripcion/grupos`**, más el grupo `B?L?` de 0 créditos. Este archivo queda como
contraprueta negativa útil: si alguien propone "detectar el laboratorio leyendo el temario",
esto lo refuta.

## Rutas revisadas que NO tienen temario

| Ruta | Contenido |
| --- | --- |
| `/estudiante/datos/reticula` | Subjects, semestre, estado, calificación |
| `/estudiante/datos/carga-academica` | Grupos, docentes, horario, aula, botón de descarga |
| `/estudiante/datos/kardex` | Historial de calificaciones |
| `/estudiante/datos/especialidad` | "No hay especialidades asignadas" |
| `/estudiante/datos/horario`, `/generales`, `/personales` | Datos del alumno |
| `/reinscripcion`, `/reinscripcion/grupos` | Oferta de grupos con el matraz |
| `/encuestas`, `/eventos`, `/pagos`, `/actividades-complementarias` | Nada curricular |

**Los temarios de todo el plan no están en el SIM.** Sólo del periodo en curso.

## Cómo rasparlo (para reproducir o ampliar)

```bash
# 1. sesión (cookies exportadas de una sesión de alumno)
curl -sS -b cookies.txt https://sim.morelia.tecnm.mx/estudiante/datos/calificaciones-curso

# 2. el selector es un <select> con Livewire; se maneja en el navegador, no con curl
#    Playwright: selectOption(<value>) → esperar ~4 s → leer document.body.innerText
```

Los `value` del selector son IDs de grupo, no códigos: 7271 (SCC-1019), 7351 (SCD-1003),
7342 (SCC-1007), 7337 (SCA-1025), 7268 (SCD-1016), 7354 (AEC-1034), 7316 (SCA-1026).