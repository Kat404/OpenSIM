# Padrón de Carreras — Instituto Tecnológico de Morelia

> **Extracción local, no de Deep Research.** Su fetcher descarga este PDF pero no sabe
> parsearlo (responde `Unsupported fetched file content type: application/pdf`).
> Aquí se bajó con `curl` y se leyó con `pdftotext`.

## Procedencia

| Campo | Valor |
| --- | --- |
| URL | `https://morelia.tecnm.mx/assets/escolares/TABLA%20DE%20CARRERAS.pdf` |
| HTTP | `200` |
| Content-Type | `application/pdf` |
| Bytes | 228,650 |
| Páginas | 3 |
| SHA-256 | `f893589b13161b5ed5339e81c144cb734a881495fcfedf8fff20ae61e66a17bd` |
| Retrieved | 2026-10-07 |
| Método | `curl -sSL` → `pdftotext -layout` |

Columnas del documento original: `plan_estudio · Carrera · Titulo_obtenido_Masculino ·
Titulo_obtenido_Femenino`. El PDF no usa separadores de columna en el flujo de texto, por eso
la tercera columna es el texto literal tal cual y la normalización va aparte.

## Programas de grado con clave vigente (2009+)

| Clave | Carrera (normalizada desde la fila) | Texto literal de la fila del PDF |
| --- | --- | --- |
| `COPU-2010-205` | Contador Público | Contador Público Contador Público Contadora Pública |
| `IBQA-2010-207` | Ingeniería Bioquímica | Ingeniería Bioquímica Ingeniero Bioquímico Ingeniera Bioquímica |
| `IELE-2010-209` | Ingeniería Eléctrica | Ingeniería Eléctrica Ingeniero Eléctrico Ingeniera Eléctrica |
| `IELC-2010-211` | Ingeniería Electrónica | Ingeniería Electrónica Ingeniero Electrónico Ingeniera Electrónica |
| `IGEM-2009-201` | Ingeniería en Gestión Empresarial | Ingeniería en Gestión Empresarial Ingeniero en Gestión Empresarial Ingeniera en Gestión Empresarial |
| `IMAT-2010-222` | Ingeniería en Materiales | Ingeniería en Materiales Ingeniero en Materiales Ingeniera en Materiales |
| `ISIC-2010-224` | Ingeniería en Sistemas Computacionales | Ingeniería en Sistemas Computacionales Ingeniero en Sistemas Computacionales Ingeniera en Sistemas Computacionales Ingeniería en Tecnologías de la Información y Ingeniero en Tecnologías de la Información y Ingeniera en Tecnologías de la Información y |
| `ITIC-2010-225` | Ingeniería en Tecnologías de la Información y Comunicaciones | Comunicaciones Comunicaciones Comunicaciones |
| `IIND-2010-227` | Ingeniería Industrial | Ingeniería Industrial Ingeniero Industrial Ingeniera Industrial |
| `IINF-2010-220` | Ingeniería Informática | Ingeniería Informática Ingeniero Informático Ingeniera Informática |
| `IMEC-2010-228` | Ingeniería Mecánica | Ingeniería Mecánica Ingeniero Mecánico Ingeniera Mecánica |
| `LADM-2010-234` | Licenciatura en Administración | Licenciatura en Administración Licenciado en Administración Licenciada en Administración |
| `LINF-2010-220` | Licenciatura en Informática | Licenciatura en Informática Licenciado en Informática Licenciada en Informática Maestría en Ciencias en Ciencias de la Maestra en Ciencias en Ciencias de la |

**No aparecen en el padrón** pero Morelia los ofrece según sus convocatorias 2025-2026:
Ingeniería Mecatrónica, Ingeniería Biomédica, Ingeniería en Semiconductores.
Consecuencia: este documento sirve para **resolver claves oficiales**, **no** para decidir qué
se imparte hoy.

### Fallas de alineación conocidas

- `ITIC-2010-225` — la fila del PDF sólo dice `Comunicaciones Comunicaciones Comunicaciones`;
  el nombre real se tomó de `morelia.tecnm.mx/academicos/ing-tecnologias`.
- `ISIC-2010-224` — la fila arrastra texto de la fila vecina (el nombre de ITIC).
- `IIND-2004-297` —idem, arrastra `R-69-5003`.
- `LINF-2010-220` — arrastre: le cuelga texto de maestría.
- El PDF usa celdas de distinto alto, así que las filas de los planes históricos
  (`IS-78-120`, `II-73-025`, `IISI-80-220`, `IS-73-033`…) arrastran el nombre del renglón
  siguiente. **No usar esas filas para nada.**

## Planes históricos registrados en el mismo documento

| Clave | Carrera (normalizada desde la fila) | Texto literal de la fila del PDF |
| --- | --- | --- |
| `IBQA-1990-268` | — | Ingeniería Bioquímica Ingeniero Bioquímico Ingeniera Bioquímica |
| `IBQA-1993-288` | — | Ingeniería Bioquímica Ingeniero Bioquímico Ingeniera Bioquímica |
| `IBQA-2005-288` | — | Ingeniería Bioquímica Ingeniero Bioquímico Ingeniera Bioquímica |
| `IELE-1985-257` | — | Ingeniería Eléctrica Ingeniero Electricista Ingeniera Electricista |
| `IELE-1993-290` | — | Ingeniería Eléctrica Ingeniero Eléctrico Ingeniera Eléctrica |
| `IELE-2005-290` | — | Ingeniería Eléctrica Ingeniero Eléctrico Ingeniera Eléctrica |
| `IELC-1982-248` | — | Ingeniería Electrónica Ingeniero en Electrónica Ingeniera en Electrónica |
| `IELC-1991-273` | — | Ingeniería Electrónica Ingeniero Electrónico Ingeniera Electrónica |
| `IELC-1993-292` | — | Ingeniería Electrónica Ingeniero Electrónico Ingeniera Electrónica |
| `IELC-2004-292` | — | Ingeniería Electrónica Ingeniero en Electrónica Ingeniera en Electrónica |
| `IMAT-1993-295` | — | Ingeniería en Materiales Ingeniero en Materiales Ingeniera en Materiales |
| `IMAT-2005-295` | — | Ingeniería en Materiales Ingeniero en Materiales Ingeniera en Materiales |
| `IS-78-120` | — | Ingeniería en Sistemas Computacionales Ingeniero en Sistemas Computacionales Ingeniera en Sistemas Computacionales |
| `ISIC-1990-266` | — | Ingeniería en Sistemas Computacionales Ingeniero en Sistemas Computacionales Ingeniera en Sistemas Computacionales |
| `ISIC-1993-296` | — | Ingeniería en Sistemas Computacionales Ingeniero en Sistemas Computacionales Ingeniera en Sistemas Computacionales |
| `ISIC-2004-296` | — | Ingeniería en Sistemas Computacionales Ingeniero en Sistemas Computacionales Ingeniera en Sistemas Computacionales |
| `IIND-1990-265` | — | Ingeniería Industrial Ingeniero Industrial Ingeniera Industrial |
| `IIND-1993-297` | — | Ingeniería Industrial Ingeniero Industrial Ingeniera Industrial |
| `IIND-2004-297` | — | Ingeniería Industrial Ingeniero Industrial Ingeniera Industrial R-69-5003 Ingeniería Industrial Ingeniero Industrial Ingeniera Industrial |
| `II-73-005` | — | Ingeniería Industrial Eléctrica Ingeniero Industrial Electrico Ingeniera Industrial Electrica |
| `II-80-230` | — | Ingeniería Industrial en Eléctrica Ingeniero Industrial en Eléctrica Ingeniera Industrial en Eléctrica |
| `II-73-025` | — | Ingeniería Industrial en Producción Ingeniero Industrial en Producción Ingeniera Industrial en Producción |
| `II-80-025` | — | Ingeniería Industrial en Producción Ingeniero Industrial en Producción Ingeniera Industrial en Producción |
| `IISI-80-220` | — | Ingeniería Industrial en Siderurgia Ingeniero Industrial en Siderurgia Ingeniera Industrial en Siderurgia Ingeniería Industrial en Siderurgia en |
| `IS-73-033` | — | Aceración Ingeniero Industrial en Siderurgia en Aceración Ingeniera Industrial en Siderurgia en Aceración Ingeniería Industrial en Siderurgia en Ingeniero Industrial en Siderurgia en Ingeniera Industrial en Siderurgia en |
| `IS-73-032` | — | Deformaciones Plásticas Deformaciones Plásticas Deformaciones Plásticas Ingeniería Industrial en Siderurgia en Ingeniero Industrial en Siderurgia, con Especialidad Ingeniera Industrial en Siderurgia, con |
| `IS-73-031` | — | Fundición en Fundición Especialidad en Fundición Ingeniería Industrial Mecánica en Diseño de Ingeniero Industrial Mecánico en Diseño de Ingeniera Industrial Mecánica en Diseño de |
| `II-73-015` | — | Manufactura Manufactura Manufactura Ingeniería Industrial Mecánica en Diseño de Ingeniero Industrial Mecánico en Diseño de Ingeniera Industrial Mecánica en Diseño de |
| `II-80-210` | — | Manufactura Manufactura Manufactura |
| `II-73-020` | — | Ingeniería Industrial Mecánica en Térmica Ingeniero Industrial Mecánico en Térmica Ingeniera Industrial Mecánica en Térmica |
| `II-80-211` | — | Ingeniería Industrial Mecánica en Térmica Ingeniero Industrial Mecánico Ingeniera Industrial Mecánica |
| `IMEC-1991-275` | — | Ingeniería Mecánica Ingeniero Mecánico Ingeniera Mecánica |
| `IMEC-1993-298` | — | Ingeniería Mecánica Ingeniero Mecánico Ingeniera Mecánica |
| `IMEC-2005-298` | — | Ingeniería Mecánica Ingeniero Mecánico Ingeniera Mecánica |
| `LADM-1993-300` | — | Licenciatura en Administración Licenciado en Administración Licenciada en Administración |
| `LADM-2004-300` | — | Licenciatura en Administración Licenciado en Administración Licenciada en Administración |
| `AE-73-060` | — | Licenciatura en Administración de Empresas Licenciado en Administración de Empresas Licenciada en Administración de Empresas |
| `LA-77-010` | — | Licenciatura en Administración de Empresas Licenciado en Administración de Empresas Licenciada en Administración de Empresas |
| `LAEM-1992-282` | — | Licenciatura en Administración de Empresas Licenciado en Administración de Empresas Licenciada en Administración de Empresas Licenciatura en Administración de Empresas Licenciado en Administración de Empresas Licenciada en Administración de Empresas |
| `LT-77-035` | — | Turísticas. Planeación y Promoción Turísticas en Planeación y Promoción Turísticas en Planeación y Promoción |
| `LC-77-005` | — | Licenciatura en Contaduría Licenciado en Contaduría Licenciada en Contaduría |
| `LCON-1992-284` | — | Licenciatura en Contaduría Licenciado en Contaduría Licenciada en Contaduría |
| `LCON-1993-302` | — | Licenciatura en Contaduría Licenciado en Contaduría Licenciada en Contaduría |
| `LCON-2004-302` | — | Licenciatura en Contaduría Licenciado en Contaduría Licenciada en Contaduría |
| `LINF-1990-267` | — | Licenciatura en Informática Licenciado en Informática Licenciada en Informática |
| `LINF-1993-303` | — | Licenciatura en Informática Licenciado en Informática Licenciada en Informática |
| `LINF-2004-303` | — | Licenciatura en Informática Licenciado en Informática Licenciada en Informática |

## Posgrado registrado en el mismo documento

| Clave | Carrera (normalizada desde la fila) | Texto literal de la fila del PDF |
| --- | --- | --- |
| `MCCC-2000-019` | — | Computación Maestro en Ciencias en Ciencias de la Computación Computación MCIEA-2011-10 Maestría en Ciencias en Ingeniería Eléctrica Maestro en Ciencias en Ingeniería Eléctrica Maestra en Ciencias en Ingeniería Eléctrica |
| `MCIE-2000-014` | — | Maestría en Ciencias en Ingeniería Eléctrica Maestro en Ciencias en Ingeniería Eléctrica Maestra en Ciencias en Ingeniería Eléctrica MCIEA-2005-15 Maestría en Ciencias en Ingeniería Eléctrica Maestro en Ciencias en Ingeniería Eléctrica Maestra en Ciencias en Ingeniería Eléctrica |
| `MIE-1992-001` | — | Maestría en Ciencias en Ingeniería Eléctrica Maestro en Ciencias en Ingeniería Eléctrica Maestra en Ciencias en Ingeniería Eléctrica |
| `MIE-91-001` | — | Maestría en Ciencias en Ingeniería Eléctrica Maestro en Ciencias en Ingeniería Eléctrica Maestra en Ciencias en Ingeniería Eléctrica MCIEO-2011-02 Maestría en Ciencias en Ingeniería Electrónica Maestro en Ciencias en Ingeniería Electrónica Maestra en Ciencias en Ingeniería Electrónica MCIEL-2000-017 Maestría en Ciencias en Ingeniería Electrónica Maestro en Ciencias en Ingeniería Electrónica Maestra en Ciencias en Ingeniería Electrónica MCIEL-2000-018 Maestría en Ciencias en Ingeniería Electrónica Maestro en Ciencias en Ingeniería Electrónica Maestra en Ciencias en Ingeniería Electrónica MCIEO-2005-16 Maestría en Ciencias en Ingeniería Electrónica Maestro en Ciencias en Ingeniería Electrónica Maestra en Ciencias en Ingeniería Electrónica MCIET-2005-16 Maestría en Ciencias en Ingeniería Electrónica Maestro en Ciencias en Ingeniería Electrónica Maestra en Ciencias en Ingeniería Electrónica |
| `MIEL-91-001` | — | Maestría en Ciencias en Ingeniería Electrónica Maestro en Ciencias en Ingeniería Electrónica Maestra en Ciencias en Ingeniería Electrónica |
| `MCM-1994-001` | — | Maestría en Ciencias en Materiales Maestro en Ciencias en Materiales Maestra en Ciencias en Materiales MCMAT-2000-021 Maestría en Ciencias en Materiales Maestro en Ciencias en Materiales Maestra en Ciencias en Materiales MCMET-2011-11 Maestría en Ciencias en Metalurgia Maestro en Ciencias en Metalurgia Maestra en Ciencias en Metalurgia |
| `MCM-2000-009` | — | Maestría en Ciencias en Metalurgia Maestro en Ciencias en Metalurgia Maestra en Ciencias en Metalurgia MCMET-2005-22 Maestría en Ciencias en Metalurgia Maestro en Ciencias en Metalurgia Maestra en Ciencias en Metalurgia |
| `MS-1992-001` | — | Maestría en Ciencias en Siderurgia Maestro en Ciencias en Siderurgia Maestra en Ciencias en Siderurgia MS-86 Maestría en Ciencias en Siderurgia Maestro en Ciencias en Siderurgia Maestra en Ciencias en Siderurgia |
| `MPIE-2000-015` | — | Maestría en Ingeniería Eléctrica Maestro en Ingeniería Eléctrica Maestra en Ingeniería Eléctrica MPIIN-2011-14 Maestría en Ingeniería Industrial Maestro en Ingeniería Industrial Maestra en Ingeniería Industrial MPIM-2011-41 Maestría en Ingeniería Mecánica Maestro en Ingeniería Mecánica Maestra en Ingeniería Mecánica MIM-2000-02 Maestría en Ingeniería Mecánica Maestro en Ingeniería Mecánica Maestra en Ingeniería Mecánica |
| `MPIM-2001-029` | — | Maestría en Ingeniería Mecánica Maestro en Ingeniería Mecánica Maestra en Ingeniería Mecánica MPIM-2007-04 Maestría en Ingeniería Mecánica Maestro en Ingeniería Mecánica Maestra en Ingeniería Mecánica |
| `MS-80-465` | — | Maestría en Siderurgia Maestro en Ciencias en Siderurgia Maestra en Ciencias en Siderurgia |
| `DCI-1994-001` | — | Doctorado en Ciencias en Ingeniería Eléctrica Doctor en Ciencias en Ingeniería Eléctrica Doctora en Ciencias en Ingeniería Eléctrica DIEA-2005-16 Doctorado en Ciencias en Ingeniería Eléctrica Doctor en Ciencias en Ingeniería Eléctrica Doctora en Ciencias en Ingeniería Eléctrica DIEA-2005-15 Doctorado en Ciencias en Ingeniería Eléctrica Doctor en Ciencias en Ingeniería Eléctrica Doctora en Ciencias en Ingeniería Eléctrica DIEA-2010-06 Doctorado en Ciencias en Ingeniería Eléctrica Doctor en Ciencias en Ingeniería Eléctrica Doctora en Ciencias en Ingeniería Eléctrica Especialización en Sistemas Eléctricos de ESEP-2007-02 Potencia Especialista en Sistemas Eléctricos de Potencia Especialista en Sistemas Eléctricos de Potencia |

## Verificación

```bash
curl -sSL -o padron_carreras.pdf \
  "https://morelia.tecnm.mx/assets/escolares/TABLA%20DE%20CARRERAS.pdf"
sha256sum padron_carreras.pdf   # debe coincidir con el SHA-256 de esta página
pdftotext -layout padron_carreras.pdf padron_carreras.txt
```

## Pendiente

**Modalidad por carrera** (escolarizada / a distancia): no está en este documento.
La fuente correcta es la Convocatoria de Reinscripción, que lista cada coordinación y su
correo. La de **Enero-Junio 2026** separa explícitamente *"Ingeniería en Sistemas
Computacionales, escolarizada"* de *"a distancia"*, lo que cierra el conflicto entre la
convocatoria de 2024 y la página web del campus.
