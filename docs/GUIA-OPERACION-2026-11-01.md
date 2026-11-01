# Guía de operación — Eco Místico — Escriba Oveja

Registro documental del **01/11/2026**, versión de esta guía **1**. Código de referencia: [`main`](https://github.com/188233/eco-mistico-escriba-oveja/tree/main), manifiesto **0.2.0**, id instalable `eco-mistico-escriba-oveja`. Este commit es sólo documentación: no cambia el runtime, una release ni el estado de un mundo.

## Requisitos y autoría

Importa notas y expedientes ilustrados desde un único archivo, con páginas editables, láminas, imágenes incluidas y permisos por página.

Compatibilidad declarada en el manifiesto: `{"maximum": "14", "minimum": "14"}`. Un campo `verified` es una declaración del paquete, no una prueba ejecutada por esta actualización. Dependencias declaradas: No se declaran dependencias obligatorias en este manifiesto; revisar también los límites de integración descritos abajo.

El código funcional pertenece al proyecto Eco Místico. Los contenidos, ilustraciones y dependencias conservan sus autores y licencias; esta guía no los redistribuye.

## Instalación y habilitación

1. Elegir la distribución exacta y sus requisitos en el [README existente](../README.md) y las [publicaciones del repositorio](https://github.com/188233/eco-mistico-escriba-oveja/releases). Una rama de fuentes no garantiza que exista un ZIP publicado con esa versión. No usar automáticamente latest si se necesita este corte.
2. Respaldar el código anterior y el mundo antes de una actualización. Si el proyecto ofrece instalador/restaurador versionado, usar el par correspondiente y su modo de comprobación; respetar cualquier ventana de mantenimiento que exija.
3. En instalación manual, con el mundo detenido en una ventana acordada, extraer sólo el módulo en `Data/modules/eco-mistico-escriba-oveja`. Debe existir un único `module.json`, sin carpetas duplicadas. No cambiar permisos del servidor para resolver una descarga.
4. Abrir el mundo compatible, habilitar el módulo y sus dependencias en Administrar módulos y guardar. Recargar los clientes cuando Foundry lo solicite. Archivo instalado, módulo habilitado y código cargado son estados distintos.

La actualización de esta guía no ejecutó esos pasos ni detuvo servicios. Un repositorio privado requiere descarga con una autenticación ya autorizada; no pegar tokens en manifiestos, comandos compartidos o el chat.

## Uso

Como GM, abrir Escriba Oveja desde Diarios o la pluma. Elegir .oveja.json; revisar textos, páginas, medios y visibilidad, desmarcar entradas no deseadas e importar. Revisar el informe de creados y omitidos. Los ejemplos ilustrados comienzan privados.

## Configuración no secreta

Usar el contrato v1/v2 descrito en el README. La visibilidad se decide por página; revisar permisos antes de compartir. Los medios incluidos no necesitan claves de IA.

## Recuperación

Conservar el archivo de entrada y el informe. Revisar diarios e identidades ya importadas antes de repetir para evitar duplicados. Para deshacer cambios de contenido usar respaldo del mundo o retirar únicamente los diarios identificados de la importación tras revisarlos; no existe una promesa de Undo universal.

## Estado real y límites

Repositorio público: esta guía contiene sólo información general del producto. La versión 0.2.0 declara generación 14; su README deja la prueba funcional real pendiente. No se subieron expedientes, textos de campaña ni imágenes.

Se verificaron el manifiesto y el README de la rama remota señalada, y que esta entrega modifica sólo esta guía. Las pruebas o ensayos históricos conservan su alcance y sus registros originales. No se ejecutaron pruebas nuevas sobre documentos de campaña ni se certifica compatibilidad con versiones no ensayadas.

## Resolución de problemas

- Si no aparece el módulo, comprobar id/carpeta, manifiesto, dependencias y el registro de paquetes de Foundry antes de reinstalar. No editar bases de datos en caliente.
- Si aparece habilitado pero no hay control/interfaz, recargar el cliente y comprobar rol y versión; no ampliar privilegios para evitar un rechazo.
- Si hay un error de escritura, conservar el informe y comprobar el resultado real antes de repetir. Un mensaje de error no demuestra que no hubo cambios.
- Antes de compartir diagnósticos, retirar claves, rutas privadas, nombres/IDs de campaña, datos personales y medios sin permiso.

El [README](../README.md) y los contratos e instaladores de esta rama conservan los detalles específicos. Las instrucciones antiguas continúan como historia; la versión de referencia se identifica arriba mediante su manifiesto.
