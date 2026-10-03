# Formato Escriba Oveja · versión 1

Este formato sigue siendo compatible en el módulo 0.2.0. Para un único diario con varias páginas e imágenes incluidas, usá el [formato v2 de expedientes](EXPEDIENTES.md).

Un archivo UTF-8 `nombre.oveja.json` contiene un paquete de hasta 100 notas y pesa como máximo 2 MB. Puede generarse junto con el contenido narrativo para que el DM solamente tenga que descargarlo e importarlo.

```json
{
  "formato": "escriba-oveja",
  "version": 1,
  "paquete": "mi-campana-sesion-01",
  "titulo": "Pistas de la primera sesión",
  "config": { "carpeta": "Mi campaña" },
  "notas": [
    {
      "id": "carta-encontrada",
      "tipo": "lore",
      "categoria": "Documentos",
      "titulo": "La carta encontrada",
      "texto": "No regreses al molino.\n\nTe esperan al otro lado del río.",
      "config": { "visibilidad": "gm" },
      "variaciones": [
        {
          "id": "mensaje-oculto",
          "titulo": "El mensaje oculto",
          "texto": "La llave está bajo la tercera piedra.",
          "condicion": "Revelar cuando examinen la carta a contraluz.",
          "config": { "visibilidad": "gm" }
        }
      ]
    }
  ]
}
```

## Campos del paquete

| Campo | Obligatorio | Significado |
| --- | --- | --- |
| `formato` | Sí | Siempre `escriba-oveja`. |
| `version` | Sí | Número `1`. |
| `paquete` | Sí | Identidad estable del lote. |
| `titulo` | Sí | Nombre que se muestra durante la revisión. |
| `config.carpeta` | No | Carpeta raíz de diarios; por defecto `Escriba Oveja`. Nombre literal, no ruta. |
| `notas` | Sí | Entre 1 y 100 notas. |

## Campos de cada nota

| Campo | Obligatorio | Significado |
| --- | --- | --- |
| `id` | Sí | Identidad estable y única dentro del paquete. |
| `titulo` | Sí | Nombre del diario y de la página principal. |
| `texto` | Sí | Texto plano, hasta 100.000 caracteres. |
| `tipo` | No | `lore` (por defecto) o `dm`. |
| `categoria` | No | Subcarpeta de destino; por defecto `Lore` o `Notas del DM`, según el tipo. |
| `config.visibilidad` | No | `gm` (por defecto) o `jugadores`, para la página principal. |
| `variaciones` | No | Hasta 20 páginas adicionales; por defecto ninguna. |

Las variaciones contienen `id`, `titulo`, `texto`, `config.visibilidad` y, opcionalmente, `condicion`. Esta última es una indicación para el DM, de hasta 4.000 caracteres. Las condiciones se reúnen en una página privada llamada **Guía de descubrimiento · DM**. Una variación puede ser una traducción, un rumor alternativo, una pista ampliada o una segunda lectura del mismo documento. No reemplaza el texto principal ni se activa automáticamente.

Cada variación es privada por defecto, aunque la página principal sea pública. Una nota de tipo `dm` no admite páginas para jugadores: se rechaza el paquete si las declara.

Los identificadores usan minúsculas, números, guiones o guiones bajos; comienzan con letra o número y admiten hasta 80 caracteres. Los títulos admiten 160 caracteres; carpeta y categoría, 80. Los campos desconocidos y los valores inválidos bloquean la lectura, con su ubicación indicada. Los campos opcionales deben omitirse si no se usan, en lugar de enviar `null`.

## Resultado en Foundry

`config.carpeta → categoria → diario con el titulo de la nota → página principal + variaciones + guía privada, si hay condiciones`.

Todo se importa a diarios del mundo, no a compendios. Es independiente del sistema de juego y del Core de Eco Místico. Los nombres de carpetas se reutilizan si existe una sola coincidencia bajo el mismo padre; nombres ambiguos detienen la importación.

`jugadores` concede lectura a todos los jugadores de esa página desde la importación. Si alguna página se comparte, el diario permite acceso de observador para que puedan encontrarlo; las demás páginas siguen con permiso explícito de ninguno. Usá un título del diario que no revele secretos si vas a compartir alguna página. No se asigna propiedad de edición a jugadores.

Para descubrimientos futuros, dejá todas las páginas en `gm` y compartilas cuando corresponda desde los permisos nativos de Foundry. Las condiciones son texto para el DM, sin tiradas, disparadores ni cambios automáticos de visibilidad.

La pareja `paquete + id de nota` evita repetir una importación: si ya existe, la nota se omite. En v1 no se actualizan diarios existentes ni se fusionan páginas. Si un envío falla a mitad, se conservan los diarios creados y el informe indica el error. Se puede reintentar el archivo para crear lo pendiente; pueden quedar carpetas vacías. Importá desde una sola sesión de GM a la vez.

Texto plano significa que se conservan párrafos y saltos de línea, pero no se interpreta HTML, Markdown, macros, tiradas ni enlaces enriquecidos de Foundry. No se aceptan imágenes, scripts, UUID, permisos arbitrarios ni flags enviados por el archivo.

## Encargo reutilizable

> Creá un archivo descargable `.oveja.json` con formato Escriba Oveja versión 1, siguiendo este contrato. Incluí las notas que te pida, con título, texto y categoría. Agregá variaciones solo cuando tengan sentido y describí en `condicion` cuándo podría descubrirse cada una. Usá `gm` en todas las páginas salvo que pida compartirlas con todos los jugadores desde el inicio. Conservá identificadores estables. Entregá JSON válido en UTF-8, sin bloques Markdown dentro del archivo. No inventes hechos de campaña que contradigan la información que te doy.

Referencia técnica: [JournalEntry de Foundry v14](https://foundryvtt.com/api/classes/foundry.documents.JournalEntry.html), [JournalEntryPage](https://foundryvtt.com/api/classes/foundry.documents.JournalEntryPage.html) y [diarios y permisos](https://foundryvtt.com/article/journal/).
