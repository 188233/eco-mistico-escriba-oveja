# Eco Místico — Escriba Oveja

Primera versión: importación de notas narrativas desde archivos `.oveja.json` a diarios de Foundry VTT 14. Cada nota crea un diario organizado por categoría. Sus variaciones se convierten en páginas adicionales, con visibilidad independiente.

## Instalar y usar

1. En la configuración inicial de Foundry, abrí **Módulos adicionales → Instalar módulo** y pegá esta URL en **URL del manifiesto**:

   ```text
   https://github.com/188233/eco-mistico-escriba-oveja/releases/latest/download/module.json
   ```

2. Instalá el módulo y activá **Eco Místico — Escriba Oveja** desde Administrar módulos del mundo.
3. Entrá como GM y abrí **Escriba Oveja** desde el directorio de diarios o el control lateral con la pluma.
4. Elegí el archivo `.oveja.json`. Revisá destinos, textos, variaciones y visibilidad; desmarcá las notas que no quieras importar.
5. Pulsá **Importar**. El informe identifica los diarios creados y las notas ya importadas que se omitieron.

El botón **Descargar ejemplo** entrega tres notas conectadas listas para probar. Todas sus páginas comienzan privadas. Podés habilitar su lectura desde los permisos de cada página cuando los personajes las descubran.

También podés descargar el ZIP desde [Releases](https://github.com/188233/eco-mistico-escriba-oveja/releases/latest). Para una instalación manual, con Foundry detenido, descomprimilo en `Data/modules`: debe quedar `Data/modules/eco-mistico-escriba-oveja/module.json`.

Acceso alternativo con una macro de tipo Script:

```js
game.modules.get("eco-mistico-escriba-oveja").api.open();
```

## Contrato y alcance

- [Formato y encargo reutilizable](docs/FORMATO.md).
- [Ejemplo de tres notas](examples/tres-notas.oveja.json).
- Solo texto plano, categorías, notas del DM/lore, variaciones y visibilidad GM/todos los jugadores.
- Todo privado por defecto; el tipo `dm` impide configurar páginas públicas en el archivo.
- No requiere Core, dnd5e, servicios externos ni claves.
- Reimportar omite diarios con la misma identidad; no reemplaza cambios hechos en Foundry.
- Las condiciones de descubrimiento son indicaciones para el DM; no revelan páginas automáticamente.

## Validación

Ejecutar `node --test` y `node tools/check.mjs` dentro de esta carpeta. Las pruebas cubren validación, permisos generados, duplicados, errores parciales y la interfaz con un entorno simulado. No sustituyen una prueba dentro de Foundry: esta entrega apunta a v14 y no declara una versión `verified` hasta probarla en el mundo real.

Comprobación manual en Foundry: importar el ejemplo, verificar sus tres diarios y sus páginas privadas, reimportarlo y comprobar que no duplica. Luego probar una copia del ejemplo con una página `jugadores`, entrar como jugador y verificar que solamente esa página se ve y que la guía del DM permanece oculta. Probar también desmarcar una nota y cargar un JSON inválido después de uno válido.

## Empaquetar

En PowerShell: `powershell -NoProfile -File tools/build-package.ps1`. Genera en `dist` el ZIP instalable y una copia de `module.json`. El paquete incluye solamente los archivos de distribución; el código de desarrollo y las pruebas quedan en el repositorio.

## Licencia

MIT. Copyright © 2026 Fabián Benítez — Eco Místico Studios. Ver [LICENSE](LICENSE).
