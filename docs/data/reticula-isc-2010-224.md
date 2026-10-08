# Retícula ISIC-2010-224 (PLAN 2017) — Instituto Tecnológico de Morelia

> **Extracción local, no de Deep Research.** Su fetcher baja el PDF pero no lo parsea.
> Aquí: `curl` → `pdftotext -layout` → `pdftotext -bbox-layout` (coordenadas reales por palabra).

## Procedencia

| Campo | Valor |
| --- | --- |
| URL | `https://dsc.itmorelia.edu.mx/web/documentos/reticula_isc.pdf` |
| HTTP | `200` |
| Content-Type | `application/pdf` |
| Bytes | 322,974 |
| Páginas | 1 (tabla de 9 columnas) |
| SHA-256 | `5a3140cdca66dc190aed7185ac8db016e23b5a335e248408899d92206a11a60a` |
| Retrieved | 2026-10-07 |
| Método | `pdftotext -bbox-layout` + asignación de celda por coordenada X |
| Texto crudo | `reticula_isc.txt` (77 líneas) · coords: `bbox.xhtml` |

**Por qué `-bbox`:** el flujo de texto del PDF desalinea los códigos respecto a su columna
porque los nombres ocupan varias líneas (`pdftotext -layout` produce 37 coincidencias
erróneas si se parsea por posición en la línea). Con coordenadas reales por palabra, cada
clave y cada crédito se asignan a la columna correcta y se emparejan por coordenada Y.

## Plan reconstruido

| Sem | Clave | Alias | Nombre | HT | HP | Cr | Suma parcial vs. impreso |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `ACF-0901` | — | Cálculo Diferencial | 3 | 2 | 5 | A1L1 coincide |
| 1 | `AED-1285` | `SCD-1008` | Fundamentos de Programación | 2 | 3 | 5 | A1L2 coincide; * ver nota al pie |
| 1 | `ACA-0907` | — | Taller de Ética | 0 | 4 | 4 | A1L3 coincide |
| 1 | `AEF-104` | — | Matemáticas Discretas | 3 | 2 | 5 | A1L4 coincide |
| 1 | `SCH-1024` | — | Taller de Administración | 1 | 3 | 4 | A1L5 coincide |
| 1 | `ACC-0906` | — | Fundamentos de Investigación | 2 | 2 | 4 | A1L6 coincide |
| 2 | `ACF-0902` | — | Cálculo Integral | 3 | 2 | 5 | A2L1 coincide |
| 2 | `AED-1286` | `SCD-1020` | Programación Orientada a Objetos | 2 | 3 | 5 | el PDF imprime `/A2LA` (L2 con letra A); ** ver nota al pie |
| 2 | `AEC-1008` | — | Contabilidad Financiera | 2 | 2 | 4 | A2L3 coincide |
| 2 | `AEC-1058` | — | Química | 2 | 2 | 4 | A2L4 coincide |
| 2 | `ACF-0903` | — | Álgebra Lineal | 3 | 2 | 5 | A2L5 coincide |
| 2 | `AEF-1052` | — | Probabilidad y Estadística | 3 | 2 | 5 | A2L6 coincide |
| 3 | `ACF-0904` | — | Cálculo Vectorial | 3 | 2 | 5 | A3L1 coincide |
| 3 | `AED-1026` | — | Estructura de Datos | 2 | 3 | 5 | A3L2 coincide |
| 3 | `SCC-1005` | — | Cultura Empresarial | 2 | 2 | 4 | A3L3 coincide |
| 3 | `ACD-0908` | — | Desarrollo Sustentable | 2 | 3 | 5 | **el PDF dice `/A5L1` pero la materia está en la columna del semestre 3** |
| 3 | `SCC-1013` | — | Investigación de Operaciones | 2 | 2 | 4 | A3L4 coincide |
| 3 | `SCF-1006` | — | Física General | 3 | 2 | 5 | A3L3 **duplica el índice L3** de SCC-1005 |
| 4 | `ACF-0905` | — | Ecuaciones Diferenciales | 3 | 2 | 5 | A4L1 coincide |
| 4 | `SCC-1017` | — | Métodos Numéricos | 2 | 2 | 4 | A4L2 coincide |
| 4 | `SCD-1027` | — | Tópicos Avanzados de Programación | 2 | 3 | 5 | A4L3 coincide |
| 4 | `AEF-1031` | — | Fundamentos de Base de Datos | 3 | 2 | 5 | A4L4 coincide |
| 4 | `SCD-1022` | — | Simulación | 2 | 3 | 5 | **el PDF dice `/A5L4` pero la materia está en la columna del semestre 4** |
| 4 | `SCD-1018` | — | Principios Eléctricos y Aplicaciones Digitales | 2 | 3 | 5 | A4L6 coincide |
| 5 | `SCC-1010` | — | Graficación | 2 | 2 | 4 | **el PDF dice `/A6L3` pero la materia está en la columna del semestre 5** |
| 5 | `AEC-1034` | — | Fundamentos de Telecomunicaciones | 2 | 2 | 4 | A5L2 coincide |
| 5 | `AEC-1061` | — | Sistemas Operativos | 2 | 2 | 4 | **el PDF dice `/A3L5` pero la materia está en la columna del semestre 5** |
| 5 | `SCA-1025` | — | Taller de Base de Datos | 0 | 4 | 4 | A5L3 coincide |
| 5 | `SCC-1007` | — | Fundamentos de Ingeniería de Software | 2 | 2 | 4 | A5L5 coincide |
| 5 | `SCC-1023` | — | Sistemas Programables | 2 | 2 | 4 | **el PDF dice `/A4L5` pero la materia está en la columna del semestre 5** |
| 6 | `SCD-1015` | — | Lenguajes y Autómatas I | 2 | 3 | 5 | A6L1 coincide |
| 6 | `SCD-1021` | — | Redes de Computadoras | 2 | 3 | 5 | A6L2 coincide |
| 6 | `SCA-1026` | — | Taller de Sistemas Operativos | 0 | 4 | 4 | **el PDF dice `/A8L6` pero la materia está en la columna del semestre 6** |
| 6 | `SCB-1001` | — | Administración de Base de Datos | 1 | 4 | 5 | A6L3 coincide |
| 6 | `SCD-1011` | — | Ingeniería de Software | 2 | 3 | 5 | A6L5 coincide |
| 6 | `AEB-1055` | — | Programación Web | 1 | 4 | 5 | **el PDF dice `/A8L3` pero la materia está en la columna del semestre 6** |
| 7 | `SCD-1016` | — | Lenguajes y Autómatas II | 2 | 3 | 5 | A7L1 coincide |
| 7 | `SCD-1004` | — | Conmutación y Enrutamiento en Redes de Datos | 2 | 3 | 5 | **el PDF dice `/A6L2` pero la materia está en la columna del semestre 7** |
| 7 | `ACA-0909` | — | Taller de Investigación I | 0 | 4 | 4 | sin sufijo `/AxLy` en el PDF |
| 7 | `SCG-1009` | — | Gestión de Proyectos de Software | 3 | 3 | 6 | A7L5 coincide |
| 7 | `SCD-1003` | — | Arquitectura de Computadoras | 2 | 3 | 5 | **el PDF dice `/A5L6` pero la materia está en la columna del semestre 7** |
| 8 | `SCC-1019` | — | Programación Lógica y Funcional | 2 | 2 | 4 | A8L1 coincide |
| 8 | `SCA-1002` | — | Administración de Redes | 0 | 4 | 4 | A8L2 coincide |
| 8 | `ACA-0910` | — | Taller de Investigación II | 0 | 4 | 4 | sin sufijo `/AxLy` en el PDF |
| 8 | `SCC-1014` | — | Lenguajes de Interfaz | 2 | 2 | 4 | **el PDF dice `/A6L6` pero la materia está en la columna del semestre 8** |
| 9 | `SCC-1012` | — | Inteligencia Artificial | 2 | 2 | 4 | A9L1 coincide |

## Comprobación de créditos

| Semestre | Suma reconstruida | Total impreso en el PDF | Diferencia | Nota |
| --- | --- | --- | --- | --- |
| 1 | 27 | 27 | +0 | coincide exacto |
| 2 | 28 | 28 | +0 | coincide exacto |
| 3 | 28 | 28 | +0 | coincide exacto |
| 4 | 29 | 29 | +0 | coincide exacto |
| 5 | 24 | 24 | +0 | coincide exacto |
| 6 | 29 | 29 | +0 | coincide exacto |
| 7 | 25 | 30 | +5 | falta el bloque de especialidad: 25 genéricas + 5 de especialidad = 30 |
| 8 | 16 | 26 | +10 | faltan 10: 16 genéricas + 5 de especialidad = 21 contra 26 impresos |
| 9 | 4 | 24 | +20 | el resto son especialidad / residencia / servicio social |

**Total de la estructura genérica reconstruida: 210 créditos.**
El propio PDF declara `Estructura Genérica 210`. **Coincide exacto** → la asignación de
columnas es correcta.

Los totales por semestre impresos suman 245; el documento declara:

| Componente | Créditos |
| --- | --- |
| Estructura Genérica | 210 |
| Especialidad | 25 |
| Residencia Profesional | 10 |
| Servicio Social | 10 |
| Actividades Complementarias | 5 |
| **Total** | **260** |

## Notación `/AxLy`

Cada clave trae un sufijo tipo `/A3L2`. **La hipótesis "A = semestre" es falsa.**
De las 46 materias, 44 llevan sufijo (`ACA-0909` y `ACA-0910` no lo llevan): 34 coinciden
con la columna, **10 no**, y la aritmética de créditos demuestra que **la columna manda**.
La lista exacta de discrepancias está marcada en la tabla principal. Dos explicaciones
posibles, ninguna confirmada:

1. El PDF tiene errores de captura.
2. El sufijo refleja el **plan nacional previo** a la actualización local de Morelia
   (las notas al pie `*SCD-1008 se actualiza a AED-1285` y `**SCD-1020 se actualiza a
   AED-1286` documentan una sustitución de claves que sí ocurrió).

Además `SCC-1005/A3L3` y `SCF-1006/A3L3` comparten el mismo índice dentro del semestre.

**No uses el sufijo `/AxLy` como dato. Usa la columna.**

## Lo que el PDF NO contiene

- **Los 5 módulos de especialidad (25 créditos).** Hay 6 celdas marcadas
  `ESPECIALIDAD / 5 cred` en los semestres 7, 8 y 9, pero sus **nombres y claves no están en
  la capa de texto**. La única parcialmente legible dice `(Programación Web. Av)`.
  Los cinco módulos vigentes por especialidad hay que sacarlos del **catálogo de
  especialidades**, no de esta retícula.
- **Prerrequisitos / seriación.** El PDF no los imprime. La seriación real hay que sacarla del
  catálogo de asignaturas o de la plataforma de reinscripción.
- **Marker de laboratorio.** No existe. Ninguna marca, sigla o nota distingue una materia con
  laboratorio dedicado de una con horas de práctica en aula. Ver la sección siguiente.

## Laboratorios: lo que sí y lo que no se puede concluir

Las cuatro materias que el usuario identifica con laboratorio dedicado son, en esta retícula:

| Materia | Clave | Sem | HT-HP-Cr |
| --- | --- | --- | --- |
| Química | `AEC-1058` | 2 | 2-2-4 |
| Física General | `SCF-1006` | 3 | 3-2-5 |
| Principios Eléctricos y Aplicaciones Digitales | `SCD-1018` | 4 | 2-3-5 |
| Arquitectura de Computadoras | `SCD-1003` | 7 | 2-3-5 |
**El reparto HT/HP no las distingue.** En las 46 materias el patrón se reparte así:
`2-2-4` ×14, `2-3-5` ×13, `3-2-5` ×9, `0-4-4` ×6, `1-4-5` ×2, `1-3-4` ×1, `3-3-6` ×1. Las
cuatro materias con laboratorio caen en los tres patrones más comunes (`2-2-4`,
`3-2-5`, `2-3-5`), que comparten con otras 34 materias: **el patrón no prediga nada**.
Conclusión: la retícula **no permite** inferir el laboratorio. Sólo la
puede dar la **oferta horaria por grupo** (aula registrada como "Laboratorio de …") o el
catálogo de asignaturas.

## Verificación

```bash
curl -sSL -o reticula_isc.pdf "https://dsc.itmorelia.edu.mx/web/documentos/reticula_isc.pdf"
sha256sum reticula_isc.pdf    # 5a3140cdca66dc190aed7185ac8db016e23b5a335e248408899d92206a11a60a
pdftotext -layout reticula_isc.pdf reticula_isc.txt
pdftotext -bbox-layout reticula_isc.pdf bbox.xhtml
```

## Texto crudo del PDF (sin interpretar)

```
PLAN 2017

                                                             Ingeniería en Sistemas Computacionales
                                                                      ISIC-2010-224 (2017)
         1                     2                      3                     4                       5                     6                    7                     8                      9

                                                                       Ecuaciones                                    Lenguajes y           Lenguajes        Programación Lógica
Cálculo Diferencial     Cálculo Integral       Cálculo Vectorial                               Graficación                                                                        Inteligencia Artificial
                                                                      Diferenciales                                  automatas I          Automatas II          y Funcional
 ACF-0901/A1L1          ACF-0902/A2L1          ACF-0904/A3L1                                 SCC-1010/A6L3                                                                           SCC-1012/A9L1
                                                                     ACF-0905/A4L1                                 SCD-1015/A6L1         SCD-1016/A7L1        SCC-1019/A8L1

     3-2-5                 3-2-5                  3-2-5                 3-2-5                   2-2-4                 2-3-5                2-3-5                 2-2-4                  2-2-4

                                                                                                                                         Conmutación y
 Fundamentos de          Programacion           Estructura de                               Fundamentos de           Redes de                                Administración de
                                                                   Métodos Numéricos                                                    Enrutamiento en
  Programación        Orientada a Objetos           Datos                                   Telecomunicaciones   Computadoras SCD-                                Redes
                                                                    SCC-1017/A4L2                                                        Redes de Datos
 AED-1285*/A1L2        AED-1286**/A2LA         AED-1026/A3L2                                 AEC-1034/A5L2          1021/A6L2                                 SCA-1002/A8L2
                                                                                                                                         SCD-1004/A6L2

     2-3-5                 2-3-5                  2-3-5                 2-2-4                   2-2-4                 2-3-5                 2-3-5                0-4-4                 Residencia
                                                                                                                                                                                       Profesional

                         Contabilidad             Cultura          Tópicos Avanzados                              Taller de Sistemas        Taller de            Taller de
   Taller de Ética                                                                         Sistemas Operativos
                          Financiera           Empresarial SCC-     de Programación                                   Operativos         Investigación I      Investigación II
  ACA-0907/A1L3                                                                               AEC-1061/A3L5
                        AEC-1008/A2L3            1005/A3L3           SCD-1027/A4L3                                 SCA-1026/A8L6           ACA-0909              ACA-0910

     0-4-4                 2-2-4                  2-2-4                 2-3-5                   2-2-4                 0-4-4                 0-4-4                0-4-4                     10
                                                                                                                                           Gestión de
  Matemáticas                                    Desarrollo         Fundamentos de          Taller de Base de     Administración de
                           Química                                                                                                        Proyectos de
    Discretas                                   Sustentable          Base de Datos                Datos             Base de Datos                               ESPECIALIDAD          ESPECIALIDAD
                        AEC-1058/A2L4                                                                                                       Software
  AEF-104/A1L4                                 ACD-0908/A5L1         AEF-1031/A4L4           SCA-1025/A5L3         SCB-1001/A6L3
                                                                                                                                         SCG-1009/A7L5

     3-2-5                 2-2-4                  2-3-5                 3-2-5                   0-4-4                 1-4-5                 3-3-6               5 cred                 5 cred

                                                                                            Fundamentos de
     Taller de                                 Investigación de                                                     Ingeniería de         ESPECIALIDAD
                      Algebra Lineal ACF-                              Simulación             Ingeniería de
Administración SCH-                              Operaciones                                                          Software         (Programación Web.       ESPECIALIDAD          ESPECIALIDAD
                          0903/A2L5                                  SCD-1022/A5L4              Software
   1024/A1L5                                    SCC-1013/A3L4                                                      SCD-1011/A6L5               Av)
                                                                                             SCC-1007/A5L5

     1-3-4                 3-2-5                  2-2-4                 2-3-5                   2-2-4                 2-3-5                5 cred               5 cred                 5 cred
                                                                   Principios Eléctricos
 Fundamentos de          Probabilidad y                                                          Sistemas                                Arquitectura de       Lenguajes de
                                                Física General        y Aplicaciones                             Programación Web
   Investigación          Estadística                                                      Programables SCC-                           Computadoras SCD-         Interfaz
                                               SCF-1006/A3L3             Digitales                                 AEB-1055/A8L3
  ACC-0906/A1L6         AEF-1052/A2L6                                                           1023/A4L5                                  1003/A5L6          SCC-1014/A6L6
                                                                     SCD-1018/A4L6

     2-2-4                 3-2-5                  3-2-5                 2-3-5                   2-2-4                 1-4-5                 2-3-5                2-2-4
                                            Actividades Complementarias +5                                                                     Servicio Social +10
       27                    28                      28                    29                     24                    29                    30                   26                      24

                                                                                                                                       Estructura Genérica                                       210
      *SCD-1008 se actualiza a AED-1285                                                                                                Especialidad                                               25
     **SCD-1020 se actualiza a AED-1286                                                                                                Residencia Profesional                                     10
                                                                                                                                       Servicio Social                                            10
                                                                                                                                       Actividades Complementarias                                 5
                                                                                                                                       Total de Créditos                                         260
```
