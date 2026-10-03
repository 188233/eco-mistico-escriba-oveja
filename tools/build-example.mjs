import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { normalizePackage } from "../scripts/format.js";

// Diagrama técnico de demostración: no representa una escena ni evidencia del caso real.
const diagram = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
<rect width="960" height="560" fill="#eee8d6"/><rect x="20" y="20" width="920" height="520" fill="none" stroke="#9b8c69" stroke-width="2"/>
<text x="480" y="75" text-anchor="middle" font-family="Georgia" font-size="30" fill="#302d27">PLANO DE DEMOSTRACIÓN</text>
<text x="480" y="109" text-anchor="middle" font-family="Arial" font-size="17" fill="#675e4d">Ejemplo técnico · No corresponde al expediente del Barrio Sur</text>
<g fill="#faf6eb" stroke="#544e40" stroke-width="5"><rect x="125" y="160" width="315" height="280"/><rect x="440" y="160" width="395" height="280"/></g>
<rect x="435" y="270" width="10" height="78" fill="#faf6eb"/>
<g font-family="Arial" font-size="24" fill="#302d27" text-anchor="middle"><text x="280" y="302">Sala A</text><text x="635" y="302">Sala B</text></g>
<path d="M280 350H640" fill="none" stroke="#98815b" stroke-width="3" stroke-dasharray="9 9"/>
<text x="480" y="495" text-anchor="middle" font-family="Arial" font-size="18" fill="#675e4d">Las imágenes viajan dentro del archivo .oveja.json</text></svg>`;
const plate = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="#f5efdf"/><rect x="35" y="35" width="730" height="930" fill="none" stroke="#9b8c69" stroke-width="3"/>
<g text-anchor="middle" fill="#302d27" font-family="Georgia"><text x="400" y="130" font-size="22">ARCHIVO DE DEMOSTRACIÓN</text><text x="400" y="215" font-size="42">Resolución de prueba</text>
<path d="M130 260H670" stroke="#9b8c69" stroke-width="2"/>
<text x="400" y="360" font-size="23">Esta lámina conserva su diseño original.</text><text x="400" y="410" font-size="23">Se importa como página de imagen.</text>
<text x="400" y="520" font-size="23">La transcripción queda disponible</text><text x="400" y="560" font-size="23">en una página de texto editable.</text>
<text x="400" y="800" font-size="26">EJEMPLO · SIN VALOR DE EVIDENCIA</text><text x="400" y="870" font-size="18">No contiene hechos del caso del Barrio Sur.</text></g></svg>`;
const images = [];
for (const [id, svg] of [["plano-demo", diagram], ["resolucion-demo", plate]]) {
  images.push({ id, mime: "image/png", base64: (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64") });
}
const pkg = normalizePackage({
  formato: "escriba-oveja", version: 2, paquete: "demo-expediente-v2", titulo: "Expediente ilustrado · Demostración",
  config: { carpeta: "Escriba Oveja · Pruebas" }, imagenes: images,
  notas: [{ id: "expediente-demo", titulo: "Expediente de demostración", tipo: "lore", categoria: "Expedientes", config: { estilo: "expediente" },
    paginas: [
      { id: "inspeccion", titulo: "I. Inspección", tipo: "texto", config: { visibilidad: "gm" }, bloques: [
        { tipo: "parrafo", texto: "Este documento demuestra cómo importar un expediente con imágenes incluidas. Su contenido es de prueba; no describe la casa ni las pruebas del caso del Barrio Sur." },
        { tipo: "imagen", archivo: "plano-demo", descripcion: "Plano esquemático de dos salas utilizado solamente para probar la importación.", pie: "Figura 1 · Diagrama técnico de demostración." },
        { tipo: "titulo", texto: "Observaciones" },
        { tipo: "lista", elementos: ["La imagen se carga automáticamente al importar.", "El texto sigue siendo editable en el diario."] }
      ] },
      { id: "dictamen", titulo: "II. Dictamen de prueba", tipo: "texto", config: { visibilidad: "gm" }, bloques: [
        { tipo: "titulo", texto: "Alcance del documento" },
        { tipo: "parrafo", texto: "Esta página permite comprobar el orden de lectura y la conservación de párrafos. El informe de autopsia real se incorporará posteriormente con sus fuentes." },
        { tipo: "cita", texto: "Ninguna imagen o afirmación de este ejemplo debe utilizarse como evidencia narrativa." }
      ] },
      { id: "cierre", titulo: "III. Resolución de prueba", tipo: "lamina", archivo: "resolucion-demo", descripcion: "Lámina de demostración con su resolución de prueba.",
        transcripcion: "ARCHIVO DE DEMOSTRACIÓN\n\nResolución de prueba\n\nEsta lámina conserva su diseño original. Se importa como página de imagen.\n\nLa transcripción queda disponible en una página de texto editable.\n\nEJEMPLO · SIN VALOR DE EVIDENCIA\nNo contiene hechos del caso del Barrio Sur.", config: { visibilidad: "gm" } }
    ] }]
});
writeFileSync(new URL("../examples/expediente-demo.oveja.json", import.meta.url), JSON.stringify(pkg, null, 2) + "\n");
console.log("Ejemplo generado: 1 diario, 3 páginas de entrada, 4 páginas nativas y 2 imágenes incluidas.");
