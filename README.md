# Eco Místico — Escriba Oveja

Importación de notas y expedientes ilustrados desde archivos `.oveja.json` a diarios de Foundry VTT 14. Cada nota crea un diario organizado por categoría, con visibilidad independiente por página.

**Versión 0.2.0:** incorpora libros de varias páginas, imágenes incluidas y láminas con transcripción. Para el servidor Ubuntu existente, usá el [bloque de instalación Linux](docs/INSTALL-UBUNTU.txt): valida la descarga antes de detener el servicio, respalda el módulo anterior y actualiza solamente Escriba Oveja. La prueba funcional dentro de Foundry sigue pendiente.

## Instalar y usar

1. En la configuración inicial de Foundry, abrí **Módulos adicionales → Instalar módulo** y pegá esta URL en **URL del manifiesto**:

   ```text
   https://github.com/188233/eco-mistico-escriba-oveja/releases/latest/download/module.json
   ```

2. Instalá el módulo y activá **Eco Místico — Escriba Oveja** desde Administrar módulos del mundo.
3. Entrá como GM y abrí **Escriba Oveja** desde el directorio de diarios o el control lateral con la pluma.
4. Elegí el archivo `.oveja.json`. Revisá destinos, textos, variaciones y visibilidad; desmarcá las notas que no quieras importar.
5. Pulsá **Importar**. El informe identifica los diarios creados y las notas ya importadas que se omitieron.

El botón **Ejemplo de notas** entrega tres notas conectadas en formato v1. **Ejemplo ilustrado** entrega un diario de demostración en formato v2 con dos imágenes incluidas: inspección, dictamen, lámina de cierre y transcripción. Todas sus páginas comienzan privadas. Podés habilitar su lectura desde los permisos de cada página cuando los personajes las descubran.

También podés descargar el ZIP desde [Releases](https://github.com/188233/eco-mistico-escriba-oveja/releases/latest). Para una instalación manual, con Foundry detenido, descomprimilo en `Data/modules`: debe quedar `Data/modules/eco-mistico-escriba-oveja/module.json`.

Acceso alternativo con una macro de tipo Script:

```js
game.modules.get("eco-mistico-escriba-oveja").api.open();
```

## Contrato y alcance

- [Formato y encargo reutilizable](docs/FORMATO.md).
- [Formato v2: expedientes ilustrados](docs/EXPEDIENTES.md).
- [Ejemplo de tres notas](examples/tres-notas.oveja.json).
- [Ejemplo ilustrado autocontenido](examples/expediente-demo.oveja.json).
- V1 conserva texto plano, categorías, variaciones y visibilidad GM/todos los jugadores.
- V2 añade bloques de texto, encabezados, citas, listas e imágenes, con estilos simple, expediente y pergamino; también admite láminas completas como páginas de imagen con transcripción editable.
- Todo privado por defecto; el tipo `dm` impide configurar páginas públicas en el archivo.
- No requiere Core, dnd5e, servicios externos ni claves.
- Reimportar omite diarios con la misma identidad; no reemplaza cambios hechos en Foundry.
- Las condiciones de descubrimiento son indicaciones para el DM; no revelan páginas automáticamente.
- Las imágenes viajan dentro del JSON y se suben automáticamente al almacenamiento `data` de Foundry al importar. No requieren copiar archivos, macros ni HTML manual.
- El módulo solo genera HTML a partir de bloques permitidos. No importa HTML/CSS/scripts arbitrarios ni JSON nativo de un diario o una macro.

## Validación

Instalá las dependencias de desarrollo con `pnpm install --frozen-lockfile`, luego ejecutá `node --test` y `node tools/check.mjs`. Para el ensayo en navegador: `node tools/browser-smoke.mjs` (Microsoft Edge instalado; admite otro canal con `OVEJA_BROWSER_CHANNEL`). Las dependencias son solo de desarrollo y no se distribuyen en el módulo.

Se verifican validación, permisos generados, duplicados, imágenes PNG/JPEG/WebP, archivos corruptos, fallos parciales y la interfaz. El navegador usa documentos y almacenamiento simulados: no sustituye una prueba dentro de Foundry. Esta entrega apunta a v14 y no declara una versión `verified` hasta probarla en el mundo real.

Comprobación manual en Foundry: importar el ejemplo, verificar sus tres diarios y sus páginas privadas, reimportarlo y comprobar que no duplica. Luego probar una copia del ejemplo con una página `jugadores`, entrar como jugador y verificar que solamente esa página se ve y que la guía del DM permanece oculta. Probar también desmarcar una nota y cargar un JSON inválido después de uno válido.

Para v2, importar el ejemplo ilustrado: debe crear un solo diario con cuatro páginas y dos imágenes persistentes al recargar Foundry. Comprobar lámina, transcripción, edición de textos y permisos mixtos desde un jugador. Las imágenes son recursos del almacenamiento de Foundry: los permisos de un diario no constituyen control de acceso a sus URLs.

## Empaquetar

En PowerShell: `powershell -NoProfile -File tools/build-package.ps1`. Genera en `dist` el ZIP instalable y una copia de `module.json`. El paquete incluye solamente los archivos de distribución; el código de desarrollo y las pruebas quedan en el repositorio.

Después ejecutar `node tools/build-install-manifest.mjs` para generar el manifiesto con SHA-256 y copiar el instalador Linux a `dist`. Adjuntar ambos archivos junto al ZIP y `module.json` a la release correspondiente. Pruebas del instalador: `python3 -m unittest discover -s tests -p "test_installer.py"`.

## Licencia

MIT. Copyright © 2026 Fabián Benítez — Eco Místico Studios. Ver [LICENSE](LICENSE).
