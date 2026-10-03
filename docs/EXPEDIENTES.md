# Expedientes ilustrados · Formato v2

El módulo 0.2.0 admite un único archivo `nombre.oveja.json` con texto e imágenes incluidas. El GM elige ese archivo, revisa la vista previa y pulsa Importar. No se crean macros, no se pega HTML y no hay que subir las imágenes por separado.

## Organización

Un paquete contiene `notas`. En v2 cada nota representa un **diario completo**, y su lista `paginas` establece el orden de lectura. Para el expediente del Barrio Sur, la distribución prevista es un solo diario con inspección/peritaje, autopsias y cierre. La plantilla de demostración no contiene sus imágenes ni sustituye sus fuentes.

Las páginas pueden ser:

- `texto`: bloques editables de párrafos, títulos, listas, citas e imágenes intercaladas.
- `lamina`: una imagen completa de una página ya diseñada. Se crea como página nativa de imagen y se agrega inmediatamente una página de transcripción editable. Ambas reciben el mismo permiso. El texto impreso en la imagen solo cambia sustituyendo la imagen; editar la transcripción no modifica la lámina.

Una página `texto` usa un diseño fluido con imágenes proporcionales. No se coloca texto encima de un fondo fragmentado ni se usan posiciones absolutas. Los estilos disponibles son `expediente`, `pergamino` y `simple`.

## Contrato

| Nivel | Campos |
| --- | --- |
| Paquete | `formato: "escriba-oveja"`, `version: 2`, `paquete`, `titulo`, `config.carpeta`, `imagenes`, `notas` |
| Imagen incluida | `id`, `mime` (`image/png`, `image/jpeg`, `image/webp`), `base64` (contenido completo, sin prefijo data URL) |
| Nota/diario | `id`, `titulo`, `tipo` (`lore` o `dm`), `categoria`, `config.estilo`, `paginas` |
| Página editable | `id`, `titulo`, `tipo: "texto"`, `config.visibilidad`, `bloques` |
| Página lámina | `id`, `titulo`, `tipo: "lamina"`, `config.visibilidad`, `archivo` (id de imagen), `descripcion`, `transcripcion` |

Los valores por defecto son: carpeta `Escriba Oveja`, tipo `lore`, categoría `Lore` o `Notas del DM`, estilo `expediente` y visibilidad `gm`. Las páginas siempre declaran `tipo`; las láminas requieren una transcripción no vacía. Los campos opcionales se omiten; no se envía `null`.

Bloques de una página editable:

| `tipo` | Campos adicionales |
| --- | --- |
| `titulo` | `texto` |
| `parrafo` | `texto` |
| `cita` | `texto` |
| `lista` | `elementos`: lista de textos |
| `imagen` | `archivo`, `descripcion` (texto alternativo), `pie` opcional |

Los textos son literales, no HTML o Markdown. El módulo genera la maquetación y escapa el contenido. No admite scripts, URLs externas de imágenes, CSS libre, macros, UUID, flags ni ownership proporcionados por el archivo.

Ejemplo mínimo válido sin imágenes:

```json
{
  "formato": "escriba-oveja",
  "version": 2,
  "paquete": "mi-expediente",
  "titulo": "Mi expediente",
  "config": { "carpeta": "Mi campaña" },
  "imagenes": [],
  "notas": [{
    "id": "informe",
    "titulo": "Informe de investigación",
    "tipo": "lore",
    "categoria": "Expedientes",
    "config": { "estilo": "expediente" },
    "paginas": [{
      "id": "inspeccion",
      "titulo": "I. Inspección",
      "tipo": "texto",
      "config": { "visibilidad": "gm" },
      "bloques": [{ "tipo": "parrafo", "texto": "Aquí va el contenido confirmado del informe." }]
    }]
  }]
}
```

Para imágenes, consultar [el ejemplo completo](../examples/expediente-demo.oveja.json), que incluye todos sus bytes. Al preparar el expediente, la herramienta de generación debe convertir las imágenes a base64; el usuario recibe el archivo final listo para cargar y no necesita editar ese contenido.

## Límites y validaciones

- 32 MiB como máximo para el archivo completo; los paquetes v1 conservan el límite de 2 MiB.
- Entre 1 y 100 diarios, con 1–50 páginas de entrada cada uno; una lámina produce dos páginas nativas.
- Hasta 30 imágenes, 8 MiB por imagen y 20 MiB de imágenes decodificadas en total.
- Hasta 8192 píxeles por lado y 32 megapíxeles por imagen; se comprueba su firma y su decodificación en el navegador.
- 1–100 bloques por página de texto; listas con 1–50 elementos.
- Identificadores hasta 80 caracteres: minúsculas/números/guiones/guiones bajos, empezando con letra o número. Unicidad dentro de paquete, diario o biblioteca, según corresponda.
- Títulos hasta 160 caracteres, carpeta/categoría hasta 80, párrafos/citas/transcripciones hasta 100.000; elementos de lista hasta 10.000, descripciones de imagen hasta 1.000, pies hasta 2.000.
- Campos desconocidos, imágenes ausentes, identificadores duplicados y permisos inválidos bloquean la importación.

## Permisos y archivos

Cada página es `gm` por defecto. `jugadores` concede lectura a todos los jugadores desde la importación. Una nota de tipo `dm` rechaza cualquier página configurada para jugadores. No hay cambios automáticos de visibilidad: el DM decide cuándo compartirlas.

Si se comparte una página, el diario recibe permiso de observador y las demás páginas conservan su permiso explícito. Su título puede ser visible: no incluir secretos en un título que se vaya a compartir. Las láminas y sus transcripciones se comparten juntas al importar.

Al importar, las imágenes usadas por los diarios seleccionados se suben a `data/escriba-oveja/<carpeta-aleatoria>/` mediante la API de archivos de Foundry. Se reutilizan dentro de una misma operación y no se sobrescriben recursos de otros diarios. No se guardan imágenes dentro de la carpeta del módulo, por lo que una actualización de código no las elimina.

**Los permisos del diario no protegen las URLs de sus imágenes.** El almacenamiento de archivos de Foundry tiene su propio comportamiento de acceso. Mantener una página oculta evita mostrarla en el diario; no debe interpretarse como cifrado o control de acceso a cada archivo de imagen. Evitar incluir secretos exclusivamente del DM en imágenes que requieran confidencialidad de archivo.

## Duplicados y fallos

La identidad sigue siendo `paquete + id de nota`, tanto en v1 como en v2. Reimportar omite el diario existente, incluso si el archivo nuevo cambia su texto o versión. No lo actualiza ni reemplaza. Para un expediente realmente distinto se utiliza otro identificador; no cambiar identificadores como mecanismo habitual de reintento.

Se validan las imágenes antes de escribir. Para cada diario se cargan todas sus imágenes antes de crearlo. Ante un error se detiene el lote, se conservan los diarios anteriores y se informa lo ocurrido. Las imágenes ya cargadas pueden quedar sin utilizar; el informe indica su carpeta, que el GM podrá revisar. No se borran recursos automáticamente. Un reintento crea una carpeta nueva y omite los diarios ya presentes. Usar una sola sesión GM para importar el mismo paquete.

## Encargo para preparar el expediente real

> Prepará un archivo único `.oveja.json` de Escriba Oveja v2. Usá un solo diario para el expediente y páginas ordenadas para inspección/peritajes, autopsias y cierre. Incorporá las capturas reales como imágenes incluidas; si usás láminas completas, agregá su transcripción fiel. Mantené los secretos del DM fuera del informe destinado a jugadores y no inventes pruebas ni observaciones que las fuentes no sostengan. Todas las páginas deben comenzar en `gm`. Conservá el contenido editable mediante bloques o transcripciones. Entregá el archivo final con las imágenes codificadas dentro; no macros, HTML suelto ni pasos de carga manual de imágenes.

El contrato está implementado y probado localmente. La apariencia dentro de la hoja nativa de Foundry, sus permisos reales y la carga de archivos en el servidor concreto deben comprobarse en Foundry 14.364 antes de dar el expediente por instalado y validado.

Referencias: [FilePicker v14](https://foundryvtt.com/api/classes/foundry.applications.apps.FilePicker.html) y [JournalEntryPage v14](https://foundryvtt.com/api/classes/foundry.documents.JournalEntryPage.html).
