# Historial de versiones

## 0.2.0

- Formato v2 para libros y expedientes de múltiples páginas en un único `.oveja.json`.
- Imágenes PNG, JPEG y WebP incluidas en base64, validadas y subidas mediante FilePicker al importar.
- Páginas editables con títulos, párrafos, citas, listas e imágenes; estilos simple, expediente y pergamino.
- Láminas completas como páginas de imagen, con transcripción editable y el mismo permiso de lectura.
- Previsualización de cada página con sus imágenes antes de escribir en Foundry.
- Conservación del formato v1, selección de diarios y detección de duplicados.
- Comprobación de imágenes antes de cualquier escritura; errores parciales informados, sin crear diarios con imágenes faltantes.
- Ejemplo ilustrado técnico, sin contenido ni imágenes del caso real del Barrio Sur.
- Instalador Linux con validación SHA-256, respaldo recuperable, rollback y alcance exclusivo a Escriba Oveja.

Validación local: 26 pruebas automatizadas y 6 comprobaciones de navegador aprobadas; capturas revisadas. El navegador usa adaptadores Foundry simulados. Pendientes: instalación en el servidor del usuario, prueba en Foundry 14.364 y permisos reales GM/jugador.

## 0.1.0

Primera versión pública de Escriba Oveja para Foundry VTT 14.

- Importación de archivos `.oveja.json` con notas de lore y del DM.
- Categorías como carpetas y una entrada de diario por nota.
- Variaciones como páginas adicionales y guía privada de descubrimiento.
- Visibilidad por página, privada por defecto.
- Revisión de contenido, destino y selección antes de importar.
- Detección de notas ya importadas por paquete e identificador.
- Informe de errores parciales y reintento sin duplicar lo creado.
- Formato documentado y ejemplo con tres notas relacionadas.

Validación: 13 pruebas automatizadas y comprobación de sintaxis y recursos. La prueba integrada dentro de Foundry y la comprobación de permisos desde una cuenta de jugador siguen pendientes; el manifiesto no declara una versión verificada.
