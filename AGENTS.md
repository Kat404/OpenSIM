# AGENTS.md - Bitácora de Ejecución

## Contexto

Estás en un repositorio todo-en-uno llamado **OpenSIM**, el cual trata de ser una opción FOSS al SIM original del Instituto Tecnológico de Morelia.

## Patrones y Guía de Ejecución

### Búsqueda e Indexado de Código

- Siempre que requieras y quieras buscar cualquier fragmento de código haz de _Codegraph_ tú método principal y favorito. Codegraph permite indexar y buscar de manera semántica y natural porciones de código grande.
- Para búsqueda menos extensa y con un alcance más específico haz uso de _ripgrep_ (mediante 'rg') como una mejora exponencial de rendimiento de _grep_.
- Como último recurso haz uso de _grep_.

### Datos & Privacidad

- Siempre que vayas a tratar con datos personales pregunta al usuario mantenedor qué se deberían hacer con dichos datos, debido a que sería un riesgo grave a la privacidad subirlos en remoto.
- Cumple el requisito anterior aún si los datos no parecen ser completamente personales o que involucren a primeras o terceras personas.

### Actualización & Seguimiento

- Siempre que hagas cualquier cambio de código (no `docs/`) usa los comandos de `qa`, `e2e` y tests en general planteados en `justfile`.
- Siempre que cambies partes del código, avances con tareas, planeaciones y demás actualiza `odd/` si es que hay un plan ODD para lo que ya ejecutaste.
- Guarda y/o actualiza en memoria Engram lo anterior. Este paso es _obligatorio_ se tenga o una planeación ODD.
- Para cualquier cambio grande, significante o que pueda llegar a introducir inestabilidad, comportamientos desconocidos e incertidumbre (aún habiendo pasado todos los pasos anteriores) lanza un subagente auditando de manera realista y específica los cambios realizados.

### Base de Datos (Demo)

- La BD que se tiene en D1 (SQLite proveído por Cloudflare) es únicamente de pruebas/demo para poder proveer una previsualización de OpenSIM sin que el usuario tenga que instalarlo en su sistema.
- La BD no está diseñada para tener un gran crecimiento y/o adopción, es solo de pruebas para siempre verificar la integridad, usabilidad y funcionamiento de OpenSIM en un entorno de producción real.

## Disclaimer

- Aunque OpenSIM trate de ser una mejor versión del SIM usado por el Instituto Tecnológico de Morelia también tiene (a futuro) como propósito poder proveer una capa de construcción liviana e inicial para cualquiera que quiera hacer un sistema completo de administración para cualquier institución.
- El código de OpenSIM está bajo la (des)licencia de [The Unlicense](https://unlicense.org) por lo que cualquier puede visualizar, auditar, verificar, analizar, copiar, usar, modificar y distribuir partes totales y/o parciales del código de OpenSIM.
